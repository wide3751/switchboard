import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Billing, Density, Field, Group, Locale, Report, SessionCard, Snapshot, Task, View } from '../types'
import {
  DEFAULT_FIELDS,
  PRESETS,
  applyPlan,
  branchLabel,
  fitToWidth,
  commonModel,
  configDirOf,
  connectorsOf,
  countTasks,
  countWaiting,
  densityOf,
  estimateWidth,
  groupOf,
  describeProgress,
  desktopLinkOf,
  locationOf,
  parseAlive,
  parseGitStatus,
  parseNumstat,
  parsePullRequest,
  parseRecord,
  parseReport,
  progressOfTodos,
  questionOf,
  rateKind,
  shortAge,
  shortModel,
  staleReports,
  summarizeReply,
  summarizeTool,
  taskStatusOf,
  wrapUpQuestionOf,
  toCards,
  usageBar,
  usageColor,
} from './board'
import type { PlanItem } from './board'
import { LOCALES, firstAppleLanguage, localeOf, messagesOf } from './i18n'
import type { Messages } from './i18n'

// 指令來自 commands/open.md，以 plugin 名稱為命名空間
const COMMAND = 'switchboard:open'
const PANE = 'switchboard'
const TITLE = 'Switchboard'
/** 作者的 GitHub */
const AUTHOR_URL = 'https://github.com/wide3751'

/** Pane 標題：有待處理時帶上數量，分頁標籤上就看得到 */
const titleOf = (needsYou: number): string => (needsYou > 0 ? `${TITLE} · ${needsYou}` : TITLE)
const POLL_MS = 3000
/** Desktop 的任務清單工具 */
const PLAN_TOOL = 'mcp__ccd_turn__update_plan'
const WRAP_UP_TOOL = 'mcp__ccd_turn__wrap_up'
const VIEW_KEY = 'view'
/** 回合出錯但沒有訊息時的標記 */
const API_ERROR = 'api-error'

/** 狀態的圖示、顏色與外框：重要程度主要靠外框粗細區分，顏色只是輔助 */
const LOOK: Record<SessionCard['status'], { glyph: string; color: string }> = {
  waiting: { glyph: '▲', color: 'warning' },
  busy: { glyph: '◉', color: 'claude' },
  idle: { glyph: '○', color: 'inactive' },
  errored: { glyph: '✕', color: 'error' },
  unknown: { glyph: '◌', color: 'inactive' },
}

/** 檢視面板裡可以開關的欄位，依卡片上的順序 */
const FIELDS: readonly Field[] = [
  'time',
  'location',
  'branch',
  'progress',
  'activity',
  'changes',
  'context',
  'pr',
  'environment',
  'connectors',
  'reply',
  'tasks',
  'model',
  'usage',
  'source',
  'path',
]

const DENSITIES: readonly Density[] = ['compact', 'standard', 'detailed']

const GROUPS: readonly Group[] = ['waiting', 'busy', 'idle']

const DEFAULT_VIEW: View = {
  fields: {
    waiting: [...DEFAULT_FIELDS.waiting],
    busy: [...DEFAULT_FIELDS.busy],
    idle: [...DEFAULT_FIELDS.idle],
  },
  isIdleCollapsed: false,
  billing: 'auto',
  locale: 'auto',
  autoOpen: true,
}

const BILLINGS: readonly Billing[] = ['auto', 'subscription', 'api']

const snapshot = atom({ plugin: 'switchboard', key: 'snapshot' } as const, null)
const view = atom({ plugin: 'switchboard', key: 'view' } as const, DEFAULT_VIEW)
const isSettingsOpen = atom({ plugin: 'switchboard', key: 'isSettingsOpen' } as const, false)
const settingsGroup = atom({ plugin: 'switchboard', key: 'settingsGroup' } as const, 'busy')
const expanded = atom({ plugin: 'switchboard', key: 'expanded' } as const, [])
const isBoardOpen = atom({ plugin: 'switchboard', key: 'isBoardOpen' } as const, false)

// 用到 $ 的函式都寫在這個檔案：Desktop 自帶的 Claude Code 不讓 $ 跨 import 傳遞

async function configDir($: EngineInterface): Promise<string> {
  return configDirOf(await $.env.get('CLAUDE_CONFIG_DIR'), await $.env.get('HOME'))
}

// ── 回報者：每個 Session 寫出自己的狀態回報 ──────────────────────────

// 這個 Session 的回報；模組重新載入時從頭開始
let own: Report | null = null
let plan: PlanItem[] = []
/** 這個回合結尾提問框的問題；回合結束時才寫進回報，等使用者回覆 */
let closingQuestion: Report['question'] = null

// git 一律關掉 repo 設定裡可能執行外部程式的功能（fsmonitor、外部 diff、textconv），
// 這些指令會在每個 Session 的工作目錄自動執行
const GIT = ['git', '-c', 'core.fsmonitor=', '-c', 'core.untrackedCache=false', '--no-optional-locks'] as const

async function git($: EngineInterface, args: readonly string[]): Promise<string | null> {
  const { exitCode, stdout } = await $.process.run([...GIT, ...args], { timeoutMs: 5000 })

  return exitCode === 0 ? stdout : null
}

/** 基底分支：origin 的預設分支，沒有時依序試 main、master。 */
async function baseBranch($: EngineInterface): Promise<string | null> {
  const head = await git($, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])
  if (head !== null && head.trim() !== '') return head.trim()
  for (const name of ['main', 'master']) {
    if ((await git($, ['rev-parse', '--verify', '--quiet', name])) !== null) return name
  }

  return null
}

async function readBranch($: EngineInterface): Promise<Report['branch']> {
  try {
    const status = await git($, ['status', '--porcelain=v2', '--branch'])
    const branch = status === null ? null : parseGitStatus(status)
    if (branch === null) return null
    // 和 Desktop 的 Changes 一致：相對基底分支的分岔點，含未 commit 的變更
    const base = await baseBranch($)
    const from = base === null ? null : await git($, ['merge-base', 'HEAD', base])
    const diff = await git($, ['diff', '--no-ext-diff', '--no-textconv', '--numstat', from?.trim() || 'HEAD'])
    if (diff === null) return branch

    return { ...branch, ...parseNumstat(diff), ...(base === null ? {} : { base }) }
  } catch {
    return null
  }
}

/** MCP 連接器：從這個 Session 的工具清單推出。 */
async function readConnectors($: EngineInterface): Promise<Report['connectors']> {
  try {
    return connectorsOf(await $.tool.list())
  } catch {
    return null
  }
}

/** 這個分支的 Pull Request（需要 gh CLI 並已登入）；查不到時是 null。 */
async function readPullRequest($: EngineInterface): Promise<Report['pr']> {
  try {
    const { exitCode, stdout } = await $.process.run(['gh', 'pr', 'view', '--json', 'number,state,url'], {
      timeoutMs: 8000,
    })

    return exitCode === 0 ? parsePullRequest(stdout) : null
  } catch {
    return null
  }
}

async function readUsage(
  $: EngineInterface,
): Promise<Pick<Report, 'contextPercent' | 'costUsd' | 'turns' | 'rateLimits'>> {
  try {
    const usage = await $.session.usage()

    return {
      contextPercent: usage.context.percent ?? null,
      costUsd: usage.cost?.usd ?? null,
      turns: await $.session.turns(),
      rateLimits: usage.rateLimits.map(one => ({
        kind: one.kind,
        percentUsed: one.percentUsed,
        ...(one.resetsAt === undefined ? {} : { resetsAt: one.resetsAt }),
      })),
    }
  } catch {
    return { contextPercent: null, costUsd: null, turns: null, rateLimits: [] }
  }
}

// 還沒收到完成通知的背景 Bash：tool_use_id → 摘要
const backgroundBash = new Map<string, string>()

/** 背景任務：這個 Session 的 Agent，加上還在跑的背景 Bash。 */
async function readTasks($: EngineInterface): Promise<Task[]> {
  let agents: Task[] = []
  try {
    agents = (await $.agent.list()).map(one => ({
      kind: 'agent' as const,
      label: `${one.type}·${one.name ?? one.description}`,
      status: taskStatusOf(one.status),
    }))
  } catch {
    // 拿不到 Agent 清單時只列背景 Bash
  }
  const bash = [...backgroundBash.values()].map(label => ({ kind: 'bash' as const, label, status: 'running' as const }))

  return [...agents, ...bash]
}

/** 合併這次的變化並寫出回報；任何失敗都不能影響 Session 本身。 */
async function writeReport($: EngineInterface, patch: Partial<Report>) {
  try {
    if (own === null) {
      own = {
        sessionId: await $.session.id(),
        reportedAt: 0,
        model: null,
        branch: null,
        progress: null,
        activity: null,
        turnStartedAt: null,
        turns: null,
        contextPercent: null,
        costUsd: null,
        approval: null,
        question: null,
        turnError: null,
        lastReply: null,
        tasks: [],
        rateLimits: [],
        connectors: null,
        pr: null,
      }
    }
    own = { ...own, ...patch, reportedAt: await $.clock.now() }
    await $.fs.write(`${await configDir($)}/switchboard/reports/${own.sessionId}.json`, JSON.stringify(own))
  } catch {
    // 回報失敗時，監看視窗只顯示基本狀態
  }
}

// ── 監看視窗：只在打開 Pane 的 Session 裡 polling ─────────────────────

async function readTexts($: EngineInterface, dir: string): Promise<{ name: string; text: string }[]> {
  const entries = await $.fs.list(dir)
  const files = entries.filter(one => one.kind === 'file' && one.name.endsWith('.json'))
  const texts = await Promise.all(
    files.map(one =>
      $.fs
        .read(`${dir}/${one.name}`)
        .then(text => (typeof text === 'string' ? { name: one.name, text } : null))
        // 紀錄可能在列出之後、讀取之前被刪掉
        .catch(() => null),
    ),
  )

  return texts.filter(one => one !== null)
}

async function readReports($: EngineInterface, dir: string, sessionIds: readonly string[]): Promise<Map<string, Report>> {
  const reports = await Promise.all(
    sessionIds.map(id =>
      $.fs
        .read(`${dir}/${id}.json`)
        .then(text => (typeof text === 'string' ? parseReport(text) : null))
        // 沒載入 mod 的 Session 沒有回報
        .catch(() => null),
    ),
  )

  return new Map(reports.filter(one => one !== null).map(one => [one.sessionId, one]))
}

/** 刪掉已結束 Session 留下的回報（回報以明碼保存，不該一直留著）。 */
async function removeStaleReports($: EngineInterface, dir: string, knownIds: ReadonlySet<string>, now: number) {
  try {
    const stale = staleReports(await $.fs.list(dir), knownIds, now)
    if (stale.length > 0) await $.process.run(['rm', '-f', '--', ...stale.map(name => `${dir}/${name}`)])
  } catch {
    // 資料夾還不存在，或刪除失敗：下次掃描再試
  }
}

async function alivePids($: EngineInterface, pids: readonly number[]): Promise<Set<number>> {
  if (pids.length === 0) return new Set()
  // 一個都不存活時 ps 以 1 結束，輸出是空的
  const { stdout } = await $.process.run(['ps', '-o', 'pid=', '-p', pids.join(',')])

  return parseAlive(stdout)
}

/** 讀所有 session 紀錄與狀態回報、檢查 pid，算出這一次的結果。 */
async function scan($: EngineInterface): Promise<Snapshot> {
  const base = await configDir($)
  const scannedAt = await $.clock.now()
  let texts: { name: string; text: string }[]
  try {
    texts = await readTexts($, `${base}/sessions`)
  } catch {
    return { needsYou: 0, error: `${base}/sessions`, sessions: [], scannedAt }
  }
  const records = texts.map(one => parseRecord(one.name, one.text)).filter(one => one !== null)
  const alive = await alivePids($, [...new Set(records.map(one => one.pid))])
  const liveIds = records.filter(one => alive.has(one.pid)).flatMap(one => (one.sessionId === null ? [] : [one.sessionId]))
  const reports = await readReports($, `${base}/switchboard/reports`, liveIds)
  // 自己的回報一律保留，其餘不屬於任何 session 紀錄的才刪
  const knownIds = new Set(records.flatMap(one => (one.sessionId === null ? [] : [one.sessionId])))
  if (own !== null) knownIds.add(own.sessionId)
  await removeStaleReports($, `${base}/switchboard/reports`, knownIds, scannedAt)
  const cards = toCards(records, alive, reports)

  return {
    needsYou: countWaiting(cards),
    error: null,
    sessions: cards,
    scannedAt,
  }
}

let poller: { cancel: () => void } | undefined
let isScanning = false

async function poll($: EngineInterface) {
  if (isScanning) return
  isScanning = true
  try {
    // Pane 被關掉（不管是誰關的）就停止 polling
    const panes = await $.ui.panes()
    if (!panes.some(pane => pane.id === PANE)) {
      stopPolling()
      await update($, isBoardOpen, () => false)
      return
    }
    const next = await scan($)
    const previous = await read($, snapshot)
    await update($, snapshot, () => next)
    // 待處理數量變了就更新標題（同一個 id 再開一次只會改標題）
    if (previous === null || previous.needsYou !== next.needsYou) {
      await $.ui.open({ id: PANE, title: titleOf(next.needsYou) })
    }
  } finally {
    isScanning = false
  }
}

function startPolling($: EngineInterface) {
  if (poller !== undefined) return
  poller = $.clock.every(POLL_MS, () => poll($))
  void poll($)
}

function stopPolling() {
  poller?.cancel()
  poller = undefined
}

async function loadView($: EngineInterface) {
  const stored = (await $.store.get(VIEW_KEY)) as
    | { fields?: unknown; isIdleCollapsed?: unknown; billing?: unknown; locale?: unknown; autoOpen?: unknown }
    | undefined
  if (stored === undefined) {
    messages = messagesOf(await detectLocale($))
    return
  }
  const raw = stored.fields
  // 舊版存的是一份共用清單：套用到每一組
  const fields: View['fields'] = Array.isArray(raw)
    ? { waiting: [...raw], busy: [...raw], idle: [...raw] }
    : { ...DEFAULT_VIEW.fields, ...((raw ?? {}) as Partial<View['fields']>) }
  const billing = BILLINGS.find(one => one === stored.billing) ?? 'auto'
  const locale = LOCALES.find(one => one.locale === stored.locale)?.locale ?? 'auto'
  const autoOpen = stored.autoOpen !== false
  await update($, view, () => ({ fields, isIdleCollapsed: stored.isIdleCollapsed === true, billing, locale, autoOpen }))
  messages = messagesOf(locale === 'auto' ? await detectLocale($) : locale)
}

async function changeView($: EngineInterface, change: (current: View) => View) {
  const next = await update($, view, change)
  await $.store.set(VIEW_KEY, next)
}

async function toggleField($: EngineInterface, group: Group, field: Field) {
  await changeView($, current => {
    const list = current.fields[group]
    const next = list.includes(field) ? list.filter(one => one !== field) : [...list, field]

    return { ...current, fields: { ...current.fields, [group]: next } }
  })
}

async function setDensity($: EngineInterface, group: Group, density: Density) {
  await changeView($, current => ({
    ...current,
    fields: { ...current.fields, [group]: [...PRESETS[density]] },
  }))
}

// 目前的介面文字：依檢視設定的語言，自動時依系統語言
let messages: Messages = messagesOf('en')
let detectedLocale: Locale | null = null

/** 系統語言：LC_ALL、LANG，Desktop 沒有這些時讀 macOS 的語言偏好；都沒有就用英文。 */
async function detectLocale($: EngineInterface): Promise<Locale> {
  if (detectedLocale !== null) return detectedLocale
  let found = localeOf(await $.env.get('LC_ALL')) ?? localeOf(await $.env.get('LANG'))
  if (found === null) {
    try {
      const { exitCode, stdout } = await $.process.run(['defaults', 'read', '-g', 'AppleLanguages'], { timeoutMs: 3000 })
      found = exitCode === 0 ? localeOf(firstAppleLanguage(stdout)) : null
    } catch {
      found = null
    }
  }
  detectedLocale = found ?? 'en'

  return detectedLocale
}

async function setLocale($: EngineInterface, locale: 'auto' | Locale) {
  await changeView($, current => ({ ...current, locale }))
  messages = messagesOf(locale === 'auto' ? await detectLocale($) : locale)
}

async function toggleAutoOpen($: EngineInterface) {
  await changeView($, current => ({ ...current, autoOpen: !current.autoOpen }))
}

// 使用者在這個 Session 手動關掉監看視窗後，就不再自動打開
let isClosedByPerson = false

/** 依設定在 Desktop Session 自動打開監看視窗，讓切換 Session 時也看得到。 */
async function autoOpenBoard($: EngineInterface) {
  if (isClosedByPerson) return
  const stored = (await $.store.get(VIEW_KEY)) as { autoOpen?: unknown } | undefined
  if (stored?.autoOpen === false) return
  const surfaces = await $.session.surfaces()
  if (!surfaces.includes('desktop')) return
  const panes = await $.ui.panes()
  if (panes.some(pane => pane.id === PANE)) {
    await update($, isBoardOpen, () => true)
    startPolling($)
  } else {
    await openBoard($)
  }
}

/** 打開監看視窗並開始 polling；指令、輸入框上方的按鈕與自動開啟共用。 */
async function openBoard($: EngineInterface) {
  isClosedByPerson = false
  const opened = await $.ui.open({ id: PANE, title: TITLE })
  await update($, isBoardOpen, () => true)
  startPolling($)

  return opened
}

async function setBilling($: EngineInterface, billing: Billing) {
  await changeView($, current => ({ ...current, billing }))
}

async function toggleExpand($: EngineInterface, pid: number) {
  await update($, expanded, list => (list.includes(pid) ? list.filter(one => one !== pid) : [...list, pid]))
}

async function toggleIdle($: EngineInterface) {
  await changeView($, current => ({ ...current, isIdleCollapsed: !current.isIdleCollapsed }))
}

/** 開啟 PR 頁面：只接受 https 網址。 */
async function openUrl($: EngineInterface, url: string) {
  if (!/^https:\/\/[^\s]+$/.test(url)) return
  await $.process.run(['open', url])
}

// 防重複：第一下點擊（取得焦點）和之後的按鈕按下，同一張卡片短時間內只跳一次
let lastJump: { pid: number; at: number } | null = null

/** 點卡片：Desktop 的 Session 用 deep link 切過去；CLI 先顯示路徑；目前這個什麼都不做。 */
async function jump($: EngineInterface, card: SessionCard) {
  if (card.sessionId !== null && card.sessionId === own?.sessionId) return
  const now = await $.clock.now()
  if (lastJump !== null && lastJump.pid === card.pid && now - lastJump.at < 1500) return
  lastJump = { pid: card.pid, at: now }
  const link = desktopLinkOf(card.hostSessionId)
  if (link === null) {
    $.ui.toast(messages.toast.cliNoJump(card.path))
    return
  }
  const { exitCode } = await $.process.run(['open', link])
  if (exitCode !== 0) $.ui.toast(messages.toast.jumpFailed(card.title, card.path))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await writeReport($, {
      model: await $.session.model(),
      branch: await readBranch($),
      connectors: await readConnectors($),
      pr: await readPullRequest($),
      ...(await readUsage($)),
    })
    // 熱重載後 Pane 還開著，就接著 polling
    const panes = await $.ui.panes()
    if (panes.some(pane => pane.id === PANE)) {
      await loadView($)
      if (detectedLocale === null) await detectLocale($)
      await update($, isBoardOpen, () => true)
      startPolling($)
    } else {
      // 先載入語言與設定：監看視窗沒開時，輸入框上方的按鈕也要用對語言
      await loadView($)
      await autoOpenBoard($)
    }

    return started
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await writeReport($, {
        model: await $.session.model(),
        turnStartedAt: await $.clock.now(),
        activity: null,
        approval: null,
        question: null,
        turnError: null,
      })
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const input = e as unknown as Record<string, unknown>
    const tool = String(e.tool)
    const patch: Partial<Report> = { activity: summarizeTool(tool, input) }
    if (tool === 'TodoWrite' && Array.isArray(input.todos)) {
      patch.progress = progressOfTodos(input.todos as Parameters<typeof progressOfTodos>[0])
    } else if (tool === PLAN_TOOL) {
      plan = applyPlan(plan, input)
      patch.progress = progressOfTodos(plan)
    } else if (tool === 'AskUserQuestion') {
      patch.question = questionOf(input.questions)
    } else if (tool === WRAP_UP_TOOL) {
      closingQuestion = wrapUpQuestionOf(input)
    }
    await writeReport($, patch)

    const ran = await next(e)
    if (tool === 'Bash' && input.run_in_background === true) {
      backgroundBash.set(e.tool_use_id, String(patch.activity))
    }
    // 核准、拒絕或回答之後，清掉待處理的摘要，並更新背景任務
    if (own?.approval != null || own?.question != null || tool === 'Agent' || tool === 'Task' || tool === 'Bash') {
      await writeReport($, { approval: null, question: null, tasks: await readTasks($) })
    }

    return ran
  }).catch(($, e, next) => next(e))

  // 引擎判定要詢問使用者時，記下想執行的動作，監看視窗就能顯示核准請求摘要
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision === 'ask') {
      const input = (typeof e.input === 'object' && e.input !== null ? e.input : {}) as Record<string, unknown>
      await writeReport($, { approval: summarizeTool(String(e.tool), input) })
    }

    return verdict
  }).catch(($, e, next) => next(e))

  // 背景任務的完成通知：把對應的背景 Bash 移掉
  on('session.append', async ($, e, next) => {
    const stored = await next(e)
    const origin = e.origin as { kind?: string }
    if (origin.kind === 'task-notification') {
      const text = JSON.stringify(e.message)
      for (const id of [...backgroundBash.keys()]) if (text.includes(id)) backgroundBash.delete(id)
      await writeReport($, { tasks: await readTasks($) })
    }

    return stored
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) {
      const answer = summarizeReply(e.answer)
      const question = closingQuestion
      closingQuestion = null
      await writeReport($, {
        turnStartedAt: null,
        activity: null,
        approval: null,
        // 結尾提問框還在等使用者回答，下一個回合開始時清掉
        question,
        lastReply: answer,
        // 沒有回覆內容時存語言中立的標記，由監看視窗依目前語言顯示
        turnError: e.reason === 'error' ? (answer ?? API_ERROR) : null,
        tasks: await readTasks($),
        branch: await readBranch($),
        connectors: await readConnectors($),
        pr: await readPullRequest($),
        ...(await readUsage($)),
      })
      // 設定改成所有 Desktop Session 都顯示時，已經開著的 Session 在回合結束後補開
      await autoOpenBoard($)
    }

    return done
  })

  // 自己回答，不呼叫 next：commands/open.md 的內容不會送給模型
  on('command.run', { command: COMMAND }, async $ => {
    const surfaces = await $.session.surfaces()
    await loadView($)
    // Desktop 和終端機都能畫 Pane；VS Code 擴充套件的圖形介面不行
    if (!surfaces.includes('desktop') && !surfaces.includes('terminal')) {
      return { text: messages.command.unsupported(COMMAND) }
    }
    const opened = await openBoard($)
    if (!opened.isPlaced) {
      return { text: messages.command.notPlaced(opened.reason) }
    }

    return { text: messages.command.opened }
  })

  // Desktop 的 Pane 沒有焦點時，第一下點擊只會讓 Pane 取得焦點、不會按到按鈕。
  // 焦點落在卡片標題上（使用者的點擊或 Tab）就直接跳轉，點一下就能切換。
  // 只限 Desktop：終端機用鍵盤移動焦點時，每經過一張卡片就會跳一次
  on('ui.focus', async ($, e, next) => {
    const moved = await next(e)
    if (
      e.requestId === PANE &&
      e.origin.kind === 'person' &&
      e.element?.startsWith('jump-') === true &&
      (await $.session.surfaces()).includes('desktop')
    ) {
      const pid = Number(e.element.slice('jump-'.length))
      const card = (await read($, snapshot))?.sessions.find(one => one.pid === pid)
      if (card !== undefined) await jump($, card)
    }

    return moved
  }).catch(($, e, next) => next(e))

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      stopPolling()
      if (e.origin.kind === 'person') isClosedByPerson = true
      await update($, isBoardOpen, () => false)
    }

    return next(e)
  })

  // 監看視窗關著時，在 Desktop 或終端機的輸入框上方放一個按鈕，點一下就打開，不用輸入指令
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const canOpen = e.surface === 'desktop' || e.surface === 'terminal'
    if (!canOpen || e.props.hasSurvey || (await read($, isBoardOpen))) return next(e)
    const { Box, Button } = $.ui.resolve(e)

    return (
      <Box>
        <Button key="open-board" label={`▦ ${messages.band.open}`} onPress={() => openBoard($)} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    let current: Snapshot | null
    let settings: View
    let isOpen: boolean
    let editing: Group
    let opened: number[]
    try {
      current = await read($, snapshot)
      settings = await read($, view)
      isOpen = await read($, isSettingsOpen)
      editing = await read($, settingsGroup)
      opened = await read($, expanded)
    } catch (error) {
      return (
        <Box flexDirection="column">
          <Box key="count">
            <Text>{messages.readFailed(String(error))}</Text>
          </Box>
        </Box>
      )
    }

    if (current === null) {
      return (
        <Box flexDirection="column">
          <Box key="count">
            <Text dimColor>{messages.loading}</Text>
          </Box>
        </Box>
      )
    }

    const now = current.scannedAt
    const m = settings.locale === 'auto' ? messages : messagesOf(settings.locale)
    const showsIn = (group: Group, field: Field) => settings.fields[group].includes(field)
    /** 這張卡要不要顯示某個欄位：展開明細時全部顯示，否則依所屬分組的設定 */
    const cardShows = (card: SessionCard, field: Field) =>
      opened.includes(card.pid) ? PRESETS.detailed.includes(field) : showsIn(groupOf(card.status), field)
    const mainModel = commonModel(current.sessions)
    const density = densityOf(settings.fields[editing])
    const waiting = current.sessions.filter(card => groupOf(card.status) === 'waiting')
    const busy = current.sessions.filter(card => groupOf(card.status) === 'busy')
    const idle = current.sessions.filter(card => groupOf(card.status) === 'idle')
    // Desktop 不會截斷按鈕裡的文字，改由這裡依 Pane 的欄寬截斷
    const columns = Math.max(20, e.props.bodyColumns)
    const cardWidth = columns - 4 // 外框加左右內距
    const rowWidth = columns - 2 // 閒置列只有左右內距

    // rate limit 是帳號層級的：取最新一份回報，在狀態列下方顯示一次
    const latest = current.sessions
      .map(card => card.report)
      .filter(report => report !== null && report.rateLimits.length > 0)
      .sort((a, b) => (b?.reportedAt ?? 0) - (a?.reportedAt ?? 0))[0]
    const rateLimits = latest?.rateLimits ?? []
    // 訂閱制不看花費；自動時有 rate limit 就當作訂閱制
    const isSubscription =
      settings.billing === 'subscription' || (settings.billing === 'auto' && rateLimits.length > 0)
    const totalCost = isSubscription
      ? 0
      : current.sessions.reduce((sum, card) => sum + (card.report?.costUsd ?? 0), 0)

    /** 需要你處理的種類：核准、回答、出錯，或基本狀態的等你 */
    const kindOf = (card: SessionCard): keyof Messages['kinds'] | null =>
      card.status === 'errored'
        ? 'errored'
        : card.status !== 'waiting'
          ? null
          : card.report?.question != null
            ? 'question'
            : card.report?.approval != null
              ? 'approval'
              : 'waiting'

    /**
     * 標題列：圖示或標籤＋可點的標題（跳轉）＋目前＋背景任務徽章＋「時間 ▸」按鈕。
     * 左右兩側都用比例字型估算寬度，另留 3 格餘裕；標題至少保留 8 格。
     */
    const titleRow = (card: SessionCard, width: number) => {
      const look = LOOK[card.status]
      const isCurrent = card.sessionId !== null && card.sessionId === own?.sessionId
      const shows = (field: Field) => cardShows(card, field)
      const age = shows('time') && card.since !== null ? shortAge(now - card.since) : ''
      const tasks = shows('tasks') ? countTasks(card.report?.tasks ?? []) : { running: 0, waiting: 0, failed: 0 }
      let badges = [
        tasks.running > 0 ? { text: `⟳${tasks.running}`, color: 'text' } : null,
        tasks.waiting > 0 ? { text: `⏸${tasks.waiting}`, color: 'warning' } : null,
        tasks.failed > 0 ? { text: `!${tasks.failed}`, color: 'error' } : null,
      ].filter(one => one !== null)
      const isOpen = opened.includes(card.pid)
      const toggle = `${age}${age === '' ? '' : ' '}${isOpen ? '▾' : '▸'}`
      const kind = kindOf(card)
      const chip = kind === null ? null : ` ${m.kinds[kind]} `
      const left = (chip === null ? estimateWidth(look.glyph) : estimateWidth(chip)) + 1
      let showsCurrent = isCurrent
      const rightOf = () =>
        (showsCurrent ? estimateWidth(m.current) + 1 : 0) +
        badges.reduce((sum, one) => sum + estimateWidth(one.text) + 1, 0) +
        estimateWidth(toggle)
      // 標題不夠 8 格時，先拿掉徽章，再拿掉「目前」
      if (width - left - rightOf() - 3 < 8) badges = []
      if (width - left - rightOf() - 3 < 8) showsCurrent = false
      const title = fitToWidth(card.title, width - left - rightOf() - 3)

      return (
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Box flexDirection="row" gap={1}>
            {chip === null ? (
              <Text color={look.color}>{look.glyph}</Text>
            ) : (
              <Text color={look.color} weight="bold">
                {`▲${chip}`.replace('▲ ', card.status === 'errored' ? '✕ ' : '▲ ')}
              </Text>
            )}
            <Button key={`jump-${card.pid}`} plain onPress={() => jump($, card)}>
              <Text weight={card.status === 'idle' ? 'regular' : 'semibold'}>{title}</Text>
            </Button>
          </Box>
          <Box flexDirection="row" gap={1} alignItems="center">
            {showsCurrent && (
              <Text size="caption" dimColor>
                {m.current}
              </Text>
            )}
            {badges.length > 0 && (
              <Box key={`tasks-${card.pid}`} flexDirection="row" gap={1}>
                {badges.map(one => (
                  <Text size="caption" color={one.color}>
                    {one.text}
                  </Text>
                ))}
              </Box>
            )}
            <Button key={`expand-${card.pid}`} plain dimColor onPress={() => toggleExpand($, card.pid)}>
              <Text size="caption" dimColor>
                {toggle}
              </Text>
            </Button>
          </Box>
        </Box>
      )
    }

    /** 情境行：依狀態只放一件事——問題、指令、出錯原因、進度與目前動作、或最後回覆 */
    const contextLine = (card: SessionCard) => {
      const report = card.report
      if (report === null) return null
      if (card.status === 'waiting' && report.question !== null) {
        const options = report.question.options.join(' / ')

        return (
          <Box key="context" flexDirection="column">
            <Text size="footnote" weight="medium" wrap="wrap">
              {`？ ${report.question.text}${(report.question.more ?? 0) > 0 ? m.moreQuestions(report.question.more ?? 0) : ''}`}
            </Text>
            {options !== '' && (
              <Text size="caption" dimColor wrap="wrap">
                {options}
              </Text>
            )}
          </Box>
        )
      }
      if (card.status === 'waiting' && report.approval !== null) {
        return (
          <Box key="context">
            <Text size="footnote" mono wrap="wrap">
              {report.approval}
            </Text>
          </Box>
        )
      }
      if (card.status === 'errored' && report.turnError !== null) {
        return (
          <Box key="context">
            <Text size="footnote" color="error" wrap="wrap">
              {report.turnError === API_ERROR ? m.apiError : report.turnError}
            </Text>
          </Box>
        )
      }
      if (card.status === 'busy') {
        const doing = [
          cardShows(card, 'progress') && report.progress != null ? describeProgress(report.progress) : null,
          cardShows(card, 'activity') && report.activity != null ? report.activity : null,
        ].filter(one => one !== null)
        if (doing.length === 0) return null

        return (
          <Box key="context">
            <Text size="footnote" wrap="truncate-end">
              {doing.join(' · ')}
            </Text>
          </Box>
        )
      }
      if (card.status === 'idle' && cardShows(card, 'reply') && report.lastReply !== null) {
        return (
          <Box key="context">
            <Text size="footnote" dimColor italic wrap="truncate-end">
              {`「${report.lastReply}」`}
            </Text>
          </Box>
        )
      }

      return null
    }

    /** 中繼資料帶：位置·分支、變更行數、ctx、PR、模型、環境、用量，排成一行自動換行 */
    const metaStrip = (card: SessionCard) => {
      const shows = (field: Field) => cardShows(card, field)
      const report = card.report
      const branch = report?.branch ?? null
      const where = [
        shows('location') ? locationOf(card.path) : null,
        shows('branch') && branch !== null ? branchLabel(branch, card.path) || null : null,
        shows('source') && card.source !== null && card.source !== 'Desktop' ? card.source : null,
      ].filter(one => one !== null)
      const added = branch?.insertions ?? 0
      const removed = branch?.deletions ?? 0
      const percent = report?.contextPercent ?? null
      const model = report?.model ?? null
      const environment = [card.isWorktree ? 'Worktree' : null, card.isRemote ? 'Remote' : null].filter(one => one !== null)
      const usage = [
        report?.costUsd != null && report.costUsd > 0 && !isSubscription ? `$${report.costUsd.toFixed(2)}` : null,
        report?.turns != null && report.turns > 0 ? m.turns(report.turns) : null,
      ].filter(one => one !== null)
      const hasWork = branch !== null && (added > 0 || removed > 0 || branch.ahead > 0)
      const segments = [
        where.length > 0 ? (
          <Text size="caption" dimColor>
            {where.join(' · ')}
          </Text>
        ) : null,
        shows('changes') && (added > 0 || removed > 0) ? (
          <Box key="changes" flexDirection="row" gap={1}>
            <Text size="caption" color="diffAdded">
              +{added}
            </Text>
            <Text size="caption" color="diffRemoved">
              −{removed}
            </Text>
          </Box>
        ) : null,
        shows('context') && percent !== null ? (
          <Box key="ctx">
            <Text size="caption" color={percent >= 80 ? usageColor(percent) : undefined} dimColor={percent < 80}>
              ctx {Math.round(percent)}%
            </Text>
          </Box>
        ) : null,
        shows('pr') && report?.pr != null ? (
          <Box key="pr">
            <Button key={`pr-${card.pid}`} plain onPress={() => openUrl($, report.pr?.url ?? '')}>
              <Text
                size="caption"
                color={report.pr.state === 'MERGED' ? 'merged' : report.pr.state === 'CLOSED' ? 'inactive' : 'success'}
              >
                #{report.pr.number} ↗
              </Text>
            </Button>
          </Box>
        ) : shows('pr') && hasWork && desktopLinkOf(card.hostSessionId) !== null && card.status !== 'idle' ? (
          <Box key="pr">
            <Button key={`create-pr-${card.pid}`} plain onPress={() => jump($, card)}>
              <Text size="caption" color="suggestion">
                {m.createPr}
              </Text>
            </Button>
          </Box>
        ) : null,
        model !== null && (shows('model') || (model !== mainModel && card.status !== 'idle')) ? (
          <Text size="caption" dimColor>
            {shortModel(model)}
          </Text>
        ) : null,
        shows('environment') && environment.length > 0 ? (
          <Text size="caption" dimColor>
            {environment.join(' · ')}
          </Text>
        ) : null,
        shows('usage') && usage.length > 0 ? (
          <Text size="caption" dimColor>
            {usage.join(' · ')}
          </Text>
        ) : null,
      ].filter(one => one !== null)
      if (segments.length === 0) return null

      return (
        <Box key="meta" flexDirection="row" flexWrap="wrap" columnGap={1}>
          {segments}
        </Box>
      )
    }

    /** 展開明細才有的內容：Context 用量條、環境、連接器、完整路徑、背景任務 */
    const expandedDetail = (card: SessionCard) => {
      if (!opened.includes(card.pid)) return null
      const report = card.report
      const percent = report?.contextPercent ?? null
      const connectors = report?.connectors ?? null
      const branch = report?.branch ?? null
      const tasks = report?.tasks ?? []
      const mark: Record<string, string> = { running: '⟳', waiting: '⏸', done: '✓', failed: '!' }
      const environment = [m.environment.local, card.isWorktree ? 'Worktree' : null, card.isRemote ? 'Remote Control' : null]
        .filter(one => one !== null)
        .join(' · ')

      return (
        <Box key="detail" flexDirection="column">
          {percent !== null && (
            <Box key="context-bar" flexDirection="row" gap={1}>
              <Text size="caption" dimColor>
                Context
              </Text>
              <Text size="caption" color={usageColor(percent)}>
                {usageBar(percent, 10)}
              </Text>
            </Box>
          )}
          {branch?.base !== undefined && (
            <Text size="caption" dimColor wrap="truncate-end">
              {`${branch.name} · ${m.versus(branch.base)}`}
            </Text>
          )}
          <Box key="environment">
            <Text size="caption" dimColor wrap="truncate-end">
              {environment}
            </Text>
          </Box>
          {connectors !== null && (connectors.connected.length > 0 || connectors.needsAuth.length > 0) && (
            <Box key="connectors" flexDirection="row" flexWrap="wrap" columnGap={1}>
              <Text size="caption" dimColor>
                {m.connectors(connectors.connected.length)}
                {connectors.connected.length > 0 ? `: ${connectors.connected.join(', ')}` : ''}
              </Text>
              {connectors.needsAuth.length > 0 && (
                <Text size="caption" color="warning">
                  {m.needsAuth} {connectors.needsAuth.join(', ')}
                </Text>
              )}
            </Box>
          )}
          {card.path !== '' && (
            <Text size="caption" dimColor wrap="truncate-middle">
              {card.path}
            </Text>
          )}
          {tasks.length > 0 && (
            <Box key="task-list" flexDirection="column">
              {tasks.slice(0, 5).map(one => (
                <Text
                  size="caption"
                  dimColor={one.status === 'done'}
                  color={one.status === 'failed' ? 'error' : undefined}
                  wrap="truncate-end"
                >
                  {`${mark[one.status] ?? '·'} ${one.kind === 'bash' ? 'Bash' : 'Agent'} ${one.label}`}
                </Text>
              ))}
              {tasks.length > 5 && (
                <Text size="caption" dimColor>
                  {m.moreTasks(tasks.length - 5)}
                </Text>
              )}
            </Box>
          )}
        </Box>
      )
    }

    const body = (card: SessionCard) => (
      <>
        {contextLine(card)}
        {metaStrip(card)}
        {expandedDetail(card)}
        {card.report === null && card.status !== 'idle' && (
          <Text key="no-report" size="caption" dimColor>
            {m.basicStatus}
          </Text>
        )}
        {groupOf(card.status) === 'waiting' && desktopLinkOf(card.hostSessionId) !== null && (
          <Box key={`go-${card.pid}`} flexDirection="row">
            <Button key={`go-button-${card.pid}`} variant="secondary" onPress={() => jump($, card)}>
              {m.goHandle}
            </Button>
          </Box>
        )}
      </>
    )

    const longestWait = Math.max(0, ...waiting.map(card => (card.since === null ? 0 : now - card.since)))
    const breakdown = (['approval', 'question', 'errored', 'waiting'] as const)
      .map(kind => ({ kind, n: waiting.filter(card => kindOf(card) === kind).length }))
      .filter(one => one.n > 0)
      .map(one => `${m.kinds[one.kind]} ${one.n}`)

    /** 帳號用量卡片：5h／週用量條與重置倒數；API 計費時加上所有 Session 的花費 */
    const accountCard =
      rateLimits.length > 0 || totalCost > 0 ? (
        <Box key="account" flexDirection="column" borderStyle="round" paddingX={1}>
          <Text size="footnote" weight="semibold" dimColor>
            {m.account.title}
          </Text>
          {rateLimits.map(one => {
            const kind = rateKind(one.kind)
            const resetIn = one.resetsAt === undefined ? null : Date.parse(one.resetsAt) - now

            return (
              <Box key={`rate-${kind ?? one.kind}`} flexDirection="row" justifyContent="space-between">
                <Text size="caption" color={usageColor(one.percentUsed)}>
                  {`${kind === null ? one.kind : m.account[kind]} ${usageBar(one.percentUsed, 10)}`}
                </Text>
                {resetIn !== null && Number.isFinite(resetIn) && resetIn > 0 && (
                  <Text size="caption" dimColor>
                    {m.account.resetsIn(shortAge(resetIn))}
                  </Text>
                )}
              </Box>
            )
          })}
          {totalCost > 0 && (
            <Box key="total-cost">
              <Text size="caption" dimColor>
                {m.account.totalCost(totalCost.toFixed(2))}
              </Text>
            </Box>
          )}
        </Box>
      ) : null

    const viewButton = (
      <Button key="settings" plain dimColor onPress={() => update($, isSettingsOpen, value => !value)}>
        {`${m.view} ${isOpen ? '▾' : '▸'}`}
      </Button>
    )

    const viewPanel = (
      <Box key="view-panel" flexDirection="column" borderStyle="round" borderDimColor paddingX={1} gap={1}>
            <Box key="auto-open-row" flexDirection="row">
              <Button key="auto-open" plain onPress={() => toggleAutoOpen($)}>
                {settings.autoOpen ? `☑ ${m.panel.autoOpen}` : `☐ ${m.panel.autoOpen}`}
              </Button>
            </Box>
            <Box flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
              <Text size="caption" dimColor>
                {m.panel.language}
              </Text>
              <Button
                key="locale-auto"
                variant={settings.locale === 'auto' ? 'primary' : 'secondary'}
                onPress={() => setLocale($, 'auto')}
              >
                {m.panel.auto}
              </Button>
              {LOCALES.map(one => (
                <Button
                  key={`locale-${one.locale}`}
                  variant={settings.locale === one.locale ? 'primary' : 'secondary'}
                  onPress={() => setLocale($, one.locale)}
                >
                  {one.label}
                </Button>
              ))}
            </Box>
            <Box flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
              <Text size="caption" dimColor>
                {m.panel.billing}
              </Text>
              {BILLINGS.map(one => (
                <Button
                  key={`billing-${one}`}
                  variant={settings.billing === one ? 'primary' : 'secondary'}
                  onPress={() => setBilling($, one)}
                >
                  {m.billings[one]}
                </Button>
              ))}
            </Box>
            <Box flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
              <Text size="caption" dimColor>
                {m.panel.group}
              </Text>
              {GROUPS.map(one => (
                <Button
                  key={`group-${one}`}
                  variant={editing === one ? 'primary' : 'secondary'}
                  onPress={() => update($, settingsGroup, () => one)}
                >
                  {m.groups[one]}
                </Button>
              ))}
            </Box>
            <Box flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
              <Text size="caption" dimColor>
                {m.panel.density}
              </Text>
              {DENSITIES.map(one => (
                <Button
                  key={`density-${one}`}
                  variant={density === one ? 'primary' : 'secondary'}
                  onPress={() => setDensity($, editing, one)}
                >
                  {m.densities[one]}
                </Button>
              ))}
              {density === null && (
                <Text size="caption" dimColor>
                  {m.panel.custom}
                </Text>
              )}
            </Box>
            <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
              {FIELDS.map(field => (
                <Button key={`field-${field}`} plain onPress={() => toggleField($, editing, field)}>
                  {showsIn(editing, field) ? `☑ ${m.fields[field]}` : `☐ ${m.fields[field]}`}
                </Button>
              ))}
            </Box>
            <Box key="about" flexDirection="row" justifyContent="flex-end">
              <Button key="author" plain dimColor onPress={() => openUrl($, AUTHOR_URL)}>
                <Text size="caption" dimColor>
                  switchboard · wide3751 ↗
                </Text>
              </Button>
            </Box>
          </Box>
    )

    const section = (key: string, label: string, n: number, color?: string, action?: JSX.Element) => (
      <Box key={key} flexDirection="row" justifyContent="space-between" alignItems="center">
        <Text size="footnote" weight="semibold" color={color}>
          {label} {n}
        </Text>
        {action}
      </Box>
    )

    return (
      <Box flexDirection="column" gap={1}>
        {current.error !== null && (
          <Box key="error">
            <Text color="error">{m.cannotRead(current.error)}</Text>
          </Box>
        )}

        <Box key="toolbar" flexDirection="row" justifyContent="flex-end">
          {viewButton}
        </Box>
        {isOpen && viewPanel}

        {/* 狀態卡片：無待處理時綠色細框；有待處理時琥珀色粗框並細分種類 */}
        {waiting.length > 0 ? (
          <Box key="header" flexDirection="column" borderStyle="bold" borderColor="warning" paddingX={1}>
            <Box key="count">
              <Text color="warning" weight="bold">
                {`▲ ${m.status.needYou(current.needsYou)}`}
              </Text>
            </Box>
            <Box key="summary">
              <Text size="caption">{[...breakdown, m.status.longest(shortAge(longestWait))].join(' · ')}</Text>
            </Box>
          </Box>
        ) : (
          <Box key="header" flexDirection="column" borderStyle="round" borderColor="success" paddingX={1}>
            <Box key="count">
              <Text color="success" weight="semibold">
                {m.header.none}
              </Text>
            </Box>
            <Box key="summary">
              <Text size="caption" dimColor>
                {current.sessions.length === 0
                  ? m.header.noOthers
                  : [busy.length > 0 ? m.header.running(busy.length) : null, idle.length > 0 ? m.header.idle(idle.length) : null]
                      .filter(one => one !== null)
                      .join(' · ')}
              </Text>
            </Box>
          </Box>
        )}
        {accountCard}

        {waiting.map(card => (
          <Box
            key={`card-${card.pid}`}
            flexDirection="column"
            borderStyle="bold"
            borderColor={card.status === 'errored' ? 'error' : 'warning'}
            paddingX={1}
          >
            {titleRow(card, cardWidth)}
            {body(card)}
          </Box>
        ))}

        {busy.length > 0 && section('section-busy', m.groups.busy, busy.length)}
        {busy.map(card => (
          <Box key={`card-${card.pid}`} flexDirection="column" borderStyle="round" paddingX={1}>
            {titleRow(card, cardWidth)}
            {body(card)}
          </Box>
        ))}

        {idle.length > 0 &&
          section(
            'section-idle',
            m.groups.idle,
            idle.length,
            'inactive',
            <Button key="toggle-idle" plain dimColor onPress={() => toggleIdle($)}>
              {settings.isIdleCollapsed ? '▸' : '▾'}
            </Button>,
          )}
        {!settings.isIdleCollapsed &&
          idle.map(card =>
            // 閒置是單行、不加外框；展開明細時才加淡色框，避免和下一列黏在一起
            opened.includes(card.pid) ? (
              <Box key={`card-${card.pid}`} flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
                {titleRow(card, cardWidth)}
                {body(card)}
              </Box>
            ) : (
              <Box key={`card-${card.pid}`} flexDirection="column" paddingX={1}>
                {titleRow(card, rowWidth)}
                {body(card)}
              </Box>
            ),
          )}
      </Box>
    )
  })
}

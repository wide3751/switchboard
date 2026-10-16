import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Billing, Density, Field, Group, Report, SessionCard, Snapshot, Task, View } from '../types'
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
  displayWidth,
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
  rateLabel,
  shortAge,
  shortModel,
  staleReports,
  summarizeReply,
  summarizeTool,
  taskStatusOf,
  toCards,
  usageBar,
  usageColor,
} from './board'
import type { PlanItem } from './board'

// 指令來自 commands/on.md，以 plugin 名稱為命名空間
const COMMAND = 'switchboard:on'
const PANE = 'switchboard'
const TITLE = 'Sessions'
const POLL_MS = 3000
/** Desktop 的任務清單工具 */
const PLAN_TOOL = 'mcp__ccd_turn__update_plan'
const VIEW_KEY = 'view'

/** 狀態的圖示、顏色與外框：重要程度主要靠外框粗細區分，顏色只是輔助 */
const LOOK: Record<SessionCard['status'], { glyph: string; color: string }> = {
  waiting: { glyph: '▲', color: 'warning' },
  busy: { glyph: '◉', color: 'claude' },
  idle: { glyph: '○', color: 'inactive' },
  errored: { glyph: '✕', color: 'error' },
  unknown: { glyph: '◌', color: 'inactive' },
}

/** 檢視面板裡可以開關的欄位，依卡片上的順序 */
const FIELDS: readonly { field: Field; label: string }[] = [
  { field: 'time', label: '時間' },
  { field: 'location', label: '位置' },
  { field: 'branch', label: '分支' },
  { field: 'progress', label: '進度' },
  { field: 'activity', label: '目前動作' },
  { field: 'changes', label: '變更行數' },
  { field: 'context', label: 'Context' },
  { field: 'pr', label: 'PR' },
  { field: 'environment', label: '環境' },
  { field: 'connectors', label: '連接器' },
  { field: 'reply', label: '最後回覆' },
  { field: 'tasks', label: '背景任務' },
  { field: 'model', label: '模型' },
  { field: 'usage', label: '用量' },
  { field: 'source', label: '來源' },
  { field: 'path', label: '完整路徑' },
]

const DENSITIES: readonly { density: Density; label: string }[] = [
  { density: 'compact', label: '精簡' },
  { density: 'standard', label: '標準' },
  { density: 'detailed', label: '詳細' },
]

const GROUPS: readonly { group: Group; label: string }[] = [
  { group: 'waiting', label: '需要你處理' },
  { group: 'busy', label: '工作中' },
  { group: 'idle', label: '閒置' },
]

const DEFAULT_VIEW: View = {
  fields: {
    waiting: [...DEFAULT_FIELDS.waiting],
    busy: [...DEFAULT_FIELDS.busy],
    idle: [...DEFAULT_FIELDS.idle],
  },
  isIdleCollapsed: false,
  billing: 'auto',
}

const BILLINGS: readonly { billing: Billing; label: string }[] = [
  { billing: 'auto', label: '自動' },
  { billing: 'subscription', label: '訂閱制' },
  { billing: 'api', label: 'API' },
]

const snapshot = atom({ plugin: 'switchboard', key: 'snapshot' } as const, null)
const view = atom({ plugin: 'switchboard', key: 'view' } as const, DEFAULT_VIEW)
const isSettingsOpen = atom({ plugin: 'switchboard', key: 'isSettingsOpen' } as const, false)
const settingsGroup = atom({ plugin: 'switchboard', key: 'settingsGroup' } as const, 'busy')
const expanded = atom({ plugin: 'switchboard', key: 'expanded' } as const, [])

// 用到 $ 的函式都寫在這個檔案：Desktop 自帶的 Claude Code 不讓 $ 跨 import 傳遞

async function configDir($: EngineInterface): Promise<string> {
  return configDirOf(await $.env.get('CLAUDE_CONFIG_DIR'), await $.env.get('HOME'))
}

// ── 回報者：每個 Session 寫出自己的狀態回報 ──────────────────────────

// 這個 Session 的回報；模組重新載入時從頭開始
let own: Report | null = null
let plan: PlanItem[] = []

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
    return { needsYou: 0, error: `讀不到 ${base}/sessions`, sessions: [], scannedAt }
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
      return
    }
    const next = await scan($)
    await update($, snapshot, () => next)
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
    | { fields?: unknown; isIdleCollapsed?: unknown; billing?: unknown }
    | undefined
  if (stored === undefined) return
  const raw = stored.fields
  // 舊版存的是一份共用清單：套用到每一組
  const fields: View['fields'] = Array.isArray(raw)
    ? { waiting: [...raw], busy: [...raw], idle: [...raw] }
    : { ...DEFAULT_VIEW.fields, ...((raw ?? {}) as Partial<View['fields']>) }
  const billing = BILLINGS.find(one => one.billing === stored.billing)?.billing ?? 'auto'
  await update($, view, () => ({ fields, isIdleCollapsed: stored.isIdleCollapsed === true, billing }))
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

/** 點卡片：Desktop 的 Session 用 deep link 切過去；CLI 先顯示路徑；目前這個什麼都不做。 */
async function jump($: EngineInterface, card: SessionCard) {
  if (card.sessionId !== null && card.sessionId === own?.sessionId) return
  const link = desktopLinkOf(card.hostSessionId)
  if (link === null) {
    $.ui.toast(`CLI Session 還不能跳轉，它在 ${card.path}`)
    return
  }
  const { exitCode } = await $.process.run(['open', link])
  if (exitCode !== 0) $.ui.toast(`沒辦法切換到「${card.title}」，它在 ${card.path}`)
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
      startPolling($)
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
      await writeReport($, {
        turnStartedAt: null,
        activity: null,
        approval: null,
        question: null,
        lastReply: answer,
        turnError: e.reason === 'error' ? (answer ?? 'API 錯誤，回合未完成') : null,
        tasks: await readTasks($),
        branch: await readBranch($),
        connectors: await readConnectors($),
        pr: await readPullRequest($),
        ...(await readUsage($)),
      })
    }

    return done
  })

  // 自己回答，不呼叫 next：commands/on.md 的內容不會送給模型
  on('command.run', { command: COMMAND }, async $ => {
    const surfaces = await $.session.surfaces()
    if (!surfaces.includes('desktop')) {
      return { text: `監看視窗只在 Claude Desktop 打開：請到 Desktop 的 Code 分頁輸入 /${COMMAND}。` }
    }
    await loadView($)
    const opened = await $.ui.open({ id: PANE, title: TITLE })
    startPolling($)
    if (!opened.isPlaced) {
      return { text: `監看視窗已開啟，但介面還沒有放上它：${opened.reason}` }
    }

    return { text: '已打開監看視窗。' }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) stopPolling()

    return next(e)
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
            <Text>switchboard 讀取狀態失敗：{String(error)}</Text>
          </Box>
        </Box>
      )
    }

    if (current === null) {
      return (
        <Box flexDirection="column">
          <Box key="count">
            <Text dimColor>讀取中…</Text>
          </Box>
        </Box>
      )
    }

    const now = current.scannedAt
    const showsIn = (group: Group, field: Field) => settings.fields[group].includes(field)
    /** 這張卡要不要顯示某個欄位：展開明細時全部顯示，否則依所屬分組的設定 */
    const cardShows = (card: SessionCard, field: Field) =>
      opened.includes(card.pid) ? PRESETS.detailed.includes(field) : showsIn(groupOf(card.status), field)
    const mainModel = commonModel(current.sessions)
    const density = densityOf(settings.fields[editing])
    const waiting = current.sessions.filter(card => groupOf(card.status) === 'waiting')
    const busy = current.sessions.filter(card => groupOf(card.status) === 'busy')
    const idle = current.sessions.filter(card => groupOf(card.status) === 'idle')
    // Desktop 不會截斷按鈕裡的文字，改由這裡依 Pane 的欄寬截斷；留 2 格餘裕給比例字型
    const columns = Math.max(20, e.props.bodyColumns)
    const cardWidth = columns - 4 // 外框加左右內距
    const rowWidth = columns - 2 // 閒置列只有左右內距

    /** 需要你處理的標籤：待核准、待回答、出錯，或基本狀態的「等你」 */
    const chipOf = (card: SessionCard): string | null =>
      card.status === 'errored'
        ? ' 出錯 '
        : card.status !== 'waiting'
          ? null
          : card.report?.question != null
            ? ' 待回答 '
            : card.report?.approval != null
              ? ' 待核准 '
              : ' 等你 '

    /** 標題列：圖示或標籤＋可點的標題（跳轉）＋目前這個＋背景任務＋時間＋展開；標題依剩下的寬度截斷 */
    const titleRow = (card: SessionCard, width: number) => {
      const look = LOOK[card.status]
      const isCurrent = card.sessionId !== null && card.sessionId === own?.sessionId
      const shows = (field: Field) => cardShows(card, field)
      const age = shows('time') && card.since !== null ? shortAge(now - card.since) : null
      const tasks = shows('tasks') ? countTasks(card.report?.tasks ?? []) : { running: 0, waiting: 0, failed: 0 }
      const badges = [
        tasks.running > 0 ? { text: `⚙${tasks.running}`, color: 'text' } : null,
        tasks.waiting > 0 ? { text: `⏸${tasks.waiting}`, color: 'warning' } : null,
        tasks.failed > 0 ? { text: `✕${tasks.failed}`, color: 'error' } : null,
      ].filter(one => one !== null)
      const isOpen = opened.includes(card.pid)
      const chip = chipOf(card)
      const left = chip === null ? 1 : displayWidth(chip)
      const right =
        (isCurrent ? displayWidth('目前') + 1 : 0) +
        badges.reduce((sum, one) => sum + displayWidth(one.text) + 1, 0) +
        (age === null ? 0 : age.length + 1) +
        1
      const title = fitToWidth(card.title, width - left - right)

      return (
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Box flexDirection="row" gap={1}>
            {chip === null ? (
              <Text color={look.color}>{look.glyph}</Text>
            ) : (
              <Text backgroundColor={look.color} color="inverseText" weight="semibold">
                {chip}
              </Text>
            )}
            <Button key={`jump-${card.pid}`} plain onPress={() => jump($, card)}>
              <Text weight={card.status === 'idle' ? 'regular' : 'semibold'}>{title}</Text>
            </Button>
          </Box>
          <Box flexDirection="row" gap={1} alignItems="center">
            {isCurrent && (
              <Text size="caption" color="suggestion">
                目前
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
            {age !== null && (
              <Text size="caption" dimColor>
                {age}
              </Text>
            )}
            <Button key={`expand-${card.pid}`} plain dimColor onPress={() => toggleExpand($, card.pid)}>
              {isOpen ? '▾' : '▸'}
            </Button>
          </Box>
        </Box>
      )
    }

    /** 情境行：待回答的問題、待核准的動作、出錯原因，或閒置時的最後回覆 */
    const contextLine = (card: SessionCard, width: number) => {
      const report = card.report
      if (report === null) return null
      if (card.status === 'waiting' && report.question !== null) {
        const options = report.question.options.join(' / ')

        return (
          <Box key="context" flexDirection="column">
            <Text weight="medium" wrap="wrap">{`？ ${report.question.text}`}</Text>
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
            <Text mono wrap="wrap">{report.approval}</Text>
          </Box>
        )
      }
      if (card.status === 'errored' && report.turnError !== null) {
        return (
          <Box key="context">
            <Text color="error" wrap="wrap">{`✕ ${report.turnError}`}</Text>
          </Box>
        )
      }
      if (card.status === 'idle' && cardShows(card, 'reply') && report.lastReply !== null) {
        return (
          <Box key="context">
            <Text size="caption" dimColor italic wrap="truncate-end">
              {`「${report.lastReply}」`}
            </Text>
          </Box>
        )
      }

      return null
    }

    /** 展開明細時列出背景任務（最多 5 個） */
    const taskLines = (card: SessionCard, width: number) => {
      const tasks = card.report?.tasks ?? []
      if (!opened.includes(card.pid) || tasks.length === 0) return null
      const mark: Record<string, string> = { running: '⚙', waiting: '⏸', done: '✓', failed: '✕' }
      const shown = tasks.slice(0, 5)

      return (
        <Box key="task-list" flexDirection="column">
          {shown.map(one => (
            <Text
              size="caption"
              dimColor={one.status === 'done'}
              color={one.status === 'failed' ? 'error' : undefined}
              wrap="truncate-end"
            >
              {`${mark[one.status] ?? '·'} ${one.kind === 'bash' ? 'Bash' : 'Agent'} ${one.label}`}
            </Text>
          ))}
          {tasks.length > shown.length && (
            <Text size="caption" dimColor>
              ＋{tasks.length - shown.length} 個
            </Text>
          )}
        </Box>
      )
    }

    /** 依欄位設定組出的明細行（每行一段淡色小字） */
    const detailLines = (card: SessionCard): string[] => {
      const shows = (field: Field) => cardShows(card, field)
      const report = card.report
      const lines: string[] = []
      const where = [
        shows('location') ? locationOf(card.path) : null,
        shows('branch') && report?.branch != null ? branchLabel(report.branch, card.path) || null : null,
        shows('source') && card.source !== 'Desktop' ? card.source : null,
      ].filter(one => one !== null)
      if (where.length > 0) lines.push(where.join(' · '))
      const doing = [
        shows('progress') && report?.progress != null ? describeProgress(report.progress) : null,
        shows('activity') && card.status === 'busy' && report?.activity != null ? report.activity : null,
      ].filter(one => one !== null)
      if (doing.length > 0) lines.push(doing.join(' · '))
      const model = report?.model
      if (model != null && (shows('model') || (model !== mainModel && card.status !== 'idle'))) {
        lines.push(shortModel(model))
      }
      if (shows('path') && card.path !== '') lines.push(card.path)

      return lines
    }

    /** 變更行數：相對基底分支 +新增（綠）−刪除（紅），和 Desktop 的 Changes 一致；沒有變更時不顯示 */
    const changesLine = (card: SessionCard) => {
      const branch = card.report?.branch
      if (!cardShows(card, 'changes') || branch == null) return null
      const added = branch.insertions ?? 0
      const removed = branch.deletions ?? 0
      if (added === 0 && removed === 0) return null

      return (
        <Box key="changes" flexDirection="row" gap={1}>
          <Text size="caption" color="diffAdded">
            +{added}
          </Text>
          <Text size="caption" color="diffRemoved">
            −{removed}
          </Text>
          <Text size="caption" dimColor>
            {branch.base === undefined ? '行' : `行 · 相對 ${branch.base}`}
          </Text>
        </Box>
      )
    }

    /** PR：已有的顯示編號與狀態並可開啟；還沒有但有變更時，提供切到 Session 建立 */
    const prLine = (card: SessionCard) => {
      const report = card.report
      if (!cardShows(card, 'pr') || report === null) return null
      if (report.pr !== null) {
        const pr = report.pr
        const color = pr.state === 'MERGED' ? 'merged' : pr.state === 'CLOSED' ? 'inactive' : 'success'

        return (
          <Box key="pr" flexDirection="row">
            <Button key={`pr-${card.pid}`} plain onPress={() => openUrl($, pr.url)}>
              <Text size="caption" color={color}>
                PR #{pr.number} · {pr.state.toLowerCase()} ↗
              </Text>
            </Button>
          </Box>
        )
      }
      const branch = report.branch
      const hasWork = branch != null && ((branch.insertions ?? 0) > 0 || (branch.deletions ?? 0) > 0 || branch.ahead > 0)
      if (!hasWork || desktopLinkOf(card.hostSessionId) === null) return null

      return (
        <Box key="pr" flexDirection="row">
          <Button key={`create-pr-${card.pid}`} plain onPress={() => jump($, card)}>
            <Text size="caption" color="suggestion">
              建立 PR ↗
            </Text>
          </Button>
        </Box>
      )
    }

    /** Context 使用率：用量條加百分比，70% 以上警示 */
    const contextBar = (card: SessionCard) => {
      const percent = card.report?.contextPercent
      if (!cardShows(card, 'context') || percent == null) return null

      return (
        <Box key="context-bar" flexDirection="row" gap={1}>
          <Text size="caption" dimColor>
            Context
          </Text>
          <Text size="caption" color={usageColor(percent)}>
            {usageBar(percent, 10)}
          </Text>
        </Box>
      )
    }

    /** 環境：本機、Worktree、Remote Control */
    const environmentLine = (card: SessionCard) => {
      if (!cardShows(card, 'environment')) return null
      const parts = ['本機', card.isWorktree ? 'Worktree' : null, card.isRemote ? 'Remote Control' : null].filter(
        one => one !== null,
      )

      return (
        <Box key="environment">
          <Text size="caption" dimColor wrap="truncate-end">
            {parts.join(' · ')}
          </Text>
        </Box>
      )
    }

    /** 連接器：已連線數量，需要驗證的另外標出 */
    const connectorsLine = (card: SessionCard) => {
      const connectors = card.report?.connectors
      if (!cardShows(card, 'connectors') || connectors == null) return null
      if (connectors.connected.length === 0 && connectors.needsAuth.length === 0) return null

      return (
        <Box key="connectors" flexDirection="row" gap={1}>
          <Text size="caption" dimColor wrap="truncate-end">
            連接器 {connectors.connected.length}
            {connectors.connected.length > 0 ? `：${connectors.connected.join('、')}` : ''}
          </Text>
          {connectors.needsAuth.length > 0 && (
            <Text size="caption" color="warning" wrap="truncate-end">
              需驗證 {connectors.needsAuth.join('、')}
            </Text>
          )}
        </Box>
      )
    }

    const usageLine = (card: SessionCard) => {
      const report = card.report
      if (!cardShows(card, 'usage') || report === null) return null
      const parts = [
        report.costUsd != null && !isSubscription ? `$${report.costUsd.toFixed(2)}` : null,
        report.turns != null ? `${report.turns} 輪` : null,
      ].filter(one => one !== null)
      if (parts.length === 0) return null

      return (
        <Box key="usage" flexDirection="row" gap={1}>
          <Text size="caption" dimColor>
            {parts.join(' · ')}
          </Text>
        </Box>
      )
    }

    const body = (card: SessionCard, width: number) => (
      <>
        {contextLine(card, width)}
        {detailLines(card).map((line, index) => (
          <Text key={`line-${index}`} size="caption" dimColor wrap="truncate-end">
            {line}
          </Text>
        ))}
        {environmentLine(card)}
        {changesLine(card)}
        {prLine(card)}
        {contextBar(card)}
        {connectorsLine(card)}
        {usageLine(card)}
        {taskLines(card, width)}
        {card.report === null && card.status !== 'idle' && (
          <Text key="no-report" size="caption" dimColor>
            基本狀態
          </Text>
        )}
      </>
    )

    const longestWait = Math.max(0, ...waiting.map(card => (card.since === null ? 0 : now - card.since)))
    const summary =
      waiting.length > 0
        ? `最長等待 ${shortAge(longestWait)} · 點選標題前往`
        : current.sessions.length === 0
          ? '沒有其他執行中的 Session'
          : [busy.length > 0 ? `執行中 ${busy.length}` : null, idle.length > 0 ? `閒置 ${idle.length}` : null]
              .filter(one => one !== null)
              .join(' · ')

    // rate limit 是帳號層級的：取最新一份回報，在頁首顯示一次
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

    const section = (key: string, label: string, color: string, n: number, action?: JSX.Element) => (
      <Box key={key} flexDirection="row" justifyContent="space-between" alignItems="center">
        <Text size="footnote" weight="semibold" color={color}>
          {label} {n}
        </Text>
        {action}
      </Box>
    )

    return (
      <Box flexDirection="column" gap={1}>
        <Box key="toolbar" flexDirection="row" justifyContent="flex-end">
          <Button key="settings" plain dimColor onPress={() => update($, isSettingsOpen, value => !value)}>
            {isOpen ? '⚙ 檢視 ▴' : '⚙ 檢視 ▾'}
          </Button>
        </Box>
        {isOpen && (
          <Box key="view-panel" flexDirection="column" borderStyle="round" borderDimColor paddingX={1} gap={1}>
            <Box flexDirection="row" gap={1} alignItems="center">
              <Text size="caption" dimColor>
                計費
              </Text>
              {BILLINGS.map(one => (
                <Button
                  key={`billing-${one.billing}`}
                  variant={settings.billing === one.billing ? 'primary' : 'secondary'}
                  onPress={() => setBilling($, one.billing)}
                >
                  {one.label}
                </Button>
              ))}
            </Box>
            <Box flexDirection="row" gap={1} alignItems="center">
              <Text size="caption" dimColor>
                設定
              </Text>
              {GROUPS.map(one => (
                <Button
                  key={`group-${one.group}`}
                  variant={editing === one.group ? 'primary' : 'secondary'}
                  onPress={() => update($, settingsGroup, () => one.group)}
                >
                  {one.label}
                </Button>
              ))}
            </Box>
            <Box flexDirection="row" gap={1} alignItems="center">
              <Text size="caption" dimColor>
                密度
              </Text>
              {DENSITIES.map(one => (
                <Button
                  key={`density-${one.density}`}
                  variant={density === one.density ? 'primary' : 'secondary'}
                  onPress={() => setDensity($, editing, one.density)}
                >
                  {one.label}
                </Button>
              ))}
              {density === null && (
                <Text size="caption" color="suggestion">
                  自訂
                </Text>
              )}
            </Box>
            <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
              {FIELDS.map(({ field, label }) => (
                <Button key={`field-${field}`} plain onPress={() => toggleField($, editing, field)}>
                  {showsIn(editing, field) ? `☑ ${label}` : `☐ ${label}`}
                </Button>
              ))}
            </Box>
          </Box>
        )}

        <Box
          key="header"
          flexDirection="column"
          borderStyle={waiting.length > 0 ? 'bold' : 'round'}
          borderColor={waiting.length > 0 ? 'warning' : 'success'}
          borderDimColor={waiting.length === 0}
          paddingX={1}
        >
          <Box key="count">
            {current.needsYou === 0 ? (
              <Text color="success" weight="semibold">
                ✓ 無待處理項目
              </Text>
            ) : (
              <Text color="warning" size="heading" weight="bold">
                ▲ {current.needsYou} 個 Session 待處理
              </Text>
            )}
          </Box>
          <Box key="summary">
            <Text size="caption" dimColor>
              {summary}
            </Text>
          </Box>
        </Box>

        {(rateLimits.length > 0 || totalCost > 0) && (
          <Box key="account" flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
            <Text size="footnote" weight="semibold" dimColor>
              帳號用量
            </Text>
            {rateLimits.map(one => {
              const resetIn = one.resetsAt === undefined ? null : Date.parse(one.resetsAt) - now
              return (
                <Box key={`rate-${rateLabel(one.kind)}`} flexDirection="row" justifyContent="space-between">
                  <Text size="caption" color={usageColor(one.percentUsed)}>
                    {rateLabel(one.kind)} {usageBar(one.percentUsed, 10)}
                  </Text>
                  {resetIn !== null && Number.isFinite(resetIn) && resetIn > 0 && (
                    <Text size="caption" dimColor>
                      {shortAge(resetIn)} 後重置
                    </Text>
                  )}
                </Box>
              )
            })}
            {totalCost > 0 && (
              <Box key="total-cost">
                <Text size="caption" dimColor>
                  所有 Session 花費 ${totalCost.toFixed(2)}
                </Text>
              </Box>
            )}
          </Box>
        )}

        {current.error !== null && (
          <Box key="error">
            <Text color="error">{current.error}</Text>
          </Box>
        )}

        {waiting.length > 0 && section('section-waiting', '需要你處理', 'warning', waiting.length)}
        {waiting.map(card => (
          <Box
            key={`card-${card.pid}`}
            flexDirection="column"
            borderStyle="bold"
            borderColor="warning"
            paddingX={1}
          >
            {titleRow(card, cardWidth)}
            {body(card, cardWidth)}
          </Box>
        ))}

        {busy.length > 0 && section('section-busy', '工作中', 'claude', busy.length)}
        {busy.map(card => (
          <Box
            key={`card-${card.pid}`}
            flexDirection="column"
            borderStyle="round"
            borderColor="claude"
            borderDimColor
            paddingX={1}
          >
            {titleRow(card, cardWidth)}
            {body(card, cardWidth)}
          </Box>
        ))}

        {idle.length > 0 &&
          section(
            'section-idle',
            '閒置',
            'inactive',
            idle.length,
            <Button key="toggle-idle" plain dimColor onPress={() => toggleIdle($)}>
              {settings.isIdleCollapsed ? '展開 ▾' : '收合 ▴'}
            </Button>,
          )}
        {!settings.isIdleCollapsed &&
          idle.map(card => (
            <Box key={`card-${card.pid}`} flexDirection="column" paddingX={1}>
              {titleRow(card, rowWidth)}
              {body(card, rowWidth)}
            </Box>
          ))}
      </Box>
    )
  })
}

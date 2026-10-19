import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderSurface, UiPane } from 'claude-code'

import type {
  Billing,
  Density,
  Field,
  Group,
  Locale,
  Report,
  ScanError,
  SessionCard,
  Snapshot,
  Task,
  UpdateFacts,
  Version,
  View,
} from '../types'
import {
  DEFAULT_FIELDS,
  GLYPHS,
  HOST_COMMANDS,
  LATEST_MANIFEST_URL,
  PRESETS,
  VALID_FIELDS,
  applyPlan,
  arrange,
  branchLabel,
  clipToWidth,
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
  displayWidth,
  locationOf,
  manifestVersionOf,
  parseGitStatus,
  parseNumstat,
  parsePullRequest,
  parseRecord,
  parseReport,
  parseVersion,
  progressOfTodos,
  questionOf,
  rateKind,
  shortAge,
  shortModel,
  sourceMark,
  staleReports,
  summarizeReply,
  summarizeTool,
  taskStatusOf,
  taskTitle,
  wrapUpQuestionOf,
  tabScriptOf,
  toCards,
  topicOf,
  updateNoticeOf,
  usageBar,
  usageColor,
  versionText,
} from './board'
import type { HostCommands, Layout, PlanItem } from './board'
import { LOCALES, firstAppleLanguage, localeOf, messagesOf } from './i18n'
import type { Messages } from './i18n'

// 指令來自 commands/open.md，以 plugin 名稱為命名空間
const COMMAND = 'switchboard:open'
const PANE = 'switchboard'
const TITLE = 'Switchboard'
/** 作者的 GitHub */
const AUTHOR_URL = 'https://github.com/wide3751'

/** Pane 標題：有待處理時帶上數量，分頁標籤上就看得到 */
const titleOf = (needsYou: number): string => (needsYou > 0 ? `${TITLE} · ${GLYPHS.waiting.char}${needsYou}` : TITLE)
const POLL_MS = 3000
/** 監看視窗沒畫出來時，替打開按鈕做輕量掃描的間隔（ADR-0006） */
const LIGHT_POLL_MS = 15_000
/** 資料比現在舊超過這麼久，就標出是多久以前的（約三次 polling） */
const STALE_MS = 10_000
/** Desktop 的任務清單工具 */
const PLAN_TOOL = 'mcp__ccd_turn__update_plan'
const WRAP_UP_TOOL = 'mcp__ccd_turn__wrap_up'
const VIEW_KEY = 'view'
/** 設定面板上次選的分區；不放進 View，別的 Session 改分區時這裡的面板不會跟著跳 */
const SETTINGS_GROUP_KEY = 'settingsGroup'
/** 回合出錯但沒有訊息時的標記 */
const API_ERROR = 'api-error'
/** 檢查更新的間隔，第一次也在啟動後這麼久：不和 Claude Code 啟動時的工作擠在一起，只開一下就關的 Session 也不發請求 */
const UPDATE_TICK_MS = 60_000
/** $.http.fetch 沒有逾時：讀公布的版本最多等這麼久，之後當作沒有新版 */
const UPDATE_FETCH_MS = 10_000
/** 上次檢查更新看到的公布版本（x.y.z），所有 Session 共用 */
const UPDATE_LATEST_KEY = 'updateLatest'

/** 標題列放不下「目前」時改用的一格寬標記 */
const CURRENT_MARK = GLYPHS.current.char

/** 狀態的圖示、顏色與外框：重要程度主要靠外框粗細區分，顏色只是輔助 */
const LOOK: Record<SessionCard['status'], { glyph: string; color: string }> = {
  waiting: { glyph: GLYPHS.waiting.char, color: 'warning' },
  busy: { glyph: GLYPHS.busy.char, color: 'claude' },
  idle: { glyph: GLYPHS.idle.char, color: 'inactive' },
  errored: { glyph: GLYPHS.errored.char, color: 'error' },
  unknown: { glyph: GLYPHS.unknown.char, color: 'inactive' },
}

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
  autoOpenCli: false,
}

const BILLINGS: readonly Billing[] = ['auto', 'subscription', 'api']

/**
 * 能畫出監看視窗的介面：Desktop 和終端機；VS Code 擴充套件的圖形介面不行。
 * 指令、輸入框上方的按鈕、自動打開都看這一份。排在前面的優先：同時在兩邊畫的 Session 算 Desktop
 */
const BOARD_SURFACES = ['desktop', 'terminal'] as const satisfies readonly RenderSurface[]
type BoardSurface = (typeof BOARD_SURFACES)[number]

const isBoardSurface = (surface: RenderSurface): surface is BoardSurface =>
  BOARD_SURFACES.some(one => one === surface)

/**
 * 有 children 的 Button 的 label：終端機畫 children、label 只當名稱；
 * Desktop 實際上會把 label 畫出來取代 children（例如展開鈕的 ▸ 變成「顯示明細：{標題}」撐破卡片），所以只在終端機給。
 */
const nameOn = (surface: RenderSurface, label: string): { label?: string } => (surface === 'terminal' ? { label } : {})

/** Session 用哪個介面顯示監看視窗；都不能顯示時是 null。 */
const boardSurfaceOf = (surfaces: readonly RenderSurface[]): BoardSurface | null =>
  BOARD_SURFACES.find(one => surfaces.includes(one)) ?? null

type AutoOpenKey = 'autoOpen' | 'autoOpenCli'

/** 各介面的自動打開看檢視設定的哪個開關 */
const AUTO_OPEN_KEY: Record<BoardSurface, AutoOpenKey> = { desktop: 'autoOpen', terminal: 'autoOpenCli' }

const snapshot = atom({ plugin: 'switchboard', key: 'snapshot' } as const, null)
const view = atom({ plugin: 'switchboard', key: 'view' } as const, DEFAULT_VIEW)
const isSettingsOpen = atom({ plugin: 'switchboard', key: 'isSettingsOpen' } as const, false)
/** 設定面板正在設定的分區：打開面板時從 store 讀上次的選擇，第一次是待處理 */
const settingsGroup = atom({ plugin: 'switchboard', key: 'settingsGroup' } as const, 'waiting')
const expanded = atom({ plugin: 'switchboard', key: 'expanded' } as const, [])
/** 這個 Session 的監看視窗是否已經畫出來（只叫引擎打開、還在等終端機變寬的不算） */
const isBoardShown = atom({ plugin: 'switchboard', key: 'isBoardShown' } as const, false)
/** 介面文字實際用的語言；放在狀態裡，語言決定後已經畫出來的按鈕才會重畫 */
const shownLocale = atom({ plugin: 'switchboard', key: 'shownLocale' } as const, 'en')
/** 打開按鈕上的等你計數；null 是還沒掃過或掃描失敗，按鈕不顯示計數（不能顯示 0） */
const bandCount = atom({ plugin: 'switchboard', key: 'bandCount' } as const, null)
/**
 * 打開按鈕旁要不要畫「不再自動打開」：剛手動關掉、而且自動打開開著時是那個開關（toast 放不了按鈕），否則是 null。
 * 別的 Session 之後關掉了那個開關，由輕量掃描確認後收起來
 */
const offersStopAutoOpen = atom({ plugin: 'switchboard', key: 'offersStopAutoOpen' } as const, null)
const NO_UPDATE_FACTS: UpdateFacts = { loaded: null, latest: null }
/** 新版提示的依據；只有 refreshUpdate 寫 */
const updateFacts = atom({ plugin: 'switchboard', key: 'updateFacts' } as const, NO_UPDATE_FACTS)

// 用到 $ 的函式都寫在這個檔案：Desktop 自帶的 Claude Code 不讓 $ 跨 import 傳遞

/** Windows 看 OS 環境變數（Git Bash 也有），不必跑指令。 */
async function isWindows($: EngineInterface): Promise<boolean> {
  return (await $.env.get('OS')) === 'Windows_NT'
}

/** 這台電腦跑外部指令的寫法：Windows 用自己的一組，其餘（macOS、Linux）維持 unix 的。 */
async function hostCommands($: EngineInterface): Promise<HostCommands> {
  return HOST_COMMANDS[(await isWindows($)) ? 'windows' : 'unix']
}

/** 家目錄照 Claude Code 的 os.homedir()：Windows 看 USERPROFILE，其餘看 HOME。 */
async function configDir($: EngineInterface): Promise<string> {
  const homes = (await isWindows($))
    ? [await $.env.get('USERPROFILE'), await $.env.get('HOME')]
    : [await $.env.get('HOME')]
  return configDirOf(await $.env.get('CLAUDE_CONFIG_DIR'), homes)
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

/** 要跑 git、gh 的欄位，和用量：狀態欄位寫完之後才補。 */
async function readDetails(
  $: EngineInterface,
): Promise<Pick<Report, 'branch' | 'connectors' | 'pr' | 'contextPercent' | 'costUsd' | 'turns' | 'rateLimits'>> {
  return {
    branch: await readBranch($),
    connectors: await readConnectors($),
    pr: await readPullRequest($),
    ...(await readUsage($)),
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
        terminal: null,
        topic: null,
      }
    }
    // 先拿時間再合併：合併時不能隔著 await，否則同時進行的另一次寫入會被這次的舊內容蓋掉
    const reportedAt = await $.clock.now()
    own = { ...own, ...patch, reportedAt }
    await $.fs.write(`${await configDir($)}/switchboard/reports/${own.sessionId}.json`, JSON.stringify(own))
  } catch {
    // 回報失敗時，監看視窗只顯示基本狀態
  }
}

/** 這個 Session 之前寫過的回報裡的主題（mod 熱重載、resume 後 own 從頭開始）；沒有時是 null。 */
async function previousTopic($: EngineInterface): Promise<string | null> {
  try {
    const text = await $.fs.read(`${await configDir($)}/switchboard/reports/${await $.session.id()}.json`)

    return typeof text === 'string' ? (parseReport(text)?.topic ?? null) : null
  } catch {
    return null
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
    if (stale.length === 0) return
    // 路徑不能安全交給系統的刪檔指令時不刪，下次掃描再說
    const argv = (await hostCommands($)).remove(stale.map(name => `${dir}/${name}`))
    if (argv !== null) await $.process.run(argv)
  } catch {
    // 資料夾還不存在，或刪除失敗：下次掃描再試
  }
}

/** 仍存活的 pid 與它所在的終端機（跳轉到 CLI Session 的分頁時用）。 */
async function alivePids($: EngineInterface, pids: readonly number[]): Promise<Map<number, string | null>> {
  if (pids.length === 0) return new Map()
  const host = await hostCommands($)
  // 和 git 一樣最多等 5 秒（引擎預設等 30 秒）：Session 啟動時要等這次掃描，卡住不能拖住啟動
  const { stdout } = await $.process.run(host.alive(pids), { timeoutMs: 5000 })

  return host.parseAlive(stdout, pids)
}

/** 讀所有 session 紀錄與狀態回報、檢查 pid，算出這一次的結果。 */
async function scan($: EngineInterface): Promise<Snapshot> {
  const base = await configDir($)
  const scannedAt = await $.clock.now()
  let texts: { name: string; text: string }[]
  try {
    texts = await readTexts($, `${base}/sessions`)
  } catch {
    return { needsYou: 0, error: { kind: 'unreadable', dir: `${base}/sessions` }, sessions: [], scannedAt }
  }
  const records = texts.map(one => parseRecord(one.name, one.text)).filter(one => one !== null)
  const alive = await alivePids($, [...new Set(records.map(one => one.pid))])
  const liveIds = records.filter(one => alive.has(one.pid)).flatMap(one => (one.sessionId === null ? [] : [one.sessionId]))
  const reports = await readReports($, `${base}/switchboard/reports`, liveIds)
  // 自己的回報一律保留，其餘不屬於任何 session 紀錄的才刪。
  // 一筆紀錄都沒有（連目前這個都沒有，見下面的 no-records）時是讀錯了地方，不能把所有回報都當成殘留
  const knownIds = new Set(records.flatMap(one => (one.sessionId === null ? [] : [one.sessionId])))
  if (own !== null) knownIds.add(own.sessionId)
  if (records.length > 0) await removeStaleReports($, `${base}/switchboard/reports`, knownIds, scannedAt)
  const cards = toCards(records, alive, reports)
  // 自我檢查：目前這個 Session 一定還活著。有它的紀錄、清單裡卻沒有它，就是檢查存活的方法壞了
  // （例如 ps 什麼都不輸出，所有 Session 都被濾掉），這時不能說「沒有在等你」
  const isSelfMissing =
    own !== null &&
    records.some(one => one.sessionId === own?.sessionId) &&
    !cards.some(card => card.sessionId === own?.sessionId)

  // 清單是 0 筆：目前這個 Session 一定在跑，連它都沒有就是紀錄讀錯了地方，不能說「沒有其他 Session」
  const error: Snapshot['error'] = isSelfMissing
    ? { kind: 'self-missing' }
    : cards.length === 0
      ? { kind: 'no-records', dir: `${base}/sessions` }
      : null

  return {
    needsYou: countWaiting(cards),
    error,
    sessions: cards,
    scannedAt,
  }
}

/**
 * 輕量掃描（ADR-0006）：監看視窗沒畫出來時，替輸入框上方的打開按鈕算等你計數。
 * 和監看視窗的掃描一樣只讀 session 紀錄、狀態回報，跑一次 ps，不跑 git、gh；順便清掉殘留的回報
 * （讀不到 session 紀錄、或一筆都沒有時不清，免得把所有回報都當成殘留刪掉）。
 * 掃描失敗、檢查不過時計數是 null：按鈕不顯示計數，不能顯示 0（掃描失敗不能變成「沒有在等你」）
 */
async function lightScan($: EngineInterface) {
  try {
    await recheckStopAutoOpen($)
  } catch {
    // 只是收起提示，失敗了下次再試，不影響計數
  }
  // 上一次還沒做完（例如 ps 卡住）就跳過這次
  if (isLightScanning) return
  isLightScanning = true
  // 掃描期間監看視窗的掃描寫過較新的計數，這次的結果就作廢
  const started = bandWrites
  let count: number | null
  try {
    const next = await scan($)
    count = next.error === null ? next.needsYou : null
  } catch {
    count = null
  }
  try {
    if (bandWrites === started) await update($, bandCount, () => count)
  } catch {
    // 連狀態都寫不進去：下次再試
  } finally {
    isLightScanning = false
  }
}

/** 「不再自動打開」要關的開關，別的 Session 已經關掉（或讀不到設定）就收起來 */
async function recheckStopAutoOpen($: EngineInterface) {
  const key = await read($, offersStopAutoOpen)
  if (key === null) return
  let isOn: boolean
  try {
    isOn = parseView(await $.store.get(VIEW_KEY))[key]
  } catch {
    isOn = false
  }
  // 讀 store 期間按了按鈕或重新打開：已經不是同一個提示，不動
  if (!isOn) await update($, offersStopAutoOpen, current => (current === key ? null : current))
}

let lightPoller: { cancel: () => void } | undefined
let isLightScanning = false
// 監看視窗的掃描寫入按鈕計數的次數。輕量掃描回來時這個數字變了，表示監看視窗已經寫過較新的計數
let bandWrites = 0

/** 開始每 15 秒的輕量掃描；只在畫得出監看視窗（輸入框上方有打開按鈕）的 Session。已經在跑就不動。 */
async function startLightPolling($: EngineInterface) {
  if (lightPoller !== undefined) return
  const surface = boardSurfaceOf(await $.session.surfaces())
  // 等待期間另一次呼叫已經開了（或監看視窗畫出來了），不再開第二個
  if (lightPoller !== undefined || surface === null || (await read($, isBoardShown))) return
  lightPoller = $.clock.every(LIGHT_POLL_MS, () => lightScan($))
}

function stopLightPolling() {
  lightPoller?.cancel()
  lightPoller = undefined
}

/**
 * 記下監看視窗有沒有畫出來：畫出來就停掉輕量掃描，改用監看視窗的掃描；
 * 沒畫出來就（重新）開始輕量掃描，剛從畫出來變成沒畫出來（關掉了）時馬上掃一次，按鈕不用等 15 秒。
 * `isCurrent` 是 poll 傳的：等待期間監看視窗被關掉（polling 停了），這次的結果就不能再寫
 */
async function setBoardShown($: EngineInterface, isShown: boolean, isCurrent: () => boolean = () => true) {
  const wasShown = await read($, isBoardShown)
  if (!isCurrent()) return
  await update($, isBoardShown, () => isShown)
  if (!isCurrent()) {
    // 寫入期間被關掉：ui.close 寫的 false 可能被這次的 true 蓋掉，補寫回去並恢復輕量掃描
    if (poller === undefined) {
      await update($, isBoardShown, () => false)
      await startLightPolling($)
    }
    return
  }
  if (isShown) {
    stopLightPolling()
    return
  }
  await startLightPolling($)
  if (wasShown) void lightScan($)
}

let poller: { cancel: () => void } | undefined
let isScanning = false
// 使用者在這個 Session 手動關掉監看視窗後，就不再自動打開
let isClosedByPerson = false

/**
 * 使用者手動關掉監看視窗：這個 Session 不再自動打開。
 * 這個介面開著自動打開時跳一次 toast：重開 Session 還會再打開，要全面關掉得到設定裡關開關
 */
async function closedByPerson($: EngineInterface) {
  if (isClosedByPerson) return
  isClosedByPerson = true
  try {
    const surface = boardSurfaceOf(await $.session.surfaces())
    if (surface === null) return
    const key = AUTO_OPEN_KEY[surface]
    if (!parseView(await $.store.get(VIEW_KEY))[key]) return
    // 寫出完整路徑：監看視窗 › 設定 ▸ › 一般 › 取消「自動打開監看視窗 › Desktop Session」
    const m = messages
    const option = surface === 'desktop' ? m.panel.autoOpenDesktop : m.panel.autoOpenTerminal
    $.ui.toast(m.toast.closed(`${m.view} ${GLYPHS.collapsed.char} › ${m.panel.general}`, `${m.panel.autoOpenTitle} › ${option}`))
    await update($, offersStopAutoOpen, () => key)
  } catch {
    // 只是說明，失敗了不影響關閉
  }
}

/** 這個 Session 的監看視窗 Pane；沒打開時是 undefined。已打開但還沒畫出來時 `isPlaced` 是 false。 */
async function findBoard($: EngineInterface): Promise<UiPane | undefined> {
  return (await $.ui.panes()).find(one => one.id === PANE)
}

async function poll($: EngineInterface) {
  if (isScanning) {
    // 上一次掃描卡住了：狀態沒變不會重畫，請引擎重畫，畫面才標得出資料是多久以前的
    $.ui.invalidate('ui.render')
    return
  }
  isScanning = true
  // 這次 poll 所屬的 polling；等待期間被 ui.close 停掉（或停了又重開）時，這次的結果不能再拿來改狀態
  const running = poller
  try {
    // Pane 不見就停止 polling，並當成使用者手動關掉、之後不再自動打開。
    // 不靠 ui.close 判斷，原因有二：mod 自己從不關 Pane，開著時消失只可能是外力；
    // 測試工具也模擬不了使用者按關閉鈕觸發的 ui.close，只能把 Pane 從 panes() 拿掉。
    // 副作用：別的 plugin 關掉這個 Pane 也會算成使用者關的
    const pane = await findBoard($)
    if (poller !== running) return
    if (pane === undefined) {
      stopPolling()
      forgetBoardFocus()
      await closedByPerson($)
      await setBoardShown($, false)
      return
    }
    // 還沒畫出來（mod 自己主動打開、終端機太窄）：當作沒打開，按鈕照樣顯示、照樣輕量掃描，這裡不掃描。
    // 引擎在終端機變寬時不發事件，只能在這裡等它畫出來，畫出來後按鈕消失、開始掃描
    await setBoardShown($, pane.isPlaced, () => poller === running)
    if (poller !== running || !pane.isPlaced) return
    await syncView($)
    const next = await scan($)
    const previous = await read($, snapshot)
    await update($, snapshot, () => next)
    // 按鈕的計數跟著更新：關掉監看視窗時按鈕馬上是最新的，不是打開之前的
    bandWrites += 1
    await update($, bandCount, () => (next.error === null ? next.needsYou : null))
    // 待處理數量變了就更新標題（同一個 id 再開一次只會改標題）。
    // ui.open 對已經關掉的 Pane 會重新打開：掃描期間使用者關掉了就不改
    if (
      (previous === null || previous.needsYou !== next.needsYou) &&
      poller === running &&
      (await findBoard($)) !== undefined
    ) {
      await $.ui.open({ id: PANE, title: titleOf(next.needsYou) })
    }
  } catch (error) {
    // ps、ui.panes 等丟例外：不能讓畫面停在上一次（或一直是 Loading），改顯示看不到狀態。
    // 上一次的卡片和時間留著，畫面會標出資料是多久以前的
    const reason = error instanceof Error ? error.message : String(error)
    try {
      const now = await $.clock.now()
      await update($, snapshot, previous => ({
        needsYou: previous?.needsYou ?? 0,
        sessions: previous?.sessions ?? [],
        scannedAt: previous?.scannedAt ?? now,
        error: { kind: 'failed', reason },
      }))
      // 看不到狀態：按鈕不顯示計數
      bandWrites += 1
      await update($, bandCount, () => null)
    } catch {
      // 連狀態都寫不進去：下次 polling 再試
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

/**
 * 把 store 裡的檢視設定讀成 View：舊版或其他版本存的可能缺欄位、型別不對，一律補成預設值。
 * 沒存過（undefined）就是預設設定。
 */
function parseView(stored: unknown): View {
  const raw = (typeof stored === 'object' && stored !== null ? stored : {}) as { [K in keyof View]?: unknown }
  const fields = raw.fields
  return {
    // 舊版存的是一份共用清單：套用到每一組
    fields: Array.isArray(fields)
      ? { waiting: [...fields], busy: [...fields], idle: [...fields] }
      : { ...DEFAULT_VIEW.fields, ...((fields ?? {}) as Partial<View['fields']>) },
    isIdleCollapsed: raw.isIdleCollapsed === true,
    billing: BILLINGS.find(one => one === raw.billing) ?? 'auto',
    locale: LOCALES.find(one => one.locale === raw.locale)?.locale ?? 'auto',
    // Desktop 預設開、CLI 預設關
    autoOpen: raw.autoOpen !== false,
    autoOpenCli: raw.autoOpenCli === true,
  }
}

/** 上次從 store 讀到或寫進 store 的檢視設定（JSON）；poll 時用來判斷別的 Session 有沒有改過 */
let seenView: string | undefined
/** 正在寫入的檢視設定變更數；寫入途中讀到的 store 可能是改之前的值 */
let pendingViewChanges = 0

async function loadView($: EngineInterface) {
  const stored = await $.store.get(VIEW_KEY)
  // 這裡正在改設定：讀到的可能是改之前的值，套用會蓋掉剛改的設定，之後 store 又和 seenView 一樣，
  // 畫面就一直停在舊設定。這次不套用，寫完之後的 poll 再同步
  if (pendingViewChanges > 0) return
  seenView = JSON.stringify(stored)
  if (stored === undefined) {
    await useLocale($, 'auto')
    return
  }
  const next = parseView(stored)
  await update($, view, () => next)
  await useLocale($, next.locale)
}

/** poll 時順便讀一次 store：別的 Session 改了設定（語言、密度…），這裡跟著變；沒變就不動。 */
async function syncView($: EngineInterface) {
  try {
    const stored = await $.store.get(VIEW_KEY)
    if (JSON.stringify(stored) === seenView) return
    await loadView($)
  } catch {
    // 讀不到設定時沿用目前的，不影響掃描
  }
}

async function changeView($: EngineInterface, change: (current: View) => View) {
  pendingViewChanges += 1
  try {
    const next = await update($, view, change)
    await $.store.set(VIEW_KEY, next)
    // 寫完才記下：寫入途中的 poll 讀到舊值，和上次看到的一樣，不會蓋回去
    seenView = JSON.stringify(next)
  } finally {
    pendingViewChanges -= 1
  }
}

async function toggleField($: EngineInterface, group: Group, field: Field) {
  await changeView($, current => {
    const list = current.fields[group]
    const next = list.includes(field) ? list.filter(one => one !== field) : [...list, field]

    return { ...current, fields: { ...current.fields, [group]: next } }
  })
}

/** 存在 store 裡的分區選擇；沒存過或值不對時是待處理 */
const parseGroup = (stored: unknown): Group => GROUPS.find(one => one === stored) ?? 'waiting'

/** 打開或關掉設定面板；打開時換成上次選的分區（可能是別的 Session 選的） */
async function toggleSettings($: EngineInterface) {
  if (!(await read($, isSettingsOpen))) {
    try {
      const group = parseGroup(await $.store.get(SETTINGS_GROUP_KEY))
      await update($, settingsGroup, () => group)
    } catch {
      // 讀不到就沿用目前的分區
    }
  }
  await update($, isSettingsOpen, value => !value)
}

/** 選分區：畫面馬上換，再存進 store 給下次打開面板用 */
async function chooseGroup($: EngineInterface, group: Group) {
  await update($, settingsGroup, () => group)
  try {
    await $.store.set(SETTINGS_GROUP_KEY, group)
  } catch {
    // 存不了只是下次不記得，不影響這次
  }
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

/** 依設定的語言換掉介面文字；自動時依系統語言。 */
async function useLocale($: EngineInterface, locale: 'auto' | Locale) {
  const shown = locale === 'auto' ? await detectLocale($) : locale
  messages = messagesOf(shown)
  await update($, shownLocale, () => shown)
}

async function setLocale($: EngineInterface, locale: 'auto' | Locale) {
  await changeView($, current => ({ ...current, locale }))
  await useLocale($, locale)
}

/** 切換 Desktop 或 CLI 的「自動打開」開關。 */
async function toggleAutoOpen($: EngineInterface, key: AutoOpenKey) {
  await changeView($, current => ({ ...current, [key]: !current[key] }))
}

/**
 * 「不再自動打開」：關掉這個介面的自動打開。一律寫成關，不用切換：
 * 別的 Session 可能已經關掉了，切換會反而打開。
 * 先讀一次 store：監看視窗關著時沒有 poll 同步設定，view atom 可能是別的 Session 改之前的
 */
async function stopAutoOpen($: EngineInterface) {
  await update($, offersStopAutoOpen, () => null)
  const surface = boardSurfaceOf(await $.session.surfaces())
  if (surface === null) return
  await syncView($)
  await changeView($, current => ({ ...current, [AUTO_OPEN_KEY[surface]]: false }))
}

/**
 * 依介面對應的設定自動打開監看視窗：Desktop 看 Desktop 的開關（預設開），終端機看 CLI 的開關（預設關）。
 * 直接讀 store 而不是 view atom：別的 Session 改了設定，這裡也要跟著生效
 */
async function autoOpenBoard($: EngineInterface) {
  if (isClosedByPerson) return
  const surface = boardSurfaceOf(await $.session.surfaces())
  if (surface === null || !parseView(await $.store.get(VIEW_KEY))[AUTO_OPEN_KEY[surface]]) return
  const pane = await findBoard($)
  // 已經打開（可能還在等終端機變寬才畫出來）就不重開
  if (pane === undefined) await openBoard($)
  else await watchBoard($, pane.isPlaced)
}

/** 打開監看視窗並開始 polling；指令、輸入框上方的按鈕與自動開啟共用。 */
async function openBoard($: EngineInterface) {
  isClosedByPerson = false
  forgetBoardFocus()
  await update($, offersStopAutoOpen, () => null)
  const opened = await $.ui.open({ id: PANE, title: TITLE })
  await watchBoard($, opened.isPlaced)

  return opened
}

/**
 * 「已打開」一律看 Pane 是否已經畫出來：畫出來了按鈕消失；
 * 還沒畫出來（mod 自己主動打開、終端機太窄）就照樣顯示按鈕，polling 只等它畫出來、不掃描。
 */
async function watchBoard($: EngineInterface, isPlaced: boolean) {
  await setBoardShown($, isPlaced)
  startPolling($)
}

async function setBilling($: EngineInterface, billing: Billing) {
  await changeView($, current => ({ ...current, billing }))
}

/** 設定面板裡的設定（三個分區的欄位、自動打開、語言、計費）都還原成預設值；閒置收合不在面板裡，照舊 */
const isPanelDefault = (current: View) =>
  GROUPS.every(group => {
    const mine = current.fields[group]
    const preset = DEFAULT_VIEW.fields[group]

    return mine.length === preset.length && preset.every(one => mine.includes(one))
  }) &&
  current.autoOpen === DEFAULT_VIEW.autoOpen &&
  current.autoOpenCli === DEFAULT_VIEW.autoOpenCli &&
  current.locale === DEFAULT_VIEW.locale &&
  current.billing === DEFAULT_VIEW.billing

async function resetView($: EngineInterface) {
  await changeView($, current => ({
    ...DEFAULT_VIEW,
    fields: { waiting: [...DEFAULT_VIEW.fields.waiting], busy: [...DEFAULT_VIEW.fields.busy], idle: [...DEFAULT_VIEW.fields.idle] },
    isIdleCollapsed: current.isIdleCollapsed,
  }))
  await useLocale($, DEFAULT_VIEW.locale)
}

async function toggleExpand($: EngineInterface, pid: number) {
  await update($, expanded, list => (list.includes(pid) ? list.filter(one => one !== pid) : [...list, pid]))
}

async function toggleIdle($: EngineInterface) {
  await changeView($, current => ({ ...current, isIdleCollapsed: !current.isIdleCollapsed }))
}

type Platform = 'mac' | 'windows' | 'other'

/** 這台電腦的作業系統；undefined 是還沒查過，null 是查不出來 */
let platform: Platform | null | undefined

/** 作業系統：Windows 看 OS 環境變數（Git Bash 也有），其餘看 `uname -s`；查不出來時是 null。 */
async function platformOf($: EngineInterface): Promise<Platform | null> {
  if (platform !== undefined) return platform
  try {
    if (await isWindows($)) {
      platform = 'windows'
    } else {
      const { exitCode, stdout } = await $.process.run(['uname', '-s'], { timeoutMs: 3000 })
      const name = stdout.trim()
      platform =
        exitCode !== 0 || name === ''
          ? null
          : name === 'Darwin'
            ? 'mac'
            : /^(mingw|msys|cygwin)/i.test(name)
              ? 'windows'
              : 'other'
    }
  } catch {
    platform = null
  }

  return platform
}

/** 指令回覆後面補的平台說明：Windows 只能跳到 Desktop，其他非 macOS 完全不能跳；macOS 或查不出來時不說。 */
async function platformNote($: EngineInterface): Promise<string> {
  const found = await platformOf($)

  return found === 'windows' ? ` ${messages.command.windows}` : found === 'other' ? ` ${messages.command.notMac}` : ''
}

/** 開啟 PR 頁面：只接受 https 網址。 */
async function openUrl($: EngineInterface, url: string) {
  if (!/^https:\/\/[^\s]+$/.test(url)) return
  await $.process.run((await hostCommands($)).open(url))
}

/** 這張卡片能不能直接跳過去：Desktop 的 deep link，或 iTerm、Terminal.app 依 tty 切分頁。 */
const canJump = (card: SessionCard): boolean =>
  desktopLinkOf(card.hostSessionId) !== null || tabScriptOf(card.report?.terminal ?? null, card.tty) !== null

/** 跳不過去時的說明：不知道在哪、要重開（0.6.0 之前開的 CLI Session），或說出是哪個終端機。 */
const noJumpMessage = (card: SessionCard): string => {
  // 來源是 CLI 表示回報裡沒有終端機：沒有這個欄位（舊版或沒載入 switchboard）時重開就能跳轉
  if (card.source === 'CLI') {
    return card.report?.terminal === undefined
      ? messages.toast.reopenToJump(card.path)
      : messages.toast.cliNoJump(card.path)
  }

  return card.source === null ? messages.toast.cliNoJump(card.path) : messages.toast.noJumpIn(card.source, card.path)
}

/**
 * 切分頁的 osascript 最多等多久。第一次控制某個終端機時 macOS 會跳出自動化權限的詢問，
 * osascript 會等使用者回答，所以不能太短（待真機確認：逾時砍掉 osascript 後，使用者的回答是否仍會被記住）
 */
const SCRIPT_TIMEOUT_MS = 10_000

// 防重複：Desktop 的一下點擊可能同時觸發焦點跳轉和按下，所以焦點跳轉前後 1.5 秒內，同一張卡片只跳一次。
// 單純的按下（不經焦點跳轉）只防雙擊和按住不放：和同一張卡片的上一下按下相隔不到 PRESS_REPEAT_MS 就不跳，
// 按住不放時每一下自動重複都和上一下比，所以一直按著也只跳一次；隔久一點刻意再按就跳
let lastJump: { pid: number; at: number; via: JumpVia } | null = null
let lastPress: { pid: number; at: number } | null = null
type JumpVia = 'focus' | 'press'
const PRESS_REPEAT_MS = 300

/**
 * 監看視窗上一次畫出來的樣子（分區次序與數字快捷鍵），依介面分開記：焦點在監看視窗裡時照這個畫，
 * 順序和數字都不變（GLOSSARY「凍結順序」）；焦點不在時照 toCards 的次序重排。Pane 關掉或重新打開就清掉
 */
const shownLayouts = new Map<RenderSurface, Layout>()

/**
 * 使用者上一次在監看視窗裡移動焦點的時間（任何元素都算，別的 mod 移的不算）：
 * 和這次相隔不到 TAB_BROWSE_MS 視為 Tab 瀏覽，焦點不跳轉。Pane 失去焦點、關掉或重新打開就清掉
 */
let lastFocusAt: number | null = null
const TAB_BROWSE_MS = 10_000
/** 上一次畫出來時焦點在監看視窗裡的介面：從有焦點變成沒有，就是 Pane 失焦 */
const focusedSurfaces = new Set<RenderSurface>()

/** 監看視窗關掉或重新打開：凍結的順序、焦點的紀錄都不沿用 */
function forgetBoardFocus() {
  shownLayouts.clear()
  focusedSurfaces.clear()
  lastFocusAt = null
}

/**
 * 點卡片：Desktop 的 Session 用 deep link 切過去；iTerm、Terminal.app 的 CLI Session 依 tty 切到分頁；
 * 其他終端機、找不到分頁或沒有權限時用 toast 說明原因與路徑；目前這個什麼都不做。
 */
async function jump($: EngineInterface, card: SessionCard, via: JumpVia = 'press') {
  if (card.sessionId !== null && card.sessionId === own?.sessionId) return
  const now = await $.clock.now()
  const isRepeat = via === 'press' && lastPress !== null && lastPress.pid === card.pid && now - lastPress.at < PRESS_REPEAT_MS
  if (via === 'press') lastPress = { pid: card.pid, at: now }
  if (isRepeat) return
  const isSameClick =
    lastJump !== null &&
    lastJump.pid === card.pid &&
    now - lastJump.at < 1500 &&
    (via === 'focus' || lastJump.via === 'focus')
  if (isSameClick) return
  lastJump = { pid: card.pid, at: now, via }
  const link = desktopLinkOf(card.hostSessionId)
  if (link === null) {
    const script = tabScriptOf(card.report?.terminal ?? null, card.tty)
    if (script === null) {
      $.ui.toast(noJumpMessage(card))
      return
    }
    let ran: { exitCode: number; stdout: string; stderr: string }
    try {
      // 終端機沒有回應時不要卡住（引擎預設等 30 秒）
      ran = await $.process.run(script, { timeoutMs: SCRIPT_TIMEOUT_MS })
    } catch {
      $.ui.toast(messages.toast.jumpFailed(card.title, card.path))
      return
    }
    const { exitCode, stdout, stderr } = ran
    if (exitCode === 0 && stdout.trim() === 'ok') return
    // 有腳本就一定知道是哪個終端機；保險起見，不知道時改用不需要終端機名稱的說法，不拼出殘缺的句子
    const terminal = card.source
    if (terminal === null) {
      $.ui.toast(messages.toast.jumpFailed(card.title, card.path))
      return
    }
    // 待真機確認：自動化權限被拒時 osascript 以錯誤結束，stderr 帶 -1743
    $.ui.toast(
      exitCode !== 0 && /-1743\b/.test(stderr)
        ? messages.toast.automationDenied(terminal)
        : messages.toast.tabMissing(terminal, card.path),
    )
    return
  }
  const { exitCode } = await $.process.run((await hostCommands($)).open(link))
  if (exitCode !== 0) $.ui.toast(messages.toast.jumpFailed(card.title, card.path))
}

// ── 檢查更新：讀 main 上公布的版本，和這份 plugin 的版本比較 ─────────────

let updateTicker: { cancel: () => void } | undefined
let isCheckingUpdate = false
/** 這次載入的程式的版本：重新載入前 plugin.json 不會變，讀一次記住 */
let loadedVersion: Promise<Version | null> | undefined

async function readLoadedVersion($: EngineInterface): Promise<Version | null> {
  try {
    const text = await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`)

    return typeof text === 'string' ? manifestVersionOf(text) : null
  } catch {
    return null
  }
}

/** 公布的版本；連不上、逾時、回應讀不懂都是 null，不區分原因 */
async function fetchLatest($: EngineInterface): Promise<Version | null> {
  let timer: { cancel: () => void } | undefined
  try {
    const gaveUp = new Promise<null>(resolve => {
      timer = $.clock.after(UPDATE_FETCH_MS, () => resolve(null))
    })
    const response = await Promise.race([$.http.fetch(LATEST_MANIFEST_URL), gaveUp])

    return response !== null && response.ok ? manifestVersionOf(response.text) : null
  } catch {
    return null
  } finally {
    timer?.cancel()
  }
}

/** 從 store 和 plugin.json 重新整理新版提示的依據；內容沒變就不寫，畫面不用重畫 */
async function refreshUpdate($: EngineInterface) {
  try {
    const facts: UpdateFacts = {
      loaded: await (loadedVersion ??= readLoadedVersion($)),
      latest: parseVersion(await $.store.get(UPDATE_LATEST_KEY)),
    }
    if (JSON.stringify(facts) === JSON.stringify(await read($, updateFacts))) return
    await update($, updateFacts, () => facts)
  } catch {
    // 下次再整理
  }
}

/** 讀公布的版本記進 store；任何失敗都當作沒有新版，不報錯、不清掉之前看到的版本 */
async function checkForUpdate($: EngineInterface) {
  if (isCheckingUpdate) return
  isCheckingUpdate = true
  try {
    const latest = await fetchLatest($)
    if (latest !== null) await $.store.set(UPDATE_LATEST_KEY, versionText(latest))
  } catch {
    // 寫不進 store：下次再檢查
  } finally {
    isCheckingUpdate = false
  }
  await refreshUpdate($)
}

/** 只在畫得出監看視窗的 Session 檢查（和輕量掃描同一個條件）；熱重載後由 session.start 重新裝上 */
async function startUpdateCheck($: EngineInterface) {
  if (updateTicker !== undefined || boardSurfaceOf(await $.session.surfaces()) === null) return
  updateTicker = $.clock.every(UPDATE_TICK_MS, () => checkForUpdate($))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    // 先寫最小的回報、先自動打開監看視窗，要跑 git、gh 的欄位最後才補
    await writeReport($, {
      model: await $.session.model(),
      terminal: (await $.env.get('TERM_PROGRAM')) ?? null,
      // 熱重載、resume 後沿用原本的主題，標題不會換成之後的另一句 prompt
      topic: own?.topic ?? (await previousTopic($)),
    })
    // 熱重載後 Pane 還開著，就接著 polling
    const pane = await findBoard($)
    if (pane !== undefined) {
      await loadView($)
      if (detectedLocale === null) await detectLocale($)
      await watchBoard($, pane.isPlaced)
    } else {
      // 先載入語言與設定：監看視窗沒開時，輸入框上方的按鈕也要用對語言
      await loadView($)
      await autoOpenBoard($)
    }
    // 監看視窗沒畫出來時，先做一次輕量掃描，打開按鈕才有計數；殘留的回報也在這裡清，
    // 沒開過監看視窗的使用者，回報也不會一直累積。畫出來時由監看視窗的掃描清
    if (!(await read($, isBoardShown))) {
      await lightScan($)
      await startLightPolling($)
    }
    await startUpdateCheck($)
    await writeReport($, await readDetails($))

    return started
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      // 第一句有內容的 prompt 當作主題（沒有 /rename 的 CLI Session 拿來當標題），之後不再改
      const topic = own?.topic ?? (typeof e.text === 'string' ? topicOf(e.text) : null)
      await writeReport($, {
        model: await $.session.model(),
        turnStartedAt: await $.clock.now(),
        activity: null,
        approval: null,
        question: null,
        turnError: null,
        topic,
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
    // 被拒絕或出錯的呼叫不會有結束通知，記下來就會一直算成執行中
    if (tool === 'Bash' && input.run_in_background === true && ran.deny === undefined && ran.isError !== true) {
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
      // 狀態欄位先寫：git、gh 可能要好幾秒，這段時間紀錄已經是閒置，出錯中止和結尾提問不能等它們
      await writeReport($, {
        turnStartedAt: null,
        activity: null,
        approval: null,
        // 結尾提問框還在等使用者回答，下一個回合開始時清掉
        question,
        lastReply: answer,
        // 沒有回覆內容時存語言中立的標記，由監看視窗依目前語言顯示
        turnError: e.reason === 'error' ? (answer ?? API_ERROR) : null,
      })
      // 「不再自動打開」只在剛手動關掉時有用，回合結束就收起來
      await update($, offersStopAutoOpen, () => null)
      // 設定改成所有 Desktop Session 都顯示時，已經開著的 Session 在回合結束後補開
      await autoOpenBoard($)
      // 之後再補；只帶這些欄位，使用者在這之間送出下一句時，新回合的狀態不會被蓋掉。
      // 背景任務等 git、gh 回來才讀：新回合在這段時間開的背景任務，不會被之前讀到的舊清單蓋掉
      const details = await readDetails($)
      await writeReport($, { ...details, tasks: await readTasks($) })
    }

    return done
  })

  // 自己回答，不呼叫 next：commands/open.md 的內容不會送給模型
  on('command.run', { command: COMMAND }, async $ => {
    const surface = boardSurfaceOf(await $.session.surfaces())
    await loadView($)
    if (surface === null) {
      return { text: messages.command.unsupported(COMMAND) }
    }
    const opened = await openBoard($)
    const note = await platformNote($)
    if (!opened.isPlaced) {
      $.ui.log(`switchboard: board not placed: ${opened.reason}`, { to: 'debug' })
      return { text: `${messages.command.notPlaced}${note}` }
    }

    return { text: `${messages.command.opened}${note}` }
  })

  // Desktop 的 Pane 沒有焦點時，第一下點擊只會讓 Pane 取得焦點、不會按到按鈕。
  // 焦點落在卡片標題上就直接跳轉，點一下就能切換。
  // 但 Pane 一直有焦點、而且使用者上一次移動焦點不到 10 秒時視為用 Tab 瀏覽，不跳轉，才走得到其他卡片和按鈕；
  // Pane 失焦過（例如點進輸入框打字）就重新算。Enter／按下一律跳轉。
  // 只限 Desktop：終端機用鍵盤移動焦點時，每經過一張卡片就會跳一次。
  // 引擎的 ui.focus 事件不帶介面資訊，分不出焦點是在 Desktop 還是終端機移動，只能看 Session 有沒有 desktop；
  // 所以同時在 Desktop 與終端機畫的 Session，在終端機第一次移動焦點（或隔了 10 秒以上）仍會跳轉
  on('ui.focus', async ($, e, next) => {
    const moved = await next(e)
    if (e.requestId !== PANE || e.origin.kind !== 'person') return moved
    const now = await $.clock.now()
    const isBrowsing = lastFocusAt !== null && now - lastFocusAt < TAB_BROWSE_MS
    lastFocusAt = now
    if (
      !isBrowsing &&
      e.element?.startsWith('jump-') === true &&
      (await $.session.surfaces()).includes('desktop')
    ) {
      const pid = Number(e.element.slice('jump-'.length))
      const card = (await read($, snapshot))?.sessions.find(one => one.pid === pid)
      if (card !== undefined) await jump($, card, 'focus')
    }

    return moved
  }).catch(($, e, next) => next(e))

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      stopPolling()
      forgetBoardFocus()
      if (e.origin.kind === 'person') await closedByPerson($)
      await setBoardShown($, false)
    }

    return next(e)
  })

  // 監看視窗關著時，在 Desktop 或終端機的輸入框上方放一個按鈕，點一下就打開，不用輸入指令。
  // 和其他 plugin 共存：hook 由外層到內層巢狀，不呼叫 next 內層就不會執行，所以一律先 next(e)，
  // 再把按鈕列疊在內層畫的東西（別的 plugin 或引擎自己的 band）上方
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!isBoardSurface(e.surface) || e.props.hasSurvey || (await read($, isBoardShown))) return next(e)
    const below = await next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const m = messagesOf(await read($, shownLocale))
    const count = await read($, bandCount)
    // 有計數時計數放最前面（`▲2 待處理 · ▦ 打開`），label 寫成完整的一句；沒有計數或掃描失敗時只有 `▦ 打開監看視窗`
    const open =
      count !== null && count > 0 ? (
        <Button key="open-board" {...nameOn(e.surface, m.band.label(count))} onPress={() => openBoard($)}>
          <Text color="warning" weight="bold">{`${GLYPHS.waiting.char}${count}`}</Text>
          {` ${m.band.need(count)} · ${GLYPHS.board.char} ${m.band.openShort}`}
        </Button>
      ) : (
        // label 不帶 ▦：螢幕閱讀器只念文字
        <Button key="open-board" {...nameOn(e.surface, m.band.open)} onPress={() => openBoard($)}>
          {`${GLYPHS.board.char} ${m.band.open}`}
        </Button>
      )
    // 剛手動關掉、而且自動打開還開著：旁邊放「不再自動打開」。
    // 看哪個開關和 toast 一樣依 Session 的介面，不看這個 band 畫在哪裡；別的 Session 關掉了由輕量掃描收起來
    const row =
      (await read($, offersStopAutoOpen)) === null ? (
        <Box key="board-row">{open}</Box>
      ) : (
        <Box key="board-row" flexDirection="row" gap={1}>
          {open}
          <Button key="stop-auto-open" label={m.band.never} onPress={() => stopAutoOpen($)} />
        </Box>
      )

    return (
      <Box flexDirection="column">
        {row}
        {below}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const components = $.ui.resolve(e)
    const { Box, Button, Link, Text } = components
    // Select 只有 terminal 和 desktop 有
    const Select = 'Select' in components ? components.Select : null
    // Pane 失焦（例如點進輸入框打字）：之後再點卡片標題是新的一下點擊，不算 Tab 瀏覽
    if (e.props.isFocused) focusedSurfaces.add(e.surface)
    else if (focusedSurfaces.delete(e.surface)) lastFocusAt = null
    let current: Snapshot | null
    let settings: View
    let isOpen: boolean
    let editing: Group
    let opened: number[]
    let facts: UpdateFacts
    try {
      current = await read($, snapshot)
      settings = await read($, view)
      isOpen = await read($, isSettingsOpen)
      editing = await read($, settingsGroup)
      opened = await read($, expanded)
      facts = await read($, updateFacts)
    } catch (error) {
      return (
        <Box flexDirection="column">
          <Box key="count">
            <Text>{`${messages.readFailed}${String(error)}`}</Text>
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
    // 掃描停擺（一直失敗或卡住）時，時間都是用 scannedAt 算的會凍住：標出資料是多久以前的
    const staleFor = (await $.clock.now()) - current.scannedAt
    const m = settings.locale === 'auto' ? messages : messagesOf(settings.locale)
    const showsIn = (group: Group, field: Field) => settings.fields[group].includes(field)
    /** 這張卡要不要顯示某個欄位：展開明細時全部顯示，否則依所屬分組的設定 */
    const cardShows = (card: SessionCard, field: Field) =>
      opened.includes(card.pid) ? PRESETS.detailed.includes(field) : showsIn(groupOf(card.status), field)
    // 連接器、完整路徑：沒展開時照設定顯示在卡片上；展開時改由展開明細顯示，不重複
    const onRow = (card: SessionCard, field: 'connectors' | 'path') =>
      !opened.includes(card.pid) && showsIn(groupOf(card.status), field)
    const mainModel = commonModel(current.sessions)
    const density = densityOf(settings.fields[editing], VALID_FIELDS[editing])
    // 實際的待處理卡片：頁首的細分、最長等待時間照這個算
    const waiting = current.sessions.filter(card => groupOf(card.status) === 'waiting')
    // 畫出來的分區：焦點在監看視窗裡時順序和數字凍結，離開待處理的卡片留在待處理分區原位、沒有按鈕
    const hasGo = (card: SessionCard) => groupOf(card.status) === 'waiting' && canJump(card)
    const arranged = arrange(current.sessions, hasGo, e.props.isFocused ? (shownLayouts.get(e.surface) ?? null) : null)
    shownLayouts.set(e.surface, arranged.layout)
    const { waiting: waitingShown, busy, idle } = arranged.sections
    // Desktop 不會截斷按鈕裡的文字，改由這裡依 Pane 的欄寬截斷
    const columns = Math.max(20, e.props.bodyColumns)
    // 外框加左右內距：卡片在終端機是外框 1 格加內距 1 格；閒置列沒有外框，內距 2 格，寬度一樣
    const cardWidth = columns - 4
    const isTerminal = e.surface === 'terminal'
    // 卡片內距：Desktop 比頁首大一級（md）；終端機仍是 1 格（md 會變 2 格，和閒置列對不齊）。上下的 xs 在終端機是 0 行
    const cardPadX = isTerminal ? 'sm' : 'md'
    // 終端機是等寬格（中日韓 2 格）；Desktop 用比例字型估算
    const clipTo = isTerminal ? clipToWidth : fitToWidth

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

    /** 待處理的種類：核准、回答、出錯，或基本狀態的等你 */
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

    /** 工作中卡片的子卡片：執行中的背景任務；展開時改由展開明細列出 */
    const subtasksOf = (card: SessionCard) =>
      card.status === 'busy' && !opened.includes(card.pid) && cardShows(card, 'tasks')
        ? (card.report?.tasks ?? []).filter(one => one.status === 'running')
        : []

    const subtaskRows = (card: SessionCard) => {
      const running = subtasksOf(card)
      if (running.length === 0) return null

      return (
        <Box key={`subtasks-${card.pid}`} flexDirection="column">
          {running.slice(0, 3).map((one, index) => (
            <Box key={`subtask-${card.pid}-${index}`}>
              <Text size="caption" wrap="truncate-end">
                {`${GLYPHS.subtask.char} ${taskTitle(one)}`}
              </Text>
            </Box>
          ))}
          {running.length > 3 && (
            <Box key={`subtasks-more-${card.pid}`}>
              <Text size="caption" dimColor>
                {`${GLYPHS.subtask.char} ${m.moreTasks(running.length - 3)}`}
              </Text>
            </Box>
          )}
        </Box>
      )
    }

    /**
     * 標題列：狀態 glyph（待處理與狀態不明時後面加標籤）＋可點的標題（跳轉）；右側依序是來源符號、目前、背景任務徽章、時間加 ▸／▾ 的展開鈕。
     * 左右兩側的寬度：終端機用等寬格計算，Desktop 用比例字型估算；另留 3 格餘裕，標題至少保留 8 格。
     * 終端機不分語言再加上 Ambiguous 字的數量當餘裕（中日韓 locale 會把它們畫成 2 格），標題也照這樣截斷。
     */
    const titleRow = (card: SessionCard, width: number) => {
      const look = LOOK[card.status]
      const isCurrent = card.sessionId !== null && card.sessionId === own?.sessionId
      const shows = (field: Field) => cardShows(card, field)
      const age = shows('time') && card.since !== null ? shortAge(now - card.since) : null
      const tasks = shows('tasks') ? countTasks(card.report?.tasks ?? []) : { running: 0, waiting: 0, failed: 0 }
      let badges = [
        // 工作中卡片的執行中任務改由子卡片一列一列列出
        tasks.running > 0 && subtasksOf(card).length === 0 ? { text: `${GLYPHS.taskRunning.char}${tasks.running}`, color: 'text' } : null,
        tasks.waiting > 0 ? { text: `${GLYPHS.taskWaiting.char}${tasks.waiting}`, color: 'warning' } : null,
        tasks.failed > 0 ? { text: `${GLYPHS.taskFailed.char}${tasks.failed}`, color: 'error' } : null,
      ].filter(one => one !== null)
      const isOpen = opened.includes(card.pid)
      // 時間和 ▸／▾ 黏成一顆展開鈕（`7s ▸`）
      const toggle = `${age === null ? '' : `${age} `}${isOpen ? GLYPHS.expanded.char : GLYPHS.collapsed.char}`
      const kind = kindOf(card)
      // 待處理的種類；狀態不明不能只靠 ◌ 表達，後面也加上文字
      const label = kind !== null ? m.kinds[kind] : card.status === 'unknown' ? m.unknown : null
      let source = sourceMark(card.source)
      const cellsOf = isTerminal ? (text: string) => displayWidth(text, 2) : estimateWidth
      const left = cellsOf(look.glyph) + 1 + (label === null ? 0 : cellsOf(label) + 1)
      let current = isCurrent ? m.current : null
      const rightOf = () =>
        (source === null ? 0 : cellsOf(source) + 1) +
        (current === null ? 0 : cellsOf(current) + 1) +
        badges.reduce((sum, one) => sum + cellsOf(one.text) + 1, 0) +
        cellsOf(toggle)
      const isTight = () => width - left - rightOf() - 3 < 8
      // 標題不夠 8 格時，依序拿掉徽章、拿掉來源符號，最後把「目前」換成一格寬的標記（不拿掉）
      if (isTight()) badges = []
      if (isTight()) source = null
      if (isTight() && current !== null) current = CURRENT_MARK
      const budget = width - left - rightOf() - 3
      const title = isTerminal ? clipToWidth(card.title, budget, 2) : clipTo(card.title, budget)

      return (
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Box flexDirection="row" gap={1}>
            <Text color={look.color} weight={kind === null ? 'regular' : 'bold'}>
              {look.glyph}
            </Text>
            {label !== null && (
              <Text color={look.color} weight={kind === null ? 'regular' : 'bold'}>
                {label}
              </Text>
            )}
            <Button key={`jump-${card.pid}`} plain onPress={() => jump($, card)}>
              <Text weight={card.status === 'idle' ? 'regular' : 'semibold'}>{title}</Text>
            </Button>
          </Box>
          <Box flexDirection="row" gap={1} alignItems="center">
            {source !== null && (
              <Box key={`source-${card.pid}`}>
                <Text dimColor>{source}</Text>
              </Box>
            )}
            {current !== null && (
              <Box key={`current-${card.pid}`}>
                <Text size="caption" dimColor={current !== CURRENT_MARK}>
                  {current}
                </Text>
              </Box>
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
            <Button
              key={`expand-${card.pid}`}
              plain
              dimColor
              {...nameOn(e.surface, m.labels.expand(card.title, isOpen))}
              onPress={() => toggleExpand($, card.pid)}
            >
              <Text size="caption" dimColor tabular>
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
              {`${m.asked(report.question.text)}${(report.question.more ?? 0) > 0 ? m.moreQuestions(report.question.more ?? 0) : ''}`}
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
            <Text size="footnote" dimColor italic={m.isReplyItalic} wrap="truncate-end">
              {m.quoted(report.lastReply)}
            </Text>
          </Box>
        )
      }

      return null
    }

    /**
     * 中繼資料帶：位置·分支、變更行數、Context、PR、模型、環境、用量、連接器，排成一行自動換行；完整路徑另起一行。
     * 待處理卡片唯一的主要動作「前往處理 →」放在這一列的右端，寬度不夠才換到下一行（和上一行留 xs）。
     * 展開時 Context 和分支改由展開明細顯示，帶上不重複。
     */
    const metaStrip = (card: SessionCard) => {
      const shows = (field: Field) => cardShows(card, field)
      const isOpen = opened.includes(card.pid)
      const report = card.report
      const branch = report?.branch ?? null
      const connectors = report?.connectors ?? null
      const where = [
        shows('location') ? locationOf(card.path) : null,
        shows('branch') && branch !== null && !isOpen ? branchLabel(branch, card.path) || null : null,
        shows('source') && card.source !== null && card.source !== 'Desktop' ? card.source : null,
      ].filter(one => one !== null)
      const added = branch?.insertions ?? 0
      const removed = branch?.deletions ?? 0
      const percent = report?.contextPercent ?? null
      const model = report?.model ?? null
      const pr = report?.pr ?? null
      const environment = [
        card.isWorktree ? m.environment.worktree : null,
        card.isRemote ? m.environment.remote : null,
      ].filter(one => one !== null)
      const usage = [
        report?.costUsd != null && report.costUsd > 0 && !isSubscription ? `$${report.costUsd.toFixed(2)}` : null,
        report?.turns != null && report.turns > 0 ? m.turns(report.turns) : null,
      ].filter(one => one !== null)
      const hasWork = branch !== null && (added > 0 || removed > 0 || branch.ahead > 0)
      // PR 狀態不只靠顏色：開啟 #12 ↗、已合併 #12 ↗ 已合併、已關閉 #12 加刪除線（不能再開啟頁面就不畫 ↗）
      const prText =
        pr === null
          ? ''
          : pr.state === 'MERGED'
            ? `${GLYPHS.pr.char}${pr.number} ${GLYPHS.external.char} ${m.merged}`
            : pr.state === 'CLOSED'
              ? `${GLYPHS.pr.char}${pr.number}`
              : `${GLYPHS.pr.char}${pr.number} ${GLYPHS.external.char}`
      const segments = [
        where.length > 0 ? (
          <Text size="caption" color="subtle">
            {where.join(' · ')}
          </Text>
        ) : null,
        // 數字為 0 的那一邊不畫
        shows('changes') && (added > 0 || removed > 0) ? (
          <Box key="changes" flexDirection="row" gap={1}>
            {added > 0 ? (
              <Text size="caption" color="diffAdded" tabular>
                +{added}
              </Text>
            ) : null}
            {removed > 0 ? (
              <Text size="caption" color="diffRemoved" tabular>
                −{removed}
              </Text>
            ) : null}
          </Box>
        ) : null,
        shows('context') && percent !== null && !isOpen ? (
          <Box key="ctx">
            <Text size="caption" color={percent >= 80 ? usageColor(percent) : undefined} dimColor={percent < 80} tabular>
              {`${m.ctx} ${Math.round(percent)}%`}
            </Text>
          </Box>
        ) : null,
        shows('pr') && pr !== null ? (
          <Box key="pr">
            <Button key={`pr-${card.pid}`} plain {...nameOn(e.surface, m.labels.pr(pr.number, pr.state))} onPress={() => openUrl($, pr.url)}>
              <Text
                size="caption"
                color={pr.state === 'MERGED' ? 'merged' : pr.state === 'CLOSED' ? 'inactive' : 'success'}
                strikethrough={pr.state === 'CLOSED'}
              >
                {prText}
              </Text>
            </Button>
          </Box>
        ) : shows('pr') && hasWork && card.status !== 'idle' ? (
          // 沒有 PR：只說明，不可點（建立 PR 要到那個 Session 裡做）
          <Box key="pr">
            <Text size="caption" dimColor>
              {m.noPr}
            </Text>
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
        onRow(card, 'connectors') && connectors !== null && (connectors.connected.length > 0 || connectors.needsAuth.length > 0) ? (
          <Box key={`field-connectors-${card.pid}`} flexDirection="row" columnGap={1}>
            <Text size="caption" dimColor>
              {m.connectors(connectors.connected.length)}
            </Text>
            {connectors.needsAuth.length > 0 && (
              <Text size="caption" color="warning">
                {`${m.needsAuth} ${connectors.needsAuth.join(', ')}`}
              </Text>
            )}
          </Box>
        ) : null,
      ].filter(one => one !== null)
      // 數字快捷鍵：非 plain 的按鈕在終端機不會畫出 hotkey，數字自己畫在前面（dim）；
      // Desktop 的數字和文字之間用寬一點的空白（en space）
      const hotkey = arranged.hotkeys.get(card.pid)
      const go = hasGo(card) ? (
        <Button
          key={`go-button-${card.pid}`}
          variant="secondary"
          {...(hotkey === undefined ? {} : { hotkey: String(hotkey) })}
          {...nameOn(e.surface, m.labels.goHandle(card.title, hotkey === undefined ? null : String(hotkey)))}
          onPress={() => jump($, card)}
        >
          {hotkey === undefined ? m.goHandle : <Text dimColor>{String(hotkey)}</Text>}
          {hotkey === undefined ? null : `${isTerminal ? ' ' : '\u2002'}${m.goHandle}`}
        </Button>
      ) : null
      const path = onRow(card, 'path') && card.path !== '' ? (
        <Box key={`field-path-${card.pid}`}>
          <Text size="caption" dimColor wrap="truncate-middle">
            {card.path}
          </Text>
        </Box>
      ) : null
      if (segments.length === 0 && go === null && path === null) return null

      return (
        <>
          {(segments.length > 0 || go !== null) && (
            <Box
              key={`strip-${card.pid}`}
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              columnGap="md"
              rowGap="xs"
            >
              {segments.length > 0 ? (
                <Box key="meta" flexDirection="row" flexWrap="wrap" flexShrink={1} columnGap="md">
                  {segments}
                </Box>
              ) : null}
              {go}
            </Box>
          )}
          {path}
        </>
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
      const mark: Record<string, string> = {
        running: GLYPHS.taskRunning.char,
        waiting: GLYPHS.taskWaiting.char,
        done: GLYPHS.done.char,
        failed: GLYPHS.taskFailed.char,
      }
      const environment = [
        m.environment.local,
        card.isWorktree ? m.environment.worktree : null,
        card.isRemote ? m.environment.remote : null,
      ]
        .filter(one => one !== null)
        .join(' · ')

      return (
        <Box key="detail" flexDirection="column">
          {percent !== null && (
            <Box key="context-bar" flexDirection="row" gap={1}>
              <Text size="caption" dimColor>
                {m.fields.context}
              </Text>
              <Text size="caption" color={usageColor(percent)}>
                {usageBar(percent, 10)}
              </Text>
            </Box>
          )}
          {/* 卡片上的帶展開時不畫分支，改在這裡寫完整（含比較的基準） */}
          {branch !== null && (
            <Box key="detail-branch">
              <Text size="caption" color="subtle" wrap="truncate-end">
                {[branchLabel(branch, card.path) || branch.name, branch.base === undefined ? null : m.versus(branch.base)]
                  .filter(one => one !== null)
                  .join(' · ')}
              </Text>
            </Box>
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
            <Box key="detail-path">
              <Text size="caption" dimColor wrap="truncate-middle">
                {card.path}
              </Text>
            </Box>
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
                  {`${mark[one.status] ?? '·'} ${one.kind === 'bash' ? m.taskKinds.bash : m.taskKinds.agent} ${one.label}`}
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
        {subtaskRows(card)}
        {contextLine(card)}
        {card.report === null && card.status !== 'idle' && (
          <Text key="no-report" size="caption" dimColor>
            {m.basicStatus}
          </Text>
        )}
        {metaStrip(card)}
        {expandedDetail(card)}
      </>
    )

    const longestWait = Math.max(0, ...waiting.map(card => (card.since === null ? 0 : now - card.since)))
    const breakdown = (['approval', 'question', 'errored', 'waiting'] as const)
      .map(kind => ({ kind, n: waiting.filter(card => kindOf(card) === kind).length }))
      .filter(one => one.n > 0)
      .map(one => `${m.kinds[one.kind]} ${one.n}`)

    // 帳號卡片平常放在清單最後，不擠掉待處理的卡片；用量快用完（≥95%）才提到頁首下方
    const isAccountUrgent = rateLimits.some(one => one.percentUsed >= 95)
    // 5h／週的標籤補到同寬（等寬字的格數），用量條從同一欄開始
    const rateLabels = rateLimits.map(one => {
      const kind = rateKind(one.kind)
      return kind === null ? one.kind : m.account[kind]
    })
    const rateLabelWidth = Math.max(0, ...rateLabels.map(label => displayWidth(label)))

    /**
     * 帳號用量卡片：5h／週用量條與重置倒數；API 計費時加上所有 Session 的花費。
     * 平常是淡色外框，退成頁尾；用量快用完、提到頂端時拿掉淡色，外框跟著加強。
     */
    const accountCard =
      rateLimits.length > 0 || totalCost > 0 ? (
        <Box
          key="account"
          flexDirection="column"
          borderStyle="round"
          borderDimColor={!isAccountUrgent}
          paddingX={cardPadX}
          paddingY="xs"
        >
          <Text size="footnote" weight="semibold" dimColor>
            {m.account.title}
          </Text>
          {rateLimits.map((one, index) => {
            const kind = rateKind(one.kind)
            const resetIn = one.resetsAt === undefined ? null : Date.parse(one.resetsAt) - now
            const label = rateLabels[index] ?? one.kind

            return (
              <Box key={`rate-${kind ?? one.kind}`} flexDirection="row" justifyContent="space-between">
                <Text size="caption" color={usageColor(one.percentUsed)} mono tabular>
                  {`${label}${' '.repeat(Math.max(0, rateLabelWidth - displayWidth(label)))} ${usageBar(one.percentUsed, 10)}`}
                </Text>
                {resetIn !== null && Number.isFinite(resetIn) && resetIn > 0 && (
                  <Text size="caption" dimColor tabular>
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
      <Button key="settings" plain dimColor onPress={() => toggleSettings($)}>
        {`${m.view} ${isOpen ? GLYPHS.expanded.char : GLYPHS.collapsed.char}`}
      </Button>
    )

    /** ☑/☐ 開關：畫勾選框加名稱，label 帶上目前開或關 */
    const checkbox = (key: string, name: string, isOn: boolean, onPress: () => void, label = m.panel.checked(name, isOn)) => (
      <Button key={key} plain {...nameOn(e.surface, label)} onPress={onPress}>
        {`${isOn ? GLYPHS.checked.char : GLYPHS.unchecked.char} ${name}`}
      </Button>
    )

    /** 一列按鈕選項：前面是 caption 的列標題 */
    const choiceRow = (key: string, title: string, buttons: JSX.Element[], extra: JSX.Element | null = null) => (
      <Box key={key} flexDirection="row" flexWrap="wrap" columnGap="sm" rowGap="xs" alignItems="center">
        <Text size="caption" dimColor>
          {title}
        </Text>
        {buttons}
        {extra}
      </Box>
    )

    // 語言、計費：Desktop 用 Select；終端機的 Select 展開後多高還沒實測（ticket 12），先維持按鈕列
    const localeChoice: 'auto' | Locale = settings.locale
    const languageAndBilling =
      e.surface === 'desktop' && Select !== null
        ? [
            <Box key="locale-billing" flexDirection="row" flexWrap="wrap" columnGap="md" rowGap="xs" alignItems="center">
              <Select
                key="locale"
                label={m.panel.language}
                value={localeChoice}
                options={[{ value: 'auto', label: m.panel.auto }, ...LOCALES.map(one => ({ value: one.locale, label: one.label }))]}
                onSelect={value => setLocale($, LOCALES.find(one => one.locale === value)?.locale ?? 'auto')}
              />
              <Select
                key="billing"
                label={m.panel.billing}
                value={settings.billing}
                options={BILLINGS.map(one => ({ value: one, label: m.billings[one] }))}
                onSelect={value => setBilling($, BILLINGS.find(one => one === value) ?? 'auto')}
              />
            </Box>,
          ]
        : [
            choiceRow('locale-row', m.panel.language, [
              <Button
                key="locale-auto"
                variant={settings.locale === 'auto' ? 'primary' : 'secondary'}
                onPress={() => setLocale($, 'auto')}
              >
                {m.panel.auto}
              </Button>,
              ...LOCALES.map(one => (
                <Button
                  key={`locale-${one.locale}`}
                  variant={settings.locale === one.locale ? 'primary' : 'secondary'}
                  onPress={() => setLocale($, one.locale)}
                >
                  {one.label}
                </Button>
              )),
            ]),
            choiceRow(
              'billing-row',
              m.panel.billing,
              BILLINGS.map(one => (
                <Button
                  key={`billing-${one}`}
                  variant={settings.billing === one ? 'primary' : 'secondary'}
                  onPress={() => setBilling($, one)}
                >
                  {m.billings[one]}
                </Button>
              )),
            ),
          ]

    // 設定面板：「卡片內容 · 分區」在前、「一般」在後，兩區不加子框；底部是作者連結和「完成」
    const viewPanel = (
      <Box key="view-panel" flexDirection="column" borderStyle="round" borderDimColor paddingX="sm" rowGap="md">
        <Box key="panel-cards" flexDirection="column" rowGap="xs">
          <Box key="panel-cards-title">
            <Text size="footnote" weight="semibold">
              {m.panel.cardContent}
              <Text dimColor>{' · '}</Text>
              {m.groups[editing]}
            </Text>
          </Box>
          {choiceRow(
            'group-row',
            m.panel.group,
            GROUPS.map(one => (
              <Button
                key={`group-${one}`}
                variant={editing === one ? 'primary' : 'secondary'}
                onPress={() => chooseGroup($, one)}
              >
                {m.groups[one]}
              </Button>
            )),
          )}
          {choiceRow(
            'density-row',
            m.panel.density,
            DENSITIES.map(one => (
              <Button
                key={`density-${one}`}
                variant={density === one ? 'primary' : 'secondary'}
                onPress={() => setDensity($, editing, one)}
              >
                {m.densities[one]}
              </Button>
            )),
            density === null ? (
              <Text size="caption" dimColor>
                {m.panel.custom}
              </Text>
            ) : null,
          )}
          {/* 只列這個分區有作用的欄位 */}
          <Box key="panel-fields" flexDirection="row" flexWrap="wrap" columnGap="md" rowGap="xs">
            {VALID_FIELDS[editing].map(field =>
              checkbox(`field-${field}`, m.fields[field], showsIn(editing, field), () => toggleField($, editing, field)),
            )}
          </Box>
        </Box>
        <Box key="panel-general" flexDirection="column" rowGap="xs">
          <Box key="panel-general-title">
            <Text size="footnote" weight="semibold">
              {m.panel.general}
            </Text>
          </Box>
          {/* 先寫標題再列選項：自動打開監看視窗  ☑ Desktop Session  ☐ CLI Session */}
          <Box key="auto-open-row" flexDirection="row" flexWrap="wrap" columnGap="md" rowGap="xs" alignItems="center">
            <Text size="caption" dimColor>
              {m.panel.autoOpenTitle}
            </Text>
            {checkbox(
              'auto-open',
              m.panel.autoOpenDesktop,
              settings.autoOpen,
              () => toggleAutoOpen($, 'autoOpen'),
              m.labels.autoOpen(m.panel.autoOpenDesktop, settings.autoOpen),
            )}
            {checkbox(
              'auto-open-cli',
              m.panel.autoOpenTerminal,
              settings.autoOpenCli,
              () => toggleAutoOpen($, 'autoOpenCli'),
              m.labels.autoOpen(m.panel.autoOpenTerminal, settings.autoOpenCli),
            )}
          </Box>
          {languageAndBilling}
        </Box>
        <Box key="panel-footer" flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" rowGap="xs">
          <Button key="author" plain dimColor onPress={() => openUrl($, AUTHOR_URL)}>
            <Text size="caption" dimColor>
              switchboard · wide3751 {GLYPHS.external.char}
            </Text>
          </Button>
          <Box key="panel-actions" flexDirection="row" columnGap="sm" alignItems="center">
            {/* 已經是預設值時不畫，免得按了沒反應 */}
            {!isPanelDefault(settings) && (
              <Button key="panel-reset" variant="secondary" onPress={() => resetView($)}>
                {m.panel.reset}
              </Button>
            )}
            <Button key="panel-done" variant="secondary" onPress={() => update($, isSettingsOpen, () => false)}>
              {m.panel.done}
            </Button>
          </Box>
        </Box>
      </Box>
    )

    // ── 骨架 ──
    // 根節點 rowGap="md"：分區之間空一行（終端機 1 行）。每個分區（標題加卡片）包一層 rowGap="xs"（終端機 0 行）；閒置列之間照上一版空一行：rowGap="md"（終端機 1 行），不然上下太擠。
    // 頁首依情境三選一：有在等（待處理分區的標題）、沒有在等（一行）、看不到狀態（有框警示卡，設定單獨一行在上方）。
    // 設定面板的插入點只有 panelSlot 一個變數，位置固定在頁首下方：有在等時在待處理分區裡（頁首和卡片之間），
    // 其他情境在頁首（警示卡）下一個。ticket 06 只要改 viewPanel 本身。

    const panelSlot = isOpen ? viewPanel : null

    // 頁首底下的附註：資料停在多久以前（掃描停擺時）、第一次使用的引導
    const notes = [
      staleFor > STALE_MS && (
        <Box key="stale">
          <Text size="caption" color="warning">
            {m.header.updatedAgo(shortAge(staleFor))}
          </Text>
        </Box>
      ),
      // 第一次使用：清單只有目前這個 Session，說明其他 Session 怎樣才會出現
      current.error === null &&
        current.sessions.length === 1 &&
        current.sessions[0]?.sessionId != null &&
        current.sessions[0].sessionId === own?.sessionId && (
          <Box key="only-self">
            <Text size="caption" dimColor wrap="wrap">
              {m.header.onlySelf}
            </Text>
          </Box>
        ),
    ]

    /** 頁首那一行：左邊是狀態，右邊是「設定 ▸」（不給 action 就只有左邊） */
    const titleLine = (countKey: string, status: JSX.Element, action: JSX.Element | null) => (
      <Box key="title-row" flexDirection="row" justifyContent="space-between" alignItems="center">
        <Box key={countKey}>{status}</Box>
        {action}
      </Box>
    )

    /** 待處理分區的標題：▲ n 個待處理（heading）加細分；看不到狀態時也畫，但設定和附註留在警示卡那邊 */
    const waitingHeader = (isHeader: boolean) => (
      <Box key={isHeader ? 'header' : 'waiting-header'} flexDirection="column">
        {titleLine(
          isHeader ? 'count' : 'waiting-count',
          <Text size="heading" color="warning" weight="bold">
            {`${GLYPHS.waiting.char} ${m.status.needYou(current.needsYou)}`}
          </Text>,
          isHeader ? viewButton : null,
        )}
        <Box key={isHeader ? 'summary' : 'waiting-summary'}>
          <Text size="caption" tabular>
            {[...breakdown, m.status.longest(shortAge(longestWait))].join(' · ')}
          </Text>
        </Box>
        {isHeader && notes}
      </Box>
    )

    /** 看不到狀態的說明：結論（預設色）、引擎的原始錯誤（只有這段用 error 色）、路徑（另起一行，從中間截斷） */
    const problemOf = (error: ScanError): { lead: string; raw: string | null; path: string | null } =>
      error.kind === 'unreadable'
        ? { lead: m.cannotRead, raw: null, path: error.dir }
        : error.kind === 'failed'
          ? { lead: m.readFailed, raw: error.reason, path: null }
          : error.kind === 'no-records'
            ? { lead: m.header.noRecords, raw: null, path: error.dir }
            : { lead: m.header.selfMissing, raw: null, path: null }

    const unknownHeader = (error: ScanError) => {
      const problem = problemOf(error)

      return (
        <Box key="header" flexDirection="column" borderStyle="round" borderColor="warning" paddingX="sm">
          {titleLine(
            'count',
            <Text color="warning" weight="bold">
              {m.header.unknown}
            </Text>,
            null,
          )}
          <Box key="summary" flexDirection="column">
            <Text size="footnote" wrap="wrap">
              {problem.lead}
              {problem.raw !== null && <Text color="error">{problem.raw}</Text>}
            </Text>
            {problem.path !== null && (
              <Text size="caption" dimColor wrap="truncate-middle">
                {problem.path}
              </Text>
            )}
          </Box>
          <Box key="retry" flexDirection="row" flexWrap="wrap" alignItems="center">
            <Text size="caption" dimColor>
              {`${m.header.retry} · `}
            </Text>
            <Link href={m.header.troubleshootUrl} label={m.header.troubleshoot} />
          </Box>
          {notes}
        </Box>
      )
    }

    const calmHeader = (
      <Box key="header" flexDirection="column">
        {titleLine(
          'count',
          <Text color="success" weight="semibold">
            {m.header.none}
          </Text>,
          viewButton,
        )}
        {/* 不重複各分區的數量；只有 0 筆 Session 時才補一句 */}
        {current.sessions.length === 0 && (
          <Box key="summary">
            <Text size="caption" dimColor>
              {m.header.noOthers}
            </Text>
          </Box>
        )}
        {notes}
      </Box>
    )

    // 粗框只給待處理卡片：琥珀色是待處理，紅色是出錯中止。
    // 焦點在時已經離開待處理、留在原位的卡片照新的狀態畫外框（工作中細框、閒置淡色細框）
    const waitingCards = waitingShown.map(card => {
      const border =
        groupOf(card.status) === 'waiting'
          ? ({ borderStyle: 'bold', borderColor: card.status === 'errored' ? 'error' : 'warning' } as const)
          : ({ borderStyle: 'round', borderDimColor: groupOf(card.status) === 'idle' } as const)

      return (
        <Box key={`card-${card.pid}`} flexDirection="column" {...border} paddingX={cardPadX} paddingY="xs">
          {titleRow(card, cardWidth)}
          {body(card)}
        </Box>
      )
    })

    const busyGroup = busy.length > 0 && (
      <Box key="busy-group" flexDirection="column" rowGap="xs">
        {/* claude 色只用在 ◉ 這個字元，標題文字用預設色 */}
        <Box key="section-busy" flexDirection="row">
          <Text size="footnote" weight="semibold">
            <Text color="claude">{GLYPHS.busy.char}</Text>
            {` ${m.groups.busy} ${busy.length}`}
          </Text>
        </Box>
        {busy.map(card => (
          <Box key={`card-${card.pid}`} flexDirection="column" borderStyle="round" paddingX={cardPadX} paddingY="xs">
            {titleRow(card, cardWidth)}
            {body(card)}
          </Box>
        ))}
      </Box>
    )

    const idleGroup = idle.length > 0 && (
      <Box key="idle-group" flexDirection="column" rowGap="xs">
        {/* 整列標題就是收合按鈕，▾／▸ 放在文字後面 */}
        <Box key="section-idle" flexDirection="row">
          <Button
            key="toggle-idle"
            plain
            {...nameOn(e.surface, m.labels.idle(idle.length, settings.isIdleCollapsed))}
            onPress={() => toggleIdle($)}
          >
            <Text size="footnote" weight="semibold" color="inactive">
              {`${GLYPHS.idle.char} ${m.groups.idle} ${idle.length} ${
                settings.isIdleCollapsed ? GLYPHS.collapsed.char : GLYPHS.expanded.char
              }`}
            </Text>
          </Button>
        </Box>
        {!settings.isIdleCollapsed && (
          <Box key="idle-rows" flexDirection="column" rowGap="md">
            {idle.map(card =>
              // 閒置是單行、不加外框；展開明細時才加淡色框，避免和下一列黏在一起
              opened.includes(card.pid) ? (
                <Box
                  key={`card-${card.pid}`}
                  flexDirection="column"
                  borderStyle="round"
                  borderDimColor
                  paddingX={cardPadX}
                  paddingY="xs"
                >
                  {titleRow(card, cardWidth)}
                  {body(card)}
                </Box>
              ) : (
                // 閒置列和卡片內文對齊：終端機 2 格（外框 1 格加內距 1 格），Desktop 和卡片內距同一級
                <Box key={`card-${card.pid}`} flexDirection="column" paddingX="md">
                  {titleRow(card, cardWidth)}
                  {body(card)}
                </Box>
              ),
            )}
          </Box>
        )}
      </Box>
    )

    // 帳號卡片平常放在清單最後；用量快用完時提到頁首（和設定面板）下方、待處理卡片之前
    const urgentAccount = isAccountUrgent ? accountCard : null

    // 新版提示排在用量提醒後面：用量快用完比較急，兩個同時出現時都看得到
    const notice = updateNoticeOf(facts)
    const updateSlot =
      notice === null ? null : (
        <Box key="update-notice" flexDirection="column">
          <Box key="update-version">
            <Text weight="semibold">{`${GLYPHS.update.char} ${m.update.available(versionText(notice.version))}`}</Text>
          </Box>
          <Box key="update-hint">
            <Text size="caption" dimColor wrap="wrap">
              {m.update.autoUpdateHint}
            </Text>
          </Box>
        </Box>
      )

    // 頁首加上它下方的設定面板，依情境三選一
    const top =
      current.error !== null
        ? [
            <Box key="toolbar" flexDirection="row" justifyContent="flex-end">
              {viewButton}
            </Box>,
            unknownHeader(current.error),
            panelSlot,
            urgentAccount,
            updateSlot,
            waitingShown.length > 0 ? (
              <Box key="waiting-group" flexDirection="column" rowGap="xs">
                {waiting.length > 0 ? waitingHeader(false) : null}
                {waitingCards}
              </Box>
            ) : null,
          ]
        : waiting.length > 0
          ? [
              <Box key="waiting-group" flexDirection="column" rowGap="xs">
                {waitingHeader(true)}
                {panelSlot}
                {urgentAccount}
                {updateSlot}
                {waitingCards}
              </Box>,
            ]
          : [
              calmHeader,
              panelSlot,
              urgentAccount,
              updateSlot,
              // 焦點在時最後一張待處理也離開了：它仍留在原位，焦點離開後才移到所屬的分區
              waitingShown.length > 0 ? (
                <Box key="waiting-group" flexDirection="column" rowGap="xs">
                  {waitingCards}
                </Box>
              ) : null,
            ]

    return (
      <Box key="board" flexDirection="column" rowGap="md">
        {top}
        {busyGroup}
        {idleGroup}
        {!isAccountUrgent && accountCard}
      </Box>
    )
  })
}

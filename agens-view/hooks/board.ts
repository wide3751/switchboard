// 這個檔案只放純函式：用到 $ 的函式必須寫在 register.tsx，
// Desktop 自帶的 Claude Code 不讓 $ 跨 import 傳遞。

import type {
  Branch,
  Connectors,
  Density,
  Field,
  Group,
  Progress,
  PullRequest,
  Question,
  RateLimit,
  Report,
  SessionCard,
  Task,
} from '../types'

/** Claude Code 的 session 紀錄裡，這個 mod 用得到的欄位。 */
export type SessionRecord = {
  pid: number
  sessionId: string | null
  status: 'busy' | 'idle' | 'waiting' | 'unknown'
  /** Session 的名稱（Desktop 的標題或 CLI 的 /rename），沒有時是 null */
  name: string | null
  cwd: string | null
  entrypoint: string | null
  /** Desktop 託管的 Session 在 Desktop 裡的 id，CLI 沒有 */
  hostSessionId: string | null
  /** Remote Control 的連線 id，沒有連線時是 null */
  bridgeSessionId: string | null
  /** 最後一次狀態變化的時間（毫秒），不知道時是 0 */
  statusUpdatedAt: number
}

const STATUSES = ['busy', 'idle', 'waiting'] as const

const asObject = (text: string): Record<string, unknown> | null => {
  try {
    const raw: unknown = JSON.parse(text)

    return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const str = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

/** 秒或毫秒的時間戳一律轉成毫秒。 */
const toMs = (value: number): number => (value > 0 && value < 1e12 ? value * 1000 : value)

const basename = (path: string): string => path.split('/').filter(Boolean).pop() ?? path

const clip = (text: string, size: number): string =>
  text.length > size ? `${text.slice(0, size - 1)}…` : text

/**
 * 解析一份 session 紀錄；不是 JSON 或找不到 pid 時回傳 null。
 *
 * pid 優先取紀錄裡的欄位，沒有時退回檔名（`<pid>.json`）。
 */
export const parseRecord = (fileName: string, text: string): SessionRecord | null => {
  const record = asObject(text)
  if (record === null) return null

  const pid = num(record.pid) ?? Number(fileName.replace(/\.json$/, ''))
  if (!Number.isInteger(pid) || pid <= 0) return null

  return {
    pid,
    sessionId: str(record.sessionId),
    status: STATUSES.find(one => one === record.status) ?? 'unknown',
    name: str(record.name),
    cwd: str(record.cwd),
    entrypoint: str(record.entrypoint),
    hostSessionId: str(record.hostSessionId),
    bridgeSessionId: str(record.bridgeSessionId),
    statusUpdatedAt: toMs(num(record.statusUpdatedAt) ?? 0),
  }
}

/** 解析一份狀態回報；格式不對時回傳 null。 */
export const parseReport = (text: string): Report | null => {
  const raw = asObject(text)
  const sessionId = str(raw?.sessionId)
  if (raw === null || sessionId === null) return null

  return {
    sessionId,
    reportedAt: num(raw.reportedAt) ?? 0,
    model: str(raw.model),
    branch: (raw.branch as Branch | null | undefined) ?? null,
    progress: (raw.progress as Progress | null | undefined) ?? null,
    activity: str(raw.activity),
    turnStartedAt: num(raw.turnStartedAt),
    turns: num(raw.turns),
    contextPercent: num(raw.contextPercent),
    costUsd: num(raw.costUsd),
    approval: str(raw.approval),
    question: (raw.question as Question | null | undefined) ?? null,
    turnError: str(raw.turnError),
    lastReply: str(raw.lastReply),
    tasks: Array.isArray(raw.tasks) ? (raw.tasks as Task[]) : [],
    rateLimits: Array.isArray(raw.rateLimits) ? (raw.rateLimits as RateLimit[]) : [],
    connectors: (raw.connectors as Connectors | null | undefined) ?? null,
    pr: (raw.pr as PullRequest | null | undefined) ?? null,
    terminal: str(raw.terminal),
  }
}

/** 從 `ps -o pid=,tty=` 的輸出取出仍存活的 pid 與它所在的終端機；沒有終端機（`??`）時是 null。 */
export const parseAlive = (stdout: string): Map<number, string | null> =>
  new Map(
    stdout
      .split('\n')
      .map(line => line.trim().split(/\s+/))
      .map(([pid, tty]) => [Number(pid), tty === undefined || tty === '??' ? null : tty] as const)
      .filter(([pid]) => Number.isInteger(pid) && pid > 0),
  )

/** Claude 設定目錄：`$CLAUDE_CONFIG_DIR`，沒設時 `~/.claude`。 */
export const configDirOf = (configDir: string | undefined, home: string | undefined): string =>
  configDir !== undefined && configDir !== '' ? configDir : `${home ?? ''}/.claude`

/** 解析 `git status --porcelain=v2 --branch` 的輸出；不是 git 目錄時回傳 null。 */
export const parseGitStatus = (stdout: string): Branch | null => {
  let name: string | null = null
  let ahead = 0
  let behind = 0
  let changed = 0
  for (const line of stdout.split('\n')) {
    if (line.startsWith('# branch.head ')) {
      name = line.slice('# branch.head '.length).trim()
    } else if (line.startsWith('# branch.ab ')) {
      const match = /\+(\d+) -(\d+)/.exec(line)
      ahead = Number(match?.[1] ?? 0)
      behind = Number(match?.[2] ?? 0)
    } else if (line !== '' && !line.startsWith('#')) {
      changed += 1
    }
  }
  if (name === null) return null

  return { name: name === '(detached)' ? '(detached HEAD)' : name, ahead, behind, changed }
}

type TodoItem = { content: string; status: string; activeForm?: string }

/** 加總 `git diff --numstat HEAD` 的新增／刪除行數；二進位檔（-）不計。 */
export const parseNumstat = (stdout: string): { insertions: number; deletions: number } => {
  let insertions = 0
  let deletions = 0
  for (const line of stdout.split('\n')) {
    const [added, removed] = line.split('\t')
    if (added !== undefined && /^\d+$/.test(added)) insertions += Number(added)
    if (removed !== undefined && /^\d+$/.test(removed)) deletions += Number(removed)
  }

  return { insertions, deletions }
}

/** TodoWrite 的清單 → 完成度；空清單時是 null。 */
export const progressOfTodos = (todos: readonly TodoItem[]): Progress | null => {
  if (todos.length === 0) return null
  const current = todos.find(one => one.status === 'in_progress')

  return {
    done: todos.filter(one => one.status === 'completed').length,
    total: todos.length,
    current: current === undefined ? null : (current.activeForm ?? current.content),
  }
}

export type PlanItem = { content: string; status: string }

/**
 * Desktop 任務清單（`update_plan`）的一次更新：`items` 換掉整份清單，
 * `advance` 完成進行中的一步並開始下一步，`done` / `start` 指定步驟（從 1 起算）。
 */
export const applyPlan = (
  items: readonly PlanItem[],
  input: Record<string, unknown>,
): PlanItem[] => {
  if (Array.isArray(input.items)) {
    return (input.items as PlanItem[]).map(one => ({
      content: String(one.content),
      status: String(one.status),
    }))
  }
  const next = items.map(one => ({ ...one }))
  const mark = (index: number, status: string) => {
    const item = next[index]
    if (item !== undefined) next[index] = { ...item, status }
  }
  if (input.advance === true) {
    mark(next.findIndex(one => one.status === 'in_progress'), 'completed')
    mark(next.findIndex(one => one.status === 'pending'), 'in_progress')
  }
  if (Array.isArray(input.done)) {
    for (const n of input.done as number[]) mark(n - 1, 'completed')
  }
  if (typeof input.start === 'number') mark(input.start - 1, 'in_progress')

  return next
}

const MASK = '•••'
/** 名稱看起來是機密：結尾是 token、secret、password，或 key 單獨成段（`API_KEY`、`x-api-key`，不含 `monkey`） */
const SECRET_NAME = String.raw`(?:[\w.-]*(?:token|secret|password|passwd)|(?:[\w.-]*[_.-])?key|apikey)`
/** 機密的值：引號包住的整段，或到空白、`&`、`;`、`|`、`)`、引號為止 */
const SECRET_VALUE = String.raw`(?:"[^"]*"|'[^']*'|[^\s&;|)"'<>]+)`
const SECRET_PATTERNS: readonly [RegExp, string][] = [
  // 網址裡的帳密：https://user:•••@host
  [/(\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:)[^\s/@]+(?=@)/gi, `$1${MASK}`],
  // Authorization 標頭，任何 scheme
  [/(\bauthorization:\s*[a-z]+\s+)[^\s"']+/gi, `$1${MASK}`],
  [/(\bbearer\s+)[^\s"'&]{8,}/gi, `$1${MASK}`],
  // name=value：環境變數、網址參數、--flag=value
  [new RegExp(String.raw`((?<![\w.-])${SECRET_NAME}=)${SECRET_VALUE}`, 'gi'), `$1${MASK}`],
  // --flag value
  [new RegExp(String.raw`((?<![\w-])--${SECRET_NAME}\s+)(?!-)${SECRET_VALUE}`, 'gi'), `$1${MASK}`],
  // 常見服務的金鑰格式
  [
    /\b(?:sk-[\w-]{8,}|gh[pousr]_[A-Za-z0-9]{16,}|github_pat_\w{16,}|glpat-[\w-]{12,}|xox[abposr]-[\w-]{8,}|AKIA[0-9A-Z]{16}|AIza[\w-]{30,}|npm_[A-Za-z0-9]{30,})/g,
    MASK,
  ],
]

/**
 * 把疑似機密的片段換成 `•••`（狀態回報以明碼保存）。只是盡力而為，不保證抓得到全部。
 * 例如 `Bearer …`、`token=…`、`--token …`、`OPENAI_API_KEY=…`、`sk-…`、`ghp_…`。
 */
export const maskSecrets = (text: string): string =>
  SECRET_PATTERNS.reduce((masked, [pattern, replacement]) => masked.replace(pattern, replacement), text)

/** 一次工具呼叫的摘要，例如「$ npm test」「✎ board.ts」「Read board.ts」「ccd·update_plan」。 */
export const summarizeTool = (tool: string, input: Record<string, unknown>): string => {
  const parts = tool.split('__')
  const name = tool.startsWith('mcp__') && parts.length >= 3 ? `${parts[1]}·${parts.slice(2).join('__')}` : tool
  const command = str(input.command)
  // 先遮罩再截斷：截斷後的金鑰可能短到認不出來
  if (command !== null) return `$ ${clip(maskSecrets(command.split('\n')[0] ?? ''), 60)}`
  const path = str(input.file_path) ?? str(input.notebook_path) ?? str(input.path)
  if (path !== null) {
    return /^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool) ? `✎ ${basename(path)}` : `${name} ${basename(path)}`
  }
  const detail =
    str(input.pattern) ?? str(input.query) ?? str(input.url) ?? str(input.description)
  if (detail !== null) return `${name} ${clip(maskSecrets(detail), 60)}`

  return name
}

/** 進度的一行描述，例如「3/7 · 寫測試」。 */
export const describeProgress = (progress: Progress): string =>
  `${progress.done}/${progress.total}${progress.current === null ? '' : ` · ${progress.current}`}`

/** 短時間：45s、17m、3h、2d。 */
export const shortAge = (ms: number): string => {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  return `${Math.floor(hours / 24)}d`
}

/** 模型縮寫：claude-opus-5-5 → Opus 5.5；claude-sonnet-5-5[1m] → Sonnet 5.5 1M。 */
export const shortModel = (model: string): string => {
  const isLong = /\[1m\]/i.test(model)
  const match = /claude-([a-z]+)-(\d+)(?:-(\d+))?/i.exec(model)
  if (match === null) return model.replace(/\[1m\]/i, ' 1M')
  const family = match[1]!.charAt(0).toUpperCase() + match[1]!.slice(1)
  const version = match[3] === undefined ? match[2] : `${match[2]}.${match[3]}`

  return `${family} ${version}${isLong ? ' 1M' : ''}`
}

const HEX_SUFFIX = /-[0-9a-f]{6}$/

/** 位置：worktree 路徑顯示 repo 名稱，其他顯示資料夾名稱（去掉結尾的 hash）。 */
export const locationOf = (path: string): string => {
  const worktree = /\/([^/]+)\/\.claude\/worktrees\/[^/]+\/?$/.exec(path)
  if (worktree !== null) return worktree[1]!

  return basename(path).replace(HEX_SUFFIX, '')
}

/** 分支標籤：去掉 claude/ 前綴與 hash；和 worktree 名稱相同時只留同步狀態。 */
export const branchLabel = (branch: Branch, path: string): string => {
  const name = branch.name.replace(/^claude\//, '').replace(HEX_SUFFIX, '')
  const worktree = /\/\.claude\/worktrees\/([^/]+)\/?$/.exec(path)?.[1]?.replace(HEX_SUFFIX, '')
  const sync = [
    branch.ahead > 0 ? `↑${branch.ahead}` : '',
    branch.behind > 0 ? `↓${branch.behind}` : '',
    branch.changed > 0 ? `±${branch.changed}` : '',
  ].filter(Boolean)
  const label = name === worktree ? '' : name

  return [label, ...sync].filter(Boolean).join(' ')
}

/** 用量條：8 格，例如 ▰▰▰▱▱▱▱▱ 40%。 */
export const usageBar = (percent: number, cells = 8): string => {
  const value = Math.min(100, Math.max(0, percent))
  const filled = Math.round((value / 100) * cells)

  return `${'▰'.repeat(filled)}${'▱'.repeat(cells - filled)} ${Math.round(value)}%`
}

/** 用量的顏色門檻：80% 以上警示、95% 以上錯誤。 */
export const usageColor = (percent: number): string =>
  percent >= 95 ? 'error' : percent >= 80 ? 'warning' : 'subtle'

/** 三種密度的欄位組合。 */
export const PRESETS: Record<Density, readonly Field[]> = {
  compact: ['time', 'reply', 'tasks'],
  standard: ['time', 'location', 'branch', 'progress', 'activity', 'changes', 'context', 'pr', 'reply', 'tasks'],
  detailed: [
    'time', 'location', 'branch', 'progress', 'activity', 'changes', 'context', 'pr', 'reply', 'tasks',
    'environment', 'connectors', 'model', 'usage', 'source', 'path',
  ],
}

/** 每一組的預設欄位：需要你處理與工作中用標準，閒置只顯示時間。 */
export const DEFAULT_FIELDS: Record<Group, readonly Field[]> = {
  waiting: PRESETS.standard,
  busy: PRESETS.standard,
  idle: PRESETS.compact,
}

/** 卡片屬於哪一組欄位設定。 */
export const groupOf = (status: SessionCard['status']): Group =>
  status === 'waiting' || status === 'errored' ? 'waiting' : status === 'busy' ? 'busy' : 'idle'

/** 目前的欄位組合屬於哪個密度；手動改過時是 null（自訂）。 */
export const densityOf = (fields: readonly Field[]): Density | null =>
  (Object.keys(PRESETS) as Density[]).find(
    density =>
      PRESETS[density].length === fields.length && PRESETS[density].every(one => fields.includes(one)),
  ) ?? null

/** 多數 Session 用的模型；用來決定哪些卡片要特別標出模型。 */
export const commonModel = (cards: readonly SessionCard[]): string | null => {
  const counts = new Map<string, number>()
  for (const card of cards) {
    const model = card.report?.model
    if (model != null) counts.set(model, (counts.get(model) ?? 0) + 1)
  }
  let best: string | null = null
  for (const [model, n] of counts) if (best === null || n > (counts.get(best) ?? 0)) best = model

  return best
}

/** 終端機的 `TERM_PROGRAM` → 顯示名稱 */
const TERMINALS: Record<string, string> = {
  'iTerm.app': 'iTerm',
  Apple_Terminal: 'Terminal',
  vscode: 'VS Code',
  WarpTerminal: 'Warp',
  ghostty: 'Ghostty',
}

const sourceOf = (entrypoint: string | null, terminal: string | null): string | null => {
  if (terminal !== null) return TERMINALS[terminal] ?? terminal
  if (entrypoint === null) return null
  if (/desktop/i.test(entrypoint)) return 'Desktop'
  if (/^cli$/i.test(entrypoint)) return 'CLI'

  return entrypoint
}

const ORDER: Record<SessionCard['status'], number> = { waiting: 0, errored: 0, busy: 1, idle: 2, unknown: 3 }

/**
 * 最終狀態：回報說回合出錯、而 session 紀錄不是工作中或等待時，算出錯中止（見 spec 的彙整規則）。
 * 回合結束時留下問題（Desktop 結尾的提問框）而 session 已閒置，算需要你處理。
 */
const statusOf = (record: SessionRecord, report: Report | null): SessionCard['status'] => {
  if (record.status === 'busy' || record.status === 'waiting') return record.status
  if (report?.turnError != null) return 'errored'
  if (report?.question != null && record.status === 'idle') return 'waiting'

  return record.status
}

/**
 * 監看視窗的卡片：只列 pid 存活的 Session，附上它的狀態回報（有的話）。
 *
 * 排序：需要你處理 → 工作中 → 閒置；同一種狀態內，狀態變化較新的在前。
 */
export const toCards = (
  records: readonly SessionRecord[],
  alive: ReadonlyMap<number, string | null>,
  reports: ReadonlyMap<string, Report>,
): SessionCard[] =>
  records
    .filter(one => alive.has(one.pid))
    .map(one => {
      const folder = one.cwd === null ? '' : basename(one.cwd)
      const report = one.sessionId === null ? null : (reports.get(one.sessionId) ?? null)
      const card: SessionCard = {
        pid: one.pid,
        sessionId: one.sessionId,
        hostSessionId: one.hostSessionId,
        isRemote: one.bridgeSessionId !== null,
        isWorktree: one.cwd !== null && /\/\.claude\/worktrees\/[^/]+\/?$/.test(one.cwd),
        status: statusOf(one, report),
        title: one.name ?? folder,
        folder,
        path: one.cwd ?? '',
        source: sourceOf(one.entrypoint, report?.terminal ?? null),
        tty: alive.get(one.pid) ?? null,
        since: one.statusUpdatedAt > 0 ? one.statusUpdatedAt : null,
        report,
      }

      return { card, at: one.statusUpdatedAt }
    })
    .sort((a, b) => ORDER[a.card.status] - ORDER[b.card.status] || b.at - a.at)
    .map(one => one.card)

/** 等你計數：需要你處理（待核准、待回答）加上出錯中止。 */
export const countWaiting = (cards: readonly SessionCard[]): number =>
  cards.filter(one => one.status === 'waiting' || one.status === 'errored').length

/** Desktop 回合結尾提問框（wrap_up）的輸入 → 問題與按鈕；沒有提問時是 null。 */
export const wrapUpQuestionOf = (input: { ask?: unknown; actions?: unknown }): Question | null => {
  const text = str(input.ask)
  if (text === null) return null
  const options = Array.isArray(input.actions)
    ? input.actions
        .map(one => {
          const action = one as { label?: unknown; action?: unknown }
          return str(action.label) ?? str(action.action)
        })
        .filter(one => one !== null)
        .slice(0, 6)
        .map(one => clip(maskSecrets(one), 30))
    : []

  return { text: clip(maskSecrets(text), 120), options }
}

/** AskUserQuestion 的輸入 → 問題與選項（多題時只取第一題，並標出還有幾題）。 */
export const questionOf = (questions: unknown): Question | null => {
  if (!Array.isArray(questions) || questions.length === 0) return null
  const first = questions[0] as { question?: unknown; options?: unknown }
  const text = str(first.question)
  if (text === null) return null
  const options = Array.isArray(first.options)
    ? first.options
        .map(one => str((one as { label?: unknown }).label))
        .filter(one => one !== null)
        .slice(0, 6)
        .map(one => clip(maskSecrets(one), 30))
    : []

  return { text: clip(maskSecrets(text), 120), options, more: questions.length - 1 }
}

/** 回覆摘要：合併空白，最多 120 字（回報檔以明碼保存，只留監看視窗用得到的長度）。 */
export const summarizeReply = (text: string): string | null => {
  const flat = text.replace(/\s+/g, ' ').trim()

  return flat === '' ? null : clip(flat, 120)
}

/** 背景任務的計數：執行中、等待中、失敗。 */
export const countTasks = (tasks: readonly Task[]) => ({
  running: tasks.filter(one => one.status === 'running').length,
  waiting: tasks.filter(one => one.status === 'waiting').length,
  failed: tasks.filter(one => one.status === 'failed').length,
})

/** Agent 狀態 → 背景任務狀態。 */
export const taskStatusOf = (status: string): Task['status'] =>
  status === 'pending' || status === 'running'
    ? 'running'
    : status === 'waiting'
      ? 'waiting'
      : status === 'failed' || status === 'killed'
        ? 'failed'
        : 'done'

/** rate limit 的種類：5 小時、每週，其他照原樣。 */
export const rateKind = (kind: string): 'fiveHour' | 'week' | null =>
  /five|5h|hour/i.test(kind) ? 'fiveHour' : /seven|week|7d/i.test(kind) ? 'week' : null

/** 跳轉到 Desktop 裡的 Session 的連結；沒有 host session id（CLI）或格式不對時是 null。 */
export const desktopLinkOf = (hostSessionId: string | null): string | null => {
  // 只接受英數字、_、-：連結會交給 open 開啟，不讓紀錄裡的任意字串混進網址
  if (hostSessionId === null || !/^[A-Za-z0-9_-]+$/.test(hostSessionId)) return null
  const id = hostSessionId.startsWith('local_') ? hostSessionId : `local_${hostSessionId}`

  return `claude://claude.ai/epitaxy/${id}`
}

/** 能依 tty 切到分頁的終端機：`TERM_PROGRAM` → AppleScript 的 app 名稱與找分頁的寫法 */
const TAB_SCRIPTS: Record<string, { app: string; find: string[] }> = {
  'iTerm.app': {
    app: 'iTerm2',
    find: [
      'repeat with w in windows',
      'repeat with t in tabs of w',
      'repeat with s in sessions of t',
      'if tty of s is target then',
      'tell w to select',
      'tell t to select',
      'tell s to select',
      'activate',
      'return "ok"',
      'end if',
      'end repeat',
      'end repeat',
      'end repeat',
    ],
  },
  Apple_Terminal: {
    app: 'Terminal',
    find: [
      'repeat with w in windows',
      'repeat with t in tabs of w',
      'if tty of t is target then',
      'set selected of t to true',
      'set index of w to 1',
      'activate',
      'return "ok"',
      'end if',
      'end repeat',
      'end repeat',
    ],
  },
}

/**
 * 切到 CLI Session 所在終端機分頁的 osascript 指令；不支援的終端機或 tty 格式不對時是 null。
 * 找到時輸出 `ok`；找不到時把終端機帶到前面、輸出 `missing`。
 */
export const tabScriptOf = (terminal: string | null, tty: string | null): string[] | null => {
  const script = terminal === null ? undefined : TAB_SCRIPTS[terminal]
  // tty 以參數傳給腳本，不拼進腳本；仍只接受 ttysNNN
  if (script === undefined || tty === null || !/^ttys\d+$/.test(tty)) return null
  const lines = [
    'on run argv',
    'set target to item 1 of argv',
    `tell application "${script.app}"`,
    ...script.find,
    'activate',
    'end tell',
    'return "missing"',
    'end run',
  ]

  return ['osascript', ...lines.flatMap(line => ['-e', line]), `/dev/${tty}`]
}

/** 寬字元（中日韓、全形、emoji 等）佔 2 格。 */
const isWide = (code: number): boolean =>
  (code >= 0x1100 && code <= 0x115f) ||
  (code >= 0x2e80 && code <= 0xa4cf) ||
  (code >= 0xac00 && code <= 0xd7a3) ||
  (code >= 0xf900 && code <= 0xfaff) ||
  (code >= 0xfe30 && code <= 0xfe4f) ||
  (code >= 0xff00 && code <= 0xff60) ||
  (code >= 0xffe0 && code <= 0xffe6) ||
  (code >= 0x1f300 && code <= 0x1faff) ||
  (code >= 0x20000 && code <= 0x3fffd)

/** 字串的顯示寬度（格數）。 */
export const displayWidth = (text: string): number => {
  let width = 0
  for (const char of text) width += isWide(char.codePointAt(0) ?? 0) ? 2 : 1

  return width
}

/** 依顯示寬度截斷，超出時結尾換成 …；寬度不足 1 格時回傳空字串。 */
export const clipToWidth = (text: string, columns: number): string => {
  if (columns <= 0) return ''
  if (displayWidth(text) <= columns) return text
  let out = ''
  let width = 0
  for (const char of text) {
    const next = isWide(char.codePointAt(0) ?? 0) ? 2 : 1
    if (width + next > columns - 1) break
    out += char
    width += next
  }

  return `${out}…`
}

/**
 * 比例字型下的寬度估算（以等寬格為單位）：Desktop 的 Pane 用比例字型，
 * 中日韓字約 1.7 格、其他字約 0.9 格，比 displayWidth 的 2 格／1 格窄。
 */
const proportionalWidth = (char: string): number => (isWide(char.codePointAt(0) ?? 0) ? 1.7 : 0.9)

/** 比例字型下的估算寬度（以等寬格為單位），和 fitToWidth 用同一套算法。 */
export const estimateWidth = (text: string): number => {
  let total = 0
  for (const char of text) total += proportionalWidth(char)

  return total
}

/** 依比例字型的估算寬度截斷，超出時結尾換成 …。 */
export const fitToWidth = (text: string, columns: number): string => {
  if (columns <= 0) return ''
  let total = 0
  for (const char of text) total += proportionalWidth(char)
  if (total <= columns) return text
  let out = ''
  let width = 0
  for (const char of text) {
    const next = proportionalWidth(char)
    if (width + next > columns - 1) break
    out += char
    width += next
  }

  return `${out}…`
}

/** 從工具清單推出 MCP 連接器：`mcp__<server>__<tool>`；只有驗證工具的伺服器視為需要驗證。 */
export const connectorsOf = (tools: readonly { name: string; mcp: boolean }[]): Connectors => {
  const byServer = new Map<string, string[]>()
  for (const tool of tools) {
    const parts = tool.name.split('__')
    if (!tool.mcp || parts.length < 3 || parts[0] !== 'mcp') continue
    const server = parts[1]!
    byServer.set(server, [...(byServer.get(server) ?? []), parts.slice(2).join('__')])
  }
  const connected: string[] = []
  const needsAuth: string[] = []
  for (const [server, names] of byServer) {
    const label = serverLabel(server)
    if (names.every(name => /authenticate/i.test(name))) needsAuth.push(label)
    else connected.push(label)
  }

  return { connected: [...new Set(connected)].sort(), needsAuth: [...new Set(needsAuth)].sort() }
}

/** 伺服器名稱的顯示：plugin_figma_figma → figma；claude.ai 連接器的 uuid → 連接器。 */
export const serverLabel = (server: string): string => {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(server)) return 'claude.ai'
  const plugin = /^plugin_([^_]+)_/.exec(server)

  return plugin === null ? server : plugin[1]!
}

/** 解析 `gh pr view --json number,state,url` 的輸出。 */
export const parsePullRequest = (stdout: string): PullRequest | null => {
  const raw = asObject(stdout)
  const number = num(raw?.number)
  const url = str(raw?.url)
  if (raw === null || number === null || url === null || !/^https:\/\//.test(url)) return null

  return { number, state: str(raw.state) ?? 'OPEN', url }
}

/**
 * 要刪除的殘留回報：檔名是 `<sessionId>.json`、不屬於任何 session 紀錄，
 * 而且超過一分鐘沒更新（避免刪掉剛啟動、紀錄還沒寫出的 Session）。
 */
export const staleReports = (
  entries: readonly { name: string; kind: string; mtimeMs: number }[],
  knownIds: ReadonlySet<string>,
  now: number,
): string[] =>
  entries
    .filter(one => one.kind === 'file' && /^[A-Za-z0-9-]+\.json$/.test(one.name))
    .filter(one => !knownIds.has(one.name.slice(0, -'.json'.length)))
    .filter(one => now - one.mtimeMs > 60_000)
    .map(one => one.name)

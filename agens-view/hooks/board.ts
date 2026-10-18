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
  /** `shell`：回合已結束，但還有背景 Bash 在跑 */
  status: 'busy' | 'idle' | 'waiting' | 'shell' | 'unknown'
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
  /** Session 開始的時間（毫秒），不知道時是 0 */
  startedAt: number
}

const STATUSES = ['busy', 'idle', 'waiting', 'shell'] as const

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
    startedAt: toMs(num(record.startedAt) ?? 0),
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
    // 0.6.0 之前的回報沒有這個欄位，保留「沒有」，跳轉時才分得出要不要重開
    ...(raw.terminal === undefined ? {} : { terminal: str(raw.terminal) }),
    topic: str(raw.topic),
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
/** 機密的值：引號包住的整段（引號沒閉合就到結尾，例如只取了多行指令的第一行），或到空白、`&`、`;`、`|`、`)`、引號為止 */
const SECRET_VALUE = String.raw`(?:"[^"]*"?|'[^']*'?|[^\s&;|)"'<>]+)`
const SECRET_PATTERNS: readonly [RegExp, string][] = [
  // 網址裡的帳密：https://user:•••@host。密碼可能含 @，遮到最後一個 @（之後的 host 不含 @）
  [/(\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:)[^\s/]+(?=@[^\s/@]*(?:[/:?#\s"']|$))/gi, `$1${MASK}`],
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

/** 第一句 prompt → Session 標題用的主題：先遮罩、合併空白，再截成約 40 字；沒有內容時是 null。 */
export const topicOf = (prompt: string): string | null => {
  const flat = maskSecrets(prompt).replace(/\s+/g, ' ').trim()

  return flat === '' ? null : clip(flat, 40)
}

/** 一次工具呼叫的摘要，例如「$ npm test」「Edit board.ts」「Read board.ts」「ccd·update_plan」。 */
export const summarizeTool = (tool: string, input: Record<string, unknown>): string => {
  const parts = tool.split('__')
  const name = tool.startsWith('mcp__') && parts.length >= 3 ? `${parts[1]}·${parts.slice(2).join('__')}` : tool
  const command = str(input.command)
  // 先遮罩再截斷：截斷後的金鑰可能短到認不出來
  // 先遮罩整段再取第一行：跨行的引號值在第一行沒閉合
  if (command !== null) return `$ ${clip(maskSecrets(command).split('\n')[0] ?? '', 60)}`
  const path = str(input.file_path) ?? str(input.notebook_path) ?? str(input.path)
  if (path !== null) {
    // 改檔案的工具都寫成 Edit，和 Read 一致；✎ 只代表 VS Code 來源
    return `${/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool) ? 'Edit' : name} ${basename(path)}`
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
/** 分支名稱的簡短寫法：去掉 claude/ 前綴與結尾的 hash。 */
const shortBranch = (name: string): string => name.replace(/^claude\//, '').replace(HEX_SUFFIX, '')

export const branchLabel = (branch: Branch, path: string): string => {
  const name = shortBranch(branch.name)
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

  return `${GLYPHS.meterUsed.char.repeat(filled)}${GLYPHS.meterFree.char.repeat(cells - filled)} ${Math.round(value)}%`
}

/** 用量的顏色門檻：80% 以上警示、95% 以上錯誤。 */
export const usageColor = (percent: number): string =>
  percent >= 95 ? 'error' : percent >= 80 ? 'warning' : 'subtle'

/** 檢視面板裡可以開關的欄位，依卡片上的順序 */
export const FIELDS: readonly Field[] = [
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

/**
 * 每個分區有作用的欄位：進度、目前動作只畫在工作中的卡片，最後回覆只畫在閒置的卡片。
 * 設定面板只列這些；收合的卡片照設定畫，展開明細不受影響
 */
export const VALID_FIELDS: Record<Group, readonly Field[]> = {
  waiting: FIELDS.filter(one => one !== 'progress' && one !== 'activity' && one !== 'reply'),
  busy: FIELDS.filter(one => one !== 'reply'),
  idle: FIELDS.filter(one => one !== 'progress' && one !== 'activity'),
}

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

/**
 * 目前的欄位組合屬於哪個密度；手動改過時是 null（自訂）。
 * 只比對 valid 裡的欄位：分區裡沒作用的欄位勾不勾都一樣，不算自訂
 */
export const densityOf = (fields: readonly Field[], valid: readonly Field[] = FIELDS): Density | null => {
  const mine = fields.filter(one => valid.includes(one))

  return (
    (Object.keys(PRESETS) as Density[]).find(density => {
      const preset = PRESETS[density].filter(one => valid.includes(one))

      return preset.length === mine.length && preset.every(one => mine.includes(one))
    }) ?? null
  )
}

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

/** 符號總表的一項：字元、碼位、East Asian Width（W 寬、N 中性、Na 窄、A 不明確）與意思。 */
export type Glyph = { char: string; code: string; ea: 'W' | 'N' | 'Na' | 'A'; meaning: string }

/**
 * 符號總表：畫面上的符號都從這裡取，一個符號只有一個意思，一個意思只用一個符號。
 * EA 是用 Unicode 15.1 的 EastAsianWidth 查的；沒有 W（寬）的字。
 * A（Ambiguous）的字在中日韓 locale 的終端機會畫成 2 格，之後新增的符號一律選 N 或 Na。
 */
export const GLYPHS = {
  // 狀態
  waiting: { char: '▲', code: 'U+25B2', ea: 'A', meaning: '待處理' },
  busy: { char: '◉', code: 'U+25C9', ea: 'N', meaning: '工作中' },
  idle: { char: '○', code: 'U+25CB', ea: 'A', meaning: '閒置' },
  errored: { char: '✕', code: 'U+2715', ea: 'N', meaning: '出錯中止' },
  unknown: { char: '◌', code: 'U+25CC', ea: 'N', meaning: '狀態不明' },
  // 來源
  desktop: { char: '◧', code: 'U+25E7', ea: 'N', meaning: '來源：Desktop' },
  vscode: { char: '✎', code: 'U+270E', ea: 'N', meaning: '來源：VS Code' },
  terminal: { char: '❯', code: 'U+276F', ea: 'N', meaning: '來源：其他終端機' },
  // 背景任務（⏸ 加 VS15，避免畫成 emoji）
  taskRunning: { char: '↻', code: 'U+21BB', ea: 'N', meaning: '背景任務執行中' },
  taskWaiting: { char: '⏸︎', code: 'U+23F8 U+FE0E', ea: 'N', meaning: '背景任務等待中' },
  taskFailed: { char: '!', code: 'U+0021', ea: 'Na', meaning: '背景任務失敗' },
  done: { char: '✓', code: 'U+2713', ea: 'N', meaning: '完成、沒有待處理' },
  subtask: { char: '↳', code: 'U+21B3', ea: 'N', meaning: '工作中卡片底下的背景任務' },
  // 揭露（放在文字後面）
  collapsed: { char: '▸', code: 'U+25B8', ea: 'N', meaning: '收合中，可展開' },
  expanded: { char: '▾', code: 'U+25BE', ea: 'N', meaning: '展開中，可收合' },
  // 其他
  current: { char: '✦', code: 'U+2726', ea: 'N', meaning: '目前這個 Session' },
  jump: { char: '→', code: 'U+2192', ea: 'A', meaning: '跳轉' },
  external: { char: '↗', code: 'U+2197', ea: 'A', meaning: '外部連結' },
  pr: { char: '#', code: 'U+0023', ea: 'Na', meaning: 'PR 編號' },
  checked: { char: '☑', code: 'U+2611', ea: 'N', meaning: '已勾選' },
  unchecked: { char: '☐', code: 'U+2610', ea: 'N', meaning: '未勾選' },
  board: { char: '▦', code: 'U+25A6', ea: 'A', meaning: '監看視窗' },
  cannotSee: { char: '⚠', code: 'U+26A0', ea: 'N', meaning: '看不到狀態' },
  meterUsed: { char: '▰', code: 'U+25B0', ea: 'N', meaning: '用量條：已用' },
  meterFree: { char: '▱', code: 'U+25B1', ea: 'N', meaning: '用量條：未用' },
} as const satisfies Record<string, Glyph>

/**
 * 來源的符號，放在標題前一格：Desktop ◧、VS Code ✎、其他終端機（iTerm、Terminal.app…）❯；不知道來源時是 null。
 * 都選終端機上佔一格的字（East Asian Width 不是 Ambiguous）。
 */
export const sourceMark = (source: string | null): string | null => {
  if (source === null) return null
  if (source === 'Desktop') return GLYPHS.desktop.char
  // VS Code 的整合終端機，和 session 紀錄裡原樣留下的 VS Code 擴充套件 entrypoint
  if (/^vs ?code$|vscode/i.test(source)) return GLYPHS.vscode.char

  return GLYPHS.terminal.char
}

const ORDER: Record<SessionCard['status'], number> = { waiting: 0, errored: 0, busy: 1, idle: 2, unknown: 3 }

/**
 * 最終狀態：回報說回合出錯、而 session 紀錄不是工作中或等待時，算出錯中止（見 spec 的彙整規則）。
 * 回合結束時留下問題（Desktop 結尾的提問框）而 session 已閒置，算需要你處理。
 * 回合結束但背景任務還在跑，算工作中：結果回來時 Claude 還會接著做。
 * CLI 的紀錄會寫成 shell；Desktop 的紀錄仍是 idle，只能看回報裡的背景任務。
 */
const statusOf = (record: SessionRecord, report: Report | null): SessionCard['status'] => {
  if (record.status === 'busy' || record.status === 'waiting') return record.status
  if (report?.turnError != null) return 'errored'
  if (report?.question != null && (record.status === 'idle' || record.status === 'shell')) return 'waiting'
  if (record.status === 'shell') return 'busy'
  if (record.status === 'idle' && report?.tasks.some(one => one.status === 'running') === true) return 'busy'

  return record.status
}

type Ranked = { card: SessionCard; at: number; startedAt: number }

const LAST = Number.MAX_SAFE_INTEGER
const startOf = (one: Ranked): number => (one.startedAt > 0 ? one.startedAt : LAST)
// 不知道何時進入待處理的排在底部，和頁首「最長」把它算成 0 一致
const enteredOf = (one: Ranked): number => (one.at > 0 ? one.at : LAST)

/**
 * 同一種狀態內的次序：待處理依進入該狀態的時間由舊到新；
 * 工作中依 Session 開始的時間，不隨狀態變化跳動；閒置依最後活動時間由新到舊。
 */
const withinGroup = (a: Ranked, b: Ranked): number => {
  const group = groupOf(a.card.status)
  if (group === 'waiting') return enteredOf(a) - enteredOf(b)
  // 紀錄沒有開始時間的排在後面，用 pid 當作固定的次序
  if (group === 'busy') return startOf(a) - startOf(b) || a.card.pid - b.card.pid

  return b.at - a.at
}

/** 依標題分組，只留兩列以上同名的。 */
const sameTitles = (ranked: readonly Ranked[]): Ranked[][] => {
  const groups = new Map<string, Ranked[]>()
  for (const one of ranked) groups.set(one.card.title, [...(groups.get(one.card.title) ?? []), one])

  return [...groups.values()].filter(group => group.length > 1)
}

const retitle = (one: Ranked, title: string): Ranked => ({ ...one, card: { ...one.card, title } })

/**
 * 同名的列看得出差別：分支不全相同時補上分支名；仍然同名的，
 * 依 Session 開始的先後補 #2、#3（最早的不補），不隨排序跳動。
 */
const disambiguate = (ranked: readonly Ranked[]): Ranked[] => {
  const byBranch = new Map<Ranked, Ranked>()
  for (const group of sameTitles(ranked)) {
    const branches = group.map(one => one.card.report?.branch?.name ?? null)
    if (new Set(branches).size < 2) continue
    for (const one of group) {
      const branch = one.card.report?.branch?.name
      if (branch != null) byBranch.set(one, retitle(one, `${one.card.title} · ${shortBranch(branch)}`))
    }
  }
  const named = ranked.map(one => byBranch.get(one) ?? one)
  const numbered = new Map<Ranked, Ranked>()
  for (const group of sameTitles(named)) {
    const ordered = [...group].sort((a, b) => startOf(a) - startOf(b) || a.card.pid - b.card.pid)
    ordered.slice(1).forEach((one, i) => numbered.set(one, retitle(one, `${one.card.title} #${i + 2}`)))
  }

  return named.map(one => numbered.get(one) ?? one)
}

/**
 * 監看視窗的卡片：只列 pid 存活的 Session，附上它的狀態回報（有的話）。
 *
 * 排序：待處理 → 工作中 → 閒置；同一種狀態內見 withinGroup。
 */
export const toCards = (
  records: readonly SessionRecord[],
  alive: ReadonlyMap<number, string | null>,
  reports: ReadonlyMap<string, Report>,
): SessionCard[] =>
  disambiguate(
    records.filter(one => alive.has(one.pid)).map(one => {
      const folder = one.cwd === null ? '' : basename(one.cwd)
      const report = one.sessionId === null ? null : (reports.get(one.sessionId) ?? null)
      const card: SessionCard = {
        pid: one.pid,
        sessionId: one.sessionId,
        hostSessionId: one.hostSessionId,
        isRemote: one.bridgeSessionId !== null,
        isWorktree: one.cwd !== null && /\/\.claude\/worktrees\/[^/]+\/?$/.test(one.cwd),
        status: statusOf(one, report),
        // worktree 用 repo 名稱，不用隨機的 worktree 名稱
        title: one.name ?? report?.topic ?? (one.cwd === null ? '' : locationOf(one.cwd)),
        folder,
        path: one.cwd ?? '',
        source: sourceOf(one.entrypoint, report?.terminal ?? null),
        tty: alive.get(one.pid) ?? null,
        since: one.statusUpdatedAt > 0 ? one.statusUpdatedAt : null,
        report,
      }

      return { card, at: one.statusUpdatedAt, startedAt: one.startedAt }
    }),
  )
    .sort((a, b) => ORDER[a.card.status] - ORDER[b.card.status] || withinGroup(a, b))
    .map(one => one.card)

/** 等你計數：需要你處理（待核准、待回答）加上出錯中止。 */
export const countWaiting = (cards: readonly SessionCard[]): number =>
  cards.filter(one => one.status === 'waiting' || one.status === 'errored').length

/** 數字快捷鍵最多到 9。 */
const MAX_HOTKEY = 9

/** 監看視窗上一次畫出來的樣子：各分區的 pid 次序，和每個 pid 用過的數字快捷鍵。 */
export type Layout = { sections: Record<Group, readonly number[]>; hotkeys: ReadonlyMap<number, number> }

/** 照 order 裡的次序排；不在 order 裡的（新來的）接在後面，彼此維持原本的次序。 */
const inOrderOf = (cards: readonly SessionCard[], order: readonly number[]): SessionCard[] => {
  const rank = new Map(order.map((pid, i) => [pid, i]))

  return [
    ...cards.filter(one => rank.has(one.pid)).sort((a, b) => (rank.get(a.pid) ?? 0) - (rank.get(b.pid) ?? 0)),
    ...cards.filter(one => !rank.has(one.pid)),
  ]
}

/**
 * 卡片放在哪個分區、什麼次序，以及「前往處理」的數字快捷鍵（GLOSSARY「凍結順序」）。
 *
 * 沒有凍結（frozen 是 null）時照 toCards 的次序分區，有按鈕的待處理卡片依序給 1…9，不跳號。
 * 凍結時（焦點在監看視窗裡）照上一次畫出來的樣子：
 * - 上一次在待處理分區的卡片留在原位，狀態離開待處理也一樣（按鈕由呼叫的一方依狀態拿掉）；
 *   新進待處理的接在待處理分區底部。工作中、閒置分區裡原本就在的維持次序，新來的接在後面。
 * - 數字跟著卡片走：還有按鈕的卡片沿用原本的數字；新出現的按鈕用沒用過的下一個數字。
 *   拿掉按鈕的卡片的數字不讓給別張，免得同一個數字對到另一張卡片。
 *
 * 回傳的 layout 是這一次畫出來的樣子，給下一次凍結用；凍結期間記得所有用過的數字。
 */
export const arrange = (
  cards: readonly SessionCard[],
  hasButton: (card: SessionCard) => boolean,
  frozen: Layout | null,
): { sections: Record<Group, SessionCard[]>; hotkeys: Map<number, number>; layout: Layout } => {
  const natural = (group: Group) => cards.filter(one => groupOf(one.status) === group)
  let sections: Record<Group, SessionCard[]>
  if (frozen === null) {
    sections = { waiting: natural('waiting'), busy: natural('busy'), idle: natural('idle') }
  } else {
    const kept = new Set(frozen.sections.waiting)
    const waiting = inOrderOf(
      cards.filter(one => kept.has(one.pid) || groupOf(one.status) === 'waiting'),
      frozen.sections.waiting,
    )
    const rest = (group: Group) =>
      inOrderOf(
        natural(group).filter(one => !kept.has(one.pid)),
        frozen.sections[group],
      )
    sections = { waiting, busy: rest('busy'), idle: rest('idle') }
  }

  const used = new Map(frozen?.hotkeys ?? [])
  let next = Math.max(0, ...used.values()) + 1
  const hotkeys = new Map<number, number>()
  for (const card of sections.waiting.filter(hasButton)) {
    const known = used.get(card.pid)
    if (known !== undefined) {
      hotkeys.set(card.pid, known)
    } else if (next <= MAX_HOTKEY) {
      hotkeys.set(card.pid, next)
      used.set(card.pid, next)
      next += 1
    }
  }

  return {
    sections,
    hotkeys,
    layout: {
      sections: {
        waiting: sections.waiting.map(one => one.pid),
        busy: sections.busy.map(one => one.pid),
        idle: sections.idle.map(one => one.pid),
      },
      hotkeys: frozen === null ? hotkeys : used,
    },
  }
}

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

/** 回覆摘要：先遮罩、合併空白，最多 120 字（回報檔以明碼保存，只留監看視窗用得到的長度）。 */
export const summarizeReply = (text: string): string | null => {
  const flat = maskSecrets(text).replace(/\s+/g, ' ').trim()

  return flat === '' ? null : clip(flat, 120)
}

/** 背景任務的計數：執行中、等待中、失敗。 */
export const countTasks = (tasks: readonly Task[]) => ({
  running: tasks.filter(one => one.status === 'running').length,
  waiting: tasks.filter(one => one.status === 'waiting').length,
  failed: tasks.filter(one => one.status === 'failed').length,
})

/** 子卡片上的任務標題：Subagent 拿掉前面的類型，只留描述；沒有描述時照原樣。背景 Bash 就是指令本身。 */
export const taskTitle = (task: Task): string => {
  const description = task.kind === 'agent' ? task.label.slice(task.label.indexOf('·') + 1).trim() : ''
  const isMissing = description === '' || description === 'undefined' || !task.label.includes('·')

  return task.kind === 'agent' && !isMissing ? description : task.label
}

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

/** 變體選擇符（例如 ⏸ 後面的 VS15）不佔格。 */
const isZeroWidth = (code: number): boolean => code >= 0xfe00 && code <= 0xfe0f

/**
 * East Asian Width 是 A（Ambiguous）的字：西文 locale 的終端機畫 1 格，中日韓 locale 畫 2 格。
 * 從 Unicode 15.1 的 EastAsianWidth.txt 產生，已排除組合字元、格式字元與私用區（十六進位碼位，`起-迄`）。
 */
const AMBIGUOUS: readonly (readonly [number, number])[] = (
  'a1 a4 a7-a8 aa ae b0-b4 b6-ba bc-bf c6 d0 d7-d8 de-e1 e6 e8-ea ec-ed f0 f2-f3 f7-fa fc fe 101 111 ' +
  '113 11b 126-127 12b 131-133 138 13f-142 144 148-14b 14d 152-153 166-167 16b 1ce 1d0 1d2 1d4 1d6 1d8 ' +
  '1da 1dc 251 261 2c4 2c7 2c9-2cb 2cd 2d0 2d8-2db 2dd 2df 391-3a1 3a3-3a9 3b1-3c1 3c3-3c9 401 410-44f ' +
  '451 2010 2013-2016 2018-2019 201c-201d 2020-2022 2024-2027 2030 2032-2033 2035 203b 203e 2074 207f ' +
  '2081-2084 20ac 2103 2105 2109 2113 2116 2121-2122 2126 212b 2153-2154 215b-215e 2160-216b 2170-2179 ' +
  '2189 2190-2199 21b8-21b9 21d2 21d4 21e7 2200 2202-2203 2207-2208 220b 220f 2211 2215 221a 221d-2220 ' +
  '2223 2225 2227-222c 222e 2234-2237 223c-223d 2248 224c 2252 2260-2261 2264-2267 226a-226b 226e-226f ' +
  '2282-2283 2286-2287 2295 2299 22a5 22bf 2312 2460-24e9 24eb-254b 2550-2573 2580-258f 2592-2595 ' +
  '25a0-25a1 25a3-25a9 25b2-25b3 25b6-25b7 25bc-25bd 25c0-25c1 25c6-25c8 25cb 25ce-25d1 25e2-25e5 25ef ' +
  '2605-2606 2609 260e-260f 261c 261e 2640 2642 2660-2661 2663-2665 2667-266a 266c-266d 266f 269e-269f ' +
  '26bf 26c6-26cd 26cf-26d3 26d5-26e1 26e3 26e8-26e9 26eb-26f1 26f4 26f6-26f9 26fb-26fc 26fe-26ff 273d ' +
  '2776-277f 2b56-2b59 3248-324f fffd 1f100-1f10a 1f110-1f12d 1f130-1f169 1f170-1f18d 1f18f-1f190 ' +
  '1f19b-1f1ac'
)
  .split(' ')
  .map(range => {
    const [from = '0', to = from] = range.split('-')
    return [parseInt(from, 16), parseInt(to, 16)] as const
  })

/** 已經算 2 格的寬字元不重複計入 */
const isAmbiguous = (code: number): boolean =>
  code >= 0xa1 && !isWide(code) && AMBIGUOUS.some(([from, to]) => code >= from && code <= to)

/** 字串裡 Ambiguous 字的數量：終端機的寬度預算拿它當餘裕，不分語言。 */
export const ambiguousCount = (text: string): number => {
  let count = 0
  for (const char of text) if (isAmbiguous(char.codePointAt(0) ?? 0)) count += 1

  return count
}

/** 一個字的格數；ambiguous 是 Ambiguous 字算幾格（預設 1 格，算最寬的情況時給 2）。 */
const cellsOf = (char: string, ambiguous: 1 | 2): number => {
  const code = char.codePointAt(0) ?? 0
  if (isZeroWidth(code)) return 0
  if (isWide(code)) return 2

  return ambiguous === 2 && isAmbiguous(code) ? 2 : 1
}

/** 字串的顯示寬度（格數）；ambiguous 給 2 時 Ambiguous 字算 2 格（中日韓 locale 的終端機，最寬的情況）。 */
export const displayWidth = (text: string, ambiguous: 1 | 2 = 1): number => {
  let width = 0
  for (const char of text) width += cellsOf(char, ambiguous)

  return width
}

/**
 * 依顯示寬度截斷，超出時結尾換成 …；放不下 … 時回傳空字串。
 * ambiguous 給 2 時，Ambiguous 字（包括結尾的 …）都算 2 格。
 */
export const clipToWidth = (text: string, columns: number, ambiguous: 1 | 2 = 1): string => {
  if (columns <= 0) return ''
  if (displayWidth(text, ambiguous) <= columns) return text
  const ellipsis = cellsOf('…', ambiguous)
  if (columns < ellipsis) return ''
  let out = ''
  let width = 0
  for (const char of text) {
    const next = cellsOf(char, ambiguous)
    if (width + next > columns - ellipsis) break
    out += char
    width += next
  }

  return `${out}…`
}

/**
 * 比例字型下的寬度估算（以等寬格為單位）：Desktop 的 Pane 用比例字型，
 * 中日韓字約 1.7 格、其他字約 0.9 格，比 displayWidth 的 2 格／1 格窄。
 */
const proportionalWidth = (char: string): number => {
  const code = char.codePointAt(0) ?? 0

  return isZeroWidth(code) ? 0 : isWide(code) ? 1.7 : 0.9
}

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

// 這個檔案只放純函式：用到 $ 的函式必須寫在 register.tsx，
// Desktop 自帶的 Claude Code 不讓 $ 跨 import 傳遞。

import type { Branch, Density, Field, Group, Progress, Report, SessionCard } from '../types'

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
  }
}

/** 等你計數：pid 存活、而且狀態是 waiting 的 Session 數。 */
export const countNeedsYou = (
  records: readonly SessionRecord[],
  alive: ReadonlySet<number>,
): number => records.filter(one => alive.has(one.pid) && one.status === 'waiting').length

/** 從 `ps` 的輸出取出仍存活的 pid。 */
export const parseAlive = (stdout: string): Set<number> =>
  new Set(
    stdout
      .split('\n')
      .map(line => Number(line.trim()))
      .filter(pid => Number.isInteger(pid) && pid > 0),
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

/** 一次工具呼叫的摘要，例如「$ npm test」「✎ board.ts」「Read board.ts」「ccd·update_plan」。 */
export const summarizeTool = (tool: string, input: Record<string, unknown>): string => {
  const parts = tool.split('__')
  const name = tool.startsWith('mcp__') && parts.length >= 3 ? `${parts[1]}·${parts.slice(2).join('__')}` : tool
  const command = str(input.command)
  if (command !== null) return `$ ${clip(command.split('\n')[0] ?? '', 60)}`
  const path = str(input.file_path) ?? str(input.notebook_path) ?? str(input.path)
  if (path !== null) {
    return /^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool) ? `✎ ${basename(path)}` : `${name} ${basename(path)}`
  }
  const detail =
    str(input.pattern) ?? str(input.query) ?? str(input.url) ?? str(input.description)
  if (detail !== null) return `${name} ${clip(detail, 60)}`

  return name
}

/** 經過的時間，例如「45 秒」「3 分鐘」「2 小時 5 分」。 */
export const formatDuration = (ms: number): string => {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分鐘`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小時 ${minutes % 60} 分`

  return `${Math.floor(hours / 24)} 天`
}

/** 分支的一行描述，例如「main ↑2 ↓1 · 3 個檔案未 commit」。 */
export const describeBranch = (branch: Branch): string => {
  const sync = `${branch.ahead > 0 ? ` ↑${branch.ahead}` : ''}${branch.behind > 0 ? ` ↓${branch.behind}` : ''}`
  const dirty = branch.changed > 0 ? ` · ${branch.changed} 個檔案未 commit` : ''

  return `${branch.name}${sync}${dirty}`
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
  compact: ['time'],
  standard: ['time', 'location', 'branch', 'progress', 'activity', 'changes'],
  detailed: ['time', 'location', 'branch', 'progress', 'activity', 'changes', 'model', 'usage', 'source', 'path'],
}

/** 每一組的預設欄位：需要你處理與工作中用標準，閒置只顯示時間。 */
export const DEFAULT_FIELDS: Record<Group, readonly Field[]> = {
  waiting: PRESETS.standard,
  busy: PRESETS.standard,
  idle: PRESETS.compact,
}

/** 卡片屬於哪一組欄位設定。 */
export const groupOf = (status: SessionCard['status']): Group =>
  status === 'waiting' ? 'waiting' : status === 'busy' ? 'busy' : 'idle'

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

const sourceOf = (entrypoint: string | null): string => {
  if (entrypoint === null) return '未知'
  if (/desktop/i.test(entrypoint)) return 'Desktop'
  if (/^cli$/i.test(entrypoint)) return 'CLI'

  return entrypoint
}

const ORDER: Record<SessionRecord['status'], number> = { waiting: 0, busy: 1, idle: 2, unknown: 3 }

/**
 * 監看視窗的卡片：只列 pid 存活的 Session，附上它的狀態回報（有的話）。
 *
 * 排序：需要你處理 → 工作中 → 閒置；同一種狀態內，狀態變化較新的在前。
 */
export const toCards = (
  records: readonly SessionRecord[],
  alive: ReadonlySet<number>,
  reports: ReadonlyMap<string, Report>,
): SessionCard[] =>
  records
    .filter(one => alive.has(one.pid))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.statusUpdatedAt - a.statusUpdatedAt)
    .map(one => {
      const folder = one.cwd === null ? '' : basename(one.cwd)

      return {
        pid: one.pid,
        sessionId: one.sessionId,
        hostSessionId: one.hostSessionId,
        status: one.status,
        title: one.name ?? folder,
        folder,
        path: one.cwd ?? '',
        source: sourceOf(one.entrypoint),
        since: one.statusUpdatedAt > 0 ? one.statusUpdatedAt : null,
        report: one.sessionId === null ? null : (reports.get(one.sessionId) ?? null),
      }
    })

/** 跳轉到 Desktop 裡的 Session 的連結；沒有 host session id（CLI）時是 null。 */
export const desktopLinkOf = (hostSessionId: string | null): string | null => {
  if (hostSessionId === null) return null
  const id = hostSessionId.startsWith('local_') ? hostSessionId : `local_${hostSessionId}`

  return `claude://claude.ai/epitaxy/${id}`
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

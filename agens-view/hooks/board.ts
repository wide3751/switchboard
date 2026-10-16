// 這個檔案只放純函式：用到 $ 的函式必須寫在 register.tsx，
// Desktop 自帶的 Claude Code 不讓 $ 跨 import 傳遞。

import type { SessionCard } from '../types'

/** Claude Code 的 session 紀錄裡，這個 mod 用得到的欄位。 */
export type SessionRecord = {
  pid: number
  sessionId: string | null
  status: 'busy' | 'idle' | 'waiting' | 'unknown'
  /** Session 的名稱（Desktop 的標題或 CLI 的 /rename），沒有時是 null */
  name: string | null
  cwd: string | null
  /** 最後一次狀態變化的時間，用來排序 */
  statusUpdatedAt: number
}

const STATUSES = ['busy', 'idle', 'waiting'] as const

/**
 * 解析一份 session 紀錄；不是 JSON 或找不到 pid 時回傳 null。
 *
 * pid 優先取紀錄裡的欄位，沒有時退回檔名（`<pid>.json`）。
 */
export const parseRecord = (fileName: string, text: string): SessionRecord | null => {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>

  const pid =
    typeof record.pid === 'number' ? record.pid : Number(fileName.replace(/\.json$/, ''))
  if (!Number.isInteger(pid) || pid <= 0) return null

  const sessionId = typeof record.sessionId === 'string' ? record.sessionId : null
  const status = STATUSES.find(one => one === record.status) ?? 'unknown'
  const name = typeof record.name === 'string' && record.name !== '' ? record.name : null
  const cwd = typeof record.cwd === 'string' ? record.cwd : null
  const statusUpdatedAt = typeof record.statusUpdatedAt === 'number' ? record.statusUpdatedAt : 0

  return { pid, sessionId, status, name, cwd, statusUpdatedAt }
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

/** session 紀錄所在的資料夾：`$CLAUDE_CONFIG_DIR/sessions`，沒設時 `~/.claude/sessions`。 */
export const sessionsDirOf = (configDir: string | undefined, home: string | undefined): string =>
  configDir !== undefined && configDir !== '' ? `${configDir}/sessions` : `${home ?? ''}/.claude/sessions`

const ORDER: Record<SessionRecord['status'], number> = { waiting: 0, busy: 1, idle: 2, unknown: 3 }

/**
 * 監看視窗的卡片：只列 pid 存活的 Session。
 *
 * 排序：需要你處理 → 工作中 → 閒置；同一種狀態內，狀態變化較新的在前。
 */
export const toCards = (
  records: readonly SessionRecord[],
  alive: ReadonlySet<number>,
): SessionCard[] =>
  records
    .filter(one => alive.has(one.pid))
    .sort(
      (a, b) => ORDER[a.status] - ORDER[b.status] || b.statusUpdatedAt - a.statusUpdatedAt,
    )
    .map(one => {
      const folder = one.cwd?.split('/').filter(Boolean).pop() ?? ''

      return { pid: one.pid, status: one.status, title: one.name ?? folder, folder }
    })

// 這個檔案只放純函式：用到 $ 的函式必須寫在 register.tsx，
// Desktop 自帶的 Claude Code 不讓 $ 跨 import 傳遞。

/** Claude Code 的 session 紀錄裡，這個 mod 用得到的欄位。 */
export type SessionRecord = {
  pid: number
  sessionId: string | null
  status: 'busy' | 'idle' | 'waiting' | 'unknown'
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

  return { pid, sessionId, status }
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

/** 暫時的診斷：每份紀錄一行（資料夾名稱、名稱、status），最後一行列出所有欄位名稱。 */
export const describeRecords = (texts: readonly string[], alive: ReadonlySet<number>): string[] => {
  const keys = new Set<string>()
  const lines: string[] = []
  for (const text of texts) {
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      continue
    }
    if (typeof raw !== 'object' || raw === null) continue
    const record = raw as Record<string, unknown>
    for (const key of Object.keys(record)) keys.add(key)
    const folder = typeof record.cwd === 'string' ? (record.cwd.split('/').pop() ?? '') : '?'
    const name = typeof record.name === 'string' ? ` 「${record.name.slice(0, 30)}」` : ''
    const isAlive = typeof record.pid === 'number' && alive.has(record.pid)
    lines.push(`${String(record.status)} · ${folder}${name}${isAlive ? '' : ' (pid 已死)'}`)
  }

  return [...lines, `欄位：${[...keys].sort().join(',')}`]
}

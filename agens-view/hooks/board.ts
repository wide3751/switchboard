import type { EngineInterface } from 'claude-code'

import type { Snapshot } from '../types'

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

async function sessionsDir($: EngineInterface): Promise<string> {
  const configDir = await $.env.get('CLAUDE_CONFIG_DIR')
  if (configDir !== undefined && configDir !== '') return `${configDir}/sessions`
  const home = await $.env.get('HOME')

  return `${home ?? ''}/.claude/sessions`
}

async function readRecords($: EngineInterface, dir: string): Promise<SessionRecord[]> {
  const entries = await $.fs.list(dir)
  const files = entries.filter(one => one.kind === 'file' && one.name.endsWith('.json'))
  const texts = await Promise.all(
    files.map(one =>
      $.fs
        .read(`${dir}/${one.name}`)
        .then(text => (typeof text === 'string' ? parseRecord(one.name, text) : null))
        // 紀錄可能在列出之後、讀取之前被刪掉
        .catch(() => null),
    ),
  )

  return texts.filter(one => one !== null)
}

async function alivePids($: EngineInterface, pids: readonly number[]): Promise<Set<number>> {
  if (pids.length === 0) return new Set()
  // 一個都不存活時 ps 以 1 結束，輸出是空的
  const { stdout } = await $.process.run(['ps', '-o', 'pid=', '-p', pids.join(',')])

  return parseAlive(stdout)
}

/** 讀所有 session 紀錄、檢查 pid，算出這一次的結果。 */
export async function scan($: EngineInterface): Promise<Snapshot> {
  const dir = await sessionsDir($)
  let records: SessionRecord[]
  try {
    records = await readRecords($, dir)
  } catch {
    return { needsYou: 0, error: `讀不到 ${dir}` }
  }
  const alive = await alivePids($, [...new Set(records.map(one => one.pid))])

  return { needsYou: countNeedsYou(records, alive), error: null }
}

/** 一次彙整的結果；尚未彙整過時是 null。 */
export type Snapshot = {
  /** 等你計數：存活且處於需要你處理的 Session 數。 */
  needsYou: number
  /** 讀不到 session 紀錄時的原因。 */
  error: string | null
  /** 存活的 Session，依監看視窗的排序 */
  sessions: SessionCard[]
}

/** 監看視窗上的一張卡片。 */
export type SessionCard = {
  pid: number
  status: 'busy' | 'idle' | 'waiting' | 'unknown'
  /** Session 標題：session 紀錄的名稱，沒有時用資料夾名稱 */
  title: string
  folder: string
}

declare module 'claude-code' {
  interface PluginState {
    'switchboard': { snapshot: Snapshot | null }
  }
}

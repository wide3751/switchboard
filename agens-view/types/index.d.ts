/** 一次彙整的結果；尚未彙整過時是 null。 */
export type Snapshot = {
  /** 等你計數：存活且處於需要你處理的 Session 數。 */
  needsYou: number
  /** 讀不到 session 紀錄時的原因。 */
  error: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'agens-view': { snapshot: Snapshot | null }
  }
}

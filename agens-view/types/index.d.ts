/** 一次彙整的結果；尚未彙整過時是 null。 */
export type Snapshot = {
  /** 等你計數：存活且處於需要你處理的 Session 數。 */
  needsYou: number
  /** 讀不到 session 紀錄時的原因。 */
  error: string | null
  /** 存活的 Session，依監看視窗的排序 */
  sessions: SessionCard[]
  /** 彙整的時間，用來算「待了多久」 */
  scannedAt: number
}

/** 待辦清單的完成度。 */
export type Progress = { done: number; total: number; current: string | null }

/** 工作目錄的 git 狀態。 */
export type Branch = {
  name: string
  ahead: number
  behind: number
  /** 未 commit 的檔案數（含未追蹤） */
  changed: number
  /** 未 commit 變更的新增／刪除行數（相對 HEAD，不含未追蹤檔案） */
  insertions?: number
  deletions?: number
}

/**
 * 狀態回報：每個 Session 的 mod 寫出自己的詳細狀態（見 ADR-0002），
 * 放在 `<Claude 設定目錄>/switchboard/reports/<sessionId>.json`。
 */
export type Report = {
  sessionId: string
  reportedAt: number
  model: string | null
  branch: Branch | null
  progress: Progress | null
  /** 最近一次工具呼叫的摘要；回合結束時清掉 */
  activity: string | null
  /** 這個回合開始的時間；不在回合中時是 null */
  turnStartedAt: number | null
  turns: number | null
  contextPercent: number | null
  costUsd: number | null
}

/** 監看視窗上的一張卡片。 */
export type SessionCard = {
  pid: number
  sessionId: string | null
  /** Desktop 託管的 Session 在 Desktop 裡的 id，用來跳轉；CLI 沒有 */
  hostSessionId: string | null
  status: 'busy' | 'idle' | 'waiting' | 'unknown'
  /** Session 標題：session 紀錄的名稱，沒有時用資料夾名稱 */
  title: string
  /** 目錄名稱（工作目錄的最後一段） */
  folder: string
  /** 工作目錄的完整路徑 */
  path: string
  /** 來源：Desktop、CLI 或 session 紀錄裡的原始值 */
  source: string
  /** 進入目前狀態的時間；不知道時是 null */
  since: number | null
  /** 沒有狀態回報（例如沒載入 mod）時是 null */
  report: Report | null
}

/** 卡片上可以開關的欄位（狀態與標題固定顯示）。 */
export type Field =
  | 'time'
  | 'location'
  | 'branch'
  | 'progress'
  | 'activity'
  | 'changes'
  | 'model'
  | 'usage'
  | 'source'
  | 'path'

/** 顯示密度：預設的欄位組合；手動改過欄位就是自訂。 */
export type Density = 'compact' | 'standard' | 'detailed'

/** 欄位設定的分組：需要你處理、工作中、閒置各自設定。 */
export type Group = 'waiting' | 'busy' | 'idle'

/** 監看視窗的檢視設定（存進 $.store，跨 Session 保留）。 */
export type View = {
  fields: Record<Group, Field[]>
  isIdleCollapsed: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'switchboard': {
      snapshot: Snapshot | null
      view: View
      /** 檢視面板是否展開 */
      isSettingsOpen: boolean
      /** 檢視面板正在設定哪一組 */
      settingsGroup: Group
    }
  }
}

/** 看不到 Session 狀態的原因：這時不能說「沒有在等你」。 */
export type ScanError =
  /** 讀不到 sessions 資料夾 */
  | { kind: 'unreadable'; dir: string }
  /** 掃描途中丟了例外（ps、ui.panes…） */
  | { kind: 'failed'; reason: string }
  /** 有目前這個 Session 的紀錄，ps 卻說它不存活：檢查存活的方法壞了 */
  | { kind: 'self-missing' }

/** 一次彙整的結果；尚未彙整過時是 null。 */
export type Snapshot = {
  /** 等你計數：存活且處於需要你處理的 Session 數。 */
  needsYou: number
  /** 看不到 Session 狀態時的原因；null 是掃描正常。 */
  error: ScanError | null
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
  /** 相對基底分支的新增／刪除行數（含未 commit 的變更，不含未追蹤檔案），和 Desktop 的 Changes 一致 */
  insertions?: number
  deletions?: number
  /** 計算差異用的基底分支，例如 origin/main */
  base?: string
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
  /** 待核准時想執行的動作摘要（例如 `$ npm i`）；核准、拒絕或回合結束後清掉 */
  approval: string | null
  /** 選項卡詢問：問題與選項；回答後清掉 */
  question: Question | null
  /** 回合因錯誤停下的原因；下一個回合開始時清掉 */
  turnError: string | null
  /** 最後一則回覆的摘要 */
  lastReply: string | null
  /** 背景任務：Agent 與背景 Bash */
  tasks: Task[]
  /** 帳號層級的 rate limit 使用率 */
  rateLimits: RateLimit[]
  /** 這個 Session 的 MCP 連接器 */
  connectors: Connectors | null
  /** 這個分支的 Pull Request；沒有或查不到時是 null */
  pr: PullRequest | null
  /** 所在終端機的 `TERM_PROGRAM`（例如 iTerm.app）；不在終端機或不知道時是 null */
  terminal: string | null
}

export type Connectors = { connected: string[]; needsAuth: string[] }

export type PullRequest = { number: number; state: string; url: string }

export type Question = {
  text: string
  options: string[]
  /** 同一次提問裡還有幾題沒顯示 */
  more?: number
}

export type Task = {
  kind: 'agent' | 'bash'
  label: string
  status: 'running' | 'waiting' | 'done' | 'failed'
}

export type RateLimit = {
  kind: string
  percentUsed: number
  /** 重置時間（ISO 字串），沒有時不顯示倒數 */
  resetsAt?: string
}

/** 監看視窗上的一張卡片。 */
export type SessionCard = {
  pid: number
  sessionId: string | null
  /** Desktop 託管的 Session 在 Desktop 裡的 id，用來跳轉；CLI 沒有 */
  hostSessionId: string | null
  /** 有 Remote Control 連線（session 紀錄有 bridgeSessionId） */
  isRemote: boolean
  /** 工作目錄是 Claude 建立的 worktree */
  isWorktree: boolean
  /** errored：回合出錯停下，和 waiting 一樣算需要你處理 */
  status: 'busy' | 'idle' | 'waiting' | 'errored' | 'unknown'
  /** Session 標題：session 紀錄的名稱，沒有時用資料夾名稱 */
  title: string
  /** 目錄名稱（工作目錄的最後一段） */
  folder: string
  /** 工作目錄的完整路徑 */
  path: string
  /** 來源：Desktop、終端機名稱（iTerm、Terminal…）、CLI 或 session 紀錄裡的原始值；不知道時是 null */
  source: string | null
  /** 程序所在的終端機（例如 ttys003）；沒有時是 null */
  tty: string | null
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
  | 'context'
  | 'pr'
  | 'environment'
  | 'connectors'
  | 'reply'
  | 'tasks'
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
  /** 計費方式：訂閱制不顯示花費；auto 依有沒有 rate limit 判斷 */
  billing: Billing
  /** 介面語言；auto 依系統語言判斷 */
  locale: 'auto' | Locale
  /**
   * 只管 Desktop：每個 Desktop Session 都自動開啟監看視窗，切換 Session 時也看得到。
   * 鍵名沿用只有 Desktop 時的舊名，不改成 autoOpenDesktop，以免已存的設定失效
   */
  autoOpen: boolean
  /** 每個 CLI Session 都自動開啟監看視窗；預設關，和 Desktop 的開關分開 */
  autoOpenCli: boolean
}

export type Locale = 'en' | 'ja' | 'ko' | 'zh-CN' | 'zh-TW'

export type Billing = 'auto' | 'subscription' | 'api'

declare module 'claude-code' {
  interface PluginState {
    'switchboard': {
      snapshot: Snapshot | null
      view: View
      /** 檢視面板是否展開 */
      isSettingsOpen: boolean
      /** 檢視面板正在設定哪一組 */
      settingsGroup: Group
      /** 展開明細的卡片（pid） */
      expanded: number[]
      /** 這個 Session 的監看視窗是否已經畫出來；只叫引擎打開、還沒畫出來（終端機太窄）也算 false。false 時輸入框上方顯示打開按鈕 */
      isBoardShown: boolean
      /** 介面文字實際用的語言：檢視設定選的，自動時是偵測到的系統語言 */
      shownLocale: Locale
      /** 打開按鈕上的等你計數（輕量掃描的結果，ADR-0006）；還沒掃過或掃描失敗時是 null，按鈕不顯示計數 */
      bandCount: number | null
    }
  }
}

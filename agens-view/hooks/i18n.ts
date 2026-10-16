// 監看視窗的介面文字。這個檔案只放純資料與純函式（Desktop 不讓 $ 跨 import 傳遞）。

import type { Billing, Density, Field, Group, Locale } from '../types'

export type Messages = {
  fields: Record<Field, string>
  densities: Record<Density, string>
  groups: Record<Group, string>
  billings: Record<Billing, string>
  /** 檢視面板的列標題 */
  panel: {
    billing: string
    group: string
    density: string
    custom: string
    language: string
    auto: string
    autoOpen: string
    autoOpenCli: string
  }
  view: string
  loading: string
  readFailed: (error: string) => string
  cannotRead: (dir: string) => string
  header: {
    none: string
    waiting: (n: number) => string
    longestWait: (age: string) => string
    noOthers: string
    running: (n: number) => string
    idle: (n: number) => string
  }
  account: {
    title: string
    resetsIn: (age: string) => string
    totalCost: (usd: string) => string
    fiveHour: string
    week: string
  }
  /** 合併後的狀態列 */
  status: {
    none: string
    needYou: (n: number) => string
    longest: (age: string) => string
    spent: (usd: string) => string
  }
  /** 待處理的種類，用在狀態列的細分 */
  kinds: { approval: string; question: string; errored: string; waiting: string }
  goHandle: string
  expand: string
  collapse: string
  chips: { waiting: string; approval: string; question: string; errored: string }
  current: string
  moreTasks: (n: number) => string
  moreQuestions: (n: number) => string
  lines: string
  versus: (base: string) => string
  createPr: string
  environment: { local: string }
  connectors: (n: number) => string
  needsAuth: string
  turns: (n: number) => string
  basicStatus: string
  unknown: string
  apiError: string
  toast: {
    cliNoJump: (path: string) => string
    jumpFailed: (title: string, path: string) => string
    jumping: (title: string) => string
  }
  /** unsupported：這個介面畫不出 Pane（例如 VS Code 擴充套件）時的提示 */
  command: { unsupported: (command: string) => string; notPlaced: (reason: string) => string; opened: string }
  /** 監看視窗關著時，輸入框上方的按鈕 */
  band: { open: string }
}

const en: Messages = {
  fields: {
    time: 'Time',
    location: 'Location',
    branch: 'Branch',
    progress: 'Progress',
    activity: 'Activity',
    changes: 'Changes',
    context: 'Context',
    pr: 'PR',
    environment: 'Environment',
    connectors: 'Connectors',
    reply: 'Last reply',
    tasks: 'Background tasks',
    model: 'Model',
    usage: 'Usage',
    source: 'Source',
    path: 'Full path',
  },
  densities: { compact: 'Compact', standard: 'Standard', detailed: 'Detailed' },
  groups: { waiting: 'Needs you', busy: 'Working', idle: 'Idle' },
  billings: { auto: 'Auto', subscription: 'Subscription', api: 'API' },
  panel: { billing: 'Billing', group: 'Section', density: 'Density', custom: 'Custom', language: 'Language', auto: 'Auto', autoOpen: 'Show in every Desktop session', autoOpenCli: 'Show in every CLI session' },
  view: 'View',
  loading: 'Loading…',
  readFailed: error => `switchboard could not read its state: ${error}`,
  cannotRead: dir => `Cannot read ${dir}`,
  header: {
    none: '✓ Nothing needs you',
    waiting: n => `▲ ${n} ${n === 1 ? 'session needs' : 'sessions need'} you`,
    longestWait: age => `Longest wait ${age} · click a title to go there`,
    noOthers: 'No other running sessions',
    running: n => `Working ${n}`,
    idle: n => `Idle ${n}`,
  },
  account: {
    title: 'Account usage',
    resetsIn: age => `resets in ${age}`,
    totalCost: usd => `All sessions spent $${usd}`,
    fiveHour: '5h',
    week: 'Week',
  },
  status: {
    none: 'Nothing needs you',
    needYou: n => `${n} need${n === 1 ? 's' : ''} you`,
    longest: age => `longest ${age}`,
    spent: usd => `Spent $${usd}`,
  },
  kinds: { approval: 'Approve', question: 'Answer', errored: 'Error', waiting: 'Waiting' },
  goHandle: 'Go handle it →',
  expand: 'Expand ▾',
  collapse: 'Collapse ▴',
  chips: { waiting: ' Waiting ', approval: ' Approve ', question: ' Answer ', errored: ' Error ' },
  current: 'This one',
  moreTasks: n => `+${n} more`,
  moreQuestions: n => ` (+${n} more)`,
  lines: 'lines',
  versus: base => `vs ${base}`,
  createPr: 'Create PR ↗',
  environment: { local: 'This computer' },
  connectors: n => `Connectors ${n}`,
  needsAuth: 'Needs auth',
  turns: n => `${n} turns`,
  basicStatus: 'switchboard not loaded, basic status only',
  unknown: 'Unknown',
  apiError: 'API error, the turn did not finish',
  toast: {
    cliNoJump: path => `Can't jump to CLI sessions yet. It is in ${path}`,
    jumpFailed: (title, path) => `Couldn't switch to "${title}". It is in ${path}`,
    jumping: title => `Switching to "${title}"…`,
  },
  command: {
    unsupported: command => `The board can't be shown here. Type /${command} in Claude Desktop's Code tab or in Claude Code in a terminal.`,
    notPlaced: reason => `The board is open, but the interface hasn't placed it yet: ${reason}`,
    opened: 'Board opened.',
  },
  band: { open: 'Open board' },
}

const ja: Messages = {
  fields: {
    time: '時間',
    location: '場所',
    branch: 'ブランチ',
    progress: '進捗',
    activity: '現在の操作',
    changes: '変更行数',
    context: 'コンテキスト',
    pr: 'PR',
    environment: '環境',
    connectors: 'コネクタ',
    reply: '最後の返信',
    tasks: 'バックグラウンドタスク',
    model: 'モデル',
    usage: '使用量',
    source: 'ソース',
    path: 'フルパス',
  },
  densities: { compact: 'コンパクト', standard: '標準', detailed: '詳細' },
  groups: { waiting: '対応が必要', busy: '作業中', idle: '待機中' },
  billings: { auto: '自動', subscription: 'サブスク', api: 'API' },
  panel: { billing: '課金', group: '設定対象', density: '密度', custom: 'カスタム', language: '言語', auto: '自動', autoOpen: 'すべての Desktop セッションに表示', autoOpenCli: 'すべての CLI セッションに表示' },
  view: '表示',
  loading: '読み込み中…',
  readFailed: error => `switchboard が状態を読み込めませんでした：${error}`,
  cannotRead: dir => `${dir} を読み込めません`,
  header: {
    none: '✓ 対応が必要な項目はありません',
    waiting: n => `▲ ${n} 件のセッションが対応待ち`,
    longestWait: age => `最長待機 ${age} · タイトルをクリックして移動`,
    noOthers: '実行中の他のセッションはありません',
    running: n => `作業中 ${n}`,
    idle: n => `待機中 ${n}`,
  },
  account: {
    title: 'アカウント使用量',
    resetsIn: age => `${age} 後にリセット`,
    totalCost: usd => `全セッションの費用 $${usd}`,
    fiveHour: '5時間',
    week: '週',
  },
  status: {
    none: '対応待ちなし',
    needYou: n => `${n} 件が対応待ち`,
    longest: age => `最長 ${age}`,
    spent: usd => `費用 $${usd}`,
  },
  kinds: { approval: '承認', question: '回答', errored: 'エラー', waiting: '対応' },
  goHandle: '対応する →',
  expand: '展開 ▾',
  collapse: '折りたたむ ▴',
  chips: { waiting: ' 対応 ', approval: ' 承認 ', question: ' 回答 ', errored: ' エラー ' },
  current: '現在',
  moreTasks: n => `他 ${n} 件`,
  moreQuestions: n => `（他 ${n} 問）`,
  lines: '行',
  versus: base => `${base} との差分`,
  createPr: 'PR を作成 ↗',
  environment: { local: 'このコンピュータ' },
  connectors: n => `コネクタ ${n}`,
  needsAuth: '要認証',
  turns: n => `${n} ターン`,
  basicStatus: 'switchboard 未読み込み、基本状態のみ',
  unknown: '不明',
  apiError: 'API エラーのため、ターンが完了しませんでした',
  toast: {
    cliNoJump: path => `CLI セッションへはまだ移動できません。場所：${path}`,
    jumpFailed: (title, path) => `「${title}」に切り替えられませんでした。場所：${path}`,
    jumping: title => `「${title}」に切り替えています…`,
  },
  command: {
    unsupported: command => `ここでは監視ウィンドウを表示できません。Claude Desktop の Code タブか、ターミナルの Claude Code で /${command} と入力してください。`,
    notPlaced: reason => `監視ウィンドウは開きましたが、まだ配置されていません：${reason}`,
    opened: '監視ウィンドウを開きました。',
  },
  band: { open: '監視ウィンドウを開く' },
}

const ko: Messages = {
  fields: {
    time: '시간',
    location: '위치',
    branch: '브랜치',
    progress: '진행률',
    activity: '현재 작업',
    changes: '변경 줄 수',
    context: '컨텍스트',
    pr: 'PR',
    environment: '환경',
    connectors: '커넥터',
    reply: '마지막 응답',
    tasks: '백그라운드 작업',
    model: '모델',
    usage: '사용량',
    source: '출처',
    path: '전체 경로',
  },
  densities: { compact: '간단히', standard: '표준', detailed: '자세히' },
  groups: { waiting: '확인 필요', busy: '작업 중', idle: '유휴' },
  billings: { auto: '자동', subscription: '구독', api: 'API' },
  panel: { billing: '요금제', group: '설정 대상', density: '밀도', custom: '사용자 지정', language: '언어', auto: '자동', autoOpen: '모든 Desktop 세션에 표시', autoOpenCli: '모든 CLI 세션에 표시' },
  view: '보기',
  loading: '불러오는 중…',
  readFailed: error => `switchboard가 상태를 읽지 못했습니다: ${error}`,
  cannotRead: dir => `${dir}을(를) 읽을 수 없습니다`,
  header: {
    none: '✓ 확인할 항목이 없습니다',
    waiting: n => `▲ 세션 ${n}개가 확인을 기다리는 중`,
    longestWait: age => `최장 대기 ${age} · 제목을 클릭해 이동`,
    noOthers: '실행 중인 다른 세션이 없습니다',
    running: n => `작업 중 ${n}`,
    idle: n => `유휴 ${n}`,
  },
  account: {
    title: '계정 사용량',
    resetsIn: age => `${age} 후 초기화`,
    totalCost: usd => `전체 세션 비용 $${usd}`,
    fiveHour: '5시간',
    week: '주간',
  },
  status: {
    none: '확인할 항목 없음',
    needYou: n => `${n}개 확인 필요`,
    longest: age => `최장 ${age}`,
    spent: usd => `비용 $${usd}`,
  },
  kinds: { approval: '승인', question: '답변', errored: '오류', waiting: '확인' },
  goHandle: '처리하러 가기 →',
  expand: '펼치기 ▾',
  collapse: '접기 ▴',
  chips: { waiting: ' 확인 ', approval: ' 승인 ', question: ' 답변 ', errored: ' 오류 ' },
  current: '현재',
  moreTasks: n => `외 ${n}개`,
  moreQuestions: n => ` (외 ${n}문항)`,
  lines: '줄',
  versus: base => `${base} 대비`,
  createPr: 'PR 만들기 ↗',
  environment: { local: '이 컴퓨터' },
  connectors: n => `커넥터 ${n}`,
  needsAuth: '인증 필요',
  turns: n => `${n}턴`,
  basicStatus: 'switchboard 미로드, 기본 상태만',
  unknown: '알 수 없음',
  apiError: 'API 오류로 턴이 완료되지 않았습니다',
  toast: {
    cliNoJump: path => `CLI 세션으로는 아직 이동할 수 없습니다. 위치: ${path}`,
    jumpFailed: (title, path) => `"${title}"(으)로 전환할 수 없습니다. 위치: ${path}`,
    jumping: title => `"${title}"(으)로 전환하는 중…`,
  },
  command: {
    unsupported: command => `여기서는 모니터 창을 표시할 수 없습니다. Claude Desktop의 Code 탭이나 터미널의 Claude Code에서 /${command}을(를) 입력하세요.`,
    notPlaced: reason => `모니터 창이 열렸지만 아직 배치되지 않았습니다: ${reason}`,
    opened: '모니터 창을 열었습니다.',
  },
  band: { open: '모니터 창 열기' },
}

const zhCN: Messages = {
  fields: {
    time: '时间',
    location: '位置',
    branch: '分支',
    progress: '进度',
    activity: '当前操作',
    changes: '变更行数',
    context: 'Context',
    pr: 'PR',
    environment: '环境',
    connectors: '连接器',
    reply: '最后回复',
    tasks: '后台任务',
    model: '模型',
    usage: '用量',
    source: '来源',
    path: '完整路径',
  },
  densities: { compact: '精简', standard: '标准', detailed: '详细' },
  groups: { waiting: '待处理', busy: '工作中', idle: '空闲' },
  billings: { auto: '自动', subscription: '订阅制', api: 'API' },
  panel: { billing: '计费', group: '设置', density: '密度', custom: '自定义', language: '语言', auto: '自动', autoOpen: '在所有 Desktop Session 显示', autoOpenCli: '在所有 CLI Session 显示' },
  view: '视图',
  loading: '加载中…',
  readFailed: error => `switchboard 读取状态失败：${error}`,
  cannotRead: dir => `无法读取 ${dir}`,
  header: {
    none: '✓ 没有待处理项目',
    waiting: n => `▲ ${n} 个 Session 待处理`,
    longestWait: age => `最长等待 ${age} · 点击标题前往`,
    noOthers: '没有其他运行中的 Session',
    running: n => `工作中 ${n}`,
    idle: n => `空闲 ${n}`,
  },
  account: {
    title: '账户用量',
    resetsIn: age => `${age} 后重置`,
    totalCost: usd => `所有 Session 花费 $${usd}`,
    fiveHour: '5h',
    week: '周',
  },
  status: {
    none: '没有待处理',
    needYou: n => `${n} 个需要你处理`,
    longest: age => `最长 ${age}`,
    spent: usd => `花费 $${usd}`,
  },
  kinds: { approval: '批准', question: '回答', errored: '出错', waiting: '等你' },
  goHandle: '前往处理 →',
  expand: '展开 ▾',
  collapse: '收起 ▴',
  chips: { waiting: ' 等你 ', approval: ' 批准 ', question: ' 回答 ', errored: ' 出错 ' },
  current: '当前',
  moreTasks: n => `另有 ${n} 个`,
  moreQuestions: n => `（另有 ${n} 题）`,
  lines: '行',
  versus: base => `相对 ${base}`,
  createPr: '创建 PR ↗',
  environment: { local: '本机' },
  connectors: n => `连接器 ${n}`,
  needsAuth: '需验证',
  turns: n => `${n} 轮`,
  basicStatus: '未加载 switchboard，仅基本状态',
  unknown: '未知',
  apiError: 'API 错误，回合未完成',
  toast: {
    cliNoJump: path => `CLI Session 还不能跳转，它在 ${path}`,
    jumpFailed: (title, path) => `无法切换到「${title}」，它在 ${path}`,
    jumping: title => `正在切换到「${title}」…`,
  },
  command: {
    unsupported: command => `这里无法显示监控窗口：请在 Claude Desktop 的 Code 标签页，或终端里的 Claude Code 输入 /${command}。`,
    notPlaced: reason => `监控窗口已打开，但界面还没有放置它：${reason}`,
    opened: '已打开监控窗口。',
  },
  band: { open: '打开监控窗口' },
}

const zhTW: Messages = {
  fields: {
    time: '時間',
    location: '位置',
    branch: '分支',
    progress: '進度',
    activity: '目前動作',
    changes: '變更行數',
    context: 'Context',
    pr: 'PR',
    environment: '環境',
    connectors: '連接器',
    reply: '最後回覆',
    tasks: '背景任務',
    model: '模型',
    usage: '用量',
    source: '來源',
    path: '完整路徑',
  },
  densities: { compact: '精簡', standard: '標準', detailed: '詳細' },
  groups: { waiting: '待處理', busy: '工作中', idle: '閒置' },
  billings: { auto: '自動', subscription: '訂閱制', api: 'API' },
  panel: { billing: '計費', group: '設定', density: '密度', custom: '自訂', language: '語言', auto: '自動', autoOpen: '所有 Desktop Session 都顯示', autoOpenCli: '所有 CLI Session 都顯示' },
  view: '檢視',
  loading: '讀取中…',
  readFailed: error => `switchboard 讀取狀態失敗：${error}`,
  cannotRead: dir => `讀不到 ${dir}`,
  header: {
    none: '✓ 無待處理項目',
    waiting: n => `▲ ${n} 個 Session 待處理`,
    longestWait: age => `最長等待 ${age} · 點選標題前往`,
    noOthers: '沒有其他執行中的 Session',
    running: n => `工作中 ${n}`,
    idle: n => `閒置 ${n}`,
  },
  account: {
    title: '帳號用量',
    resetsIn: age => `${age} 後重置`,
    totalCost: usd => `所有 Session 花費 $${usd}`,
    fiveHour: '5h',
    week: '週',
  },
  status: {
    none: '無待處理',
    needYou: n => `${n} 個需要你處理`,
    longest: age => `最長 ${age}`,
    spent: usd => `花費 $${usd}`,
  },
  kinds: { approval: '核准', question: '回答', errored: '出錯', waiting: '等你' },
  goHandle: '前往處理 →',
  expand: '展開 ▾',
  collapse: '收合 ▴',
  chips: { waiting: ' 等你 ', approval: ' 核准 ', question: ' 回答 ', errored: ' 出錯 ' },
  current: '目前',
  moreTasks: n => `＋${n} 個`,
  moreQuestions: n => `（另有 ${n} 題）`,
  lines: '行',
  versus: base => `相對 ${base}`,
  createPr: '建立 PR ↗',
  environment: { local: '本機' },
  connectors: n => `連接器 ${n}`,
  needsAuth: '需驗證',
  turns: n => `${n} 輪`,
  basicStatus: '未載入 switchboard，僅基本狀態',
  unknown: '未知',
  apiError: 'API 錯誤，回合未完成',
  toast: {
    cliNoJump: path => `CLI Session 還不能跳轉，它在 ${path}`,
    jumpFailed: (title, path) => `沒辦法切換到「${title}」，它在 ${path}`,
    jumping: title => `正在切換到「${title}」…`,
  },
  command: {
    unsupported: command => `這裡無法顯示監看視窗：請在 Claude Desktop 的 Code 分頁，或終端機裡的 Claude Code 輸入 /${command}。`,
    notPlaced: reason => `監看視窗已開啟，但介面還沒有放上它：${reason}`,
    opened: '已打開監看視窗。',
  },
  band: { open: '打開監看視窗' },
}

export const LOCALES: readonly { locale: Locale; label: string }[] = [
  { locale: 'en', label: 'EN' },
  { locale: 'ja', label: '日本語' },
  { locale: 'ko', label: '한국어' },
  { locale: 'zh-CN', label: '简中' },
  { locale: 'zh-TW', label: '繁中' },
]

const MESSAGES: Record<Locale, Messages> = { en, ja, ko, 'zh-CN': zhCN, 'zh-TW': zhTW }

export const messagesOf = (locale: Locale): Messages => MESSAGES[locale]

/**
 * 語言標籤 → 支援的語言：zh-Hant、zh-TW、zh-HK、zh-MO → 繁中；其他 zh → 簡中；
 * ja、ko 照用；其餘（含無法辨識）→ 英文。接受 `zh_TW.UTF-8`、`zh-Hant-TW` 等寫法。
 */
export const localeOf = (tag: string | undefined | null): Locale | null => {
  if (tag === undefined || tag === null) return null
  const value = tag.trim().replace(/_/g, '-').replace(/\..*$/, '').toLowerCase()
  if (value === '' || value === 'c' || value === 'posix') return null
  if (value.startsWith('zh')) return /hant|-tw|-hk|-mo/.test(value) ? 'zh-TW' : 'zh-CN'
  if (value.startsWith('ja')) return 'ja'
  if (value.startsWith('ko')) return 'ko'

  return 'en'
}

/** `defaults read -g AppleLanguages` 的輸出 → 第一個語言。 */
export const firstAppleLanguage = (stdout: string): string | null => {
  const match = /"?([A-Za-z]{2,3}(?:[-_][A-Za-z0-9]+)*)"?/.exec(stdout.replace(/^\s*\(/, ''))

  return match?.[1] ?? null
}

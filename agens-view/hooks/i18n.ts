// 監看視窗的介面文字。這個檔案只放純資料與純函式（Desktop 不讓 $ 跨 import 傳遞）。

import type { Billing, Density, Field, Group, Locale } from '../types'

export type Messages = {
  fields: Record<Field, string>
  /** 卡片中繼資料帶上 Context 用量的短標籤；設定面板和展開明細用 fields.context */
  ctx: string
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
    /** 設定面板「卡片內容」區的標題，後面接「 · 分區」 */
    cardContent: string
    /** 設定面板「一般」區的標題；手動關掉的 toast 寫路徑時也用 */
    general: string
    /** 自動打開的設定標題，後面接 autoOpenDesktop、autoOpenTerminal 兩個選項 */
    autoOpenTitle: string
    autoOpenDesktop: string
    autoOpenTerminal: string
    /** 設定面板底部關掉面板的按鈕 */
    done: string
    /** 設定面板底部把面板裡的設定都還原成預設值的按鈕 */
    reset: string
    /** ☑/☐ 開關的 label：選項名稱加上目前開或關 */
    checked: (name: string, isOn: boolean) => string
  }
  view: string
  loading: string
  /** 讀取狀態失敗的固定說明（含結尾的冒號），後面接引擎的原始錯誤 */
  readFailed: string
  /** 讀不到 sessions 資料夾：結論加下一步；路徑另起一行 */
  cannotRead: string
  header: {
    none: string
    noOthers: string
    /** 掃描失敗或檢查不過：看不到狀態 */
    unknown: string
    /** 清單裡沒有目前這個 Session */
    selfMissing: string
    /** 清單是 0 筆：連目前這個 Session 的紀錄都讀不到；路徑另起一行 */
    noRecords: string
    /** 看不到狀態時：每 3 秒自動重試 */
    retry: string
    /** 疑難排解連結的文字，結尾是 ↗ */
    troubleshoot: string
    /** 這個語言的 README 的疑難排解錨點 */
    troubleshootUrl: string
    /** 清單只有目前這個 Session：第一次使用的引導 */
    onlySelf: string
    /** 資料是多久以前的（掃描停擺時）；age 是 shortAge 的短單位，例如 12s、3m */
    updatedAgo: (age: string) => string
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
    needYou: (n: number) => string
    longest: (age: string) => string
  }
  /** 待處理的種類，用在狀態列的細分與卡片的標籤 */
  kinds: { approval: string; question: string; errored: string; waiting: string }
  goHandle: string
  current: string
  moreTasks: (n: number) => string
  moreQuestions: (n: number) => string
  /** 待回答的問題前面加上問號 */
  asked: (text: string) => string
  /** 最後訊息摘要加上這個語言的引號 */
  quoted: (text: string) => string
  /** 最後訊息摘要用不用斜體：CJK 字型的斜體是硬斜過去的，難讀，只有英文用 */
  isReplyItalic: boolean
  versus: (base: string) => string
  /** 已合併的 PR 接在 `#12 ↗` 後面的字，不只靠顏色分辨 */
  merged: string
  /** 有變更、還沒有 PR：不可點的說明 */
  noPr: string
  environment: { local: string; worktree: string; remote: string }
  /** 展開明細的背景任務清單：每一項前面的種類 */
  taskKinds: { agent: string; bash: string }
  connectors: (n: number) => string
  needsAuth: string
  turns: (n: number) => string
  basicStatus: string
  /** 狀態不明（session 紀錄的狀態認不得）的卡片，◌ 後面的標籤 */
  unknown: string
  apiError: string
  toast: {
    cliNoJump: (path: string) => string
    tabMissing: (terminal: string, path: string) => string
    jumpFailed: (title: string, path: string) => string
    /** 0.6.0 之前開的 CLI Session：回報沒有終端機，重開後才能跳轉 */
    reopenToJump: (path: string) => string
    /** 不支援跳轉的來源，例如 VS Code、Warp */
    noJumpIn: (source: string, path: string) => string
    /** osascript 的自動化權限被拒（-1743） */
    automationDenied: (terminal: string) => string
    /**
     * 使用者手動關掉監看視窗：寫出關掉自動打開的完整路徑。
     * path 是監看視窗之後、開關之前的路徑（`設定 ▸ › 一般`），setting 是開關（`自動打開監看視窗 › Desktop Session`）
     */
    closed: (path: string, setting: string) => string
  }
  /** unsupported：這個介面畫不出 Pane（例如 VS Code 擴充套件）時的提示 */
  command: {
    unsupported: (command: string) => string
    /** 指令打開了監看視窗，但介面還沒畫出來；引擎的原始 reason 只寫進 debug log */
    notPlaced: string
    opened: string
    /** 不在 macOS：點卡片跳轉不能用 */
    notMac: string
    /** Windows：沒有 ps，連狀態都看不到 */
    windows: string
  }
  /** 監看視窗關著時，輸入框上方的按鈕 */
  band: {
    /** 沒有計數時的按鈕文字（▦ 後面） */
    open: string
    /** 有計數時，▲n 後面接的字 */
    need: (n: number) => string
    /** 有計數時，▦ 後面的短字 */
    openShort: string
    /** 有計數時按鈕的名稱（label）：完整的一句 */
    label: (n: number) => string
    /** 剛手動關掉監看視窗、而且自動打開開著時，打開按鈕旁的按鈕 */
    never: string
  }
  /** 只有符號的控件的 label（螢幕閱讀器、滑過提示），畫面上不出現 */
  labels: {
    /** 展開鈕（畫面只有 ▸／▾）：要做的事加上完整標題 */
    expand: (title: string, isOpen: boolean) => string
    /** PR（畫面是 `#12 ↗`）：編號加上狀態；state 是 gh 的 OPEN、MERGED、CLOSED */
    pr: (n: number, state: string) => string
    /** 閒置分區標題（`○ 閒置 3 ▾`）：按下會收合或展開 */
    idle: (n: number, isCollapsed: boolean) => string
    /** 自動打開的 ☑/☐：帶上「自動打開監看視窗」的上下文，再接選項名稱與開或關 */
    autoOpen: (option: string, isOn: boolean) => string
    /** 「前往處理」（畫面是 `1 前往處理 →`）：哪一張卡片、數字快捷鍵（第 10 張以後沒有快捷鍵，是 null） */
    goHandle: (title: string, hotkey: string | null) => string
  }
}

const REPO = 'https://github.com/wide3751/switchboard/blob/main/'

/** README 某一節的網址：錨點是 GitHub 依標題產生的 slug，percent-encode 後放進網址（終端機的 OSC 8 只收 ASCII） */
const readmeAnchor = (file: string, slug: string): string => `${REPO}${file}#${encodeURIComponent(slug)}`

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
  ctx: 'ctx',
  densities: { compact: 'Compact', standard: 'Standard', detailed: 'Detailed' },
  groups: { waiting: 'Needs you', busy: 'Working', idle: 'Idle' },
  billings: { auto: 'Auto', subscription: 'Subscription', api: 'API' },
  panel: { billing: 'Billing', group: 'Section', density: 'Density', custom: 'Custom', language: 'Language', auto: 'Auto', cardContent: 'Card content', general: 'General', autoOpenTitle: 'Open the board automatically in', autoOpenDesktop: 'Desktop sessions', autoOpenTerminal: 'CLI sessions', done: 'Done', reset: 'Restore defaults', checked: (name, isOn) => `${name}: ${isOn ? 'on' : 'off'}` },
  view: 'Settings',
  loading: 'Loading…',
  readFailed: 'switchboard could not read its state: ',
  cannotRead: 'Cannot read the session records folder below. Check that it exists and that you have read permission for it; if you set CLAUDE_CONFIG_DIR, check that it points to the folder Claude Code actually uses',
  header: {
    none: '✓ Nothing needs you',
    noOthers: 'No other running sessions',
    unknown: '⚠ Can’t see session status right now',
    selfMissing: 'This session is missing from the list, so the scan is not working',
    noRecords: 'No session records found in the folder below, not even for this session. Check that your Claude Code version writes session records there, and that CLAUDE_CONFIG_DIR points to the folder Claude Code actually uses',
    retry: 'Retries every 3s',
    troubleshoot: 'Troubleshooting ↗',
    troubleshootUrl: readmeAnchor('README.md', 'troubleshooting'),
    updatedAgo: age => `Updated ${age} ago`,
    onlySelf: 'Start other sessions (Desktop or terminal) and they will show up here. Sessions that were already open before you installed switchboard need a restart',
  },
  account: {
    title: 'Account usage',
    resetsIn: age => `resets in ${age}`,
    totalCost: usd => `All sessions spent $${usd}`,
    fiveHour: '5h',
    week: 'Week',
  },
  status: {
    needYou: n => `${n} need${n === 1 ? 's' : ''} you`,
    longest: age => `longest ${age}`,
  },
  kinds: { approval: 'Approve', question: 'Answer', errored: 'Error', waiting: 'Needs you' },
  goHandle: 'Go handle it →',
  current: 'This one',
  moreTasks: n => `+${n} more`,
  moreQuestions: n => ` (+${n} more)`,
  asked: text => `? ${text}`,
  quoted: text => `“${text}”`,
  isReplyItalic: true,
  versus: base => `vs ${base}`,
  merged: 'merged',
  noPr: 'No PR',
  environment: { local: 'This computer', worktree: 'Worktree', remote: 'Remote Control' },
  taskKinds: { agent: 'Subagent', bash: 'Bash' },
  connectors: n => `Connectors ${n}`,
  needsAuth: 'Needs auth',
  turns: n => `${n} ${n === 1 ? 'turn' : 'turns'}`,
  basicStatus: 'switchboard not loaded, basic status only',
  unknown: 'Unknown',
  apiError: 'API error, the turn did not finish',
  toast: {
    cliNoJump: path => `Can't jump to sessions in this terminal yet. It is in ${path}`,
    tabMissing: (terminal, path) => `Couldn't find the tab in ${terminal}. The session is in ${path}`,
    jumpFailed: (title, path) => `Couldn't switch to "${title}". It is in ${path}`,
    reopenToJump: path => `Reopen this session to jump to it. It is in ${path}`,
    noJumpIn: (source, path) => `Can't jump to sessions in ${source} yet. It is in ${path}`,
    automationDenied: terminal => `No permission to control ${terminal}. Allow it in System Settings › Privacy & Security › Automation, then try again`,
    closed: (path, setting) =>
      `Board closed. It opens again by itself when you restart the session. To turn it off everywhere: board › ${path} › uncheck “${setting}”`,
  },
  command: {
    unsupported: command => `The board can't be shown here. Type /${command} in Claude Desktop's Code tab or in Claude Code in a terminal.`,
    notPlaced: 'The board is open but not shown yet. It appears as soon as this window can display it.',
    opened: 'Board opened.',
    notMac: 'switchboard is built for macOS. This computer is not a Mac, so clicking a card will not take you to that session.',
    windows: 'switchboard is built for macOS. Windows has no ps, so the board cannot see session status, and clicking a card will not take you to that session.',
  },
  band: {
    open: 'Open board',
    need: n => `need${n === 1 ? 's' : ''} you`,
    openShort: 'Open',
    label: n => `Open board, ${n} need${n === 1 ? 's' : ''} you`,
    never: 'Don’t open automatically',
  },
  labels: {
    expand: (title, isOpen) => `${isOpen ? 'Hide' : 'Show'} details: ${title}`,
    pr: (n, state) => `Open PR #${n} (${state === 'MERGED' ? 'merged' : state === 'CLOSED' ? 'closed' : 'open'})`,
    idle: (n, isCollapsed) => `${isCollapsed ? 'Expand' : 'Collapse'} ${n} idle session${n === 1 ? '' : 's'}`,
    autoOpen: (option, isOn) => `Open the board automatically in ${option}: ${isOn ? 'on' : 'off'}`,
    goHandle: (title, hotkey) => `Go handle ${title}${hotkey === null ? '' : ` (shortcut ${hotkey})`}`,
  },
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
  ctx: 'ctx',
  densities: { compact: 'コンパクト', standard: '標準', detailed: '詳細' },
  groups: { waiting: '対応が必要', busy: '作業中', idle: '待機中' },
  billings: { auto: '自動', subscription: 'サブスク', api: 'API' },
  panel: { billing: '課金', group: '設定対象', density: '密度', custom: 'カスタム', language: '言語', auto: '自動', cardContent: 'カードの内容', general: '一般', autoOpenTitle: '監視ウィンドウを自動で開く', autoOpenDesktop: 'Desktop セッション', autoOpenTerminal: 'CLI セッション', done: '完了', reset: 'デフォルトに戻す', checked: (name, isOn) => `${name}：${isOn ? 'オン' : 'オフ'}` },
  view: '設定',
  loading: '読み込み中…',
  readFailed: 'switchboard が状態を読み込めませんでした：',
  cannotRead: '下のセッション記録フォルダを読み込めません。フォルダが存在し、読み取り権限があるか確認してください。CLAUDE_CONFIG_DIR を設定している場合は、Claude Code が実際に使うフォルダを指しているか確認してください',
  header: {
    none: '✓ 対応が必要な項目はありません',
    noOthers: '実行中の他のセッションはありません',
    unknown: '⚠ 現在セッションの状態を確認できません',
    selfMissing: 'このセッションが一覧にないため、スキャンが正しく動いていません',
    noRecords: '下のフォルダにセッションの記録が 1 件もありません（このセッションの分も）。お使いの Claude Code がここに記録を書くバージョンか、CLAUDE_CONFIG_DIR が Claude Code の実際のフォルダを指しているか確認してください',
    retry: '3 秒ごとに自動で再試行',
    troubleshoot: 'トラブルシューティング ↗',
    troubleshootUrl: readmeAnchor('README.ja.md', 'トラブルシューティング'),
    updatedAgo: age => `${age} 前に更新`,
    onlySelf: 'ほかのセッション（Desktop またはターミナル）を開くとここに表示されます。インストール前から開いていたセッションは再起動してください',
  },
  account: {
    title: 'アカウント使用量',
    resetsIn: age => `${age} 後にリセット`,
    totalCost: usd => `全セッションの費用 $${usd}`,
    fiveHour: '5h',
    week: '週',
  },
  status: {
    needYou: n => `${n} 件が対応待ち`,
    longest: age => `最長 ${age}`,
  },
  kinds: { approval: '承認', question: '回答', errored: 'エラー', waiting: '対応' },
  goHandle: '対応する →',
  current: '現在',
  moreTasks: n => `他 ${n} 件`,
  moreQuestions: n => `（他 ${n} 問）`,
  asked: text => `? ${text}`,
  quoted: text => `「${text}」`,
  isReplyItalic: false,
  versus: base => `${base} との差分`,
  merged: 'マージ済み',
  noPr: 'PR なし',
  environment: { local: 'このコンピュータ', worktree: 'Worktree', remote: 'Remote Control' },
  taskKinds: { agent: 'サブエージェント', bash: 'Bash' },
  connectors: n => `コネクタ ${n}`,
  needsAuth: '要認証',
  turns: n => `${n} ターン`,
  basicStatus: 'switchboard 未読み込み、基本状態のみ',
  unknown: '不明',
  apiError: 'API エラーのため、ターンが完了しませんでした',
  toast: {
    cliNoJump: path => `このターミナルのセッションへはまだ移動できません。場所：${path}`,
    tabMissing: (terminal, path) => `${terminal} に該当するタブが見つかりません。場所：${path}`,
    jumpFailed: (title, path) => `「${title}」に切り替えられませんでした。場所：${path}`,
    reopenToJump: path => `このセッションを開き直すと移動できるようになります。場所：${path}`,
    noJumpIn: (source, path) => `${source} のセッションへはまだ直接移動できません。場所：${path}`,
    automationDenied: terminal => `${terminal} を操作する権限がありません。システム設定 › プライバシーとセキュリティ › オートメーション で許可してから、もう一度お試しください`,
    closed: (path, setting) =>
      `監視ウィンドウを閉じました。セッションを再起動すると自動で開きます。すべてで閉じるには：監視ウィンドウ › ${path} › 「${setting}」をオフ`,
  },
  command: {
    unsupported: command => `ここでは監視ウィンドウを表示できません。Claude Desktop の Code タブか、ターミナルの Claude Code で /${command} と入力してください。`,
    notPlaced: '監視ウィンドウは開きましたが、まだ表示されていません。表示できるようになると現れます。',
    opened: '監視ウィンドウを開きました。',
    notMac: 'switchboard は macOS 向けです。このコンピュータは macOS ではないため、カードをクリックしてもそのセッションへは移動できません。',
    windows: 'switchboard は macOS 向けです。Windows には ps がないため、セッションの状態を確認できず、カードをクリックしてもそのセッションへは移動できません。',
  },
  band: {
    open: '監視ウィンドウを開く',
    need: () => '件が対応待ち',
    openShort: '開く',
    label: n => `監視ウィンドウを開く、${n} 件が対応待ち`,
    never: '自動で開かない',
  },
  labels: {
    expand: (title, isOpen) => `詳細を${isOpen ? '閉じる' : '表示'}：${title}`,
    pr: (n, state) => `PR #${n} を開く（${state === 'MERGED' ? 'マージ済み' : state === 'CLOSED' ? 'クローズ済み' : 'オープン'}）`,
    idle: (n, isCollapsed) => `待機中の ${n} 件を${isCollapsed ? '展開' : '折りたたむ'}`,
    autoOpen: (option, isOn) => `監視ウィンドウを自動で開く（${option}）：${isOn ? 'オン' : 'オフ'}`,
    goHandle: (title, hotkey) => `${title} に対応する${hotkey === null ? '' : `（ショートカット ${hotkey}）`}`,
  },
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
  ctx: 'ctx',
  densities: { compact: '간단히', standard: '표준', detailed: '자세히' },
  groups: { waiting: '확인 필요', busy: '작업 중', idle: '유휴' },
  billings: { auto: '자동', subscription: '구독', api: 'API' },
  panel: { billing: '요금제', group: '설정 대상', density: '밀도', custom: '사용자 지정', language: '언어', auto: '자동', cardContent: '카드 내용', general: '일반', autoOpenTitle: '모니터 창 자동으로 열기', autoOpenDesktop: 'Desktop 세션', autoOpenTerminal: 'CLI 세션', done: '완료', reset: '기본값으로 복원', checked: (name, isOn) => `${name}: ${isOn ? '켜짐' : '꺼짐'}` },
  view: '설정',
  loading: '불러오는 중…',
  readFailed: 'switchboard가 상태를 읽지 못했습니다: ',
  cannotRead: '아래 세션 기록 폴더를 읽을 수 없습니다. 폴더가 있는지, 읽기 권한이 있는지 확인하세요. CLAUDE_CONFIG_DIR을 설정했다면 Claude Code가 실제로 쓰는 폴더를 가리키는지 확인하세요',
  header: {
    none: '✓ 확인할 항목이 없습니다',
    noOthers: '실행 중인 다른 세션이 없습니다',
    unknown: '⚠ 지금은 세션 상태를 확인할 수 없습니다',
    selfMissing: '이 세션이 목록에 없어 스캔이 제대로 동작하지 않습니다',
    noRecords: '아래 폴더에 세션 기록이 하나도 없습니다(이 세션의 기록도 없음). 사용 중인 Claude Code 버전이 이곳에 기록을 남기는지, CLAUDE_CONFIG_DIR이 Claude Code가 실제로 쓰는 폴더를 가리키는지 확인하세요',
    retry: '3초마다 자동으로 다시 시도',
    troubleshoot: '문제 해결 ↗',
    troubleshootUrl: readmeAnchor('README.ko.md', '문제-해결'),
    updatedAgo: age => `${age} 전 업데이트`,
    onlySelf: '다른 세션(Desktop 또는 터미널)을 열면 여기에 표시됩니다. 설치 전부터 열려 있던 세션은 다시 시작하세요',
  },
  account: {
    title: '계정 사용량',
    resetsIn: age => `${age} 후 초기화`,
    totalCost: usd => `전체 세션 비용 $${usd}`,
    fiveHour: '5h',
    week: '주간',
  },
  status: {
    needYou: n => `${n}개 확인 필요`,
    longest: age => `최장 ${age}`,
  },
  kinds: { approval: '승인', question: '답변', errored: '오류', waiting: '확인' },
  goHandle: '처리하러 가기 →',
  current: '현재',
  moreTasks: n => `외 ${n}개`,
  moreQuestions: n => ` (외 ${n}문항)`,
  asked: text => `? ${text}`,
  quoted: text => `“${text}”`,
  isReplyItalic: false,
  versus: base => `${base} 대비`,
  merged: '병합됨',
  noPr: 'PR 없음',
  environment: { local: '이 컴퓨터', worktree: 'Worktree', remote: 'Remote Control' },
  taskKinds: { agent: '서브에이전트', bash: 'Bash' },
  connectors: n => `커넥터 ${n}`,
  needsAuth: '인증 필요',
  turns: n => `${n}턴`,
  basicStatus: 'switchboard 미로드, 기본 상태만',
  unknown: '알 수 없음',
  apiError: 'API 오류로 턴이 완료되지 않았습니다',
  toast: {
    cliNoJump: path => `이 터미널의 세션으로는 아직 이동할 수 없습니다. 위치: ${path}`,
    tabMissing: (terminal, path) => `${terminal}에서 해당 탭을 찾지 못했습니다. 위치: ${path}`,
    jumpFailed: (title, path) => `"${title}"(으)로 전환할 수 없습니다. 위치: ${path}`,
    reopenToJump: path => `이 세션을 다시 열면 이동할 수 있습니다. 위치: ${path}`,
    noJumpIn: (source, path) => `${source}의 세션으로는 아직 바로 이동할 수 없습니다. 위치: ${path}`,
    automationDenied: terminal => `${terminal}을(를) 제어할 권한이 없습니다. 시스템 설정 › 개인정보 보호 및 보안 › 자동화에서 허용한 뒤 다시 시도하세요`,
    closed: (path, setting) =>
      `모니터 창을 닫았습니다. 세션을 다시 시작하면 자동으로 열립니다. 모두 끄려면: 모니터 창 › ${path} › “${setting}” 해제`,
  },
  command: {
    unsupported: command => `여기서는 모니터 창을 표시할 수 없습니다. Claude Desktop의 Code 탭이나 터미널의 Claude Code에서 /${command}을(를) 입력하세요.`,
    notPlaced: '모니터 창이 열렸지만 아직 표시되지 않았습니다. 표시할 수 있게 되면 나타납니다.',
    opened: '모니터 창을 열었습니다.',
    notMac: 'switchboard는 macOS용입니다. 이 컴퓨터는 macOS가 아니어서 카드를 클릭해도 해당 세션으로 이동할 수 없습니다.',
    windows: 'switchboard는 macOS용입니다. Windows에는 ps가 없어 세션 상태를 확인할 수 없고, 카드를 클릭해도 해당 세션으로 이동할 수 없습니다.',
  },
  band: {
    open: '모니터 창 열기',
    need: () => '확인 필요',
    openShort: '열기',
    label: n => `모니터 창 열기, ${n}개 확인 필요`,
    never: '자동으로 열지 않기',
  },
  labels: {
    expand: (title, isOpen) => `세부 정보 ${isOpen ? '숨기기' : '보기'}: ${title}`,
    pr: (n, state) => `PR #${n} 열기 (${state === 'MERGED' ? '병합됨' : state === 'CLOSED' ? '닫힘' : '열림'})`,
    idle: (n, isCollapsed) => `유휴 세션 ${n}개 ${isCollapsed ? '펼치기' : '접기'}`,
    autoOpen: (option, isOn) => `모니터 창 자동으로 열기 (${option}): ${isOn ? '켜짐' : '꺼짐'}`,
    goHandle: (title, hotkey) => `${title} 처리하러 가기${hotkey === null ? '' : ` (단축키 ${hotkey})`}`,
  },
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
  ctx: 'ctx',
  densities: { compact: '精简', standard: '标准', detailed: '详细' },
  groups: { waiting: '待处理', busy: '工作中', idle: '空闲' },
  billings: { auto: '自动', subscription: '订阅制', api: 'API' },
  panel: { billing: '计费', group: '应用到', density: '密度', custom: '自定义', language: '语言', auto: '自动', cardContent: '卡片内容', general: '常规', autoOpenTitle: '自动打开监控窗口', autoOpenDesktop: 'Desktop Session', autoOpenTerminal: 'CLI Session', done: '完成', reset: '恢复默认值', checked: (name, isOn) => `${name}：${isOn ? '已开启' : '已关闭'}` },
  view: '设置',
  loading: '加载中…',
  readFailed: 'switchboard 读取状态失败：',
  cannotRead: '无法读取下面这个 Session 记录文件夹。请确认它存在、你有读取权限；设置了 CLAUDE_CONFIG_DIR 的话，确认它指向 Claude Code 实际使用的文件夹',
  header: {
    none: '✓ 没有待处理的 Session',
    noOthers: '没有其他运行中的 Session',
    unknown: '⚠ 目前看不到 Session 状态',
    selfMissing: '列表里没有当前这个 Session，扫描没有正常工作',
    noRecords: '下面这个文件夹里找不到任何 Session 记录，连当前这个都没有。请确认所用的 Claude Code 版本会在这里写记录，以及 CLAUDE_CONFIG_DIR 指向 Claude Code 实际使用的文件夹',
    retry: '每 3 秒自动重试',
    troubleshoot: '故障排除 ↗',
    troubleshootUrl: readmeAnchor('README.zh-CN.md', '故障排除'),
    updatedAgo: age => `${age} 前更新`,
    onlySelf: '再开其他 Session（Desktop 或终端）就会出现在这里；安装前就开着的要重开',
  },
  account: {
    title: '账户用量',
    resetsIn: age => `${age} 后重置`,
    totalCost: usd => `所有 Session 花费 $${usd}`,
    fiveHour: '5h',
    week: '周',
  },
  status: {
    needYou: n => `${n} 个待处理`,
    longest: age => `最长 ${age}`,
  },
  kinds: { approval: '批准', question: '回答', errored: '出错', waiting: '待处理' },
  goHandle: '前往处理 →',
  current: '当前',
  moreTasks: n => `另有 ${n} 个`,
  moreQuestions: n => `（另有 ${n} 题）`,
  asked: text => `? ${text}`,
  quoted: text => `“${text}”`,
  isReplyItalic: false,
  versus: base => `相对 ${base}`,
  merged: '已合并',
  noPr: '无 PR',
  environment: { local: '本机', worktree: 'Worktree', remote: 'Remote Control' },
  taskKinds: { agent: 'Subagent', bash: 'Bash' },
  connectors: n => `连接器 ${n}`,
  needsAuth: '需验证',
  turns: n => `${n} 轮`,
  basicStatus: '未加载 switchboard，仅基本状态',
  unknown: '未知',
  apiError: 'API 错误，回合未完成',
  toast: {
    cliNoJump: path => `这个终端还不能跳转，Session 在 ${path}`,
    tabMissing: (terminal, path) => `在 ${terminal} 里找不到对应的标签页，Session 在 ${path}`,
    jumpFailed: (title, path) => `无法切换到「${title}」，它在 ${path}`,
    reopenToJump: path => `重新打开这个 Session 后才能跳转，它在 ${path}`,
    noJumpIn: (source, path) => `${source} 里的 Session 还不能直接跳转，它在 ${path}`,
    automationDenied: terminal => `没有控制 ${terminal} 的权限。请到「系统设置 › 隐私与安全性 › 自动化」允许后再试`,
    closed: (path, setting) => `已关闭监控窗口。重开 Session 时会再自动打开。要全部关掉：监控窗口 › ${path} › 取消「${setting}」`,
  },
  command: {
    unsupported: command => `这里无法显示监控窗口：请在 Claude Desktop 的 Code 标签页，或终端里的 Claude Code 输入 /${command}。`,
    notPlaced: '监控窗口已打开，但还没有显示出来；能显示时就会出现。',
    opened: '已打开监控窗口。',
    notMac: 'switchboard 是为 macOS 做的：这台电脑不是 macOS，点卡片跳转到该 Session 不能用。',
    windows: 'switchboard 是为 macOS 做的：Windows 没有 ps，看不到各 Session 的状态，点卡片跳转也不能用。',
  },
  band: {
    open: '打开监控窗口',
    need: () => '待处理',
    openShort: '打开',
    label: n => `打开监控窗口，${n} 个待处理`,
    never: '不再自动打开',
  },
  labels: {
    expand: (title, isOpen) => `${isOpen ? '收起' : '显示'}明细：${title}`,
    pr: (n, state) => `打开 PR #${n}（${state === 'MERGED' ? '已合并' : state === 'CLOSED' ? '已关闭' : '开启中'}）`,
    idle: (n, isCollapsed) => `${isCollapsed ? '展开' : '收起'}空闲的 ${n} 个 Session`,
    autoOpen: (option, isOn) => `自动打开监控窗口（${option}）：${isOn ? '已开启' : '已关闭'}`,
    goHandle: (title, hotkey) => `前往处理 ${title}${hotkey === null ? '' : `（快捷键 ${hotkey}）`}`,
  },
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
  ctx: 'ctx',
  densities: { compact: '精簡', standard: '標準', detailed: '詳細' },
  groups: { waiting: '待處理', busy: '工作中', idle: '閒置' },
  billings: { auto: '自動', subscription: '訂閱制', api: 'API' },
  panel: { billing: '計費', group: '套用到', density: '密度', custom: '自訂', language: '語言', auto: '自動', cardContent: '卡片內容', general: '一般', autoOpenTitle: '自動打開監看視窗', autoOpenDesktop: 'Desktop Session', autoOpenTerminal: 'CLI Session', done: '完成', reset: '還原預設值', checked: (name, isOn) => `${name}：${isOn ? '已開啟' : '已關閉'}` },
  view: '設定',
  loading: '讀取中…',
  readFailed: 'switchboard 讀取狀態失敗：',
  cannotRead: '讀不到下面這個 Session 紀錄資料夾。請確認它存在、你有讀取權限；有設 CLAUDE_CONFIG_DIR 的話，確認它指向 Claude Code 實際使用的資料夾',
  header: {
    none: '✓ 沒有待處理的 Session',
    noOthers: '沒有其他執行中的 Session',
    unknown: '⚠ 目前看不到 Session 狀態',
    selfMissing: '清單裡沒有目前這個 Session，掃描沒有正常運作',
    noRecords: '下面這個資料夾裡找不到任何 Session 紀錄，連目前這個都沒有。請確認用的 Claude Code 版本會在這裡寫紀錄，以及 CLAUDE_CONFIG_DIR 指向 Claude Code 實際使用的資料夾',
    retry: '每 3 秒自動重試',
    troubleshoot: '疑難排解 ↗',
    troubleshootUrl: readmeAnchor('README.zh-TW.md', '疑難排解'),
    updatedAgo: age => `${age} 前更新`,
    onlySelf: '再開其他 Session（Desktop 或終端機）就會出現在這裡；安裝前就開著的要重開',
  },
  account: {
    title: '帳號用量',
    resetsIn: age => `${age} 後重置`,
    totalCost: usd => `所有 Session 花費 $${usd}`,
    fiveHour: '5h',
    week: '週',
  },
  status: {
    needYou: n => `${n} 個待處理`,
    longest: age => `最長 ${age}`,
  },
  kinds: { approval: '核准', question: '回答', errored: '出錯', waiting: '待處理' },
  goHandle: '前往處理 →',
  current: '目前',
  moreTasks: n => `+${n} 個`,
  moreQuestions: n => `（另有 ${n} 題）`,
  asked: text => `? ${text}`,
  quoted: text => `「${text}」`,
  isReplyItalic: false,
  versus: base => `相對 ${base}`,
  merged: '已合併',
  noPr: '無 PR',
  environment: { local: '本機', worktree: 'Worktree', remote: 'Remote Control' },
  taskKinds: { agent: 'Subagent', bash: 'Bash' },
  connectors: n => `連接器 ${n}`,
  needsAuth: '需驗證',
  turns: n => `${n} 輪`,
  basicStatus: '未載入 switchboard，僅基本狀態',
  unknown: '未知',
  apiError: 'API 錯誤，回合未完成',
  toast: {
    cliNoJump: path => `這個終端機還不能跳轉，Session 在 ${path}`,
    tabMissing: (terminal, path) => `在 ${terminal} 裡找不到對應的分頁，Session 在 ${path}`,
    jumpFailed: (title, path) => `沒辦法切換到「${title}」，它在 ${path}`,
    reopenToJump: path => `重開這個 Session 後才能跳轉，它在 ${path}`,
    noJumpIn: (source, path) => `${source} 裡的 Session 還不能直接跳轉，它在 ${path}`,
    automationDenied: terminal => `沒有控制 ${terminal} 的權限。請到「系統設定 › 隱私權與安全性 › 自動化」允許後再試`,
    closed: (path, setting) => `已關閉監看視窗。重開 Session 時會再自動打開。要全面關掉：監看視窗 › ${path} › 取消「${setting}」`,
  },
  command: {
    unsupported: command => `這裡無法顯示監看視窗：請在 Claude Desktop 的 Code 分頁，或終端機裡的 Claude Code 輸入 /${command}。`,
    notPlaced: '監看視窗已打開，但介面還沒有畫出來；能顯示時就會出現。',
    opened: '已打開監看視窗。',
    notMac: 'switchboard 是為 macOS 做的：這台電腦不是 macOS，點卡片跳轉到該 Session 不能用。',
    windows: 'switchboard 是為 macOS 做的：Windows 沒有 ps，看不到各 Session 的狀態，點卡片跳轉也不能用。',
  },
  band: {
    open: '打開監看視窗',
    need: () => '待處理',
    openShort: '打開',
    label: n => `打開監看視窗，${n} 個待處理`,
    never: '不再自動打開',
  },
  labels: {
    expand: (title, isOpen) => `${isOpen ? '收起' : '顯示'}明細：${title}`,
    pr: (n, state) => `打開 PR #${n}（${state === 'MERGED' ? '已合併' : state === 'CLOSED' ? '已關閉' : '開啟中'}）`,
    idle: (n, isCollapsed) => `${isCollapsed ? '展開' : '收合'}閒置的 ${n} 個 Session`,
    autoOpen: (option, isOn) => `自動打開監看視窗（${option}）：${isOn ? '已開啟' : '已關閉'}`,
    goHandle: (title, hotkey) => `前往處理 ${title}${hotkey === null ? '' : `（快捷鍵 ${hotkey}）`}`,
  },
}

/** 語言選項：一律用母語名稱，不隨介面語言翻譯，找自己的語言時不用先看懂目前的語言 */
export const LOCALES: readonly { locale: Locale; label: string }[] = [
  { locale: 'en', label: 'English' },
  { locale: 'ja', label: '日本語' },
  { locale: 'ko', label: '한국어' },
  { locale: 'zh-CN', label: '简体中文' },
  { locale: 'zh-TW', label: '繁體中文' },
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

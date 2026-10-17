// 依 i18n.ts 的實際字串與 board.ts 的實際函式，產生監看視窗示意圖的 HTML。每個語言三份：
// - board.<語言>.html：Desktop 的監看視窗（有在等你的情境）
// - terminal.<語言>.html：同一份樣本、同一個版面，畫成 80 欄終端機裡嵌在輸入框上方的監看視窗
// - states.<語言>.html：狀態總覽（出錯中止；沒有在等你、展開明細；看不到狀態），Desktop 版
// 用法（截圖用 shot.mjs：截每份 HTML 的 `.shot` 元素，2 倍解析度，存成同名的 PNG）：
//   node assets/board/render.mjs . <輸出資料夾>
//   node assets/board/shot.mjs <輸出資料夾> assets/board
//
// 版面照 agens-view/hooks/register.tsx 的 Pane render 寫成同一棵樹（Box、Text、Button、Link），
// 再由兩個畫法各自畫：Desktop 轉成 CSS flexbox，終端機排成等寬格（中日韓字 2 格）。
// 改了 register.tsx 的版面、LOOK、i18n.ts 或 GLYPHS，就要同步改這裡並重新產生圖（PR 範本有這一項）。
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const [repo, out] = process.argv.slice(2)
const { messagesOf } = await import(pathToFileURL(join(repo, 'agens-view/hooks/i18n.ts')).href)
const {
  GLYPHS, DEFAULT_FIELDS, PRESETS, arrange, branchLabel, clipToWidth, commonModel, countTasks,
  describeProgress, displayWidth, estimateWidth, fitToWidth, groupOf, locationOf, rateKind, shortAge, shortModel,
  sourceMark, usageBar, usageColor,
} = await import(pathToFileURL(join(repo, 'agens-view/hooks/board.ts')).href)

// ── 示意內容（Session 標題、問題、待辦等），依語言翻譯 ────────────────────────
const SAMPLE = {
  en: {
    login: 'Fix login 401', chart: 'Pick a chart library', question: 'Which chart library should we use?',
    dark: 'Add dark mode', darkStep: 'Update theme tokens', docs: 'Translate the README', docsStep: 'Japanese version',
    deps: 'Upgrade dependencies', reply: 'All tests pass after the upgrade.',
    node: 'Upgrade to Node 20', notes: 'Write weekly notes', notesReply: 'The weekly notes are in notes/2026-w42.md.',
    contrast: 'Check color contrast',
    panels: ['Errored', 'Nothing needs you · details expanded', 'Can’t see status'],
  },
  'zh-TW': {
    login: '修正登入 401', chart: '選擇圖表套件', question: '要用哪一個圖表套件？',
    dark: '加入深色模式', darkStep: '更新主題色票', docs: '翻譯 README', docsStep: '日文版',
    deps: '升級相依套件', reply: '升級後測試全部通過。',
    node: '升級到 Node 20', notes: '整理本週週報', notesReply: '週報已經寫好，放在 notes/2026-w42.md。',
    contrast: '檢查色彩對比',
    panels: ['出錯中止', '沒有在等你 · 展開明細', '看不到狀態'],
  },
  'zh-CN': {
    login: '修复登录 401', chart: '选择图表库', question: '要用哪个图表库？',
    dark: '添加深色模式', darkStep: '更新主题色板', docs: '翻译 README', docsStep: '日文版',
    deps: '升级依赖', reply: '升级后测试全部通过。',
    node: '升级到 Node 20', notes: '整理本周周报', notesReply: '周报已经写好，放在 notes/2026-w42.md。',
    contrast: '检查色彩对比',
    panels: ['出错中止', '没有在等你 · 展开明细', '看不到状态'],
  },
  ja: {
    login: 'ログインの 401 を修正', chart: 'チャートライブラリを選ぶ', question: 'どのチャートライブラリを使いますか？',
    dark: 'ダークモードを追加', darkStep: 'テーマトークンを更新', docs: 'README を翻訳', docsStep: '日本語版',
    deps: '依存関係を更新', reply: '更新後、テストはすべて通りました。',
    node: 'Node 20 に上げる', notes: '今週の週報をまとめる', notesReply: '週報は notes/2026-w42.md に書きました。',
    contrast: '色のコントラストを確認',
    panels: ['エラーで停止', '対応待ちなし · 詳細を展開', '状態を確認できない'],
  },
  ko: {
    login: '로그인 401 수정', chart: '차트 라이브러리 고르기', question: '어떤 차트 라이브러리를 쓸까요?',
    dark: '다크 모드 추가', darkStep: '테마 토큰 업데이트', docs: 'README 번역', docsStep: '일본어판',
    deps: '의존성 업그레이드', reply: '업그레이드 후 테스트가 모두 통과했습니다.',
    node: 'Node 20으로 업그레이드', notes: '이번 주 주간 보고 정리', notesReply: '주간 보고는 notes/2026-w42.md에 있습니다.',
    contrast: '색 대비 확인',
    panels: ['오류로 중단', '확인 필요 없음 · 세부 정보 펼침', '상태를 확인할 수 없음'],
  },
}

const NOW = Date.parse('2026-10-17T09:00:00Z')
const MIN = 60_000
const MODEL = 'claude-opus-5-5'
const RATES = [
  { kind: 'five_hour', percentUsed: 34, resetsAt: new Date(NOW + 2 * 60 * MIN).toISOString() },
  { kind: 'seven_day', percentUsed: 58, resetsAt: new Date(NOW + 3 * 24 * 60 * MIN).toISOString() },
]

/** SessionCard 的樣本（types/index.d.ts）；canJump 代替 register.tsx 的 canJump() */
const card = (pid, status, title, source, minutesAgo, path, report, extra = {}) => ({
  pid, sessionId: `s-${pid}`, hostSessionId: null, isRemote: false, isWorktree: false, status, title,
  folder: path.split('/').pop(), path, source, tty: null, since: NOW - minutesAgo * MIN, canJump: true,
  report: { model: MODEL, question: null, approval: null, turnError: null, progress: null, activity: null,
    lastReply: null, branch: null, contextPercent: null, pr: null, costUsd: 0, turns: 0, connectors: null,
    tasks: [], rateLimits: [], reportedAt: NOW, ...report },
  ...extra,
})

const cardsOf = (locale, scene) => {
  const s = SAMPLE[locale]
  const login = card(701, 'waiting', s.login, 'iTerm', 3, '/Users/me/code/api-server', {
    approval: '$ npm install jsonwebtoken', contextPercent: 31,
    branch: { name: 'fix-login', ahead: 0, behind: 0, changed: 3, insertions: 12, deletions: 0, base: 'origin/main' },
  })
  const chart = card(702, 'waiting', s.chart, 'Desktop', 1, '/Users/me/code/dashboard', {
    question: { text: s.question, options: ['Recharts', 'Chart.js', 'D3'] }, contextPercent: 12,
  })
  const dark = card(703, 'busy', s.dark, 'iTerm', 12, '/Users/me/code/web-app', {
    progress: { done: 3, total: 5, current: s.darkStep }, activity: 'Edit theme.css', contextPercent: 42,
    branch: { name: 'dark-mode', ahead: 2, behind: 0, changed: 0, insertions: 184, deletions: 37, base: 'origin/main' },
    pr: { number: 12, state: 'OPEN', url: '' }, turns: 14, rateLimits: RATES,
    tasks: [{ status: 'running', kind: 'agent', label: s.contrast }, { status: 'done', kind: 'bash', label: 'npm test' }],
    connectors: { connected: ['github', 'linear'], needsAuth: ['figma'] },
  }, { sessionId: 'me' })
  const docs = card(704, 'busy', s.docs, 'Desktop', 5, '/Users/me/code/docs', {
    progress: { done: 2, total: 4, current: s.docsStep }, activity: 'Read README.ja.md', contextPercent: 18,
    branch: { name: 'readme-i18n', ahead: 3, behind: 0, changed: 0, insertions: 620, deletions: 0, base: 'origin/main' },
    pr: { number: 9, state: 'MERGED', url: '' },
  })
  const deps = card(705, 'idle', s.deps, 'VS Code', 120, '/Users/me/code/web', { lastReply: s.reply, contextPercent: 54 })
  const notes = card(706, 'idle', s.notes, 'Terminal', 24 * 60, '/Users/me/notes', { lastReply: s.notesReply, contextPercent: 7 })
  const node = card(707, 'errored', s.node, 'Terminal', 2, '/Users/me/code/infra/.claude/worktrees/node-20', {
    turnError: 'api-error', contextPercent: 88,
    branch: { name: 'node-20', ahead: 0, behind: 0, changed: 2, insertions: 9, deletions: 4, base: 'origin/main' },
    pr: { number: 37, state: 'CLOSED', url: '' },
  }, { isWorktree: true })

  if (scene === 'errored') return { cards: [node, docs], opened: [] }
  if (scene === 'calm') return { cards: [dark, deps, notes], opened: [dark.pid] }
  if (scene === 'unknown') return { cards: [], opened: [], error: { kind: 'failed', reason: 'EACCES: permission denied' } }

  return { cards: [login, chart, dark, docs, deps], opened: [] }
}

// ── 樹：和 register.tsx 同樣的 Box／Text／Button／Link ──────────────────────────
const h = (type, props, ...children) => ({
  type,
  props: props ?? {},
  children: children.flat(Infinity).filter(one => one !== null && one !== undefined && one !== false && one !== ''),
})
const Box = (props, ...children) => h('Box', props, ...children)
const Text = (props, ...children) => h('Text', props, ...children)
const Button = (props, ...children) => h('Button', props, ...children)
const Link = props => h('Link', props)

/** register.tsx 的 Pane render，只留畫圖用得到的部分 */
const boardTree = (locale, scene, surface) => {
  const m = messagesOf(locale)
  const { cards, opened, error = null } = cardsOf(locale, scene)
  const isTerminal = surface === 'terminal'
  const now = NOW
  const own = { sessionId: 'me' }
  const settings = { fields: DEFAULT_FIELDS, isIdleCollapsed: false }
  const isSubscription = true
  const showsIn = (group, field) => settings.fields[group].includes(field)
  const cardShows = (c, field) => (opened.includes(c.pid) ? PRESETS.detailed.includes(field) : showsIn(groupOf(c.status), field))
  const onRow = (c, field) => !opened.includes(c.pid) && showsIn(groupOf(c.status), field)
  const mainModel = commonModel(cards)
  const waiting = cards.filter(c => groupOf(c.status) === 'waiting')
  const hasGo = c => groupOf(c.status) === 'waiting' && c.canJump
  const arranged = arrange(cards, hasGo, null)
  const { waiting: waitingShown, busy, idle } = arranged.sections
  // Desktop 的 bodyColumns 沒有實測值；412px 寬的 Pane 約 56 格（只影響標題要不要截斷，樣本的標題都放得下）
  const columns = isTerminal ? COLUMNS - 4 : 56
  const cardWidth = columns - 4
  const cardPadX = isTerminal ? 'sm' : 'md'
  const clipTo = isTerminal ? clipToWidth : fitToWidth
  const LOOK = {
    waiting: { glyph: GLYPHS.waiting.char, color: 'warning' },
    busy: { glyph: GLYPHS.busy.char, color: 'claude' },
    idle: { glyph: GLYPHS.idle.char, color: 'inactive' },
    errored: { glyph: GLYPHS.errored.char, color: 'error' },
    unknown: { glyph: GLYPHS.unknown.char, color: 'inactive' },
  }
  const rateLimits = cards.map(c => c.report).filter(r => r.rateLimits.length > 0)[0]?.rateLimits ?? []
  const kindOf = c =>
    c.status === 'errored' ? 'errored' : c.status !== 'waiting' ? null
      : c.report?.question != null ? 'question' : c.report?.approval != null ? 'approval' : 'waiting'

  const titleRow = (c, width) => {
    const look = LOOK[c.status]
    const isCurrent = c.sessionId !== null && c.sessionId === own.sessionId
    const shows = field => cardShows(c, field)
    const age = shows('time') && c.since !== null ? shortAge(now - c.since) : null
    const tasks = shows('tasks') ? countTasks(c.report?.tasks ?? []) : { running: 0, waiting: 0, failed: 0 }
    let badges = [
      tasks.running > 0 ? { text: `${GLYPHS.taskRunning.char}${tasks.running}`, color: 'text' } : null,
      tasks.waiting > 0 ? { text: `${GLYPHS.taskWaiting.char}${tasks.waiting}`, color: 'warning' } : null,
      tasks.failed > 0 ? { text: `${GLYPHS.taskFailed.char}${tasks.failed}`, color: 'error' } : null,
    ].filter(one => one !== null)
    const isOpen = opened.includes(c.pid)
    // 時間和 ▸／▾ 黏成一顆展開鈕（`7s ▸`）
    const toggle = `${age === null ? '' : `${age} `}${isOpen ? GLYPHS.expanded.char : GLYPHS.collapsed.char}`
    const kind = kindOf(c)
    const label = kind !== null ? m.kinds[kind] : c.status === 'unknown' ? m.unknown : null
    let source = sourceMark(c.source)
    const cellsOf = isTerminal ? text => displayWidth(text, 2) : estimateWidth
    const left = cellsOf(look.glyph) + 1 + (label === null ? 0 : cellsOf(label) + 1)
    let current = isCurrent ? m.current : null
    const rightOf = () =>
      (source === null ? 0 : cellsOf(source) + 1) + (current === null ? 0 : cellsOf(current) + 1) +
      badges.reduce((sum, one) => sum + cellsOf(one.text) + 1, 0) + cellsOf(toggle)
    const isTight = () => width - left - rightOf() - 3 < 8
    if (isTight()) badges = []
    if (isTight()) source = null
    if (isTight() && current !== null) current = GLYPHS.current.char
    const budget = width - left - rightOf() - 3
    const title = isTerminal ? clipToWidth(c.title, budget, 2) : clipTo(c.title, budget)

    return Box({ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 1 },
      Box({ flexDirection: 'row', gap: 1 },
        Text({ color: look.color, weight: kind === null ? 'regular' : 'bold' }, look.glyph),
        label !== null && Text({ color: look.color, weight: kind === null ? 'regular' : 'bold' }, label),
        Button({ plain: true, shrink: true }, Text({ weight: c.status === 'idle' ? 'regular' : 'semibold' }, title)),
      ),
      Box({ flexDirection: 'row', gap: 1, alignItems: 'center' },
        source !== null && Box({}, Text({ dimColor: true }, source)),
        current !== null && Box({}, Text({ size: 'caption', dimColor: current !== GLYPHS.current.char }, current)),
        badges.length > 0 && Box({ flexDirection: 'row', gap: 1 }, badges.map(one => Text({ size: 'caption', color: one.color }, one.text))),
        Button({ plain: true, dimColor: true }, Text({ size: 'caption', dimColor: true, tabular: true }, toggle)),
      ),
    )
  }

  const contextLine = c => {
    const report = c.report
    if (report === null) return null
    if (c.status === 'waiting' && report.question !== null) {
      const options = report.question.options.join(' / ')
      return Box({ flexDirection: 'column' },
        Text({ size: 'footnote', weight: 'medium', wrap: 'wrap' }, m.asked(report.question.text)),
        options !== '' && Text({ size: 'caption', dimColor: true, wrap: 'wrap' }, options),
      )
    }
    if (c.status === 'waiting' && report.approval !== null) {
      return Box({}, Text({ size: 'footnote', mono: true, wrap: 'wrap' }, report.approval))
    }
    if (c.status === 'errored' && report.turnError !== null) {
      return Box({}, Text({ size: 'footnote', color: 'error', wrap: 'wrap' }, report.turnError === 'api-error' ? m.apiError : report.turnError))
    }
    if (c.status === 'busy') {
      const doing = [
        cardShows(c, 'progress') && report.progress != null ? describeProgress(report.progress) : null,
        cardShows(c, 'activity') && report.activity != null ? report.activity : null,
      ].filter(one => one !== null)
      if (doing.length === 0) return null
      return Box({}, Text({ size: 'footnote', wrap: 'truncate-end' }, doing.join(' · ')))
    }
    if (c.status === 'idle' && cardShows(c, 'reply') && report.lastReply !== null) {
      return Box({}, Text({ size: 'footnote', dimColor: true, italic: m.isReplyItalic, wrap: 'truncate-end' }, m.quoted(report.lastReply)))
    }
    return null
  }

  const metaStrip = c => {
    const shows = field => cardShows(c, field)
    const isOpen = opened.includes(c.pid)
    const report = c.report
    const branch = report?.branch ?? null
    const connectors = report?.connectors ?? null
    const where = [
      shows('location') ? locationOf(c.path) : null,
      shows('branch') && branch !== null && !isOpen ? branchLabel(branch, c.path) || null : null,
      shows('source') && c.source !== null && c.source !== 'Desktop' ? c.source : null,
    ].filter(one => one !== null)
    const added = branch?.insertions ?? 0
    const removed = branch?.deletions ?? 0
    const percent = report?.contextPercent ?? null
    const model = report?.model ?? null
    const pr = report?.pr ?? null
    const environment = [c.isWorktree ? m.environment.worktree : null, c.isRemote ? m.environment.remote : null].filter(Boolean)
    const usage = [
      report?.costUsd > 0 && !isSubscription ? `$${report.costUsd.toFixed(2)}` : null,
      report?.turns > 0 ? m.turns(report.turns) : null,
    ].filter(Boolean)
    const hasWork = branch !== null && (added > 0 || removed > 0 || branch.ahead > 0)
    const prText = pr === null ? ''
      : pr.state === 'MERGED' ? `${GLYPHS.pr.char}${pr.number} ${GLYPHS.external.char} ${m.merged}`
        : pr.state === 'CLOSED' ? `${GLYPHS.pr.char}${pr.number}`
          : `${GLYPHS.pr.char}${pr.number} ${GLYPHS.external.char}`
    const segments = [
      where.length > 0 ? Text({ size: 'caption', color: 'subtle' }, where.join(' · ')) : null,
      shows('changes') && (added > 0 || removed > 0)
        ? Box({ flexDirection: 'row', gap: 1 },
          added > 0 ? Text({ size: 'caption', color: 'diffAdded', tabular: true }, `+${added}`) : null,
          removed > 0 ? Text({ size: 'caption', color: 'diffRemoved', tabular: true }, `−${removed}`) : null)
        : null,
      shows('context') && percent !== null && !isOpen
        ? Box({}, Text({ size: 'caption', color: percent >= 80 ? usageColor(percent) : undefined, dimColor: percent < 80, tabular: true }, `${m.ctx} ${Math.round(percent)}%`))
        : null,
      shows('pr') && pr !== null
        ? Box({}, Button({ plain: true }, Text({ size: 'caption', color: pr.state === 'MERGED' ? 'merged' : pr.state === 'CLOSED' ? 'inactive' : 'success', strikethrough: pr.state === 'CLOSED' }, prText)))
        : shows('pr') && hasWork && c.status !== 'idle' ? Box({}, Text({ size: 'caption', dimColor: true }, m.noPr)) : null,
      model !== null && (shows('model') || (model !== mainModel && c.status !== 'idle')) ? Text({ size: 'caption', dimColor: true }, shortModel(model)) : null,
      shows('environment') && environment.length > 0 ? Text({ size: 'caption', dimColor: true }, environment.join(' · ')) : null,
      shows('usage') && usage.length > 0 ? Text({ size: 'caption', dimColor: true }, usage.join(' · ')) : null,
      onRow(c, 'connectors') && connectors !== null && (connectors.connected.length > 0 || connectors.needsAuth.length > 0)
        ? Box({ flexDirection: 'row', columnGap: 1 },
          Text({ size: 'caption', dimColor: true }, m.connectors(connectors.connected.length)),
          connectors.needsAuth.length > 0 && Text({ size: 'caption', color: 'warning' }, `${m.needsAuth} ${connectors.needsAuth.join(', ')}`))
        : null,
    ].filter(one => one !== null)
    const hotkey = arranged.hotkeys.get(c.pid)
    const go = hasGo(c)
      ? Button({ variant: 'secondary' },
        hotkey === undefined ? m.goHandle : Text({ dimColor: true }, String(hotkey)),
        hotkey === undefined ? null : `${isTerminal ? ' ' : ' '}${m.goHandle}`)
      : null
    const path = onRow(c, 'path') && c.path !== '' ? Box({}, Text({ size: 'caption', dimColor: true, wrap: 'truncate-middle' }, c.path)) : null
    if (segments.length === 0 && go === null && path === null) return null

    return [
      (segments.length > 0 || go !== null) && Box(
        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', columnGap: 'md', rowGap: 'xs' },
        segments.length > 0 ? Box({ flexDirection: 'row', flexWrap: 'wrap', flexShrink: 1, columnGap: 'md' }, segments) : null,
        go,
      ),
      path,
    ]
  }

  const expandedDetail = c => {
    if (!opened.includes(c.pid)) return null
    const report = c.report
    const percent = report?.contextPercent ?? null
    const connectors = report?.connectors ?? null
    const branch = report?.branch ?? null
    const tasks = report?.tasks ?? []
    const mark = { running: GLYPHS.taskRunning.char, waiting: GLYPHS.taskWaiting.char, done: GLYPHS.done.char, failed: GLYPHS.taskFailed.char }
    const environment = [m.environment.local, c.isWorktree ? m.environment.worktree : null, c.isRemote ? m.environment.remote : null]
      .filter(Boolean).join(' · ')

    return Box({ flexDirection: 'column' },
      percent !== null && Box({ flexDirection: 'row', gap: 1 },
        Text({ size: 'caption', dimColor: true }, m.fields.context),
        Text({ size: 'caption', color: usageColor(percent) }, usageBar(percent, 10))),
      branch !== null && Box({}, Text({ size: 'caption', color: 'subtle', wrap: 'truncate-end' },
        [branchLabel(branch, c.path) || branch.name, branch.base === undefined ? null : m.versus(branch.base)].filter(Boolean).join(' · '))),
      Box({}, Text({ size: 'caption', dimColor: true, wrap: 'truncate-end' }, environment)),
      connectors !== null && (connectors.connected.length > 0 || connectors.needsAuth.length > 0) && Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 1 },
        Text({ size: 'caption', dimColor: true }, m.connectors(connectors.connected.length), connectors.connected.length > 0 ? `: ${connectors.connected.join(', ')}` : ''),
        connectors.needsAuth.length > 0 && Text({ size: 'caption', color: 'warning' }, `${m.needsAuth} ${connectors.needsAuth.join(', ')}`)),
      c.path !== '' && Box({}, Text({ size: 'caption', dimColor: true, wrap: 'truncate-middle' }, c.path)),
      tasks.length > 0 && Box({ flexDirection: 'column' }, tasks.slice(0, 5).map(one =>
        Text({ size: 'caption', dimColor: one.status === 'done', color: one.status === 'failed' ? 'error' : undefined, wrap: 'truncate-end' },
          `${mark[one.status] ?? '·'} ${one.kind === 'bash' ? m.taskKinds.bash : m.taskKinds.agent} ${one.label}`))),
    )
  }

  const body = c => [
    contextLine(c),
    c.report === null && c.status !== 'idle' && Text({ size: 'caption', dimColor: true }, m.basicStatus),
    metaStrip(c),
    expandedDetail(c),
  ]

  const longestWait = Math.max(0, ...waiting.map(c => (c.since === null ? 0 : now - c.since)))
  const breakdown = ['approval', 'question', 'errored', 'waiting']
    .map(kind => ({ kind, n: waiting.filter(c => kindOf(c) === kind).length }))
    .filter(one => one.n > 0)
    .map(one => `${m.kinds[one.kind]} ${one.n}`)

  const isAccountUrgent = rateLimits.some(one => one.percentUsed >= 95)
  const rateLabels = rateLimits.map(one => {
    const kind = rateKind(one.kind)
    return kind === null ? one.kind : m.account[kind]
  })
  const rateLabelWidth = Math.max(0, ...rateLabels.map(label => displayWidth(label)))
  const accountCard = rateLimits.length > 0
    ? Box({ flexDirection: 'column', borderStyle: 'round', borderDimColor: !isAccountUrgent, paddingX: cardPadX, paddingY: 'xs' },
      Text({ size: 'footnote', weight: 'semibold', dimColor: true }, m.account.title),
      rateLimits.map((one, index) => {
        const resetIn = Date.parse(one.resetsAt) - now
        const label = rateLabels[index] ?? one.kind
        return Box({ flexDirection: 'row', justifyContent: 'space-between' },
          Text({ size: 'caption', color: usageColor(one.percentUsed), mono: true, tabular: true },
            `${label}${' '.repeat(Math.max(0, rateLabelWidth - displayWidth(label)))} ${usageBar(one.percentUsed, 10)}`),
          resetIn > 0 && Text({ size: 'caption', dimColor: true, tabular: true }, m.account.resetsIn(shortAge(resetIn))))
      }))
    : null

  const viewButton = Button({ plain: true, dimColor: true }, `${m.view} ${GLYPHS.collapsed.char}`)
  const titleLine = (status, action) => Box({ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, Box({}, status), action)
  const waitingHeader = isHeader => Box({ flexDirection: 'column' },
    titleLine(Text({ size: 'heading', color: 'warning', weight: 'bold' }, `${GLYPHS.waiting.char} ${m.status.needYou(waiting.length)}`), isHeader ? viewButton : null),
    Box({}, Text({ size: 'caption', tabular: true }, [...breakdown, m.status.longest(shortAge(longestWait))].join(' · '))),
  )
  const unknownHeader = err => Box({ flexDirection: 'column', borderStyle: 'round', borderColor: 'warning', paddingX: 'sm' },
    titleLine(Text({ color: 'warning', weight: 'bold' }, m.header.unknown), null),
    Box({ flexDirection: 'column' }, Text({ size: 'footnote', wrap: 'wrap' }, m.readFailed, Text({ color: 'error' }, err.reason))),
    Box({ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
      Text({ size: 'caption', dimColor: true }, `${m.header.retry} · `),
      Link({ label: m.header.troubleshoot })),
  )
  const calmHeader = Box({ flexDirection: 'column' },
    titleLine(Text({ color: 'success', weight: 'semibold' }, m.header.none), viewButton),
    cards.length === 0 && Box({}, Text({ size: 'caption', dimColor: true }, m.header.noOthers)),
  )
  const waitingCards = waitingShown.map(c => Box(
    { flexDirection: 'column', borderStyle: 'bold', borderColor: c.status === 'errored' ? 'error' : 'warning', paddingX: cardPadX, paddingY: 'xs' },
    titleRow(c, cardWidth), body(c)))
  const busyGroup = busy.length > 0 && Box({ flexDirection: 'column', rowGap: 'xs' },
    Box({ flexDirection: 'row' }, Text({ size: 'footnote', weight: 'semibold' }, Text({ color: 'claude' }, GLYPHS.busy.char), ` ${m.groups.busy} ${busy.length}`)),
    busy.map(c => Box({ flexDirection: 'column', borderStyle: 'round', paddingX: cardPadX, paddingY: 'xs' }, titleRow(c, cardWidth), body(c))))
  const idleGroup = idle.length > 0 && Box({ flexDirection: 'column', rowGap: 'xs' },
    Box({ flexDirection: 'row' }, Button({ plain: true },
      Text({ size: 'footnote', weight: 'semibold', color: 'inactive' }, `${GLYPHS.idle.char} ${m.groups.idle} ${idle.length} ${GLYPHS.expanded.char}`))),
    Box({ flexDirection: 'column', rowGap: 'md' }, idle.map(c => opened.includes(c.pid)
      ? Box({ flexDirection: 'column', borderStyle: 'round', borderDimColor: true, paddingX: cardPadX, paddingY: 'xs' }, titleRow(c, cardWidth), body(c))
      : Box({ flexDirection: 'column', paddingX: 'md' }, titleRow(c, cardWidth), body(c)))))
  const urgentAccount = isAccountUrgent ? accountCard : null
  const top = error !== null
    ? [Box({ flexDirection: 'row', justifyContent: 'flex-end' }, viewButton), unknownHeader(error), urgentAccount]
    : waiting.length > 0
      ? [Box({ flexDirection: 'column', rowGap: 'xs' }, waitingHeader(true), urgentAccount, waitingCards)]
      : [calmHeader, urgentAccount]

  return {
    // register.tsx 的 titleOf
    title: waiting.length > 0 ? `Switchboard · ${GLYPHS.waiting.char}${waiting.length}` : 'Switchboard',
    tree: Box({ flexDirection: 'column', rowGap: 'md' }, top, busyGroup, idleGroup, !isAccountUrgent && accountCard),
  }
}

// ── 樣式：兩種畫法共用的 class ─────────────────────────────────────────────
const COLOR = {
  warning: 'warn', claude: 'claude', inactive: 'inactive', error: 'err', success: 'ok', merged: 'merged',
  diffAdded: 'add', diffRemoved: 'del', subtle: 'subtle', text: 'text',
}
const styleOf = (props, parent = {}) => ({
  color: props.color ?? parent.color,
  dim: props.dimColor ?? parent.dim,
  size: props.size ?? parent.size,
  weight: props.weight ?? parent.weight,
  italic: props.italic ?? parent.italic,
  strike: props.strikethrough ?? parent.strike,
  mono: props.mono ?? parent.mono,
  tabular: props.tabular ?? parent.tabular,
})
const classOf = style => [
  style.color && COLOR[style.color], style.dim && 'dim', style.size && `sz-${style.size}`, style.weight && `w-${style.weight}`,
  style.italic && 'i', style.strike && 'strike', style.mono && 'mono', style.tabular && 'tab',
].filter(Boolean).join(' ')
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ── Desktop 畫法：Box 轉成 flexbox ────────────────────────────────────────
// Space 的 step 在 Desktop 是多少 px 沒有實測值（ticket 12），這裡用 xs 4、sm 8、md 12；數字是格數，一格約 6px
const PX = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 }
const px = space => (typeof space === 'number' ? space * 6 : PX[space] ?? 0)

const deskHtml = (node, parent = {}) => {
  if (typeof node === 'string') return esc(node)
  const p = node.props
  if (node.type === 'Text') {
    const style = styleOf(p, parent)
    const wrap = p.wrap === 'truncate-end' || p.wrap === 'truncate-middle' ? ' trunc' : p.wrap === 'wrap' ? ' wrap' : ''
    return `<span class="${classOf(style)}${wrap}">${node.children.map(one => deskHtml(one, style)).join('')}</span>`
  }
  if (node.type === 'Button') {
    const kind = p.plain ? 'plain' : p.variant ?? 'secondary'
    const style = styleOf({ dimColor: p.dimColor }, parent)
    return `<button class="btn ${kind}${p.shrink ? ' shrink' : ''} ${classOf(style)}">${node.children.map(one => deskHtml(one, style)).join('')}</button>`
  }
  if (node.type === 'Link') return `<a class="link">${esc(p.label)}</a>`
  const css = [
    `flex-direction:${p.flexDirection ?? 'row'}`,
    p.flexWrap && `flex-wrap:${p.flexWrap}`,
    p.justifyContent && `justify-content:${p.justifyContent}`,
    p.alignItems && `align-items:${p.alignItems}`,
    p.flexShrink !== undefined && `flex-shrink:${p.flexShrink}`,
    (p.rowGap ?? p.gap) !== undefined && `row-gap:${px(p.rowGap ?? p.gap)}px`,
    (p.columnGap ?? p.gap) !== undefined && `column-gap:${px(p.columnGap ?? p.gap)}px`,
    `padding:${px(p.paddingY ?? 0)}px ${px(p.paddingX ?? 0)}px`,
  ].filter(Boolean).join(';')
  const border = p.borderStyle ? ` border-${p.borderStyle} ${p.borderColor ? `bc-${COLOR[p.borderColor]}` : p.borderDimColor ? 'bc-dim' : ''}` : ''
  return `<div class="box${border}" style="${css}">${node.children.map(one => deskHtml(one, parent)).join('')}</div>`
}

const DESK_CSS = `
  :root { --page:#faf9f5; --pane:#ffffff; --bar:#f1efe8; --t:#141413; --dim:#87867f; --subtle:#5c5b55; --ln:#d3d0c6; --ln-dim:#e7e5de;
    --warn:#b8650f; --claude:#c4623f; --ok:#3f7d3a; --err:#c0392b; --add:#3f7d3a; --del:#c0392b; --merged:#7c4dbc;
    --inactive:#a3a199; --link:#2f6fd6; --btn:#f5f4ee; --btn-line:#d3d0c6; }
  * { box-sizing: border-box; margin: 0; }
  body { background: var(--page); color: var(--t); font: 13px/1.45 -apple-system, "PingFang TC", "Hiragino Sans", "Apple SD Gothic Neo", sans-serif; }
  .shot { display: inline-flex; gap: 16px; padding: 16px; align-items: flex-start; }
  .col { display: flex; flex-direction: column; gap: 16px; }
  .caption-top { font-size: 12px; color: var(--dim); margin: 0 0 6px 2px; }
  .pane { width: 412px; background: var(--pane); border: 1px solid var(--ln); border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,.06); }
  .pane > .bar { display: flex; justify-content: space-between; padding: 9px 14px; border-bottom: 1px solid var(--ln); font-weight: 600; background: var(--bar); }
  .pane > .bar .x { color: var(--dim); font-weight: 400; }
  .pane > .body { padding: 12px; }
  .box { display: flex; min-width: 0; }
  .border-round { border: 1px solid var(--ln); border-radius: 8px; }
  .border-bold { border: 2px solid var(--ln); border-radius: 8px; }
  .bc-warn { border-color: var(--warn); } .bc-err { border-color: var(--err); } .bc-dim { border-color: var(--ln-dim); }
  .trunc { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; display: block; }
  .wrap { white-space: pre-wrap; overflow-wrap: anywhere; }
  span, button { white-space: pre; }
  .sz-heading { font-size: 15px; } .sz-footnote { font-size: 12px; } .sz-caption { font-size: 11.5px; }
  .w-bold { font-weight: 700; } .w-semibold { font-weight: 600; } .w-medium { font-weight: 500; } .w-regular { font-weight: 400; }
  .i { font-style: italic; } .strike { text-decoration: line-through; }
  .mono { font-family: ui-monospace, "SF Mono", Menlo, "DejaVu Sans Mono", monospace; } .tab { font-variant-numeric: tabular-nums; }
  .warn { color: var(--warn); } .claude { color: var(--claude); } .inactive { color: var(--inactive); } .err { color: var(--err); }
  .ok { color: var(--ok); } .merged { color: var(--merged); } .add { color: var(--add); } .del { color: var(--del); }
  .subtle { color: var(--subtle); } .text { color: var(--t); } .dim { color: var(--dim); }
  .link { color: var(--link); font-size: 11.5px; text-decoration: none; }
  .btn { font: inherit; color: inherit; background: none; border: 0; padding: 0; text-align: left; display: inline-flex; align-items: center; min-width: 0; }
  .btn.dim { color: var(--dim); }
  .btn.shrink { overflow: hidden; } .btn.shrink > span { overflow: hidden; text-overflow: ellipsis; }
  .btn.secondary, .btn.primary { border: 1px solid var(--btn-line); background: var(--btn); border-radius: 6px; padding: 3px 10px; font-size: 12px; }
`

const deskPane = ({ title, tree }) =>
  `<div class="pane"><div class="bar"><span>${esc(title)}</span><span class="x">✕</span></div><div class="body">${deskHtml(tree)}</div></div>`
const deskPage = (locale, inner) =>
  `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><style>${DESK_CSS}</style></head><body><div class="shot">${inner}</div></body></html>`

const board = locale => deskPage(locale, deskPane(boardTree(locale, 'main', 'desktop')))
const states = locale => {
  const [errored, calm, unknown] = SAMPLE[locale].panels
  const panel = (caption, scene) => `<div><div class="caption-top">${esc(caption)}</div>${deskPane(boardTree(locale, scene, 'desktop'))}</div>`
  return deskPage(locale, `<div class="col">${panel(errored, 'errored')}${panel(unknown, 'unknown')}</div>${panel(calm, 'calm')}`)
}

// ── 終端機畫法：排成等寬格 ────────────────────────────────────────────────
// Space 的 step 在終端機是格數（claude-code.d.ts 的 Space）：橫向 xs、sm 1 格，md 2；縱向 xs、sm 0 行，md 1 行
const ACROSS = { xs: 1, sm: 1, md: 2, lg: 3, xl: 4 }
const DOWN = { xs: 0, sm: 0, md: 1, lg: 1, xl: 2 }
const across = space => (typeof space === 'number' ? space : ACROSS[space] ?? 0)
const down = space => (typeof space === 'number' ? space : DOWN[space] ?? 0)
const COLUMNS = 80

const seg = (text, cls = '') => ({ text, cls })
const widthOfLine = line => line.reduce((sum, one) => sum + displayWidth(one.text), 0)
const blank = width => [seg(' '.repeat(Math.max(0, width)))]
const padTo = (line, width) => [...line, ...blank(width - widthOfLine(line))]
/** 一行截到 width 格，超出時結尾換成 … */
const clipLine = (line, width) => {
  if (widthOfLine(line) <= width) return line
  const kept = []
  let used = 0
  for (const one of line) {
    const w = displayWidth(one.text)
    if (used + w <= width - 1) { kept.push(one); used += w; continue }
    const cut = clipToWidth(one.text, width - used)
    if (cut !== '') kept.push({ ...one, text: cut })
    break
  }
  return kept
}
/** 依字元換行 */
const wrapLine = (line, width) => {
  const lines = []
  let current = []
  let used = 0
  for (const one of line) {
    let buffer = ''
    for (const char of one.text) {
      const w = displayWidth(char)
      if (used + w > width) {
        if (buffer !== '') current.push({ ...one, text: buffer })
        lines.push(current)
        current = []
        used = 0
        buffer = ''
      }
      buffer += char
      used += w
    }
    if (buffer !== '') current.push({ ...one, text: buffer })
  }
  if (current.length > 0) lines.push(current)
  return lines
}
const middleClip = (text, width) => {
  if (displayWidth(text) <= width) return text
  const chars = [...text]
  const half = Math.floor((width - 1) / 2)
  let head = ''
  let tail = ''
  for (const char of chars) { if (displayWidth(head + char) > half) break; head += char }
  for (const char of chars.reverse()) { if (displayWidth(char + tail) > width - 1 - displayWidth(head)) break; tail = char + tail }
  return `${head}…${tail}`
}

const textSegs = (node, style) => {
  if (typeof node === 'string') return [seg(node, termClass(style))]
  if (node.type === 'Text') {
    const mine = styleOf(node.props, style)
    return node.children.flatMap(one => textSegs(one, mine))
  }
  return []
}
const termClass = style => [
  style.color && COLOR[style.color], style.dim && 'dim', (style.weight === 'bold' || style.weight === 'semibold') && 'b',
  style.italic && 'i', style.strike && 'strike',
].filter(Boolean).join(' ')

/** 不換行時的寬度 */
const natural = node => {
  if (typeof node === 'string') return displayWidth(node)
  const p = node.props
  if (node.type === 'Text') return widthOfLine(textSegs(node, {}))
  if (node.type === 'Button') return node.children.reduce((sum, one) => sum + natural(one), 0) + (p.plain ? 0 : 4)
  if (node.type === 'Link') return displayWidth(p.label)
  const frame = (p.borderStyle ? 2 : 0) + 2 * across(p.paddingX ?? 0)
  const widths = node.children.map(natural)
  if ((p.flexDirection ?? 'row') === 'column') return frame + Math.max(0, ...widths)
  return frame + widths.reduce((a, b) => a + b, 0) + across(p.columnGap ?? p.gap ?? 0) * Math.max(0, widths.length - 1)
}

const BORDERS = { bold: '┏━┓┃┗┛', round: '╭─╮│╰╯' }

/** 一個節點排在 width 格寬裡：回傳每一行（都補到 width 格） */
const layout = (node, width, style = {}) => {
  if (typeof node === 'string' || node.type === 'Text') {
    const segs = textSegs(node, style)
    const wrap = typeof node === 'string' ? undefined : node.props.wrap
    if (wrap === 'truncate-end') return [padTo(clipLine(segs, width), width)]
    if (wrap === 'truncate-middle') return [padTo([{ ...segs[0], text: middleClip(segs.map(one => one.text).join(''), width) }], width)]
    return wrapLine(segs, width).map(line => padTo(line, width))
  }
  const p = node.props
  if (node.type === 'Button') {
    const mine = styleOf({ dimColor: p.dimColor }, style)
    const inner = node.children.flatMap(one => textSegs(one, mine))
    const segs = p.plain ? inner : [seg('[ ', 'btn'), ...inner, seg(' ]', 'btn')]
    return [padTo(clipLine(segs, width), width)]
  }
  if (node.type === 'Link') return [padTo(clipLine([seg(p.label, 'link')], width), width)]

  const border = p.borderStyle ? 1 : 0
  const padX = across(p.paddingX ?? 0)
  const padY = down(p.paddingY ?? 0)
  const inner = width - 2 * border - 2 * padX
  const isColumn = (p.flexDirection ?? 'row') === 'column'
  let lines = isColumn ? column(node.children, inner, down(p.rowGap ?? p.gap ?? 0)) : row(node, inner)
  lines = [...Array(padY).fill([]), ...lines, ...Array(padY).fill([])].map(line => [...blank(padX), ...padTo(line, inner), ...blank(padX)])
  if (!border) return lines
  const [tl, hz, tr, vt, bl, br] = BORDERS[p.borderStyle]
  const cls = p.borderColor ? COLOR[p.borderColor] : p.borderDimColor ? 'line-dim' : 'line'
  return [
    [seg(`${tl}${hz.repeat(width - 2)}${tr}`, cls)],
    ...lines.map(line => [seg(vt, cls), ...line, seg(vt, cls)]),
    [seg(`${bl}${hz.repeat(width - 2)}${br}`, cls)],
  ]
}

const column = (children, width, gap) =>
  children.flatMap((child, i) => [...(i === 0 ? [] : Array(gap).fill(blank(width))), ...layout(child, width)])

/** 橫向：可換行時依寬度分成幾行，每一行再依 justifyContent 排 */
const row = (node, width) => {
  const p = node.props
  const gap = across(p.columnGap ?? p.gap ?? 0)
  const items = node.children.map(child => ({ child, width: Math.min(width, natural(child)) }))
  const groups = []
  if (p.flexWrap === 'wrap') {
    let current = []
    let used = 0
    for (const item of items) {
      if (current.length > 0 && used + gap + item.width > width) { groups.push(current); current = []; used = 0 }
      used += (current.length > 0 ? gap : 0) + item.width
      current.push(item)
    }
    if (current.length > 0) groups.push(current)
  } else {
    groups.push(items)
  }
  const rowGap = down(p.rowGap ?? p.gap ?? 0)
  return groups.flatMap((group, i) => [...(i === 0 ? [] : Array(rowGap).fill(blank(width))), ...oneRow(group, width, gap, p.justifyContent)])
}

const oneRow = (group, width, gap, justify) => {
  const widths = group.map(one => one.width)
  const total = () => widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1)
  // 放不下時縮第一個（標題那一側）
  if (total() > width) widths[0] = Math.max(0, widths[0] - (total() - width))
  const free = width - total()
  const gaps = widths.map((_, i) => (i === 0 ? 0 : gap + (justify === 'space-between' ? Math.floor(free / (widths.length - 1)) + (i <= free % (widths.length - 1) ? 1 : 0) : 0)))
  const lead = justify === 'flex-end' ? free : 0
  const blocks = group.map((one, i) => layout(one.child, widths[i]))
  const height = Math.max(...blocks.map(block => block.length))
  return Array.from({ length: height }, (_, r) => [
    ...blank(lead),
    ...blocks.flatMap((block, i) => [...blank(gaps[i]), ...(block[r] ?? blank(widths[i]))]),
  ]).map(line => padTo(line, width))
}

const cells = line =>
  line.map(one => [...one.text].map(char =>
    `<span class="c${displayWidth(char) === 2 ? ' w' : ''}${/[─-╿]/.test(char) ? ' bx' : ''}${one.cls ? ` ${one.cls}` : ''}">${char === ' ' ? '&nbsp;' : esc(char)}</span>`).join('')).join('')

const terminal = locale => {
  const body = COLUMNS - 4
  // 引擎畫的 Pane 外框：只開一個 Pane 時不畫標題，右上角是關閉標記；下面是 Claude Code 的輸入框
  const pane = [
    [seg(`╭${'─'.repeat(COLUMNS - 6)} ✕ ─╮`, 'frame')],
    ...layout(boardTree(locale, 'main', 'terminal').tree, body).map(line => [seg('│', 'frame'), seg(' '), ...padTo(line, body), seg(' '), seg('│', 'frame')]),
    [seg(`╰${'─'.repeat(COLUMNS - 2)}╯`, 'frame')],
  ]
  const prompt = [[seg('─'.repeat(COLUMNS), 'frame')], [seg('> ', 'dim'), seg(' ', 'cursor')], [seg('─'.repeat(COLUMNS), 'frame')]]
  // 中日韓字不指定文泉驛：指定了 Chromium 就不合成粗體（每一格寬度固定，換字型也不會跑掉）
  const cjk = locale === 'ja' ? '"Hiragino Sans", "IPAGothic"' : locale === 'ko' ? '"Apple SD Gothic Neo"' : '"PingFang TC"'

  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><style>
  :root { --cw: 8px; --lh: 18px; --bg:#1f1e1d; --bar:#2b2a28; --text:#e8e6dc; --dim:#8f8d86; --subtle:#b3b1a8; --line:#5c5a55; --line-dim:#403f3b;
    --warn:#e8a33d; --claude:#d97757; --ok:#7bbf6a; --err:#e5736b; --add:#7bbf6a; --del:#e5736b; --merged:#b294e8; --inactive:#7a7872; --link:#8fb3ff; }
  * { box-sizing: border-box; margin: 0; }
  body { background: #faf9f5; display: inline-block; }
  .shot { display: inline-block; padding: 16px; }
  .term { display: inline-block; background: var(--bg); border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.18); }
  .bar { background: var(--bar); height: 28px; display: flex; align-items: center; gap: 7px; padding: 0 11px; font: 12px -apple-system, "DejaVu Sans", sans-serif; color: var(--dim); }
  .dot { width: 11px; height: 11px; border-radius: 50%; background: #5c5a55; }
  .bar .name { flex: 1; text-align: center; margin-right: 50px; }
  .screen { padding: 10px 12px 12px; font: 13px/var(--lh) Menlo, "DejaVu Sans Mono", ${cjk}, monospace; color: var(--text); }
  .r { height: var(--lh); white-space: nowrap; }
  .c { display: inline-block; width: var(--cw); text-align: center; overflow: visible; }
  .c.w { width: calc(var(--cw) * 2); font-size: 15px; }
  /* 框線字拉高到整列，上下列的直線才接得起來 */
  .c.bx { transform: scaleY(1.4); }
  .b { font-weight: 700; } .i { font-style: italic; } .strike { text-decoration: line-through; } .dim { color: var(--dim); }
  .warn { color: var(--warn); } .claude { color: var(--claude); } .ok { color: var(--ok); } .err { color: var(--err); }
  .add { color: var(--add); } .del { color: var(--del); } .merged { color: var(--merged); } .inactive { color: var(--inactive); }
  .subtle { color: var(--subtle); } .text { color: var(--text); } .link { color: var(--link); }
  .line, .frame { color: var(--line); } .line-dim { color: var(--line-dim); }
  .btn { color: var(--text); } .cursor { background: var(--text); }
  </style></head><body><div class="shot"><div class="term">
  <div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="name">web-app — claude</span></div>
  <div class="screen">${[...pane, [], ...prompt].map(line => `<div class="r">${cells(line)}</div>`).join('')}</div>
  </div></div></body></html>`
}

mkdirSync(out, { recursive: true })
for (const locale of Object.keys(SAMPLE)) {
  writeFileSync(join(out, `board.${locale}.html`), board(locale))
  writeFileSync(join(out, `terminal.${locale}.html`), terminal(locale))
  writeFileSync(join(out, `states.${locale}.html`), states(locale))
}
console.log('ok')

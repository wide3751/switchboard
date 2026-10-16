import { expect, mock, test } from 'claude-code/testing'
import type { On, RenderElement } from 'claude-code'
import {
  HOME,
  DIR,
  PANE,
  SESSIONS,
  T0,
  REPORTS,
  GIT_STATUS,
  ok,
  fakeWorld,
  asPerson,
  put,
  report,
  BAND,
  engineBand,
  putTerminals,
  type Status,
  type World,
} from './world'

test('Desktop 的 /switchboard:open 打開 Pane，計數只算存活且 waiting 的 Session，並隨 polling 更新', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 101, 'waiting')
  put(world, 102, 'waiting', false) // pid 已死
  put(world, 103, 'busy')

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  const ran = await $.command.run(SESSIONS)
  expect(world.opened.at(-1)).toBe('switchboard')
  expect(ran.text).toContain('已打開監看視窗。')

  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ key: 'count' }))?.text).toBe('▲ 1 個需要你處理')
  // 存活的 Session 各一張卡片，需要你處理排在最前；pid 已死的不出現
  const cards = (await ui.findAll({ type: 'Box' })).filter(one => one.key?.startsWith('card-'))
  expect(cards.map(one => one.key)).toEqual(['card-101', 'card-103'])
  expect(cards[0]?.text).toContain('等你')
  expect(cards[0]?.text).toContain('proj-101')
  // 待處理的分區標題併入狀態列，狀態列細分種類
  expect(await ui.find({ key: 'section-waiting' })).toBeUndefined()
  expect((await ui.find({ key: 'summary' }))?.text).toContain('等你 1')
  expect((await ui.find({ key: 'section-busy' }))?.text).toBe('工作中 1')

  // 103 進入權限提示，下一次 polling 反映
  put(world, 103, 'waiting')
  await clock.advance(3_000)
  expect((await ui.find({ key: 'count' }))?.text).toBe('▲ 2 個需要你處理')
  // 分頁標題帶上待處理數量
  expect(world.titles.at(-1)).toBe('Switchboard · 2')

  // 全部處理完，或程序結束
  put(world, 101, 'idle')
  put(world, 103, 'waiting', false)
  await clock.advance(3_000)
  expect((await ui.find({ key: 'count' }))?.text).toContain('✓ 無待處理')

  await ui.unmount()
})

test('CLI 的 /switchboard:open 打開 Pane 並開始 polling', async ($, on) => {
  const clock = mock.clock(on)
  const world = fakeWorld(on, ['terminal'])
  put(world, 201, 'waiting')

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  const ran = await $.command.run(SESSIONS)

  expect(ran.text).toContain('已打開監看視窗。')
  expect(world.opened).toEqual(['switchboard'])
  await clock.advance(3_000)
  expect(world.scans).toBeGreaterThan(0)
})

test('CLI 的 Pane 標題也帶上等你計數，並隨 polling 更新', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  const world = fakeWorld(on, ['terminal'])
  put(world, 211, 'waiting')
  put(world, 212, 'busy')

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  expect(world.titles.at(-1)).toBe('Switchboard · 1')

  // 212 進入權限提示，下一次 polling 反映到分頁標題
  put(world, 212, 'waiting')
  await clock.advance(3_000)
  expect(world.titles.at(-1)).toBe('Switchboard · 2')

  // 全部處理完，標題回到不帶數量
  put(world, 211, 'idle')
  put(world, 212, 'idle')
  await clock.advance(3_000)
  expect(world.titles.at(-1)).toBe('Switchboard')
})

test('沒有打開 Pane 的 Session 不做 polling（自動顯示關閉時）', async ($, on) => {
  const clock = mock.clock(on)
  const world = fakeWorld(on, ['desktop'], {}, { view: { autoOpen: false } })
  put(world, 301, 'waiting')

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await clock.advance(10_000)

  expect(world.opened).toEqual([])
  expect(world.scans).toBe(0)
})

test('關掉 Pane 之後停止 polling', async ($, on) => {
  const clock = mock.clock(on)
  const world = fakeWorld(on, ['desktop'])
  put(world, 401, 'waiting')

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.advance(3_000)
  const before = world.scans
  expect(before).toBeGreaterThan(0)

  // 使用者按下 Pane 的關閉鈕
  world.panes.delete('switchboard')
  await clock.advance(30_000)
  expect(world.scans).toBe(before)
})

test('Session 啟動時寫出自己的狀態回報：模型、分支、用量', async ($, on) => {
  mock.clock(on, { now: 5_000 })
  const world = fakeWorld(on, ['terminal'])

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

  const written = JSON.parse(world.files.get(`${REPORTS}/me.json`) ?? 'null')
  expect(written).toMatchObject({
    sessionId: 'me',
    model: 'claude-opus-5-5',
    branch: { name: 'feature/cards', ahead: 2, behind: 1, changed: 2, insertions: 15, deletions: 2, base: 'origin/main' },
    connectors: { connected: ['chrome-devtools'], needsAuth: ['figma'] },
    pr: { number: 12, state: 'OPEN', url: 'https://github.com/o/r/pull/12' },
    contextPercent: 42,
    costUsd: 1.5,
    turns: 3,
  })
})

test('卡片依密度顯示位置、分支、進度、目前動作；詳細密度再加模型與用量條；欄位可以單獨開關', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 61_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 501, 'busy')
  report(world, 501, {
    model: 'claude-sonnet-5-5',
    branch: { name: 'main', ahead: 1, behind: 0, changed: 3, insertions: 12, deletions: 3 },
    progress: { done: 3, total: 7, current: '寫測試' },
    activity: '$ npm test',
    turnStartedAt: T0 + 1_000,
    contextPercent: 85,
    costUsd: 0.25,
    turns: 4,
  })
  put(world, 502, 'idle')
  report(world, 502, { branch: { name: 'idle-branch', ahead: 0, behind: 0, changed: 0 } })

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  // 標準密度：時間、位置、分支、進度、目前動作
  const card = async () => (await ui.find({ key: 'card-501' }))?.text ?? ''
  expect(await card()).toContain('1m')
  expect(await card()).toContain('proj-501 · main ↑1 ±3')
  expect(await card()).toContain('3/7 · 寫測試 · $ npm test')
  // 中繼資料帶：變更行數與 ctx 百分比；用量條只在展開時出現
  expect((await ui.find({ key: 'changes' }))?.text).toBe('+12−3')
  expect((await ui.find({ key: 'ctx' }))?.text).toBe('ctx 85%')
  expect(await ui.find({ key: 'context-bar' })).toBeUndefined()
  // 閒置的 Session 只有一行：標題與時間，不顯示分支
  expect((await ui.find({ key: 'card-502' }))?.text).not.toContain('idle-branch')

  // 詳細密度：多了模型與用量條
  await ui.press({ key: 'settings' })
  await ui.press({ key: 'density-detailed' })
  expect(await card()).toContain('Sonnet 5.5')
  expect(await card()).toContain('$0.25 · 4 輪')
  // 展開明細才有 Context 用量條
  await ui.press({ key: 'expand-501' })
  expect((await ui.find({ key: 'context-bar' }))?.text).toBe('Context▰▰▰▰▰▰▰▰▰▱ 85%')
  await ui.press({ key: 'expand-501' })

  // 單獨關掉模型 → 自訂
  await ui.press({ key: 'field-model' })
  expect(await card()).not.toContain('Sonnet 5.5')
  expect((await ui.find({ key: 'view-panel' }))?.text).toContain('自訂')

  // 閒置區可以收合
  await ui.press({ key: 'toggle-idle' })
  expect(await ui.find({ key: 'card-502' })).toBeUndefined()

  await ui.unmount()
})

test('點 Desktop Session 的卡片，用 deep link 切過去；點目前這個什麼都不做', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 601, 'idle')
  world.files.set(
    `${DIR}/601.json`,
    JSON.stringify({ pid: 601, sessionId: 's-601', hostSessionId: 'local_abc', status: 'idle', cwd: '/work/x' }),
  )
  put(world, 602, 'busy')
  world.files.set(`${DIR}/602.json`, JSON.stringify({ pid: 602, sessionId: 'me', status: 'busy', cwd: '/work/me' }))

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  // 第一下點擊只讓 Pane 取得焦點：焦點落在標題上就跳轉
  await $.ui.focus({
    component: 'Pane',
    requestId: 'switchboard',
    plugin: 'switchboard',
    element: 'jump-601',
    origin: { kind: 'person' },
  })
  expect(world.links).toEqual(['claude://claude.ai/epitaxy/local_abc'])
  // 緊接著的第二下按下不會再跳一次
  await ui.press({ key: 'jump-601' })
  expect(world.links).toEqual(['claude://claude.ai/epitaxy/local_abc'])
  expect((await ui.find({ key: 'card-602' }))?.text).toContain('目前')
  await ui.press({ key: 'jump-602' })
  expect(world.links).toHaveLength(1)

  await ui.unmount()
})

test('長標題依 Pane 寬度截斷，時間仍在；頁首摘要顯示各狀態數量', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 300_000 })
  const world = fakeWorld(on, ['desktop'])
  world.files.set(
    `${DIR}/701.json`,
    JSON.stringify({
      pid: 701,
      sessionId: 's-701',
      status: 'idle',
      cwd: '/work/x',
      name: '評估放寬 parse_plan 在 AppMCP 後截斷計畫的長度限制與相關測試',
      statusUpdatedAt: T0,
    }),
  )
  world.alive.add(701)
  put(world, 702, 'busy')

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop', props: { ...PANE.props, bodyColumns: 40 } })

  const row = (await ui.find({ key: 'card-701' }))?.text ?? ''
  expect(row).toContain('…')
  expect(row).toContain('5m')
  expect(row).not.toContain('相關測試')
  expect((await ui.find({ key: 'summary' }))?.text).toBe('工作中 1 · 閒置 1')

  await ui.unmount()
})

test('閒置與工作中的欄位分開設定', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 61_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 801, 'busy')
  report(world, 801, { branch: { name: 'busy-branch', ahead: 0, behind: 0, changed: 0 } })
  put(world, 802, 'idle')
  report(world, 802, { branch: { name: 'idle-branch', ahead: 0, behind: 0, changed: 0 } })

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text ?? ''

  // 預設：工作中顯示分支，閒置不顯示
  expect(await text('card-801')).toContain('busy-branch')
  expect(await text('card-802')).not.toContain('idle-branch')

  // 切到「閒置」那組，打開分支；工作中不受影響
  await ui.press({ key: 'settings' })
  await ui.press({ key: 'group-idle' })
  await ui.press({ key: 'field-branch' })
  expect(await text('card-802')).toContain('idle-branch')
  expect(await text('card-801')).toContain('busy-branch')

  // 切到「工作中」那組，關掉分支；閒置不受影響
  await ui.press({ key: 'group-busy' })
  await ui.press({ key: 'field-branch' })
  expect(await text('card-801')).not.toContain('busy-branch')
  expect(await text('card-802')).toContain('idle-branch')

  await ui.unmount()
})

test('情境行：待核准顯示想執行的指令、待回答顯示問題與選項、出錯中止算待處理、閒置顯示最後回覆', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 901, 'waiting')
  report(world, 901, { approval: '$ rm -rf node_modules' })
  put(world, 902, 'waiting')
  report(world, 902, { question: { text: '要用哪個方案？', options: ['方案 A', '方案 B'] } })
  put(world, 903, 'idle')
  report(world, 903, { turnError: 'API 過載（529）' })
  put(world, 904, 'idle')
  report(world, 904, { lastReply: '要我直接開 PR 嗎？' })

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text ?? ''

  // 出錯中止也算進待處理
  expect(await text('count')).toBe('▲ 3 個需要你處理')
  expect(await text('card-901')).toContain('▲ 核准')
  expect(await text('card-901')).toContain('$ rm -rf node_modules')
  expect(await text('card-902')).toContain('▲ 回答')
  expect(await text('card-902')).toContain('？ 要用哪個方案？')
  expect(await text('card-902')).toContain('方案 A / 方案 B')
  expect(await text('card-903')).toContain('✕ 出錯')
  expect(await text('card-903')).toContain('API 過載（529）')
  expect(await text('card-904')).toContain('「要我直接開 PR 嗎？」')

  await ui.unmount()
})

test('Desktop 回合結尾提問框留下的問題算待處理；回合結束後 Session 閒置也一樣，下一個回合開始時清掉', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  // 別的 Session：回合已結束、紀錄是閒置，但回報裡留著結尾提問
  put(world, 905, 'idle')
  report(world, 905, { question: { text: '要怎麼合併？', options: ['只合 logo', '照原樣合併'] } })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: '' }))
  on('turn.complete', () => ({ text: '' }))

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text ?? ''
  expect(await text('count')).toBe('▲ 1 個需要你處理')
  expect(await text('card-905')).toContain('？ 要怎麼合併？')
  expect(await text('card-905')).toContain('只合 logo / 照原樣合併')
  await ui.unmount()

  // 這個 Session 自己：回合結尾呼叫 wrap_up 提問，回合結束後回報還留著問題
  const mine = `${REPORTS}/me.json`
  await $.turn.start({ turnId: 't1', prompt: '合併提交' })
  await $.tool.call({
    tool: 'mcp__ccd_turn__wrap_up',
    tool_use_id: 'w1',
    recap: '還沒合併。',
    ask: '要怎麼合併？',
    actions: [{ label: '只合 logo' }, { action: 'commit' }],
  })
  await $.turn.complete({ turnId: 't1', answer: '', reason: 'done' })
  expect(JSON.parse(world.files.get(mine) ?? '{}').question).toEqual({
    text: '要怎麼合併？',
    options: ['只合 logo', 'commit'],
  })

  // 使用者回覆，下一個回合開始：問題清掉
  await $.turn.start({ turnId: 't2', prompt: '只合 logo' })
  expect(JSON.parse(world.files.get(mine) ?? '{}').question).toBeNull()
})

test('背景任務徽章、展開明細列出任務、帳號用量卡片顯示 rate limit 與總花費', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 951, 'busy')
  report(world, 951, {
    model: 'claude-opus-5-5',
    tasks: [
      { kind: 'agent', label: 'Explore·找呼叫點', status: 'running' },
      { kind: 'bash', label: '$ npm run dev', status: 'running' },
      { kind: 'agent', label: 'Plan·設計方案', status: 'failed' },
    ],
    costUsd: 1.5,
    rateLimits: [
      { kind: 'five_hour', percentUsed: 72, resetsAt: new Date(T0 + 60_000 + 2 * 3_600_000).toISOString() },
      { kind: 'seven_day', percentUsed: 21 },
    ],
  })

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text ?? ''

  expect(await text('tasks-951')).toBe('⟳2!1')
  // 全局資訊在獨立的帳號用量卡片
  expect(await text('rate-fiveHour')).toBe('5h ▰▰▰▰▰▰▰▱▱▱ 72%2h 後重置')
  expect(await text('rate-week')).toBe('週 ▰▰▱▱▱▱▱▱▱▱ 21%')
  expect(await text('header')).not.toContain('72%')
  // 自動：有 rate limit 就當訂閱制，不顯示花費；切到 API 才顯示
  expect(await ui.find({ key: 'total-cost' })).toBeUndefined()
  await ui.press({ key: 'settings' })
  await ui.press({ key: 'billing-api' })
  expect(await text('total-cost')).toBe('所有 Session 花費 $1.50')
  await ui.press({ key: 'billing-subscription' })
  expect(await ui.find({ key: 'total-cost' })).toBeUndefined()
  await ui.press({ key: 'settings' })
  // 收合時沒有任務清單與模型
  expect(await ui.find({ key: 'task-list' })).toBeUndefined()

  await ui.press({ key: 'expand-951' })
  expect(await text('task-list')).toContain('Agent Explore·找呼叫點')
  expect(await text('task-list')).toContain('Bash $ npm run dev')
  expect(await text('card-951')).toContain('Opus 5.5')

  await ui.press({ key: 'expand-951' })
  expect(await ui.find({ key: 'task-list' })).toBeUndefined()

  await ui.unmount()
})

test('環境、連接器、PR；已有 PR 點了開啟頁面', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  world.files.set(
    `${DIR}/961.json`,
    JSON.stringify({
      pid: 961,
      sessionId: 's-961',
      status: 'busy',
      cwd: '/Users/x/Projects/switchboard/.claude/worktrees/start-cf4efb',
      bridgeSessionId: 'bridge-1',
      hostSessionId: 'local_961',
      statusUpdatedAt: T0,
    }),
  )
  world.alive.add(961)
  report(world, 961, {
    branch: { name: 'claude/start-cf4efb', ahead: 7, behind: 0, changed: 0, insertions: 2189, deletions: 26, base: 'origin/main' },
    connectors: { connected: ['chrome-devtools'], needsAuth: ['figma'] },
    pr: { number: 12, state: 'OPEN', url: 'https://github.com/o/r/pull/12' },
  })

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text ?? ''

  expect(await text('changes')).toBe('+2189−26')
  expect(await text('pr')).toBe('#12 ↗')
  await ui.press({ key: 'pr-961' })
  expect(world.links).toEqual(['https://github.com/o/r/pull/12'])

  // 詳細密度才有環境與連接器
  await ui.press({ key: 'expand-961' })
  expect(await text('environment')).toBe('本機 · Worktree · Remote Control')
  expect(await text('connectors')).toContain('連接器 1: chrome-devtools')
  expect(await text('connectors')).toContain('需驗證 figma')

  await ui.unmount()
})

test('Session 啟動時回報連接器與 PR', async ($, on) => {
  mock.clock(on, { now: 5_000 })
  const world = fakeWorld(on, ['terminal'])

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

  const written = JSON.parse(world.files.get(`${REPORTS}/me.json`) ?? 'null')
  expect(written.connectors).toEqual({ connected: ['chrome-devtools'], needsAuth: ['figma'] })
  expect(written.pr).toEqual({ number: 12, state: 'OPEN', url: 'https://github.com/o/r/pull/12' })
})

test('資安：刪除已結束 Session 的回報；hostSessionId 格式不對時不跳轉', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 971, 'idle')
  report(world, 971, {})
  world.files.set(`${REPORTS}/s-gone.json`, JSON.stringify({ sessionId: 's-gone', reportedAt: 1 }))
  world.files.set(`${REPORTS}/../escape.json`, '{}')
  world.files.set(
    `${DIR}/972.json`,
    JSON.stringify({ pid: 972, sessionId: 's-972', hostSessionId: 'local_x/../evil?y=1', status: 'idle', cwd: '/w' }),
  )
  world.alive.add(972)

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()

  // 只刪掉不屬於任何 session 紀錄的回報
  expect(world.removed).toEqual([`${REPORTS}/s-gone.json`])
  expect(world.files.has(`${REPORTS}/s-971.json`)).toBe(true)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'jump-972' })
  expect(world.links).toEqual([])

  await ui.unmount()
})

test('多國語言：自動依 macOS 系統語言，也可以在檢視面板切換', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  world.appleLanguages = '(\n    "ja-JP"\n)\n'
  put(world, 981, 'busy')

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  const ran = await $.command.run(SESSIONS)
  expect(ran.text).toBe('監視ウィンドウを開きました。')
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text ?? ''

  expect(await text('count')).toBe('✓ 対応が必要な項目はありません')
  expect(await text('section-busy')).toBe('作業中 1')

  await ui.press({ key: 'settings' })
  for (const [locale, header, busy] of [
    ['en', '✓ Nothing needs you', 'Working 1'],
    ['ko', '✓ 확인할 항목이 없습니다', '작업 중 1'],
    ['zh-CN', '✓ 没有待处理项目', '工作中 1'],
    ['zh-TW', '✓ 無待處理項目', '工作中 1'],
  ] as const) {
    await ui.press({ key: `locale-${locale}` })
    expect(await text('count')).toContain(header)
    expect(await text('section-busy')).toBe(busy)
  }

  await ui.unmount()
})

test('CLI 的監看視窗：清單、等你計數、檢視面板、展開、閒置收合都畫得出來，長標題依寬度截斷', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 300_000 })
  const world = fakeWorld(on, ['terminal'])
  put(world, 211, 'waiting')
  report(world, 211, { approval: '$ rm -rf dist' })
  put(world, 212, 'busy')
  report(world, 212, { progress: { done: 1, total: 4, current: '寫測試' }, contextPercent: 30 })
  world.files.set(
    `${DIR}/213.json`,
    JSON.stringify({
      pid: 213,
      sessionId: 's-213',
      status: 'idle',
      cwd: '/work/x',
      name: '評估放寬 parse_plan 在 AppMCP 後截斷計畫的長度限制與相關測試',
      statusUpdatedAt: T0,
    }),
  )
  world.alive.add(213)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, bodyColumns: 40 } })
  const text = async (key: string) => (await ui.find({ key }))?.text ?? ''

  expect(await text('count')).toBe('▲ 1 個需要你處理')
  expect(await text('card-211')).toContain('$ rm -rf dist')
  expect(await text('section-busy')).toBe('工作中 1')
  const row = await text('card-213')
  expect(row).toContain('…')
  expect(row).toContain('5m')
  expect(row).not.toContain('相關測試')

  // 檢視面板
  await ui.press({ key: 'settings' })
  expect(await text('view-panel')).toContain('所有 Desktop Session 都顯示')
  await ui.press({ key: 'settings' })

  // 展開明細
  await ui.press({ key: 'expand-212' })
  expect(await text('context-bar')).toContain('30%')

  // 閒置區收合
  await ui.press({ key: 'toggle-idle' })
  expect(await ui.find({ key: 'card-213' })).toBeUndefined()

  await ui.unmount()
})

test('CLI 的監看視窗：點 Desktop Session 用 deep link、點 CLI Session 顯示路徑、點目前這個不做事；焦點移動不跳轉', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  const toasts: string[] = []
  on('ui.toast', (_$, e) => {
    toasts.push(String(e.text))
    return { value: undefined }
  })
  world.files.set(
    `${DIR}/221.json`,
    JSON.stringify({ pid: 221, sessionId: 's-221', hostSessionId: 'local_abc', status: 'idle', cwd: '/work/desk' }),
  )
  world.alive.add(221)
  world.files.set(`${DIR}/222.json`, JSON.stringify({ pid: 222, sessionId: 's-222', status: 'idle', cwd: '/work/cli' }))
  world.alive.add(222)
  world.files.set(`${DIR}/223.json`, JSON.stringify({ pid: 223, sessionId: 'me', status: 'busy', cwd: '/work/me' }))
  world.alive.add(223)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  // 用鍵盤把焦點移過卡片標題：終端機不會因此跳轉
  for (const pid of [221, 222]) {
    await $.ui.focus({
      component: 'Pane',
      requestId: 'switchboard',
      plugin: 'switchboard',
      element: `jump-${pid}`,
      origin: { kind: 'person' },
    })
  }
  expect(world.links).toEqual([])
  expect(toasts).toEqual([])

  await ui.press({ key: 'jump-221' })
  expect(world.links).toEqual(['claude://claude.ai/epitaxy/local_abc'])
  await ui.press({ key: 'jump-222' })
  expect(toasts.at(-1)).toContain('/work/cli')
  await ui.press({ key: 'jump-223' })
  expect(world.links).toHaveLength(1)
  expect(toasts).toHaveLength(1)

  await ui.unmount()
})

test('CLI 關掉 Pane 之後停止 polling', async ($, on) => {
  const clock = mock.clock(on)
  const world = fakeWorld(on, ['terminal'])
  put(world, 231, 'waiting')

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.advance(3_000)
  const before = world.scans
  expect(before).toBeGreaterThan(0)

  world.panes.delete('switchboard')
  await clock.advance(30_000)
  expect(world.scans).toBe(before)
})

test('VS Code 擴充套件的 /switchboard:open 只回提示，不打開 Pane、不掃描', async ($, on) => {
  const clock = mock.clock(on)
  const world = fakeWorld(on, ['vscode'])
  put(world, 202, 'waiting')

  await $.session.start({ cwd: '/work', surface: 'vscode', isInteractive: true })
  const ran = await $.command.run(SESSIONS)

  // 提示說明可以在 Desktop 或終端機打開，不再只叫人到 Desktop
  expect(ran.text).toContain('Desktop')
  expect(ran.text).toContain('終端機')
  expect(ran.text).not.toContain('只在 Claude Desktop')
  await clock.advance(10_000)
  expect(world.opened).toEqual([])
  expect(world.scans).toBe(0)
})

test('多國語言：LANG 優先於 macOS 系統語言；不支援的提示也跟著語言', async ($, on) => {
  mock.clock(on)
  const world = fakeWorld(on, ['vscode'], { LANG: 'ko_KR.UTF-8' })

  await $.session.start({ cwd: '/work', surface: 'vscode', isInteractive: true })
  const ran = await $.command.run(SESSIONS)
  expect(ran.text).toContain('터미널')
  expect(ran.text).not.toContain('Claude Desktop에서만')
  expect(world.opened).toEqual([])
})

test('所有 Desktop Session 自動顯示監看視窗；在檢視面板可以關掉', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 991, 'idle')

  // 預設打開：Desktop Session 一啟動就有監看視窗
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await clock.settle()
  expect(world.opened).toEqual(['switchboard'])

  // 在檢視面板關掉這個設定，存進 store
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'settings' })
  expect((await ui.find({ key: 'auto-open' }))?.text).toContain('☑')
  await ui.press({ key: 'auto-open' })
  expect((await ui.find({ key: 'auto-open' }))?.text).toContain('☐')
  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface} 的檢視面板切換「所有 CLI Session 都顯示」：預設未勾選，存進設定，Desktop 的開關不受影響`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const world = fakeWorld(on, [surface])

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })
    const text = async (key: string) => (await ui.find({ key }))?.text ?? ''
    await ui.press({ key: 'settings' })
    expect(await text('auto-open-cli')).toBe('☐ 所有 CLI Session 都顯示')
    expect(await text('auto-open')).toBe('☑ 所有 Desktop Session 都顯示')

    await ui.press({ key: 'auto-open-cli' })
    expect(await text('auto-open-cli')).toBe('☑ 所有 CLI Session 都顯示')
    expect(await text('auto-open')).toBe('☑ 所有 Desktop Session 都顯示')
    expect(world.stored.get('view')).toMatchObject({ autoOpen: true, autoOpenCli: true })

    // Desktop 的開關也只改自己那一項
    await ui.press({ key: 'auto-open' })
    expect(world.stored.get('view')).toMatchObject({ autoOpen: false, autoOpenCli: true })
    await ui.unmount()
  })
}

test('「所有 CLI Session 都顯示」預設關閉：CLI Session 啟動不打開監看視窗、不掃描', async ($, on) => {
  const clock = mock.clock(on)
  const world = fakeWorld(on, ['terminal'])

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.advance(5_000)
  expect(world.opened).toEqual([])
  expect(world.scans).toBe(0)
})

test('「所有 CLI Session 都顯示」打開時，CLI Session 一啟動就打開監看視窗並開始 polling', async ($, on) => {
  const clock = mock.clock(on)
  const world = fakeWorld(on, ['terminal'], {}, { view: { autoOpenCli: true } })
  put(world, 241, 'waiting')

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.advance(3_000)
  expect(world.opened).toEqual(['switchboard'])
  expect(world.scans).toBeGreaterThan(0)
})

test('Desktop 的開關打開、CLI 的開關關閉時，CLI Session 啟動與回合結束都不自動打開', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { view: { autoOpen: true, autoOpenCli: false } })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.turn.start({ turnId: 't1', prompt: '繼續' })
  await $.turn.complete({ turnId: 't1', answer: '', reason: 'done' })
  await clock.advance(5_000)
  expect(world.opened).toEqual([])
  expect(world.scans).toBe(0)
})

test('CLI 的開關打開、Desktop 的開關關閉時，Desktop Session 啟動與回合結束都不自動打開', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'], {}, { view: { autoOpen: false, autoOpenCli: true } })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.turn.start({ turnId: 't1', prompt: '繼續' })
  await $.turn.complete({ turnId: 't1', answer: '', reason: 'done' })
  await clock.advance(5_000)
  expect(world.opened).toEqual([])
  expect(world.scans).toBe(0)
})

test('「所有 CLI Session 都顯示」打開後，已經開著的 CLI Session 在回合結束後補開', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  put(world, 251, 'waiting')
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(world.opened).toEqual([])

  // 在別的 Session 的檢視面板打開了這個開關
  world.stored.set('view', { autoOpenCli: true })
  await $.turn.start({ turnId: 't1', prompt: '繼續' })
  await $.turn.complete({ turnId: 't1', answer: '', reason: 'done' })
  await clock.advance(3_000)
  expect(world.opened).toEqual(['switchboard'])
  expect(world.scans).toBeGreaterThan(0)
})

test('CLI Session 手動關掉監看視窗後，回合結束不再自動打開；再次輸入指令才打開', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { view: { autoOpenCli: true } })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(world.opened).toEqual(['switchboard'])

  // 使用者按下 Pane 的關閉鈕
  world.panes.delete('switchboard')
  await clock.advance(3_000)
  await $.turn.start({ turnId: 't1', prompt: '繼續' })
  await $.turn.complete({ turnId: 't1', answer: '', reason: 'done' })
  await clock.advance(3_000)
  expect(world.opened).toEqual(['switchboard'])
  expect(world.panes.has('switchboard')).toBe(false)

  const before = world.scans
  await $.command.run(SESSIONS)
  expect(world.opened).toEqual(['switchboard', 'switchboard'])
  expect(world.panes.has('switchboard')).toBe(true)
  await clock.advance(3_000)
  expect(world.scans).toBeGreaterThan(before)
})

/** 輸入框上方的區域（AbovePrompt）。 */

test('監看視窗關著時，Desktop 輸入框上方有打開按鈕；按下就打開，開著時不顯示', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'], {}, { view: { autoOpen: false } })
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await clock.settle()
  expect(world.opened).toEqual([])

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await band.find({ key: 'open-board' }))?.text).toContain('打開監看視窗')
  await band.press({ key: 'open-board' })
  await clock.settle()
  expect(world.opened).toEqual(['switchboard'])
  expect(await band.find({ key: 'open-board' })).toBeUndefined()
  expect(await band.find({ key: 'engine-band' })).toBeDefined()
  await band.unmount()
})

test('CLI 的監看視窗關著時，輸入框上方也有打開按鈕；按下就打開並 polling，關掉後按鈕再出現', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  put(world, 241, 'waiting')
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(world.opened).toEqual([])

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await band.find({ key: 'open-board' }))?.text).toContain('▦ 打開監看視窗')
  await band.press({ key: 'open-board' })
  await clock.advance(3_000)
  expect(world.opened).toEqual(['switchboard'])
  expect(world.scans).toBeGreaterThan(0)
  // 打開後按鈕消失，換回引擎自己的內容
  expect(await band.find({ key: 'open-board' })).toBeUndefined()
  expect(await band.find({ key: 'engine-band' })).toBeDefined()

  // 使用者關掉監看視窗：停止 polling，按鈕再出現
  world.panes.delete('switchboard')
  await clock.advance(3_000)
  const after = world.scans
  expect((await band.find({ key: 'open-board' }))?.text).toContain('打開監看視窗')
  await clock.advance(10_000)
  expect(world.scans).toBe(after)
  await band.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface} 不自動打開、LANG 沒設時，啟動前就畫出的打開按鈕也跟著 macOS 系統語言`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const world = fakeWorld(on, [surface], {}, { view: { autoOpen: false, autoOpenCli: false } })
    world.appleLanguages = '(\n    "zh-Hant",\n    "en"\n)\n'
    engineBand(on)

    // 按鈕在 Session 啟動、偵測語言之前就畫出來
    const band = await $.ui.mount({ ...BAND, surface })
    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await clock.settle()
    expect(world.opened).toEqual([])
    expect((await band.find({ key: 'open-board' }))?.text).toBe('▦ 打開監看視窗')
    await band.unmount()
  })
}

test('檢視面板手動選的語言優先於系統語言：輸入框上方的按鈕也跟著', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  fakeWorld(on, ['terminal'], {}, { view: { locale: 'ja' } })
  engineBand(on)

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect((await band.find({ key: 'open-board' }))?.text).toBe('▦ 監視ウィンドウを開く')
  await band.unmount()
})

test('CLI 有提問框時不顯示打開按鈕；VS Code 擴充套件不顯示', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  fakeWorld(on, ['terminal'])
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()

  const survey = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true }, surface: 'terminal' })
  expect(await survey.find({ key: 'open-board' })).toBeUndefined()
  expect(await survey.find({ key: 'engine-band' })).toBeDefined()
  await survey.unmount()

  const vscode = await $.ui.mount({ ...BAND, surface: 'vscode' })
  expect(await vscode.find({ key: 'open-board' })).toBeUndefined()
  expect(await vscode.find({ key: 'engine-band' })).toBeDefined()
  await vscode.unmount()
})

test('終端機太窄時，自動打開的監看視窗沒畫出來：輸入框上方照樣有按鈕，也不掃描', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { view: { autoOpenCli: true } }, { isNarrow: true })
  put(world, 261, 'waiting')
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.advance(10_000)
  expect(world.opened).toEqual(['switchboard'])
  expect(world.placed.has('switchboard')).toBe(false)
  expect(world.scans).toBe(0)

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await band.find({ key: 'open-board' }))?.text).toContain('▦ 打開監看視窗')
  await band.unmount()
})

test('終端機太窄時，回合結束不把等待中的監看視窗當成已打開，也不當成使用者關掉', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { view: { autoOpenCli: true } }, { isNarrow: true })
  put(world, 262, 'waiting')
  engineBand(on)
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.advance(3_000)
  await $.turn.start({ turnId: 't1', prompt: '繼續' })
  await $.turn.complete({ turnId: 't1', answer: '', reason: 'done' })
  await clock.advance(10_000)
  expect(world.scans).toBe(0)
  expect(world.panes.has('switchboard')).toBe(true)

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await band.find({ key: 'open-board' }))?.text).toContain('▦ 打開監看視窗')
  await band.unmount()
})

test('終端機太窄時按下打開按鈕：Pane 畫出來、開始 polling、按鈕消失', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { view: { autoOpenCli: true } }, { isNarrow: true })
  put(world, 263, 'waiting')
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.advance(3_000)
  expect(world.scans).toBe(0)

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await asPerson(world, () => band.press({ key: 'open-board' }))
  await clock.advance(3_000)
  expect(world.placed.has('switchboard')).toBe(true)
  expect(world.scans).toBeGreaterThan(0)
  expect(await band.find({ key: 'open-board' })).toBeUndefined()
  expect(await band.find({ key: 'engine-band' })).toBeDefined()
  await band.unmount()
})

test('終端機變寬、引擎畫出等待中的監看視窗後，按鈕消失、開始 polling', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { view: { autoOpenCli: true } }, { isNarrow: true })
  put(world, 264, 'waiting')
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.advance(3_000)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await band.find({ key: 'open-board' }))?.text).toContain('▦ 打開監看視窗')
  expect(world.scans).toBe(0)

  // 終端機拉寬到門檻：引擎把等待中的 Pane 畫出來，下一次 polling 就看得到
  world.isNarrow = false
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await clock.advance(3_000)
  expect(world.scans).toBeGreaterThan(0)
  expect(await band.find({ key: 'open-board' })).toBeUndefined()
  expect(await band.find({ key: 'engine-band' })).toBeDefined()
  await ui.unmount()
  await band.unmount()
})

test('Session 啟動時在狀態回報記下所在的終端機', async ($, on) => {
  mock.clock(on, { now: 5_000 })
  const world = fakeWorld(on, ['terminal'], { TERM_PROGRAM: 'iTerm.app' })

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

  expect(JSON.parse(world.files.get(`${REPORTS}/me.json`) ?? 'null')).toMatchObject({ terminal: 'iTerm.app' })
})

/** 三個 CLI Session：iTerm、Terminal.app、Warp（不支援切分頁），各在自己的 tty。 */
for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface} 的監看視窗：點 iTerm／Terminal.app 的 CLI Session，依 tty 切到對應分頁；其他終端機顯示路徑`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const world = fakeWorld(on, [surface])
    const toasts: string[] = []
    on('ui.toast', (_$, e) => {
      toasts.push(String(e.text))
      return { value: undefined }
    })
    putTerminals(world)

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await asPerson(world, () => $.command.run(SESSIONS))
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })

    await ui.press({ key: 'jump-231' })
    await ui.press({ key: 'jump-232' })
    expect(world.scripts).toEqual([
      { app: 'iTerm2', tty: '/dev/ttys003' },
      { app: 'Terminal', tty: '/dev/ttys004' },
    ])
    expect(toasts).toEqual([])

    // Warp 不支援依 tty 切分頁：不跑腳本，顯示路徑
    await ui.press({ key: 'jump-233' })
    expect(world.scripts).toHaveLength(2)
    expect(toasts.at(-1)).toContain('/work/proj-233')

    await ui.unmount()
  })
}

test('找不到對應的終端機分頁時，顯示 Session 所在的資料夾', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  const toasts: string[] = []
  on('ui.toast', (_$, e) => {
    toasts.push(String(e.text))
    return { value: undefined }
  })
  putTerminals(world)
  world.isTabMissing = true

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await asPerson(world, () => $.command.run(SESSIONS))
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'jump-231' })
  expect(world.scripts).toEqual([{ app: 'iTerm2', tty: '/dev/ttys003' }])
  expect(toasts.at(-1)).toContain('/work/proj-231')

  await ui.unmount()
})

test('資安：沒有 tty 或 tty 格式不對時不跑 osascript', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  on('ui.toast', () => ({ value: undefined }))
  putTerminals(world)
  world.ttys.set(231, '??')
  world.ttys.set(232, 'ttys004"; do shell script "rm')

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await asPerson(world, () => $.command.run(SESSIONS))
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'jump-231' })
  await ui.press({ key: 'jump-232' })
  expect(world.scripts).toEqual([])

  await ui.unmount()
})

import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const HOME = '/Users/tester'
const DIR = `${HOME}/.claude/sessions`

const PANE = {
  plugin: 'switchboard',
  component: 'Pane',
  requestId: 'switchboard',
  props: {
    title: 'Sessions',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

/** 使用者在輸入框打 `/switchboard:on` 按下 Enter。 */
const SESSIONS = {
  command: 'switchboard:on',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 120 },
} as const

type Status = 'busy' | 'idle' | 'waiting'
type World = {
  /** 假的檔案系統：路徑 → 內容 */
  files: Map<string, string>
  alive: Set<number>
  opened: string[]
  /** 目前開著的 Pane */
  panes: Set<string>
  scans: number
  /** 用 open 打開過的連結 */
  links: string[]
}

/** 一個實際的時間點（毫秒） */
const T0 = 1_760_000_000_000

const REPORTS = `${HOME}/.claude/switchboard/reports`
const GIT_STATUS = '# branch.oid abc\n# branch.head feature/cards\n# branch.upstream origin/feature/cards\n# branch.ab +2 -1\n1 .M N... 100644 100644 100644 a b hooks/board.ts\n? notes.md\n'

const ok = (stdout: string, exitCode = 0) => ({
  value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
})

/** 假造引擎底下的世界：檔案、pid 存活結果、git、目前的介面，以及這個 Session 自己。 */
const fakeWorld = (on: On, surfaces: readonly ('terminal' | 'desktop')[]): World => {
  const world: World = {
    files: new Map(),
    alive: new Set(),
    opened: [],
    panes: new Set(),
    scans: 0,
    links: [],
  }

  mock.env(on, { HOME })
  mock.store(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: surfaces }))
  on('session.id', () => ({ value: 'me' }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.turns', () => ({ value: 3 }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200_000, percent: 42 }, rateLimits: [], cost: { usd: 1.5 } },
  }))
  on('ui.panes', () => ({
    value: [...world.panes].map(id => ({
      id,
      title: 'Sessions',
      isShown: true,
      isFocused: false,
      isPlaced: true,
    })),
  }))
  on('ui.open', (_$, e) => {
    world.opened.push(e.id)
    world.panes.add(e.id)

    return { value: { isPlaced: true as const } }
  })
  on('fs.list', (_$, e) => {
    if (e.path === DIR) world.scans += 1
    const names = [...world.files.keys()]
      .filter(path => path.startsWith(`${e.path}/`))
      .map(path => path.slice(e.path.length + 1))

    return {
      value: names.map(name => ({ name, kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })),
    }
  })
  on('fs.read', (_$, e) => {
    const text = world.files.get(e.path)
    if (text === undefined) throw new Error(`ENOENT ${e.path}`)

    return { value: text }
  })
  on('fs.write', (_$, e) => {
    world.files.set(e.path, e.text)

    return { value: undefined }
  })
  on('process.run', (_$, e) => {
    if (e.argv[0] === 'git' && e.argv[1] === 'diff') return ok('10\t2\thooks/board.ts\n-\t-\tlogo.png\n5\t0\tREADME.md\n')
    if (e.argv[0] === 'git') return ok(GIT_STATUS)
    if (e.argv[0] === 'open') {
      world.links.push(e.argv[1] ?? '')
      return ok('')
    }
    expect(e.argv.slice(0, 4)).toEqual(['ps', '-o', 'pid=', '-p'])
    const found = (e.argv[4] ?? '').split(',').map(Number).filter(pid => world.alive.has(pid))

    return ok(found.map(pid => `  ${pid}\n`).join(''), found.length === 0 ? 1 : 0)
  })

  return world
}

const put = (world: World, pid: number, status: Status, isAlive = true) => {
  world.files.set(
    `${DIR}/${pid}.json`,
    JSON.stringify({ pid, sessionId: `s-${pid}`, status, cwd: `/work/proj-${pid}`, statusUpdatedAt: T0 }),
  )
  if (isAlive) world.alive.add(pid)
  else world.alive.delete(pid)
}

/** 另一個 Session 寫出的狀態回報。 */
const report = (world: World, pid: number, fields: Record<string, unknown>) => {
  world.files.set(`${REPORTS}/s-${pid}.json`, JSON.stringify({ sessionId: `s-${pid}`, reportedAt: 1, ...fields }))
}

test('Desktop 的 /switchboard:on 打開 Pane，計數只算存活且 waiting 的 Session，並隨 polling 更新', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 101, 'waiting')
  put(world, 102, 'waiting', false) // pid 已死
  put(world, 103, 'busy')

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  const ran = await $.command.run(SESSIONS)
  expect(world.opened).toEqual(['switchboard'])
  expect(ran.text).toContain('已打開監看視窗。')

  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ key: 'count' }))?.text).toBe('▲ 1 個 Session 待處理')
  // 存活的 Session 各一張卡片，需要你處理排在最前；pid 已死的不出現
  const cards = (await ui.findAll({ type: 'Box' })).filter(one => one.key?.startsWith('card-'))
  expect(cards.map(one => one.key)).toEqual(['card-101', 'card-103'])
  expect(cards[0]?.text).toContain('等你')
  expect(cards[0]?.text).toContain('proj-101')
  expect((await ui.find({ key: 'section-waiting' }))?.text).toBe('需要你處理 1')
  expect((await ui.find({ key: 'section-busy' }))?.text).toBe('工作中 1')

  // 103 進入權限提示，下一次 polling 反映
  put(world, 103, 'waiting')
  await clock.advance(3_000)
  expect((await ui.find({ key: 'count' }))?.text).toBe('▲ 2 個 Session 待處理')

  // 全部處理完，或程序結束
  put(world, 101, 'idle')
  put(world, 103, 'waiting', false)
  await clock.advance(3_000)
  expect((await ui.find({ key: 'count' }))?.text).toBe('✓ 無待處理項目')

  await ui.unmount()
})

test('CLI 的 /switchboard:on 不打開任何畫面，只回提示', async ($, on) => {
  const clock = mock.clock(on)
  const world = fakeWorld(on, ['terminal'])
  put(world, 201, 'waiting')

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  const ran = await $.command.run(SESSIONS)

  expect(ran.text).toContain('請到 Desktop')
  await clock.advance(10_000)
  expect(world.opened).toEqual([])
  expect(world.scans).toBe(0)
})

test('沒有打開 Pane 的 Session 不做 polling', async ($, on) => {
  const clock = mock.clock(on)
  const world = fakeWorld(on, ['desktop'])
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
    branch: { name: 'feature/cards', ahead: 2, behind: 1, changed: 2, insertions: 15, deletions: 2 },
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
  expect(await card()).not.toContain('ctx')
  // 變更行數：+新增 −刪除
  expect((await ui.find({ key: 'changes' }))?.text).toBe('+12−3行')
  // 閒置的 Session 只有一行：標題與時間，不顯示分支
  expect((await ui.find({ key: 'card-502' }))?.text).not.toContain('idle-branch')

  // 詳細密度：多了模型與用量條
  await ui.press({ key: 'settings' })
  await ui.press({ key: 'density-detailed' })
  expect(await card()).toContain('Sonnet 5.5')
  expect(await card()).toContain('ctx ▰▰▰▰▰▰▰▱ 85%')
  expect(await card()).toContain('$0.25 · 4 輪')

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
  expect((await ui.find({ key: 'summary' }))?.text).toBe('執行中 1 · 閒置 1')

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
  expect(await text('count')).toBe('▲ 3 個 Session 待處理')
  expect(await text('card-901')).toContain('待核准')
  expect(await text('card-901')).toContain('$ rm -rf node_modules')
  expect(await text('card-902')).toContain('待回答')
  expect(await text('card-902')).toContain('？ 要用哪個方案？')
  expect(await text('card-902')).toContain('方案 A / 方案 B')
  expect(await text('card-903')).toContain('出錯')
  expect(await text('card-903')).toContain('✕ API 過載（529）')
  expect(await text('card-904')).toContain('「要我直接開 PR 嗎？」')

  await ui.unmount()
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

  expect(await text('tasks-951')).toBe('⚙2✕1')
  // 全局資訊在獨立的帳號用量卡片
  expect(await text('rate-5h')).toBe('5h ▰▰▰▰▰▰▰▱▱▱ 72%2h 後重置')
  expect(await text('rate-週')).toBe('週 ▰▰▱▱▱▱▱▱▱▱ 21%')
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

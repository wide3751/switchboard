import { expect, mock, test } from 'claude-code/testing'
import { DIR, PANE, SESSIONS, T0, fakeWorld, put, report } from './world'

const EN = { LANG: 'en_US.UTF-8' }

test('英文：基本狀態的需要你處理標成 Needs you，不用 GLOSSARY 避免的 Waiting', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'], EN)
  put(world, 1201, 'waiting')

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text ?? ''

  expect(await text('card-1201')).toContain('▲ Needs you ')
  expect(await text('summary')).toContain('Needs you 1')
  expect(await text('header')).not.toContain('Waiting')
  expect(await text('card-1201')).not.toContain('Waiting')

  await ui.unmount()
})

test('英文：回合數分單複數', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'], EN)
  put(world, 1211, 'busy')
  report(world, 1211, { turns: 1 })
  put(world, 1212, 'busy')
  report(world, 1212, { turns: 4 })

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text ?? ''
  await ui.press({ key: 'settings' })
  await ui.press({ key: 'density-detailed' })

  expect(await text('card-1211')).toContain('1 turn')
  expect(await text('card-1211')).not.toContain('1 turns')
  expect(await text('card-1212')).toContain('4 turns')

  await ui.unmount()
})

for (const [locale, env, asked, quoted] of [
  ['en', EN, '? Which plan?', '“Shall I open the PR?”'],
  ['ko', { LANG: 'ko_KR.UTF-8' }, '? Which plan?', '“Shall I open the PR?”'],
  ['zh-TW', {}, '？ Which plan?', '「Shall I open the PR?」'],
] as const) {
  test(`${locale}：問題前的問號與最後回覆的引號用這個語言的寫法`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 + 60_000 })
    const world = fakeWorld(on, ['desktop'], env)
    put(world, 1221, 'waiting')
    report(world, 1221, { question: { text: 'Which plan?', options: ['A', 'B'] } })
    put(world, 1222, 'idle')
    report(world, 1222, { lastReply: 'Shall I open the PR?' })

    await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    const text = async (key: string) => (await ui.find({ key }))?.text ?? ''

    expect(await text('card-1221')).toContain(asked)
    expect(await text('card-1222')).toContain(quoted)

    await ui.unmount()
  })
}

test('英文：Context 用量、背景任務的種類、環境都用介面文字，Remote Control 只有一個名字', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'], EN)
  world.files.set(
    `${DIR}/1231.json`,
    JSON.stringify({
      pid: 1231,
      sessionId: 's-1231',
      status: 'busy',
      cwd: '/Users/x/Projects/switchboard/.claude/worktrees/start-cf4efb',
      bridgeSessionId: 'bridge-1',
      statusUpdatedAt: T0,
    }),
  )
  world.alive.add(1231)
  report(world, 1231, {
    contextPercent: 85,
    tasks: [
      { kind: 'agent', label: 'Explore·find callers', status: 'running' },
      { kind: 'bash', label: '$ npm run dev', status: 'running' },
    ],
  })

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text ?? ''
  await ui.press({ key: 'settings' })
  await ui.press({ key: 'field-environment' })
  await ui.press({ key: 'settings' })

  expect(await text('ctx')).toBe('Context 85%')
  expect(await text('meta')).toContain('Worktree · Remote Control')

  await ui.press({ key: 'expand-1231' })
  expect(await text('context-bar')).toBe('Context▰▰▰▰▰▰▰▰▰▱ 85%')
  expect(await text('environment')).toBe('This computer · Worktree · Remote Control')
  expect(await text('task-list')).toContain('Subagent Explore·find callers')
  expect(await text('task-list')).toContain('Bash $ npm run dev')
  expect(await text('task-list')).not.toContain('Agent Explore')

  await ui.unmount()
})

test('日文：Context 用量的標籤和欄位名稱一致', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'], { LANG: 'ja_JP.UTF-8' })
  put(world, 1232, 'busy')
  report(world, 1232, { contextPercent: 42 })

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await ui.find({ key: 'ctx' }))?.text).toBe('コンテキスト 42%')

  await ui.unmount()
})

for (const [locale, env, label] of [
  ['en', EN, '◌ Unknown'],
  ['zh-TW', {}, '◌ 未知'],
] as const) {
  test(`${locale}：狀態不明的 Session 除了 ◌ 還有文字標籤`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 + 60_000 })
    const world = fakeWorld(on, ['desktop'], env)
    world.files.set(
      `${DIR}/1241.json`,
      JSON.stringify({ pid: 1241, sessionId: 's-1241', status: 'compacting', cwd: '/work/proj-1241', statusUpdatedAt: T0 }),
    )
    world.alive.add(1241)

    await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

    expect((await ui.find({ key: 'card-1241' }))?.text).toContain(`${label}proj-1241`)

    await ui.unmount()
  })
}

test('繁中：需要你處理只有一種說法；檢視面板選分組的那一列叫「套用到」', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 1251, 'waiting')

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text ?? ''

  expect(await text('count')).toBe('▲ 1 個需要你處理')
  expect(await text('card-1251')).toContain('▲ 需要你處理 ')
  expect(await text('summary')).toContain('需要你處理 1')
  await ui.press({ key: 'settings' })
  expect(await text('view-panel')).toContain('套用到需要你處理工作中閒置')
  for (const word of ['待處理', '等你']) {
    expect(await text('header')).not.toContain(word)
    expect(await text('card-1251')).not.toContain(word)
    expect(await text('view-panel')).not.toContain(word)
  }

  await ui.unmount()
})

test('指令打開的監看視窗還沒畫出來時，回覆不夾帶引擎的原始 reason', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], EN, {}, { isNarrow: true })

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  const ran = await $.command.run(SESSIONS)

  expect(world.opened).toContain('switchboard')
  expect(ran.text).toContain('The board is open but not shown yet.')
  expect(ran.text).not.toContain('narrow')
  expect(ran.text).not.toContain('columns')
})

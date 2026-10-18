import { expect, mock, test } from 'claude-code/testing'
import { PANE, SESSIONS, T0, fakeWorld, put, report } from './world'

const mount = async ($: Parameters<Parameters<typeof test>[1]>[0], clock: { settle: () => Promise<void> }) => {
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text

  return { ui, text }
}

test('工作中卡片的標題列下方，每個執行中的背景任務一列，只有標題', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 1301, 'busy')
  report(world, 1301, {
    tasks: [
      { kind: 'agent', label: 'Explore·找呼叫點', status: 'running' },
      { kind: 'bash', label: '$ npm run dev', status: 'running' },
      { kind: 'agent', label: 'Plan·設計方案', status: 'waiting' },
      { kind: 'agent', label: 'Review·看 diff', status: 'failed' },
      { kind: 'bash', label: '$ make', status: 'done' },
    ],
  })

  const { ui, text } = await mount($, clock)

  expect(await text('subtask-1301-0')).toBe('↳ 找呼叫點')
  expect(await text('subtask-1301-1')).toBe('↳ $ npm run dev')
  expect(await text('subtask-1301-2')).toBeUndefined()
  expect(await text('subtasks-1301')).not.toContain('設計方案')
  expect(await text('subtasks-1301')).not.toContain('Explore')
  // 執行中的已經一列一列列出來，標題列不再重複 ↻；等待中和失敗照舊
  expect(await text('tasks-1301')).toBe('⏸︎1!1')

  await ui.unmount()
})

test('最多 3 列子卡片，其餘收成 +n', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 1311, 'busy')
  report(world, 1311, {
    tasks: ['a', 'b', 'c', 'd', 'e'].map(name => ({ kind: 'bash', label: `$ ${name}`, status: 'running' })),
  })

  const { ui, text } = await mount($, clock)

  expect(await text('subtask-1311-2')).toBe('↳ $ c')
  expect(await text('subtask-1311-3')).toBeUndefined()
  expect(await text('subtasks-more-1311')).toBe('↳ +2 個')

  await ui.unmount()
})

test('回合結束但背景任務還在跑的 Session 也有子卡片', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 1321, 'idle')
  report(world, 1321, { tasks: [{ kind: 'bash', label: '$ sleep 120', status: 'running' }] })

  const { ui, text } = await mount($, clock)

  expect(await text('subtask-1321-0')).toBe('↳ $ sleep 120')

  await ui.unmount()
})

test('待處理卡片不畫子卡片，標題列照舊顯示 ↻', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 1331, 'waiting')
  report(world, 1331, { tasks: [{ kind: 'agent', label: 'Explore·找呼叫點', status: 'running' }] })

  const { ui, text } = await mount($, clock)

  expect(await text('subtasks-1331')).toBeUndefined()
  expect(await text('tasks-1331')).toBe('↻1')

  await ui.unmount()
})

test('展開卡片時改由展開明細列出任務，子卡片不重複', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 1341, 'busy')
  report(world, 1341, { tasks: [{ kind: 'agent', label: 'Explore·找呼叫點', status: 'running' }] })

  const { ui, text } = await mount($, clock)
  expect(await text('subtasks-1341')).toBeDefined()

  await ui.press({ key: 'expand-1341' })
  expect(await text('subtasks-1341')).toBeUndefined()
  expect(await text('task-list')).toContain('Subagent Explore·找呼叫點')

  await ui.unmount()
})

test('工作中分區沒勾背景任務欄位時，不畫子卡片', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const fields = ['time', 'location']
  const world = fakeWorld(on, ['desktop'], {}, {
    view: {
      fields: { waiting: fields, busy: fields, idle: fields },
      isIdleCollapsed: false,
      billing: 'auto',
      locale: 'zh-TW',
      autoOpen: false,
      autoOpenCli: false,
    },
  })
  put(world, 1351, 'busy')
  report(world, 1351, { tasks: [{ kind: 'bash', label: '$ sleep 120', status: 'running' }] })

  const { ui, text } = await mount($, clock)

  expect(await text('subtasks-1351')).toBeUndefined()

  await ui.unmount()
})

test('Subagent 沒有描述時，子卡片照原樣顯示整個 label，不會是空白', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 1361, 'busy')
  report(world, 1361, {
    tasks: [
      { kind: 'agent', label: 'Explore·', status: 'running' },
      { kind: 'agent', label: 'Plan·undefined', status: 'running' },
    ],
  })

  const { ui, text } = await mount($, clock)

  expect(await text('subtask-1361-0')).toBe('↳ Explore·')
  expect(await text('subtask-1361-1')).toBe('↳ Plan·undefined')

  await ui.unmount()
})

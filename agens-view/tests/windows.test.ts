import { expect, mock, test } from 'claude-code/testing'
import { BAND, PANE, SESSIONS, T0, engineBand, fakeWorld, put, putSelf } from './world'

test('Windows 沒有 HOME 也沒有 ps：從 USERPROFILE 找 sessions 資料夾，用 tasklist 看存活，看得到 Session 狀態', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  // Windows 原生環境：沒有 HOME，家目錄在 USERPROFILE
  const world = fakeWorld(on, ['desktop'], { HOME: undefined, OS: 'Windows_NT', USERPROFILE: '/Users/tester' })
  putSelf(world, 900)
  put(world, 101, 'waiting')

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text ?? ''

  expect(await text('summary')).not.toContain('/.claude/sessions')
  expect(await text('count')).toBe('▲ 1 個待處理')

  await ui.unmount()
})

test('Windows 上 HOME 和 USERPROFILE 都有時，照 Claude Code 用 USERPROFILE', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'], { HOME: '/c/msys-home', OS: 'Windows_NT', USERPROFILE: '/Users/tester' })
  putSelf(world, 900)
  put(world, 101, 'waiting')

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await ui.find({ key: 'count' }))?.text).toBe('▲ 1 個待處理')

  await ui.unmount()
})

test('macOS 上掃描不為了判斷是不是 Windows 去跑 uname', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  put(world, 101, 'waiting')
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await clock.advance(30_000)
  await band.unmount()

  expect(world.lightScans).toBeGreaterThan(0)
  expect(world.commands.filter(argv => argv[0] === 'uname')).toEqual([])
})

import { expect, mock, test } from 'claude-code/testing'
import { PANE, SESSIONS, T0, fakeWorld, put, putSelf } from './world'

test('Windows 沒有 HOME、只有 USERPROFILE 時，從 USERPROFILE 找 sessions 資料夾', async ($, on) => {
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

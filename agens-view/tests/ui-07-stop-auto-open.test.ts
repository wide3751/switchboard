import { expect, mock, test } from 'claude-code/testing'
import { BAND, SESSIONS, T0, engineBand, fakeWorld, putSelf } from './world'

// 「不再自動打開」按鈕（ui-consensus/07）：toast 放不了按鈕，所以畫在輸入框上方、打開按鈕旁邊。
// 只在這個 Session 剛被手動關掉、而且自動打開開著時出現；下一次打開或回合結束後消失

const NEVER = 'stop-auto-open'

test('Desktop 手動關掉監看視窗後，打開按鈕旁出現「不再自動打開」；按下就關掉 Desktop 的自動打開', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  putSelf(world, 900)
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await clock.settle()
  expect(world.opened).toEqual(['switchboard'])

  // 使用者按下 Pane 的關閉鈕
  world.panes.delete('switchboard')
  await clock.advance(3_000)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await band.find({ key: 'open-board' }))?.text).toBe('▦ 打開監看視窗')
  expect((await band.find({ key: NEVER }))?.text).toBe('不再自動打開')

  await band.press({ key: NEVER })
  await clock.settle()
  expect(world.stored.get('view')).toMatchObject({ autoOpen: false })
  expect(await band.find({ key: NEVER })).toBeUndefined()
  // 打開按鈕還在
  expect(await band.find({ key: 'open-board' })).toBeDefined()
  await band.unmount()
})

test('CLI 開了自動打開時，「不再自動打開」關掉的是 CLI 的開關，Desktop 的不動', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { view: { autoOpenCli: true } })
  putSelf(world, 900)
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  world.panes.delete('switchboard')
  await clock.advance(3_000)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await band.press({ key: NEVER })
  await clock.settle()

  expect(world.stored.get('view')).toMatchObject({ autoOpen: true, autoOpenCli: false })
  expect(await band.find({ key: NEVER })).toBeUndefined()
  await band.unmount()
})

test('沒有開自動打開時，手動關掉監看視窗不出現「不再自動打開」', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  putSelf(world, 900)
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  world.panes.delete('switchboard')
  await clock.advance(3_000)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(await band.find({ key: 'open-board' })).toBeDefined()
  expect(await band.find({ key: NEVER })).toBeUndefined()
  await band.unmount()
})

test('沒被手動關掉過（啟動時就沒打開）時不出現「不再自動打開」', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { view: { autoOpenCli: true } }, { isNarrow: true })
  putSelf(world, 900)
  engineBand(on)

  // 終端機太窄：自動打開的監看視窗還沒畫出來，按鈕照樣顯示
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.advance(3_000)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(await band.find({ key: 'open-board' })).toBeDefined()
  expect(await band.find({ key: NEVER })).toBeUndefined()
  await band.unmount()
})

test('回合結束後「不再自動打開」消失', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  putSelf(world, 900)
  engineBand(on)
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await clock.settle()
  world.panes.delete('switchboard')
  await clock.advance(3_000)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ key: NEVER })).toBeDefined()

  await $.turn.start({ turnId: 't1', text: '繼續' })
  await $.turn.complete({ turnId: 't1', answer: '', durationMs: 1_000, isAborted: false, reason: 'answer' })
  await clock.settle()
  expect(await band.find({ key: NEVER })).toBeUndefined()
  // 手動關掉過，回合結束也不自動打開；設定沒有被改
  expect(world.opened).toEqual(['switchboard'])
  expect(world.stored.get('view')).not.toMatchObject({ autoOpen: false })
  await band.unmount()
})

test('下一次打開監看視窗後「不再自動打開」消失', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { view: { autoOpenCli: true } })
  putSelf(world, 900)
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  world.panes.delete('switchboard')
  await clock.advance(3_000)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ key: NEVER })).toBeDefined()

  // 終端機變窄之後才按打開：監看視窗還沒畫出來，輸入框上方的按鈕留著，看得到「不再自動打開」已經消失
  world.isNarrow = true
  world.placed.delete('switchboard')
  await band.press({ key: 'open-board' })
  await clock.settle()
  expect(await band.find({ key: 'open-board' })).toBeDefined()
  expect(await band.find({ key: NEVER })).toBeUndefined()
  await band.unmount()
})

test('別的 Session 關掉了自動打開：15 秒內「不再自動打開」消失', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  putSelf(world, 900)
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await clock.settle()
  world.panes.delete('switchboard')
  await clock.advance(3_000)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ key: NEVER })).toBeDefined()

  world.stored.set('view', { autoOpen: false })
  await clock.advance(15_000)
  expect(await band.find({ key: NEVER })).toBeUndefined()
  expect(await band.find({ key: 'open-board' })).toBeDefined()
  await band.unmount()
})

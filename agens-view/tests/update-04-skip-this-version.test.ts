import { expect, mock, test } from 'claude-code/testing'
import { BAND, PANE, SESSIONS, T0, engineBand, fakeWorld } from './world'

// 這版略過（update-check/04）：略過的版本記在 store，所有 Session 共用；更高的版本出現才再提示

const MINUTE = 60_000
/** 別的 Session 剛檢查過，看到 1.3.0（已安裝的是 1.2.0） */
const SEEN_NEWER = { updateCheckedAt: T0, updateLatest: '1.3.0' }

/** label 裡至少有一個字母或漢字：終端機用 tab 移到它時念得出來 */
const hasWords = (label: unknown) => typeof label === 'string' && /\p{L}/u.test(label)

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：按「這版略過」，新版提示和打開按鈕上的 ⇡ 新版 一起消失`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const world = fakeWorld(on, [surface], {}, { view: { autoOpen: false, autoOpenCli: false }, ...SEEN_NEWER })
    engineBand(on)

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })
    const skip = await ui.find({ key: 'update-skip' })
    expect(skip?.type).toBe('Button')
    expect(skip?.text).toBe('這版略過')
    // 終端機用 tab 移過去、enter 按下；Desktop 的 label 就是畫面上的文字
    expect(surface === 'terminal' ? hasWords(skip?.props.label) : skip?.props.label === skip?.text).toBe(true)

    await ui.press({ key: 'update-skip' })
    expect(await ui.find({ key: 'update-notice' })).toBeUndefined()
    expect(world.stored.get('updateSkipped')).toBe('1.3.0')
    await ui.unmount()

    world.panes.delete('switchboard')
    await clock.advance(3_000)
    const band = await $.ui.mount({ ...BAND, surface })
    expect((await band.find({ key: 'open-board' }))?.text).toBe('▦ 打開監看視窗')
    await band.unmount()
  })
}

test('別的 Session 按了「這版略過」：監看視窗 3 秒內、打開按鈕 15 秒內跟著消失', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'], {}, SEEN_NEWER)
  engineBand(on)

  // 這個 Session 的監看視窗開著（Desktop 預設自動打開）
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ key: 'update-version' }))?.text).toBe('⇡ 新版 1.3.0')

  world.stored.set('updateSkipped', '1.3.0')
  await clock.advance(3_000)
  expect(await ui.find({ key: 'update-notice' })).toBeUndefined()
  await ui.unmount()

  // 監看視窗關著：輕量掃描時跟著消失
  world.stored.delete('updateSkipped')
  world.panes.delete('switchboard')
  await clock.advance(3_000)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await band.find({ key: 'open-board' }))?.text).toBe('⇡ 新版 · ▦ 打開')
  world.stored.set('updateSkipped', '1.3.0')
  await clock.advance(15_000)
  expect((await band.find({ key: 'open-board' }))?.text).toBe('▦ 打開監看視窗')
  await band.unmount()
})

test('公布的仍是略過的那一版：重新開 Session 也不顯示', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { view: { autoOpenCli: true }, updateCheckedAt: T0 - 2 * 60 * MINUTE, updateLatest: '1.3.0', updateSkipped: '1.3.0' })
  world.published = '1.3.0'

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.advance(MINUTE)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(world.fetches).toHaveLength(1)
  expect(await ui.find({ key: 'update-notice' })).toBeUndefined()
  await ui.unmount()
})

test('出現比略過的更高的版本：新版提示和打開按鈕上的標記再出現', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, {
    view: { autoOpen: false, autoOpenCli: false },
    updateCheckedAt: T0 - 2 * 60 * MINUTE,
    updateLatest: '1.3.0',
    updateSkipped: '1.3.0',
  })
  world.published = '1.4.0'
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const text = async () => (await band.find({ key: 'open-board' }))?.text
  expect(await text()).toBe('▦ 打開監看視窗')

  await clock.advance(MINUTE)
  expect(await text()).toBe('⇡ 新版 · ▦ 打開')
  await band.press({ key: 'open-board' })
  await clock.settle()
  await band.unmount()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'update-version' }))?.text).toBe('⇡ 新版 1.4.0')
  await ui.unmount()
})

test('畫面還停在舊版本時按「這版略過」：不會蓋掉別的 Session 已經略過的更高版本', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, SEEN_NEWER)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'update-version' }))?.text).toBe('⇡ 新版 1.3.0')

  // 別的 Session 已經看到 1.4.0 並略過；這裡還沒重新整理就按下
  world.stored.set('updateLatest', '1.4.0')
  world.stored.set('updateSkipped', '1.4.0')
  await ui.press({ key: 'update-skip' })
  expect(world.stored.get('updateSkipped')).toBe('1.4.0')
  expect(await ui.find({ key: 'update-notice' })).toBeUndefined()
  await ui.unmount()
})

for (const [locale, skip] of [
  ['en', 'Skip this version'],
  ['ja', 'このバージョンをスキップ'],
  ['ko', '이 버전 건너뛰기'],
  ['zh-CN', '跳过这个版本'],
  ['zh-TW', '這版略過'],
] as const) {
  test(`多國語言（${locale}）：「這版略過」`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    fakeWorld(on, ['terminal'], {}, { view: { locale }, ...SEEN_NEWER })

    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect((await ui.find({ key: 'update-skip' }))?.text).toBe(skip)
    await ui.unmount()
  })
}

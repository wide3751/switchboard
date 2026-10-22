import { expect, mock, test } from 'claude-code/testing'
import { BAND, T0, engineBand, fakeWorld, put } from './world'

// 打開按鈕帶 ⇡ 新版（update-check/03）：監看視窗沒打開也知道有新版；等你計數仍排最前面

const CLOSED = { autoOpen: false, autoOpenCli: false }
/** 別的 Session 剛檢查過，看到 1.3.0（已安裝的是 1.2.0） */
const SEEN_NEWER = { updateCheckedAt: T0, updateLatest: '1.3.0' }

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：有新版也有待處理時，⇡ 新版 接在等你計數後面，▲N 的樣式不變`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const world = fakeWorld(on, [surface], {}, { view: CLOSED, ...SEEN_NEWER })
    put(world, 301, 'waiting')
    put(world, 302, 'waiting')
    engineBand(on)

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await clock.settle()
    const band = await $.ui.mount({ ...BAND, surface })
    const button = await band.find({ key: 'open-board' })
    expect(button?.text).toBe('▲2 待處理 · ⇡ 新版 · ▦ 打開')
    // label 只在終端機給；Desktop 會把 label 畫出來取代 children，label 就是畫面上的文字
    expect(button?.props.label).toBe(surface === 'terminal' ? '打開監看視窗，2 個待處理，有新版' : button?.text)
    expect(button?.children[0]).toMatchObject({ type: 'Text', props: { color: 'warning', weight: 'bold' }, children: ['▲2'] })
    await band.unmount()
  })

  test(`${surface}：有新版、沒有待處理時是 ⇡ 新版 · ▦ 打開`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const world = fakeWorld(on, [surface], {}, { view: CLOSED, ...SEEN_NEWER })
    put(world, 303, 'busy')
    engineBand(on)

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await clock.settle()
    const band = await $.ui.mount({ ...BAND, surface })
    const button = await band.find({ key: 'open-board' })
    expect(button?.text).toBe('⇡ 新版 · ▦ 打開')
    expect(button?.props.label).toBe(surface === 'terminal' ? '打開監看視窗，有新版' : button?.text)
    await band.unmount()
  })

  test(`${surface}：沒有新版時打開按鈕和以前一樣`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const world = fakeWorld(on, [surface], {}, { view: CLOSED, updateCheckedAt: T0, updateLatest: '1.2.0' })
    put(world, 304, 'waiting')
    engineBand(on)

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await clock.advance(60_000)
    const band = await $.ui.mount({ ...BAND, surface })
    const button = await band.find({ key: 'open-board' })
    expect(button?.text).toBe('▲1 待處理 · ▦ 打開')
    expect(button?.props.label).toBe(surface === 'terminal' ? '打開監看視窗，1 個待處理' : button?.text)

    put(world, 304, 'idle')
    await clock.advance(15_000)
    expect((await band.find({ key: 'open-board' }))?.text).toBe('▦ 打開監看視窗')
    await band.unmount()
  })
}

test('這個 Session 檢查到新版：打開按鈕跟著帶上標記', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { view: CLOSED })
  world.published = '1.3.0'
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const text = async () => (await band.find({ key: 'open-board' }))?.text
  await clock.advance(59_000)
  expect(await text()).toBe('▦ 打開監看視窗')

  await clock.advance(1_000)
  expect(await text()).toBe('⇡ 新版 · ▦ 打開')
  await band.unmount()
})

test('別的 Session 檢查到新版：15 秒內的輕量掃描就帶上標記', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'], {}, { view: CLOSED, updateCheckedAt: T0 - 10 * 60_000, updateLatest: '1.2.0' })
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const text = async () => (await band.find({ key: 'open-board' }))?.text
  expect(await text()).toBe('▦ 打開監看視窗')

  world.stored.set('updateCheckedAt', T0)
  world.stored.set('updateLatest', '1.3.0')
  await clock.advance(14_000)
  expect(await text()).toBe('▦ 打開監看視窗')
  await clock.advance(1_000)
  expect(await text()).toBe('⇡ 新版 · ▦ 打開')
  expect(world.fetches).toHaveLength(0)
  await band.unmount()
})

for (const [locale, withCount, countLabel, alone, aloneLabel] of [
  ['en', '▲1 needs you · ⇡ New version · ▦ Open', 'Open board, 1 needs you, new version available', '⇡ New version · ▦ Open', 'Open board, new version available'],
  ['ja', '▲1 件が対応待ち · ⇡ 新しいバージョン · ▦ 開く', '監視ウィンドウを開く、1 件が対応待ち、新しいバージョンあり', '⇡ 新しいバージョン · ▦ 開く', '監視ウィンドウを開く、新しいバージョンあり'],
  ['ko', '▲1 확인 필요 · ⇡ 새 버전 · ▦ 열기', '모니터 창 열기, 1개 확인 필요, 새 버전 있음', '⇡ 새 버전 · ▦ 열기', '모니터 창 열기, 새 버전 있음'],
  ['zh-CN', '▲1 待处理 · ⇡ 新版 · ▦ 打开', '打开监控窗口，1 个待处理，有新版', '⇡ 新版 · ▦ 打开', '打开监控窗口，有新版'],
  ['zh-TW', '▲1 待處理 · ⇡ 新版 · ▦ 打開', '打開監看視窗，1 個待處理，有新版', '⇡ 新版 · ▦ 打開', '打開監看視窗，有新版'],
] as const) {
  test(`多國語言（${locale}）：打開按鈕上的 ⇡ 新版 和 label`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const world = fakeWorld(on, ['terminal'], {}, { view: { locale }, ...SEEN_NEWER })
    put(world, 351, 'waiting')
    engineBand(on)

    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await clock.settle()
    const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const button = async () => await band.find({ key: 'open-board' })
    expect((await button())?.text).toBe(withCount)
    expect((await button())?.props.label).toBe(countLabel)

    put(world, 351, 'idle')
    await clock.advance(15_000)
    expect((await button())?.text).toBe(alone)
    expect((await button())?.props.label).toBe(aloneLabel)
    await band.unmount()
  })
}

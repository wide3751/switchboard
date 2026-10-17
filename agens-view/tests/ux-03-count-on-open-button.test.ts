import { expect, mock, test } from 'claude-code/testing'
import { BAND, T0, engineBand, fakeWorld, put, putSelf } from './world'

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：監看視窗沒打開時，打開按鈕帶上等你計數`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const world = fakeWorld(on, [surface], {}, { view: { autoOpen: false, autoOpenCli: false } })
    put(world, 301, 'waiting')
    put(world, 302, 'waiting')
    put(world, 303, 'busy')
    put(world, 304, 'waiting', false) // 程序已結束
    engineBand(on)

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await clock.settle()
    const band = await $.ui.mount({ ...BAND, surface })

    // 計數放最前面；▲2 是 warning 粗體，label 寫成完整的一句
    const button = await band.find({ key: 'open-board' })
    expect(button?.text).toBe('▲2 待處理 · ▦ 打開')
    // label 只在終端機給；Desktop 會把 label 畫出來取代 children，label 就是畫面上的文字
    expect(button?.props.label).toBe(surface === 'terminal' ? '打開監看視窗，2 個待處理' : button?.text)
    expect(button?.children[0]).toMatchObject({ type: 'Text', props: { color: 'warning', weight: 'bold' }, children: ['▲2'] })
    await band.unmount()
  })
}

for (const [locale, text, label] of [
  ['en', '▲1 needs you · ▦ Open', 'Open board, 1 needs you'],
  ['ja', '▲1 件が対応待ち · ▦ 開く', '監視ウィンドウを開く、1 件が対応待ち'],
  ['ko', '▲1 확인 필요 · ▦ 열기', '모니터 창 열기, 1개 확인 필요'],
  ['zh-CN', '▲1 待处理 · ▦ 打开', '打开监控窗口，1 个待处理'],
  ['zh-TW', '▲1 待處理 · ▦ 打開', '打開監看視窗，1 個待處理'],
] as const) {
  test(`多國語言（${locale}）：帶計數的打開按鈕`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const world = fakeWorld(on, ['terminal'], {}, { view: { locale } })
    put(world, 351, 'waiting')
    engineBand(on)

    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await clock.settle()
    const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const button = await band.find({ key: 'open-board' })
    expect(button?.text).toBe(text)
    expect(button?.props.label).toBe(label)
    await band.unmount()
  })
}

test('監看視窗沒打開時每 15 秒輕量掃描一次，更新按鈕的計數；輕量掃描不跑 git、gh', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  put(world, 311, 'waiting')
  put(world, 312, 'busy')
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const label = async () => (await band.find({ key: 'open-board' }))?.text
  expect(await label()).toBe('▲1 待處理 · ▦ 打開')
  const scans = world.lightScans
  const commands = world.commands.length

  // 312 進入權限提示：15 秒內還沒反映
  put(world, 312, 'waiting')
  await clock.advance(14_000)
  expect(await label()).toBe('▲1 待處理 · ▦ 打開')
  await clock.advance(1_000)
  expect(await label()).toBe('▲2 待處理 · ▦ 打開')

  // 全部處理完：只顯示按鈕本身
  put(world, 311, 'idle')
  put(world, 312, 'idle')
  await clock.advance(15_000)
  expect(await label()).toBe('▦ 打開監看視窗')

  // 每次只跑一次 ps；git、gh 一次都沒跑，也不算監看視窗的掃描
  expect(world.lightScans).toBe(scans + 2)
  expect(world.commands.slice(commands).map(argv => argv[0])).toEqual(['ps', 'ps'])
  expect(world.scans).toBe(0)
  await band.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：打開監看視窗後輕量掃描停止，改用 3 秒的掃描；關掉後恢復，按鈕馬上帶上計數`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const world = fakeWorld(on, [surface], {}, { view: { autoOpen: false, autoOpenCli: false } })
    put(world, 321, 'busy')
    engineBand(on)

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await clock.settle()
    const band = await $.ui.mount({ ...BAND, surface })
    await band.press({ key: 'open-board' })
    await clock.settle()
    const light = world.lightScans
    const before = world.scans

    // 開著的時候只有監看視窗每 3 秒的掃描，沒有夾雜輕量掃描
    await clock.advance(30_000)
    expect(world.lightScans).toBe(light)
    expect(world.scans).toBe(before + 10)

    // 321 進入權限提示後，使用者關掉監看視窗
    put(world, 321, 'waiting')
    world.panes.delete('switchboard')
    await clock.advance(3_000)
    const scans = world.scans
    expect((await band.find({ key: 'open-board' }))?.text).toBe('▲1 待處理 · ▦ 打開')
    expect(world.lightScans).toBe(light + 1)

    // 之後又回到每 15 秒一次的輕量掃描
    await clock.advance(30_000)
    expect(world.lightScans).toBe(light + 3)
    expect(world.scans).toBe(scans)
    await band.unmount()
  })
}

test('自動打開的監看視窗因為終端機太窄還沒畫出來時，照樣輕量掃描；畫出來後停止', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { view: { autoOpenCli: true } }, { isNarrow: true })
  put(world, 331, 'waiting')
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.advance(15_000)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await band.find({ key: 'open-board' }))?.text).toBe('▲1 待處理 · ▦ 打開')
  expect(world.lightScans).toBe(2)

  // 終端機拉寬：引擎畫出等待中的監看視窗
  world.isNarrow = false
  await clock.advance(3_000)
  const light = world.lightScans
  const before = world.scans
  await clock.advance(30_000)
  // 只剩監看視窗每 3 秒的掃描
  expect(world.lightScans).toBe(light)
  expect(world.scans).toBe(before + 10)
  await band.unmount()
})

test('輕量掃描失敗時按鈕不顯示計數，也不顯示 0；恢復後計數回來', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  putSelf(world, 900, 'busy')
  put(world, 341, 'waiting')
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const label = async () => (await band.find({ key: 'open-board' }))?.text
  expect(await label()).toBe('▲1 待處理 · ▦ 打開')

  // ps 丟例外：上一次的計數也不留著
  world.psFailure = 'throws'
  await clock.advance(15_000)
  expect(await label()).toBe('▦ 打開監看視窗')

  // ps 什麼都不輸出：清單裡沒有目前這個 Session，不能當成沒有在等你
  world.psFailure = 'empty'
  await clock.advance(15_000)
  expect(await label()).toBe('▦ 打開監看視窗')

  // ps 的結果裡有別的 Session、卻沒有目前這個：檢查存活的方法壞了，算出來的數字也不能信
  world.psFailure = undefined
  world.alive.delete(900)
  await clock.advance(15_000)
  expect(await label()).toBe('▦ 打開監看視窗')
  world.alive.add(900)

  // 讀不到 sessions 資料夾
  world.isSessionsUnreadable = true
  await clock.advance(15_000)
  expect(await label()).toBe('▦ 打開監看視窗')

  world.isSessionsUnreadable = false
  await clock.advance(15_000)
  expect(await label()).toBe('▲1 待處理 · ▦ 打開')
  await band.unmount()
})

import { expect, mock, test } from 'claude-code/testing'
import { BAND, PANE, SESSIONS, T0, engineBand, fakeWorld, put } from './world'

// 檢查更新每小時最多一次、所有 Session 共用（update-check/02）：上次檢查的時間和看到的版本存在 store

const MINUTE = 60_000
const HOUR = 60 * MINUTE

test('啟動後一分鐘內不連網；滿一分鐘才第一次檢查', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  world.published = '1.3.0'

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await clock.advance(59_000)
  expect(world.fetches).toHaveLength(0)
  expect(await ui.find({ key: 'update-notice' })).toBeUndefined()

  await clock.advance(1_000)
  expect(world.fetches).toHaveLength(1)
  expect(world.stored.get('updateCheckedAt')).toBe(T0 + MINUTE)
  expect(world.stored.get('updateLatest')).toBe('1.3.0')
  expect((await ui.find({ key: 'update-version' }))?.text).toBe('⇡ 新版 1.3.0')
  await ui.unmount()
})

test('別的 Session 一小時內檢查過：這個 Session 不連網，照樣顯示 store 裡的新版提示', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { updateCheckedAt: T0 - 10 * MINUTE, updateLatest: '1.3.0' })

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'update-version' }))?.text).toBe('⇡ 新版 1.3.0')

  await clock.advance(2 * MINUTE)
  expect(world.fetches).toHaveLength(0)
  expect((await ui.find({ key: 'update-version' }))?.text).toBe('⇡ 新版 1.3.0')
  await ui.unmount()
})

test('監看視窗開著時別的 Session 檢查到新版：3 秒內出現，這個 Session 不必自己連網', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { updateCheckedAt: T0 - 10 * MINUTE, updateLatest: '1.2.0' })

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'update-notice' })).toBeUndefined()

  world.stored.set('updateCheckedAt', T0)
  world.stored.set('updateLatest', '1.3.0')
  await clock.advance(3_000)
  expect((await ui.find({ key: 'update-version' }))?.text).toBe('⇡ 新版 1.3.0')
  expect(world.fetches).toHaveLength(0)
  await ui.unmount()
})

test('上次檢查滿一小時，下一次判斷才再連網', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { updateCheckedAt: T0 - 58 * MINUTE, updateLatest: '1.2.0' })
  world.published = '1.3.0'

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.advance(MINUTE)
  expect(world.fetches).toHaveLength(0)
  expect(world.stored.get('updateLatest')).toBe('1.2.0')

  await clock.advance(MINUTE)
  expect(world.fetches).toHaveLength(1)
  expect(world.stored.get('updateCheckedAt')).toBe(T0 + 2 * MINUTE)
  expect(world.stored.get('updateLatest')).toBe('1.3.0')
})

// 照實走過兩個小時：每 15 秒一次的輕量掃描就要好幾秒
test('一直開著的 Session 每小時再檢查一次，之後才公布的新版也會出現', { timeoutMs: 30_000 }, async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.advance(MINUTE)
  expect(world.fetches).toHaveLength(1)

  world.published = '1.3.0'
  await clock.advance(HOUR - MINUTE)
  expect(world.fetches).toHaveLength(1)
  await clock.advance(MINUTE)
  expect(world.fetches).toHaveLength(2)
  await clock.advance(HOUR)
  expect(world.fetches).toHaveLength(3)

  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'update-version' }))?.text).toBe('⇡ 新版 1.3.0')
  await ui.unmount()
})

test('連網失敗也算一次檢查：不清掉上次看到的版本，一小時內不重試', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { updateCheckedAt: T0 - 2 * HOUR, updateLatest: '1.3.0' })
  world.fetchFailure = 'throws'

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.advance(MINUTE)
  expect(world.fetches).toHaveLength(1)
  // 別的 Session 讀到這個時間，一小時內也不會連網
  expect(world.stored.get('updateCheckedAt')).toBe(T0 + MINUTE)
  expect(world.stored.get('updateLatest')).toBe('1.3.0')

  world.fetchFailure = undefined
  await clock.advance(5 * MINUTE)
  expect(world.fetches).toHaveLength(1)

  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'update-version' }))?.text).toBe('⇡ 新版 1.3.0')
  await ui.unmount()
})

test('讀公布的版本卡住：10 秒後放棄，下次到期照常檢查', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  world.fetchFailure = 'hang'

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.advance(MINUTE + 10_000)
  expect(world.fetches).toHaveLength(1)

  // 還卡在上一次的話，到期了也不會再檢查
  world.fetchFailure = undefined
  world.published = '1.3.0'
  world.stored.set('updateCheckedAt', T0 - HOUR)
  await clock.advance(MINUTE)
  expect(world.fetches).toHaveLength(2)
  expect(world.stored.get('updateLatest')).toBe('1.3.0')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：檢查更新不改變監看視窗的掃描和輕量掃描的次數，也不跑外部指令`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const world = fakeWorld(on, [surface], {}, { view: { autoOpen: false, autoOpenCli: false } })
    world.published = '1.3.0'
    put(world, 201, 'busy')
    engineBand(on)

    // 監看視窗沒打開：每 15 秒一次輕量掃描，每次只跑一次 ps
    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await clock.settle()
    const light = world.lightScans
    const commands = world.commands.length
    await clock.advance(2 * MINUTE)
    expect(world.fetches).toHaveLength(1)
    expect(world.lightScans).toBe(light + 8)
    expect(world.scans).toBe(0)
    expect(world.commands.slice(commands).map(argv => argv[0])).toEqual(Array(8).fill('ps'))

    // 監看視窗打開：每 3 秒一次掃描，沒有夾雜輕量掃描。上次檢查改成一小時前，這段時間裡也會連網
    world.stored.set('updateCheckedAt', T0 - HOUR)
    const band = await $.ui.mount({ ...BAND, surface })
    await band.press({ key: 'open-board' })
    await clock.settle()
    await band.unmount()
    const scans = world.scans
    const lightAfter = world.lightScans
    await clock.advance(2 * MINUTE)
    expect(world.fetches).toHaveLength(2)
    expect(world.scans).toBe(scans + 40)
    expect(world.lightScans).toBe(lightAfter)
  })
}

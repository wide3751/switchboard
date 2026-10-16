import { expect, mock, test } from 'claude-code/testing'
import { PANE, SESSIONS, T0, fakeWorld, put, putSelf } from './world'

test('讀不到 sessions 資料夾時，頁首說看不到 Session 狀態，不說沒有在等你', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  world.isSessionsUnreadable = true

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text ?? ''

  expect(await text('count')).toBe('⚠ 目前看不到 Session 狀態')
  expect(await text('summary')).toContain('/Users/tester/.claude/sessions')
  expect(await text('header')).not.toContain('沒有 Session 需要你處理')

  await ui.unmount()
})

test('ps 丟例外時，畫面顯示錯誤，不會卡在 Loading', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 101, 'idle')
  world.psFailure = 'throws'

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text ?? ''

  expect(await text('count')).toBe('⚠ 目前看不到 Session 狀態')
  // 測試引擎把丟例外的 hook 當成沒有實作，原因文字由引擎決定，這裡只看得到失敗本身
  expect(await text('summary')).toContain('switchboard 讀取狀態失敗：')

  // ps 恢復後，下一次 polling 回到正常的頁首
  world.psFailure = undefined
  await clock.advance(3_000)
  expect(await text('count')).toBe('✓ 沒有 Session 需要你處理')

  await ui.unmount()
})

test('ps 什麼都不輸出時，清單裡沒有目前這個 Session，頁首顯示警告而不是沒有在等你', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  putSelf(world, 900)
  put(world, 101, 'waiting')

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text ?? ''
  expect(await text('count')).toBe('▲ 1 個需要你處理')

  // ps 壞掉：所有 Session 都被當成已結束
  world.psFailure = 'empty'
  await clock.advance(3_000)
  expect(await text('count')).toBe('⚠ 目前看不到 Session 狀態')
  expect(await text('summary')).toBe('清單裡沒有目前這個 Session，掃描沒有正常運作')

  await ui.unmount()
})

test('掃描一直失敗超過約 10 秒，畫面標出資料是幾秒前的', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  putSelf(world, 900)
  put(world, 101, 'waiting')

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text ?? ''

  // 掃描正常時不標時間
  await clock.advance(3_000)
  expect(await ui.find({ key: 'stale' })).toBeUndefined()

  // 從這裡開始每次 ps 都丟例外：上次成功是 T0 + 3s
  world.psFailure = 'throws'
  await clock.advance(9_000)
  expect(await ui.find({ key: 'stale' })).toBeUndefined()
  await clock.advance(3_000)
  expect(await text('stale')).toBe('12 秒前更新')
  // 上一次的卡片還在，但頁首不再假裝資料是新的
  expect(await ui.find({ key: 'card-101' })).toBeDefined()
  expect(await text('count')).toBe('⚠ 目前看不到 Session 狀態')

  await ui.unmount()
})

test('掃描卡住（ps 遲遲不回）超過約 10 秒，畫面也標出資料是幾秒前的', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  putSelf(world, 900)
  put(world, 101, 'idle')

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text ?? ''

  // 下一次的 ps 要一分鐘後才回答：上次成功是 T0
  world.psWait = () => clock.sleep(60_000)
  await clock.advance(15_000)
  expect(await text('stale')).toBe('15 秒前更新')

  // ps 回來之後恢復正常，不再標時間
  world.psWait = undefined
  await clock.advance(60_000)
  expect(await ui.find({ key: 'stale' })).toBeUndefined()

  await ui.unmount()
})

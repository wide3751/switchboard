import { expect, mock, test } from 'claude-code/testing'
import { DIR, PANE, SESSIONS, T0, fakeWorld, report, type Status, type World } from './world'

const MINUTE = 60_000

/** 一份 session 紀錄：可指定狀態變化時間（statusUpdatedAt）與 Session 開始時間（startedAt）。 */
const putAt = (
  world: World,
  pid: number,
  status: Status,
  times: { changedAt: number; startedAt?: number; procStart?: string },
) => {
  world.files.set(
    `${DIR}/${pid}.json`,
    JSON.stringify({
      pid,
      sessionId: `s-${pid}`,
      status,
      cwd: `/work/proj-${pid}`,
      statusUpdatedAt: times.changedAt,
      ...(times.startedAt === undefined ? {} : { startedAt: times.startedAt }),
      ...(times.procStart === undefined ? {} : { procStart: times.procStart }),
    }),
  )
  world.alive.add(pid)
}

/** 打開監看視窗，回傳卡片的 pid 順序。 */
const openBoard = async ($: Parameters<Parameters<typeof test>[1]>[0]) => {
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const order = async () =>
    (await ui.findAll({ type: 'Box' }))
      .map(one => one.key)
      .filter((key): key is string => key?.startsWith('card-') === true)
      .map(key => Number(key.slice('card-'.length)))

  return { ui, order }
}

test('需要你處理依進入該狀態的時間由舊到新：等最久的在最上面，新進來的加在底部', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 30 * MINUTE })
  const world = fakeWorld(on, ['desktop'])
  putAt(world, 301, 'waiting', { changedAt: T0 + 20 * MINUTE })
  putAt(world, 302, 'waiting', { changedAt: T0 + 5 * MINUTE }) // 等最久
  putAt(world, 303, 'idle', { changedAt: T0 + 10 * MINUTE })
  report(world, 303, { turnError: 'API 過載' }) // 出錯中止也屬於需要你處理

  const { ui, order } = await openBoard($)
  await clock.settle()
  expect(await order()).toEqual([302, 303, 301])
  // 頁首的「最長 n」就是最上面那張卡片等的時間
  expect((await ui.find({ key: 'summary' }))?.text).toContain('最長 25m')

  // 新進來的加在底部
  putAt(world, 304, 'waiting', { changedAt: T0 + 30 * MINUTE })
  await clock.advance(3_000)
  expect(await order()).toEqual([302, 303, 301, 304])
})

test('工作中依 Session 開始的時間排，核准來回不改變位置', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 30 * MINUTE })
  const world = fakeWorld(on, ['desktop'])
  putAt(world, 311, 'busy', { startedAt: T0, changedAt: T0 + 2 * MINUTE }) // 最早開始
  putAt(world, 312, 'busy', { startedAt: T0 + MINUTE, changedAt: T0 + 20 * MINUTE })
  putAt(world, 313, 'busy', { startedAt: T0 + 2 * MINUTE, changedAt: T0 + 10 * MINUTE })

  const { order } = await openBoard($)
  await clock.settle()
  expect(await order()).toEqual([311, 312, 313])

  // 311 停在權限提示：移到需要你處理
  putAt(world, 311, 'waiting', { startedAt: T0, changedAt: T0 + 30 * MINUTE })
  await clock.advance(3_000)
  expect(await order()).toEqual([311, 312, 313])
  // 使用者核准後回到工作中：狀態變化時間最新，仍回到原本的位置
  putAt(world, 312, 'waiting', { startedAt: T0 + MINUTE, changedAt: T0 + 31 * MINUTE })
  putAt(world, 311, 'busy', { startedAt: T0, changedAt: T0 + 31 * MINUTE })
  await clock.advance(3_000)
  expect(await order()).toEqual([312, 311, 313])
  putAt(world, 312, 'busy', { startedAt: T0 + MINUTE, changedAt: T0 + 32 * MINUTE })
  await clock.advance(3_000)
  expect(await order()).toEqual([311, 312, 313])
})

test('工作中的 Session 紀錄沒有開始時間時，排在有開始時間的後面，依 pid 維持固定次序', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 30 * MINUTE })
  const world = fakeWorld(on, ['desktop'])
  // 檔案順序和 pid 順序刻意不同
  putAt(world, 324, 'busy', { changedAt: T0 + 3 * MINUTE })
  putAt(world, 322, 'busy', { changedAt: T0 + 9 * MINUTE })
  putAt(world, 323, 'busy', { changedAt: T0 + MINUTE })
  putAt(world, 321, 'busy', { startedAt: T0 + 5 * MINUTE, changedAt: T0 })

  const { order } = await openBoard($)
  await clock.settle()
  expect(await order()).toEqual([321, 322, 323, 324])

  // 狀態變化時間改變也不跳動
  putAt(world, 324, 'busy', { changedAt: T0 + 29 * MINUTE })
  await clock.advance(3_000)
  expect(await order()).toEqual([321, 322, 323, 324])
})

test('需要你處理的 Session 紀錄沒有狀態變化時間時排在底部，最上面仍是「最長」那張', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 30 * MINUTE })
  const world = fakeWorld(on, ['desktop'])
  putAt(world, 331, 'waiting', { changedAt: 0 })
  putAt(world, 332, 'waiting', { changedAt: T0 + 18 * MINUTE })

  const { ui, order } = await openBoard($)
  await clock.settle()
  expect(await order()).toEqual([332, 331])
  expect((await ui.find({ key: 'summary' }))?.text).toContain('最長 12m')
})

test('閒置依最後活動時間由新到舊', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 30 * MINUTE })
  const world = fakeWorld(on, ['desktop'])
  putAt(world, 341, 'idle', { startedAt: T0, changedAt: T0 + 5 * MINUTE })
  putAt(world, 342, 'idle', { startedAt: T0 + MINUTE, changedAt: T0 + 25 * MINUTE })
  putAt(world, 343, 'idle', { startedAt: T0 + 2 * MINUTE, changedAt: T0 + 15 * MINUTE })

  const { order } = await openBoard($)
  await clock.settle()
  expect(await order()).toEqual([342, 343, 341])

  // 341 有新的動作，回到最上面
  putAt(world, 341, 'idle', { startedAt: T0, changedAt: T0 + 30 * MINUTE })
  await clock.advance(3_000)
  expect(await order()).toEqual([341, 342, 343])
})

test('三個分組依序排列：需要你處理 → 工作中 → 閒置', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 30 * MINUTE })
  const world = fakeWorld(on, ['desktop'])
  putAt(world, 351, 'idle', { startedAt: T0, changedAt: T0 + 29 * MINUTE })
  putAt(world, 352, 'busy', { startedAt: T0, changedAt: T0 + 28 * MINUTE })
  putAt(world, 353, 'waiting', { startedAt: T0, changedAt: T0 + MINUTE })
  putAt(world, 354, 'busy', { startedAt: T0 - MINUTE, changedAt: T0 })

  const { order } = await openBoard($)
  await clock.settle()
  expect(await order()).toEqual([353, 354, 352, 351])
})

import { expect, mock, test } from 'claude-code/testing'
import { PANE, SESSIONS, T0, fakeWorld, put, report } from './world'

/** 打開監看視窗，回傳卡片的 pid 順序。 */
const openBoard = async ($: Parameters<Parameters<typeof test>[1]>[0]) => {
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  return async () =>
    (await ui.findAll({ type: 'Box' }))
      .map(one => one.key)
      .filter((key): key is string => key?.startsWith('card-') === true)
      .map(key => Number(key.slice('card-'.length)))
}

const running = [{ kind: 'bash', label: '$ sleep 120', status: 'running' }]

test('回合結束但背景 Bash 還在跑（紀錄是 shell）的 Session 算工作中，跑完才變閒置', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 601, 'idle')
  // 背景 Bash 還在跑時，Claude Code 把紀錄寫成 shell
  put(world, 602, 'shell')
  report(world, 602, { tasks: running })
  put(world, 603, 'busy')

  const order = await openBoard($)
  await clock.settle()
  expect(await order()).toEqual([602, 603, 601])

  put(world, 602, 'idle')
  report(world, 602, { tasks: [] })
  await clock.advance(3_000)
  expect(await order()).toEqual([603, 601, 602])
})

test('Desktop 的紀錄在背景任務還在跑時仍是 idle：看狀態回報裡執行中的任務，算工作中', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 621, 'idle')
  put(world, 622, 'idle')
  report(world, 622, { tasks: running })
  put(world, 623, 'busy')

  const order = await openBoard($)
  await clock.settle()
  expect(await order()).toEqual([622, 623, 621])

  report(world, 622, { tasks: [{ ...running[0], status: 'done' }] })
  await clock.advance(3_000)
  expect(await order()).toEqual([623, 621, 622])
})

test('出錯中止的 Session 即使背景 Bash 還在跑，仍算待處理', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 611, 'busy')
  put(world, 612, 'shell')
  report(world, 612, { turnError: 'API 過載', tasks: running })

  const order = await openBoard($)
  await clock.settle()
  expect(await order()).toEqual([612, 611])
})

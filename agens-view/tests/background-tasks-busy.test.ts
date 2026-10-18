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

const running = [{ kind: 'agent', label: 'Explore·掃描', status: 'running' }]

test('回合結束但背景任務還在跑的 Session 算工作中，任務都結束後才變閒置', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 601, 'idle')
  put(world, 602, 'idle')
  report(world, 602, { tasks: running })
  put(world, 603, 'busy')

  const order = await openBoard($)
  await clock.settle()
  expect(await order()).toEqual([602, 603, 601])

  report(world, 602, { tasks: [{ ...running[0], status: 'done' }] })
  await clock.advance(3_000)
  expect(await order()).toEqual([603, 601, 602])
})

test('出錯中止的 Session 即使背景任務還在跑，仍算待處理', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 611, 'busy')
  put(world, 612, 'idle')
  report(world, 612, { turnError: 'API 過載', tasks: running })

  const order = await openBoard($)
  await clock.settle()
  expect(await order()).toEqual([612, 611])
})

import { mock, test, expect } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { On } from 'claude-code'
import { DIR, PANE, SESSIONS, T0, fakeWorld, put, type World } from './world'

// 焦點跳轉的 10 秒規則（ui-consensus/09）：同一個 Pane 上一次取得焦點不到 10 秒，視為用 Tab 瀏覽，不跳轉

/** 一個 Desktop Session：有 hostSessionId，跳轉時打開 claude:// 連結。 */
const putDesktop = (world: World, pid: number, host: string) => {
  put(world, pid, 'idle')
  world.files.set(
    `${DIR}/${pid}.json`,
    JSON.stringify({ pid, sessionId: `s-${pid}`, hostSessionId: host, status: 'idle', cwd: `/work/proj-${pid}` }),
  )
}

const linkOf = (host: string) => `claude://claude.ai/epitaxy/${host}`

/** 在 Desktop 打開監看視窗。 */
const openBoard = async ($: Parameters<TestBody>[0], on: On) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  putDesktop(world, 601, 'local_a')
  putDesktop(world, 602, 'local_b')
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  return { ui, world, clock }
}

/** 使用者把焦點移到 Pane 裡的某個元素（點擊或 Tab）。 */
const focus = ($: Parameters<TestBody>[0], element?: string) =>
  $.ui.focus({
    component: 'Pane',
    requestId: 'switchboard',
    ...(element === undefined ? {} : { plugin: 'switchboard', element }),
    origin: { kind: 'person' },
  })

test('Desktop：第一次取得焦點就跳轉，10 秒內接著移動焦點（Tab 瀏覽）不跳', async ($, on) => {
  const { ui, world, clock } = await openBoard($, on)

  await focus($, 'jump-601')
  expect(world.links).toEqual([linkOf('local_a')])

  await clock.advance(3_000)
  await focus($, 'jump-602')
  expect(world.links).toEqual([linkOf('local_a')])

  await ui.unmount()
})

test('Desktop：焦點先停在別的元素（按鈕、Pane 的關閉鈕）再 Tab 到標題，也不跳', async ($, on) => {
  const { ui, world, clock } = await openBoard($, on)

  await focus($)
  await clock.advance(2_000)
  await focus($, 'settings')
  await clock.advance(2_000)
  await focus($, 'jump-601')
  expect(world.links).toEqual([])

  await ui.unmount()
})

test('Desktop：Enter／按下標題一律跳轉，連按也每次都跳', async ($, on) => {
  const { ui, world, clock } = await openBoard($, on)

  await focus($, 'settings')
  await ui.press({ key: 'jump-601' })
  await ui.press({ key: 'jump-601' })
  await clock.advance(500)
  await ui.press({ key: 'jump-602' })
  expect(world.links).toEqual([linkOf('local_a'), linkOf('local_a'), linkOf('local_b')])

  await ui.unmount()
})

test('Desktop：焦點跳轉之後 1.5 秒內按下同一張卡片不再跳一次（同一下點擊）；之後再按就跳', async ($, on) => {
  const { ui, world, clock } = await openBoard($, on)

  await focus($, 'jump-601')
  await ui.press({ key: 'jump-601' })
  expect(world.links).toEqual([linkOf('local_a')])

  await clock.advance(1_500)
  await ui.press({ key: 'jump-601' })
  expect(world.links).toEqual([linkOf('local_a'), linkOf('local_a')])

  await ui.unmount()
})

test('Desktop：焦點隔了 10 秒以上才移動，視為新的一下點擊，照樣跳轉', async ($, on) => {
  const { ui, world, clock } = await openBoard($, on)

  await focus($, 'jump-601')
  await clock.advance(10_000)
  await focus($, 'jump-602')
  expect(world.links).toEqual([linkOf('local_a'), linkOf('local_b')])

  await ui.unmount()
})

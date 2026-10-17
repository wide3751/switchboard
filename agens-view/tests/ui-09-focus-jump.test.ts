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

test('Desktop：Enter／按下標題一律跳轉；隔一下再按同一張也再跳一次', async ($, on) => {
  const { ui, world, clock } = await openBoard($, on)

  await focus($, 'settings')
  await ui.press({ key: 'jump-601' })
  await clock.advance(500)
  await ui.press({ key: 'jump-601' })
  await ui.press({ key: 'jump-602' })
  expect(world.links).toEqual([linkOf('local_a'), linkOf('local_a'), linkOf('local_b')])

  await ui.unmount()
})

test('雙擊或按住不放（同一張卡片 300 毫秒內接連按下）只跳一次', async ($, on) => {
  const { ui, world, clock } = await openBoard($, on)

  await focus($, 'settings')
  // 雙擊
  await ui.press({ key: 'jump-601' })
  await clock.advance(150)
  await ui.press({ key: 'jump-601' })
  expect(world.links).toEqual([linkOf('local_a')])
  // 按住不放：自動重複每 50 毫秒按一下，按了將近一秒
  await clock.advance(400)
  await ui.press({ key: 'jump-602' })
  for (let i = 0; i < 18; i++) {
    await clock.advance(50)
    await ui.press({ key: 'jump-602' })
  }
  expect(world.links).toEqual([linkOf('local_a'), linkOf('local_b')])

  // 放開之後刻意再按一次就跳
  await clock.advance(400)
  await ui.press({ key: 'jump-602' })
  expect(world.links).toEqual([linkOf('local_a'), linkOf('local_b'), linkOf('local_b')])

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

test('Desktop：點了 Pane 裡的按鈕、再點進輸入框打字（Pane 失焦），10 秒內點卡片標題照樣跳轉', async ($, on) => {
  const { ui, world, clock } = await openBoard($, on)

  await focus($, 'settings')
  await ui.redraw({ ...PANE.props, isFocused: true })
  // 點進輸入框：Pane 失去焦點
  await ui.redraw({ ...PANE.props, isFocused: false })
  await clock.advance(6_000)
  await focus($, 'jump-601')
  expect(world.links).toEqual([linkOf('local_a')])

  await ui.unmount()
})

test('Desktop：別的 mod 移動的焦點不算使用者的瀏覽，接著點卡片標題照樣跳轉', async ($, on) => {
  const { ui, world, clock } = await openBoard($, on)

  await $.ui.focus({
    component: 'Pane',
    requestId: 'switchboard',
    plugin: 'switchboard',
    element: 'settings',
    origin: { kind: 'plugin', name: 'other' },
  })
  await clock.advance(2_000)
  await focus($, 'jump-601')
  expect(world.links).toEqual([linkOf('local_a')])

  await ui.unmount()
})

test('Desktop：監看視窗關掉又打開後，第一次點卡片標題就跳轉（不沿用關掉前的焦點時間）', async ($, on) => {
  const { ui, world, clock } = await openBoard($, on)

  await focus($, 'settings')
  // Pane 被關掉（沒有 ui.close），馬上用指令重開
  world.panes.delete('switchboard')
  await clock.advance(3_000)
  await $.command.run(SESSIONS)
  await clock.settle()
  await focus($, 'jump-601')
  expect(world.links).toEqual([linkOf('local_a')])

  await ui.unmount()
})

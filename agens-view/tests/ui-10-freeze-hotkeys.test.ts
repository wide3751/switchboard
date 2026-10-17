import { mock, test, expect } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { On } from 'claude-code'
import { DIR, PANE, SESSIONS, T0, fakeWorld, put, type Status, type World } from './world'

// 凍結順序與數字快捷鍵（ui-consensus/10）：待處理卡片的「前往處理」依排序帶 1…9；
// 焦點在監看視窗裡時順序和數字都不變，焦點離開後才重排

type Surface = 'terminal' | 'desktop'

/**
 * 一個 Desktop Session（有 hostSessionId，可以跳轉）；`at` 是進入目前狀態的時間，決定待處理的先後。
 * `canJump: false` 時沒有 hostSessionId，卡片上不會有「前往處理」。
 */
const putSession = (world: World, pid: number, status: Status, at: number, canJump = true) => {
  put(world, pid, status)
  world.files.set(
    `${DIR}/${pid}.json`,
    JSON.stringify({
      pid,
      sessionId: `s-${pid}`,
      status,
      cwd: `/work/proj-${pid}`,
      statusUpdatedAt: at,
      ...(canJump ? { hostSessionId: `local_${pid}` } : {}),
    }),
  )
}

const openBoard = async ($: Parameters<TestBody>[0], on: On, world: World, surface: Surface = 'terminal') => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  await $.session.start({ cwd: '/work', surface, isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface })

  return { ui, clock }
}

type Mounted = Awaited<ReturnType<typeof openBoard>>['ui']

/** 分區與卡片依畫面上的次序：`waiting-group`、`card-701`、`busy-group`… */
const layoutOf = async (ui: Mounted) =>
  (await ui.findAll({ type: 'Box' }))
    .map(one => one.key ?? '')
    .filter(key => /^(card-\d+|(waiting|busy|idle)-group)$/.test(key))

const goOf = async (ui: Mounted, pid: number) => (await ui.find({ key: `go-button-${pid}` }))?.props

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：「前往處理」依排序帶 1、2…，跳不過去的卡片沒有按鈕、不佔號碼`, async ($, on) => {
    const world = fakeWorld(on, [surface])
    putSession(world, 701, 'waiting', T0 + 1_000)
    putSession(world, 702, 'waiting', T0 + 2_000, false)
    putSession(world, 703, 'waiting', T0 + 3_000)
    const { ui } = await openBoard($, on, world, surface)

    expect(await goOf(ui, 701)).toMatchObject({ hotkey: '1', label: '前往處理 proj-701（快捷鍵 1）' })
    expect(await ui.find({ key: 'go-button-702' })).toBeUndefined()
    expect(await goOf(ui, 703)).toMatchObject({ hotkey: '2', label: '前往處理 proj-703（快捷鍵 2）' })
    // 數字畫在按鈕文字前面（dim）；Desktop 的數字和文字之間留寬一點的空白
    const text = (await ui.find({ key: 'go-button-701' }))?.text ?? ''
    if (surface === 'terminal') expect(text).toBe('1 前往處理 →')
    else expect(text).toMatch(/^1\s+前往處理 →$/u)
    const digit = (await ui.findAll({ type: 'Text' })).find(one => one.text === '1')
    expect(digit?.props).toMatchObject({ dimColor: true })

    await ui.press({ key: 'go-button-703' })
    expect(world.links).toEqual(['claude://claude.ai/epitaxy/local_703'])

    await ui.unmount()
  })
}

test('第 10 張以後的「前往處理」沒有數字快捷鍵', async ($, on) => {
  const world = fakeWorld(on, ['terminal'])
  for (let i = 1; i <= 10; i++) putSession(world, 710 + i, 'waiting', T0 + i * 1_000)
  const { ui } = await openBoard($, on, world)

  expect(await goOf(ui, 719)).toMatchObject({ hotkey: '9' })
  const tenth = await ui.find({ key: 'go-button-720' })
  expect(tenth?.props.hotkey).toBeUndefined()
  expect(tenth?.props.label).toBe('前往處理 proj-720')
  expect(tenth?.text).toBe('前往處理 →')

  await ui.unmount()
})

test('焦點在監看視窗裡：離開待處理的卡片留在原位、拿掉「前往處理」，其他卡片的數字不變；焦點離開後才重排', async ($, on) => {
  const world = fakeWorld(on, ['terminal'])
  putSession(world, 701, 'waiting', T0 + 1_000)
  putSession(world, 703, 'waiting', T0 + 3_000)
  putSession(world, 705, 'busy', T0)
  const { ui, clock } = await openBoard($, on, world)
  expect(await layoutOf(ui)).toEqual(['waiting-group', 'card-701', 'card-703', 'busy-group', 'card-705'])

  await ui.redraw({ ...PANE.props, isFocused: true })
  putSession(world, 701, 'busy', T0 + 50_000)
  await clock.advance(3_000)

  // 順序不變；701 的內容和外框照新的狀態（工作中的細框），沒有按鈕；703 仍是 2
  expect(await layoutOf(ui)).toEqual(['waiting-group', 'card-701', 'card-703', 'busy-group', 'card-705'])
  expect((await ui.find({ key: 'card-701' }))?.props).toMatchObject({ borderStyle: 'round' })
  expect((await ui.find({ key: 'card-703' }))?.props).toMatchObject({ borderStyle: 'bold' })
  expect(await ui.find({ key: 'go-button-701' })).toBeUndefined()
  expect(await goOf(ui, 703)).toMatchObject({ hotkey: '2' })
  // 頁首的等你計數照實際的數量
  expect((await ui.find({ key: 'count' }))?.text).toBe('▲ 1 個待處理')

  await ui.redraw({ ...PANE.props, isFocused: false })
  expect(await layoutOf(ui)).toEqual(['waiting-group', 'card-703', 'busy-group', 'card-701', 'card-705'])
  expect(await goOf(ui, 703)).toMatchObject({ hotkey: '1' })

  await ui.unmount()
})

test('焦點在監看視窗裡：新進待處理的卡片接在待處理底部，用沒用過的下一個數字；焦點離開後依等待時間重排', async ($, on) => {
  const world = fakeWorld(on, ['terminal'])
  putSession(world, 701, 'waiting', T0 + 1_000)
  putSession(world, 703, 'waiting', T0 + 3_000)
  putSession(world, 704, 'busy', T0)
  const { ui, clock } = await openBoard($, on, world)
  await ui.redraw({ ...PANE.props, isFocused: true })

  // 703（數字 2）變成閒置、704 轉進待處理（等得比 701 還久）
  putSession(world, 703, 'idle', T0 + 50_000)
  putSession(world, 704, 'waiting', T0)
  await clock.advance(3_000)

  expect(await layoutOf(ui)).toEqual(['waiting-group', 'card-701', 'card-703', 'card-704'])
  expect(await goOf(ui, 701)).toMatchObject({ hotkey: '1' })
  expect(await ui.find({ key: 'go-button-703' })).toBeUndefined()
  // 2 剛才還是 703 的，不能馬上換成別張卡片
  expect(await goOf(ui, 704)).toMatchObject({ hotkey: '3' })

  await ui.redraw({ ...PANE.props, isFocused: false })
  expect(await layoutOf(ui)).toEqual(['waiting-group', 'card-704', 'card-701', 'idle-group', 'card-703'])
  expect(await goOf(ui, 704)).toMatchObject({ hotkey: '1' })
  expect(await goOf(ui, 701)).toMatchObject({ hotkey: '2' })

  await ui.unmount()
})

test('焦點在監看視窗裡：最後一張待處理也離開時，它仍留在頂端原位，頁首改成沒有在等', async ($, on) => {
  const world = fakeWorld(on, ['terminal'])
  putSession(world, 701, 'waiting', T0 + 1_000)
  putSession(world, 705, 'busy', T0)
  const { ui, clock } = await openBoard($, on, world)
  await ui.redraw({ ...PANE.props, isFocused: true })

  putSession(world, 701, 'idle', T0 + 50_000)
  await clock.advance(3_000)

  expect(await layoutOf(ui)).toEqual(['waiting-group', 'card-701', 'busy-group', 'card-705'])
  expect(await ui.find({ key: 'go-button-701' })).toBeUndefined()
  expect((await ui.find({ key: 'card-701' }))?.props).toMatchObject({ borderStyle: 'round', borderDimColor: true })
  expect((await ui.find({ key: 'count' }))?.text).toBe('✓ 沒有待處理的 Session')

  await ui.redraw({ ...PANE.props, isFocused: false })
  expect(await layoutOf(ui)).toEqual(['busy-group', 'card-705', 'idle-group', 'card-701'])

  await ui.unmount()
})

test('監看視窗關掉又打開後，不沿用關掉前凍結的順序', async ($, on) => {
  const world = fakeWorld(on, ['terminal'])
  putSession(world, 701, 'waiting', T0 + 1_000)
  putSession(world, 703, 'waiting', T0 + 3_000)
  putSession(world, 705, 'busy', T0)
  const { ui, clock } = await openBoard($, on, world)
  await ui.redraw({ ...PANE.props, isFocused: true })
  putSession(world, 701, 'busy', T0 + 50_000)
  await clock.advance(3_000)
  expect(await layoutOf(ui)).toEqual(['waiting-group', 'card-701', 'card-703', 'busy-group', 'card-705'])
  await ui.unmount()

  // Pane 被關掉（沒有 ui.close），馬上用指令重開；打開時焦點就在監看視窗裡
  world.panes.delete('switchboard')
  await $.command.run(SESSIONS)
  await clock.settle()
  const again = await $.ui.mount({ ...PANE, surface: 'terminal' as Surface, props: { ...PANE.props, isFocused: true } })
  expect(await layoutOf(again)).toEqual(['waiting-group', 'card-703', 'busy-group', 'card-701', 'card-705'])
  expect(await goOf(again, 703)).toMatchObject({ hotkey: '1' })

  await again.unmount()
})

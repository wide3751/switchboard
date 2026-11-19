import { expect, mock, test } from 'claude-code/testing'

import { contextTokens } from '../hooks/board'
import { PANE, SESSIONS, T0, fakeWorld, putSelf } from './world'

// 上下文使用量（context-usage/01）：監看視窗頁首「目前這個」Session 的一列

type Drawn = { type: string; key?: string; props: Record<string, unknown>; text?: string; children?: unknown[] }

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：頁首預設收合，只有百分比加 4 格短條`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const world = fakeWorld(on, [surface])
    putSelf(world, 900)
    world.usage = { window: 200_000, percent: 42 }

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })

    expect((await ui.find({ key: 'context-usage' }))?.text).toBe('上下文使用量 ▸ 42% ▰▰▱▱')

    await ui.unmount()
  })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：點頁首那一列展開，出現 10 格條與實際的 token 數；再點收合；展開狀態存進設定`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const world = fakeWorld(on, [surface])
    putSelf(world, 900)
    world.usage = { window: 200_000, percent: 42, tokens: 84_000 }

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ key: 'context-usage-detail' })).toBeUndefined()

    await ui.press({ key: 'context-usage' })
    expect((await ui.find({ key: 'context-usage' }))?.text).toBe('上下文使用量 ▾')
    expect((await ui.find({ key: 'context-usage-detail' }))?.text).toBe('▰▰▰▰▱▱▱▱▱▱ 42% · 84k / 200k')
    expect((world.stored.get('view') as { isContextOpen?: boolean }).isContextOpen).toBe(true)

    await ui.press({ key: 'context-usage' })
    expect((await ui.find({ key: 'context-usage' }))?.text).toBe('上下文使用量 ▸ 42% ▰▰▱▱')
    expect(await ui.find({ key: 'context-usage-detail' })).toBeUndefined()

    await ui.unmount()
  })
}

test('contextTokens：實際 token 數與視窗大小，萬以上四捨五入到 k，千位留一位小數', () => {
  expect(contextTokens(84_000, 200_000)).toEqual({ used: '84k', total: '200k' })
  expect(contextTokens(0, 200_000)).toEqual({ used: '0', total: '200k' })
  expect(contextTokens(7_240, 200_000)).toEqual({ used: '7.2k', total: '200k' })
  expect(contextTokens(2_000, 1_000_000)).toEqual({ used: '2k', total: '1000k' })
  expect(contextTokens(400, 200_000)).toEqual({ used: '400', total: '200k' })
})

const textsOf = (node: unknown): { text: string; props: Record<string, unknown> }[] => {
  if (typeof node !== 'object' || node === null) return []
  const one = node as Drawn
  const kids = (one.children ?? []).flatMap(textsOf)
  if (one.type !== 'Text') return kids
  const own = (one.children ?? []).filter(kid => typeof kid === 'string').join('')

  return [{ text: own, props: one.props }, ...kids]
}

test('引擎一開始就查不到用量：整列不畫，也不畫 0% 或錯誤', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  putSelf(world, 900)
  world.usage = 'throws'

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await ui.find({ key: 'context-usage' })).toBeUndefined()

  await ui.unmount()
})

test('單次查不到沿用上一次的值，連續三次查不到才隱藏；查到了又回來', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  putSelf(world, 900)
  world.usage = { window: 200_000, percent: 42 }

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ key: 'context-usage' }))?.text).toBe('上下文使用量 ▸ 42% ▰▰▱▱')

  world.usage = 'throws'
  await clock.advance(3_000)
  await clock.advance(3_000)
  expect((await ui.find({ key: 'context-usage' }))?.text).toBe('上下文使用量 ▸ 42% ▰▰▱▱')
  await clock.advance(3_000)
  expect(await ui.find({ key: 'context-usage' })).toBeUndefined()

  world.usage = { window: 200_000, percent: 50 }
  await clock.advance(3_000)
  expect((await ui.find({ key: 'context-usage' }))?.text).toBe('上下文使用量 ▸ 50% ▰▰▱▱')

  await ui.unmount()
})

const CATEGORIES = [
  { name: 'System prompt', tokens: 7_240, kind: 'used' },
  { name: 'Messages', tokens: 76_760, kind: 'used' },
  { name: 'Deferred tools', tokens: 9_000, kind: 'deferred' },
  { name: 'Free space', tokens: 76_000, kind: 'free' },
  { name: 'Autocompact buffer', tokens: 40_000, kind: 'buffer' },
]

test('展開才多要分類明細（summary）；每個分類一列，隨選載入的不佔視窗、百分比寫 —', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  putSelf(world, 900)
  world.usage = { window: 200_000, percent: 42, tokens: 84_000, categories: CATEGORIES }

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  // 收合：只呼叫免費的 usage()，不要分類
  expect(world.usageArgs.every(one => (one as { breakdown?: string }).breakdown === undefined)).toBe(true)
  expect(await ui.find({ key: 'context-usage-cat-0' })).toBeUndefined()

  // 按下去馬上要分類明細，不用等下一輪掃描
  await ui.press({ key: 'context-usage' })
  expect(world.usageArgs.some(one => (one as { breakdown?: string }).breakdown === 'summary')).toBe(true)
  const rows = []
  for (let i = 0; i < 6; i++) rows.push((await ui.find({ key: `context-usage-cat-${i}` }))?.text)
  expect(rows).toEqual([
    '▰ System prompt · 7.2k · 4%',
    '▰ Messages · 77k · 38%',
    '▰ Deferred tools · 9k · —',
    '▰ Free space · 76k · 38%',
    '▰ Autocompact buffer · 40k · 20%',
    undefined,
  ])

  await ui.unmount()
})

test('分類明細查不到：展開仍有條和 token 數，沒有分類列', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'], {}, { view: { isContextOpen: true } })
  putSelf(world, 900)
  world.usage = { window: 200_000, percent: 42, tokens: 84_000, categories: CATEGORIES }
  world.isBreakdownBroken = true

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await ui.find({ key: 'context-usage-detail' }))?.text).toBe('▰▰▰▰▱▱▱▱▱▱ 42% · 84k / 200k')
  expect(await ui.find({ key: 'context-usage-cat-0' })).toBeUndefined()

  await ui.unmount()
})

test('80% 以上變成警示色、95% 以上變錯誤色；文字照樣寫出百分比', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  putSelf(world, 900)
  world.usage = { window: 200_000, percent: 85 }

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  const colored = textsOf(await ui.find({ key: 'context-usage' })).find(one => one.text.includes('85%'))
  expect(colored?.props.color).toBe('warning')

  world.usage = { window: 200_000, percent: 96 }
  await clock.advance(3_000)
  const hot = textsOf(await ui.find({ key: 'context-usage' })).find(one => one.text.includes('96%'))
  expect(hot?.props.color).toBe('error')

  await ui.unmount()
})

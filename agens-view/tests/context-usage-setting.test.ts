import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { LOCALES, messagesOf } from '../hooks/i18n'
import { PANE, SESSIONS, T0, fakeWorld, putSelf } from './world'

// 上下文使用量（context-usage/02）：一般設定裡的開關與多語系

const open = async (
  $: Parameters<TestBody>[0],
  on: Parameters<TestBody>[1],
  store: Record<string, unknown> = {},
) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'], {}, store)
  putSelf(world, 900)
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  return { world, ui, clock }
}

test('一般設定有「上下文使用量」開關，預設勾選；關掉整列消失並存進設定，再勾回來', async ($, on) => {
  const { world, ui } = await open($, on)
  expect((await ui.find({ key: 'context-usage' }))?.text).toBe('上下文使用量 ▸')

  await ui.press({ key: 'settings' })
  expect((await ui.find({ key: 'context-usage-setting' }))?.text).toBe('☑ 上下文使用量')
  await ui.press({ key: 'context-usage-setting' })
  expect((await ui.find({ key: 'context-usage-setting' }))?.text).toBe('☐ 上下文使用量')
  expect(world.stored.get('view')).toMatchObject({ contextUsage: false })
  expect(await ui.find({ key: 'context-usage' })).toBeUndefined()

  await ui.press({ key: 'context-usage-setting' })
  expect(world.stored.get('view')).toMatchObject({ contextUsage: true })
  expect((await ui.find({ key: 'context-usage' }))?.text).toBe('上下文使用量 ▸')

  await ui.unmount()
})

test('舊的設定沒有這一項：當作開啟；存了關閉就不畫', async ($, on) => {
  const old = await open($, on, { view: { autoOpen: true, billing: 'auto', locale: 'auto' } })
  expect((await old.ui.find({ key: 'context-usage' }))?.text).toBe('上下文使用量 ▸')
  await old.ui.unmount()
})

test('存了關閉：頁首不畫那一列，展開狀態仍留著', async ($, on) => {
  const { ui, world } = await open($, on, { view: { contextUsage: false, isContextOpen: true } })
  expect(await ui.find({ key: 'context-usage' })).toBeUndefined()
  expect(world.stored.get('view')).toMatchObject({ isContextOpen: true })
  await ui.unmount()
})

test('還原預設值：上下文使用量開關回到開啟，展開狀態不動', async ($, on) => {
  const { ui, world } = await open($, on, { view: { contextUsage: false, isContextOpen: true } })
  await ui.press({ key: 'settings' })
  await ui.press({ key: 'panel-reset' })
  expect(world.stored.get('view')).toMatchObject({ contextUsage: true, isContextOpen: true })
  await ui.unmount()
})

test('每個介面語言都有標籤，沒有任何語言叫「背景資訊」', () => {
  for (const { locale } of LOCALES) {
    const m = messagesOf(locale)
    expect(m.contextUsage.length).toBeGreaterThan(0)
    expect(m.panel.contextUsage.length).toBeGreaterThan(0)
    expect(JSON.stringify([m.contextUsage, m.panel.contextUsage, m.labels.contextUsage(42, true)])).not.toContain('背景資訊')
  }
})

test('開關關掉：不再為這一列呼叫 usage()', async ($, on) => {
  const { ui, world, clock } = await open($, on, { view: { contextUsage: false } })
  const before = world.usageArgs.length
  await clock.advance(9_000)
  expect(world.usageArgs.length).toBe(before)
  await ui.unmount()
})

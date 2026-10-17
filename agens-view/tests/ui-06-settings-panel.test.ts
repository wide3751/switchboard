import { expect, mock, test } from 'claude-code/testing'

import { DEFAULT_FIELDS, PRESETS, VALID_FIELDS, densityOf } from '../hooks/board'
import { LOCALES, messagesOf } from '../hooks/i18n'
import { PANE, SESSIONS, T0, fakeWorld, put } from './world'

// 設定面板（ui-consensus/06）

type Drawn = { type: string; key?: string; props: Record<string, unknown>; children?: unknown[] }

/** 元素底下的所有元素，依畫面順序；子元素的 key 在 props.key */
const all = (node: unknown): Drawn[] => {
  if (typeof node !== 'object' || node === null) return []
  const one = node as Drawn

  return [{ ...one, key: one.key ?? (one.props.key as string | undefined) }, ...(one.children ?? []).flatMap(all)]
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：面板先「卡片內容 · 分區」再「一般」；底部「完成」關掉面板，不加 ▴`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 + 60_000 })
    const world = fakeWorld(on, [surface])
    put(world, 6101, 'busy')
    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })
    const text = async (key: string) => (await ui.find({ key }))?.text

    await ui.press({ key: 'settings' })
    const keys = all(await ui.find({ key: 'view-panel' })).map(one => one.key)
    const cards = keys.indexOf('panel-cards')
    const general = keys.indexOf('panel-general')
    const footer = keys.indexOf('panel-footer')
    expect(cards).toBeGreaterThan(-1)
    expect(general).toBeGreaterThan(cards)
    expect(footer).toBeGreaterThan(general)
    // 不加子框：兩區都沒有外框
    for (const key of ['panel-cards', 'panel-general']) {
      expect((await ui.find({ key }))?.props.borderStyle).toBeUndefined()
    }
    expect(await text('panel-cards-title')).toBe('卡片內容 · 待處理')
    expect(await text('panel-general-title')).toBe('一般')

    expect(await text('panel-done')).toBe('完成')
    await ui.press({ key: 'panel-done' })
    expect(await ui.find({ key: 'view-panel' })).toBeUndefined()
    expect(await text('settings')).toBe('設定 ▸')

    await ui.unmount()
  })

  test(`${surface}：自動打開先寫標題再列選項，☑/☐ 的 label 帶狀態`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const world = fakeWorld(on, [surface])
    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })
    const find = (key: string) => ui.find({ key })

    await ui.press({ key: 'settings' })
    expect((await find('auto-open-row'))?.text).toBe('自動打開監看視窗☑ Desktop Session☐ CLI Session')
    // label 帶上標題當上下文（ui-consensus/08）
    expect((await find('auto-open'))?.props.label).toBe('自動打開監看視窗（Desktop Session）：已開啟')
    expect((await find('auto-open-cli'))?.props.label).toBe('自動打開監看視窗（CLI Session）：已關閉')
    expect((await find('view-panel'))?.text).not.toContain('都顯示')

    await ui.press({ key: 'auto-open-cli' })
    expect((await find('auto-open-cli'))?.text).toBe('☑ CLI Session')
    expect((await find('auto-open-cli'))?.props.label).toBe('自動打開監看視窗（CLI Session）：已開啟')
    // 欄位的開關也一樣
    expect((await find('field-time'))?.props.label).toBe('時間：已開啟')
    expect((await find('field-model'))?.props.label).toBe('模型：已關閉')

    await ui.unmount()
  })
}

test('五種語言都有自動打開的標題、兩個選項、帶狀態的 label，舊的長句拿掉了', () => {
  for (const { locale } of LOCALES) {
    const m = messagesOf(locale)
    for (const one of [m.panel.autoOpenTitle, m.panel.autoOpenDesktop, m.panel.autoOpenTerminal, m.panel.cardContent, m.panel.done]) {
      expect(one.length).toBeGreaterThan(0)
    }
    expect(m.panel.checked('X', true)).not.toBe(m.panel.checked('X', false))
    expect(m.panel.checked('X', true)).toContain('X')
    expect('autoOpen' in m.panel).toBe(false)
    expect('autoOpenCli' in m.panel).toBe(false)
  }
  expect(messagesOf('en').panel.checked('Desktop sessions', true)).toBe('Desktop sessions: on')
})

test('densityOf 只比對有效欄位：預設值各自是一種密度，勾掉無效欄位不會變成自訂', () => {
  expect(densityOf(DEFAULT_FIELDS.waiting, VALID_FIELDS.waiting)).toBe('standard')
  expect(densityOf(DEFAULT_FIELDS.busy, VALID_FIELDS.busy)).toBe('standard')
  expect(densityOf(DEFAULT_FIELDS.idle, VALID_FIELDS.idle)).toBe('compact')
  // 待處理的標準密度少了「最後回覆」「進度」：這些在待處理本來就沒作用
  const withoutInvalid = PRESETS.standard.filter(one => !['reply', 'progress', 'activity'].includes(one))
  expect(densityOf(withoutInvalid, VALID_FIELDS.waiting)).toBe('standard')
  expect(densityOf(withoutInvalid, VALID_FIELDS.busy)).toBeNull()
  // 沒給有效欄位時照舊比對全部
  expect(densityOf(withoutInvalid)).toBeNull()
})

test('分區選擇存進 store：重開面板記得上次的分區，不寫進檢視設定', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const title = async () => (await ui.find({ key: 'panel-cards-title' }))?.text

  await ui.press({ key: 'settings' })
  expect(await title()).toBe('卡片內容 · 待處理')
  expect((await ui.find({ key: 'group-waiting' }))?.props.variant).toBe('primary')
  await ui.press({ key: 'group-idle' })
  expect(world.stored.get('settingsGroup')).toBe('idle')
  await ui.press({ key: 'panel-done' })

  await ui.press({ key: 'settings' })
  expect(await title()).toBe('卡片內容 · 閒置')
  expect((await ui.find({ key: 'group-idle' }))?.props.variant).toBe('primary')
  expect(world.stored.get('view') ?? {}).not.toHaveProperty('settingsGroup')

  await ui.unmount()
})

test('新的 Session 打開面板時用 store 裡上次的分區；存的值不對就用待處理', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'], {}, { settingsGroup: 'busy' })
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const title = async () => (await ui.find({ key: 'panel-cards-title' }))?.text

  await ui.press({ key: 'settings' })
  expect(await title()).toBe('卡片內容 · 工作中')
  await ui.press({ key: 'settings' })

  world.stored.set('settingsGroup', 'nope')
  await ui.press({ key: 'settings' })
  expect(await title()).toBe('卡片內容 · 待處理')

  await ui.unmount()
})

test('desktop：語言、計費用 Select', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 6301, 'busy')
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await ui.press({ key: 'settings' })
  const locale = await ui.find({ key: 'locale' })
  expect(locale?.type).toBe('Select')
  expect(locale?.props.label).toBe('語言')
  expect(locale?.props.value).toBe('auto')
  expect((locale?.props.options as { value: string; label?: string }[]).map(one => one.label)).toEqual([
    '自動',
    'English',
    '日本語',
    '한국어',
    '简体中文',
    '繁體中文',
  ])
  expect(await ui.find({ key: 'locale-en' })).toBeUndefined()
  const billing = await ui.find({ key: 'billing' })
  expect(billing?.type).toBe('Select')
  expect(billing?.props.value).toBe('auto')
  expect(await ui.find({ key: 'billing-api' })).toBeUndefined()

  await ui.select({ key: 'locale', value: 'en' })
  expect((await ui.find({ key: 'section-busy' }))?.text).toBe('◉ Working 1')
  expect(world.stored.get('view')).toMatchObject({ locale: 'en' })
  await ui.select({ key: 'billing', value: 'api' })
  expect(world.stored.get('view')).toMatchObject({ billing: 'api' })

  await ui.unmount()
})

test('terminal：語言、計費維持按鈕列', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  fakeWorld(on, ['terminal'])
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'settings' })
  expect(await ui.find({ key: 'locale' })).toBeUndefined()
  expect(await ui.find({ key: 'billing' })).toBeUndefined()
  expect((await ui.find({ key: 'locale-en' }))?.text).toBe('English')
  expect((await ui.find({ key: 'billing-api' }))?.text).toBe('API')

  await ui.unmount()
})

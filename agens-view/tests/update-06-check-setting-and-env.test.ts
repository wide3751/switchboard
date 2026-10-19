import { expect, mock, test } from 'claude-code/testing'
import { BAND, PANE, SESSIONS, T0, engineBand, fakeWorld } from './world'

// 檢查更新開關與環境變數（update-check/06）：設定 ▸ › 一般 的「檢查更新」預設開；
// Claude Code 自己表明不要非必要流量的環境變數任一有值時也不檢查

const MINUTE = 60_000
/** 上次檢查是兩小時前，看到 1.3.0（已安裝的是 1.2.0）：下一次判斷就會連網 */
const SEEN_NEWER = { updateCheckedAt: T0 - 2 * 60 * MINUTE, updateLatest: '1.3.0' }

type Drawn = { type: string; key?: string; props: Record<string, unknown>; children?: unknown[] }

/** 元素底下所有元素的 key，依畫面順序 */
const keysIn = (node: unknown): string[] => {
  if (typeof node !== 'object' || node === null) return []
  const one = node as Drawn
  const key = one.key ?? (one.props.key as string | undefined)

  return [...(key === undefined ? [] : [key]), ...(one.children ?? []).flatMap(keysIn)]
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：一般設定裡有「檢查更新」，預設勾選，自成一列排在自動打開後面`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    fakeWorld(on, [surface])
    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })

    await ui.press({ key: 'settings' })
    const box = await ui.find({ key: 'check-updates' })
    expect(box?.text).toBe('☑ 檢查更新')
    expect(box?.props.label).toBe(surface === 'terminal' ? '檢查更新：已開啟' : box?.text)
    const general = keysIn(await ui.find({ key: 'panel-general' }))
    expect(general.indexOf('check-updates-row')).toBeGreaterThan(general.indexOf('auto-open-row'))
    expect(keysIn(await ui.find({ key: 'check-updates-row' }))).toContain('check-updates')
    expect(await ui.find({ key: 'panel-reset' })).toBeUndefined()
    await ui.unmount()
  })
}

test('舊的設定沒有這一項：當作開啟，照常檢查更新', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { view: { autoOpen: true, autoOpenCli: false, billing: 'auto', locale: 'auto' } })
  world.published = '1.3.0'

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.advance(MINUTE)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(world.fetches).toHaveLength(1)
  expect((await ui.find({ key: 'update-version' }))?.text).toBe('⇡ 新版 1.3.0')
  await ui.press({ key: 'settings' })
  expect((await ui.find({ key: 'check-updates' }))?.text).toBe('☑ 檢查更新')
  await ui.unmount()
})

test('關掉：已經顯示的新版提示馬上消失，之後不連網；再打開，下一次判斷照常檢查', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, SEEN_NEWER)
  world.published = '1.3.0'

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'update-version' }))?.text).toBe('⇡ 新版 1.3.0')

  await ui.press({ key: 'settings' })
  await ui.press({ key: 'check-updates' })
  expect((await ui.find({ key: 'check-updates' }))?.text).toBe('☐ 檢查更新')
  expect((await ui.find({ key: 'check-updates' }))?.props.label).toBe('檢查更新：已關閉')
  expect(world.stored.get('view')).toMatchObject({ checkUpdates: false })
  expect(await ui.find({ key: 'update-notice' })).toBeUndefined()

  await clock.advance(2 * MINUTE)
  expect(world.fetches).toHaveLength(0)
  expect(await ui.find({ key: 'update-notice' })).toBeUndefined()

  await ui.press({ key: 'check-updates' })
  expect(world.stored.get('view')).toMatchObject({ checkUpdates: true })
  expect((await ui.find({ key: 'update-version' }))?.text).toBe('⇡ 新版 1.3.0')
  expect(world.fetches).toHaveLength(0)
  await clock.advance(MINUTE)
  expect(world.fetches).toHaveLength(1)
  await ui.unmount()
})

test('別的 Session 關掉：監看視窗 3 秒內、打開按鈕 15 秒內跟著消失', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'], {}, { updateCheckedAt: T0, updateLatest: '1.3.0' })
  engineBand(on)

  // 這個 Session 的監看視窗開著（Desktop 預設自動打開）
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ key: 'update-version' }))?.text).toBe('⇡ 新版 1.3.0')
  world.stored.set('view', { checkUpdates: false })
  await clock.advance(3_000)
  expect(await ui.find({ key: 'update-notice' })).toBeUndefined()
  await ui.unmount()

  // 監看視窗關著：輕量掃描時跟著消失
  world.stored.set('view', { checkUpdates: true })
  world.panes.delete('switchboard')
  await clock.advance(3_000)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await band.find({ key: 'open-board' }))?.text).toBe('⇡ 新版 · ▦ 打開')
  world.stored.set('view', { checkUpdates: false })
  await clock.advance(15_000)
  expect((await band.find({ key: 'open-board' }))?.text).toBe('▦ 打開監看視窗')
  await band.unmount()
})

for (const name of ['DISABLE_UPDATES', 'DISABLE_AUTOUPDATER', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC']) {
  test(`${name} 有值：不連網，也不顯示新版提示和標記，不管設定開關`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const world = fakeWorld(on, ['terminal'], { [name]: '1' }, { view: { autoOpen: false, autoOpenCli: false, checkUpdates: true }, ...SEEN_NEWER })
    world.published = '1.4.0'
    engineBand(on)

    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await clock.advance(2 * MINUTE)
    expect(world.fetches).toHaveLength(0)
    const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect((await band.find({ key: 'open-board' }))?.text).toBe('▦ 打開監看視窗')
    await band.press({ key: 'open-board' })
    await clock.settle()
    await band.unmount()
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await ui.find({ key: 'update-notice' })).toBeUndefined()
    await ui.unmount()
  })
}

test('環境變數設成空字串不算有值：照常檢查', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], { DISABLE_UPDATES: '', DISABLE_AUTOUPDATER: '', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '' })

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.advance(MINUTE)
  expect(world.fetches).toHaveLength(1)
})

test('關掉檢查更新不影響卡片內容的精簡／標準／詳細；還原預設值會把它打開', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'settings' })
  await ui.press({ key: 'check-updates' })
  expect((await ui.find({ key: 'density-standard' }))?.props.variant).toBe('primary')
  expect((await ui.find({ key: 'density-row' }))?.text).not.toContain('自訂')

  expect((await ui.find({ key: 'panel-reset' }))?.text).toBe('還原預設值')
  await ui.press({ key: 'panel-reset' })
  expect((await ui.find({ key: 'check-updates' }))?.text).toBe('☑ 檢查更新')
  expect(world.stored.get('view')).toMatchObject({ checkUpdates: true })
  await ui.unmount()
})

for (const [locale, text, label] of [
  ['en', '☑ Check for updates', 'Check for updates: on'],
  ['ja', '☑ 更新を確認', '更新を確認：オン'],
  ['ko', '☑ 업데이트 확인', '업데이트 확인: 켜짐'],
  ['zh-CN', '☑ 检查更新', '检查更新：已开启'],
  ['zh-TW', '☑ 檢查更新', '檢查更新：已開啟'],
] as const) {
  test(`多國語言（${locale}）：「檢查更新」開關`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    fakeWorld(on, ['terminal'], {}, { view: { locale } })
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

    await ui.press({ key: 'settings' })
    expect((await ui.find({ key: 'check-updates' }))?.text).toBe(text)
    expect((await ui.find({ key: 'check-updates' }))?.props.label).toBe(label)
    await ui.unmount()
  })
}

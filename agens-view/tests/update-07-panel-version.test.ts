import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { On } from 'claude-code'
import { PANE, SESSIONS, T0, UPDATE_COMMANDS, fakeWorld, type World } from './world'

// 設定面板的版本列：「檢查更新」旁邊是這次載入的版本號；有新版時接 ⇡ 新版 和「立即更新」

/** 已安裝 1.2.0；store 可以先放別的 Session 看到的公布版本 */
const panel = async ($: Parameters<TestBody>[0], on: On, surface: 'terminal' | 'desktop', store: Record<string, unknown> = {}) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, [surface], {}, { view: { autoOpen: false, autoOpenCli: false }, ...store })
  world.installed = '1.2.0'
  await $.session.start({ cwd: '/work', surface, isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface })
  await ui.press({ key: 'settings' })
  const text = async (key: string) => (await ui.find({ key }))?.text

  return { clock, world, ui, text }
}

const claudeRuns = (world: World) => world.commands.filter(argv => argv[0] === 'claude')

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：面板顯示目前版本；沒有新版就沒有更新按鈕`, async ($, on) => {
    const { ui, text } = await panel($, on, surface)
    expect(await text('panel-version')).toBe('目前版本 1.2.0')
    expect(await ui.find({ key: 'panel-update' })).toBeUndefined()
    await ui.unmount()
  })

  test(`${surface}：有新版時面板出現 ⇡ 新版 和「立即更新」，按下跑更新的兩個指令`, async ($, on) => {
    const { clock, world, ui, text } = await panel($, on, surface, { updateCheckedAt: T0, updateLatest: '1.3.0' })
    expect(await text('panel-update')).toContain('⇡ 新版 1.3.0')
    expect(await text('panel-update-now')).toBe('立即更新')

    await ui.press({ key: 'panel-update-now' })
    await clock.settle()
    expect(claudeRuns(world)).toEqual(UPDATE_COMMANDS.map(argv => [...argv]))
    expect(await ui.find({ key: 'panel-update' })).toBeUndefined()
    expect(await text('update-done')).toBe('已更新到 1.3.0，重啟 Session 或輸入 /reload-plugins 生效')
    await ui.unmount()
  })
}

test('關掉檢查更新：面板仍顯示目前版本，但不提示新版', async ($, on) => {
  const { ui, text } = await panel($, on, 'terminal', {
    updateCheckedAt: T0,
    updateLatest: '1.3.0',
    view: { autoOpen: false, autoOpenCli: false, checkUpdates: false },
  })
  expect(await text('panel-version')).toBe('目前版本 1.2.0')
  expect(await ui.find({ key: 'panel-update' })).toBeUndefined()
  await ui.unmount()
})

test('略過這一版：面板也不再提示', async ($, on) => {
  const { ui } = await panel($, on, 'terminal', { updateCheckedAt: T0, updateLatest: '1.3.0', updateSkipped: '1.3.0' })
  expect(await ui.find({ key: 'panel-update' })).toBeUndefined()
  await ui.unmount()
})

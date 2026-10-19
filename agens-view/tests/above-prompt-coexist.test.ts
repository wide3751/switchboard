import { expect, mock, test } from 'claude-code/testing'
import type { On, RenderElement } from 'claude-code'
import { BAND, T0, fakeWorld, putSelf } from './world'

// 輸入框上方（AbovePrompt）和其他 plugin 共存：ui.render 的 hook 由外層到內層巢狀，
// 外層不呼叫 next，內層就完全不執行。switchboard 先 next(e) 讓內層畫，再把自己的按鈕列疊在上面

/** 載入順序排在 switchboard 後面的 plugin：自己畫一顆按鈕、不呼叫 next */
const otherBand = (on: On) =>
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box, Button } = $.ui.resolve(e)
    return h(Box, { key: 'other-band' }, h(Button, { key: 'other-open', onPress: () => {} }, 'other')) as RenderElement
  })

const buttonKeys = async (band: { findAll: (query: { type: string }) => Promise<{ key?: string }[]> }) =>
  (await band.findAll({ type: 'Button' })).map(one => one.key)

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface} 監看視窗關著時，打開按鈕疊在後面 plugin 的畫面上方，兩個都畫出來`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    fakeWorld(on, [surface], {}, { view: { autoOpen: false, autoOpenCli: false } })
    otherBand(on)

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await clock.settle()
    const band = await $.ui.mount({ ...BAND, surface })
    expect(await buttonKeys(band)).toEqual(['open-board', 'other-open'])
    await band.unmount()
  })
}

test('打開按鈕帶 ⇡ 新版 時仍是同一顆按鈕，後面 plugin 的畫面照樣畫出來', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  fakeWorld(on, ['terminal'], {}, { view: { autoOpen: false, autoOpenCli: false }, updateCheckedAt: T0, updateLatest: '1.3.0' })
  otherBand(on)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await band.find({ key: 'open-board' }))?.text).toBe('⇡ 新版 · ▦ 打開')
  expect(await buttonKeys(band)).toEqual(['open-board', 'other-open'])
  await band.unmount()
})

test('有「不再自動打開」時，後面 plugin 的畫面也照樣畫出來', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { view: { autoOpenCli: true } })
  putSelf(world, 900)
  otherBand(on)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  world.panes.delete('switchboard')
  await clock.advance(3_000)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await buttonKeys(band)).toEqual(['open-board', 'stop-auto-open', 'other-open'])
  await band.unmount()
})

test('有提問框或監看視窗開著時讓位：只畫後面 plugin 的畫面', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  fakeWorld(on, ['terminal'], {}, { view: { autoOpenCli: true } })
  otherBand(on)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const opened = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await buttonKeys(opened)).toEqual(['other-open'])
  await opened.unmount()

  const survey = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true }, surface: 'terminal' })
  expect(await buttonKeys(survey)).toEqual(['other-open'])
  await survey.unmount()
})

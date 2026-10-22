import { expect, mock, test } from 'claude-code/testing'

import { LOCALES, messagesOf } from '../hooks/i18n'
import { BAND, DIR, PANE, SESSIONS, T0, engineBand, fakeWorld, put, report } from './world'

// 只有符號的控件補上 label（ui-consensus/08）：畫面不變，label 寫成文字說明。
// Button 有 children、沒給 label 時引擎會拿 children 的文字當 label（例如 `▸`、`#12 ↗`），
// 所以這裡檢查 label 裡有文字，不只檢查有沒有 label。
// Desktop 實際上會把 label 畫出來取代 children（展開鈕變成「顯示明細：{標題}」撐破卡片），所以 label 只在終端機給。

const WORK = { name: 'feature/x', ahead: 1, behind: 0, changed: 1, insertions: 12, deletions: 3 }

/** label 裡至少有一個字母或漢字，不是只有符號、數字和空白 */
const hasWords = (label: unknown) => typeof label === 'string' && /\p{L}/u.test(label)

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：監看視窗裡每個按鈕的 label 都有文字說明，不是只有符號`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 + 60_000 })
    const world = fakeWorld(on, [surface])
    put(world, 8101, 'waiting')
    report(world, 8101, { approval: '$ npm i' })
    for (const [pid, state] of [
      [8102, 'OPEN'],
      [8103, 'MERGED'],
      [8104, 'CLOSED'],
    ] as const) {
      put(world, pid, 'busy')
      report(world, pid, { branch: WORK, pr: { number: 12, state, url: `https://github.com/o/r/pull/${pid}` } })
    }
    put(world, 8105, 'idle')

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'settings' })
    await ui.press({ key: 'expand-8102' })

    const buttons = await ui.findAll({ type: 'Button' })
    // 涵蓋展開鈕、PR、閒置收合、☑/☐
    const keys = buttons.map(one => one.key)
    for (const key of ['expand-8101', 'expand-8102', 'pr-8102', 'pr-8103', 'pr-8104', 'toggle-idle', 'auto-open', 'field-time']) {
      expect(keys).toContain(key)
    }
    // Desktop 不另給 label（見下一個測試）；終端機的 label 要有文字說明
    if (surface === 'terminal') {
      const bare = buttons.filter(one => !hasWords(one.props.label)).map(one => `${one.key}=${String(one.props.label)}`)
      expect(bare).toEqual([])
    }

    await ui.unmount()
  })
}

/** label 和畫面文字不同的按鈕：`key=label ≠ text` */
const labelDrawnOver = (buttons: { key?: string; text: string; props: { label?: unknown } }[]) =>
  buttons.filter(one => one.props.label !== one.text).map(one => `${one.key}=${String(one.props.label)} ≠ ${one.text}`)

// Desktop 會把 Button 的 label 畫出來、取代 children（mods 文件說只當名稱，實機不是），
// 0.8.0 的展開鈕因此變成「顯示明細：{標題}」撐破卡片。所以 Desktop 上每一顆按鈕的 label 都要等於畫面上的文字。
// 這裡把監看視窗和打開按鈕能畫出來的按鈕盡量都畫出來，新增的按鈕也會被這個測試涵蓋。
test('desktop：每一顆按鈕的 label 都等於畫面上的文字，不會被 Desktop 畫成別的字', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'], {}, { view: { autoOpen: false, autoOpenCli: false } })
  world.files.set(
    `${DIR}/8601.json`,
    JSON.stringify({ pid: 8601, sessionId: 's-8601', hostSessionId: 'local_8601', status: 'waiting', cwd: '/work/a', statusUpdatedAt: T0 }),
  )
  world.alive.add(8601)
  report(world, 8601, { approval: '$ npm i' })
  for (const [pid, state] of [
    [8602, 'OPEN'],
    [8603, 'MERGED'],
    [8604, 'CLOSED'],
  ] as const) {
    put(world, pid, 'busy')
    report(world, pid, { branch: WORK, pr: { number: 12, state, url: `https://github.com/o/r/pull/${pid}` } })
  }
  put(world, 8605, 'idle')
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const bandButtons = await band.findAll({ type: 'Button' })
  expect(bandButtons.map(one => one.key)).toContain('open-board')
  expect(labelDrawnOver(bandButtons)).toEqual([])
  await band.unmount()

  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'settings' })
  await ui.press({ key: 'auto-open-cli' })
  await ui.press({ key: 'expand-8602' })

  const buttons = await ui.findAll({ type: 'Button' })
  const keys = buttons.map(one => one.key)
  for (const key of ['go-button-8601', 'expand-8601', 'expand-8602', 'pr-8602', 'pr-8603', 'pr-8604', 'toggle-idle', 'auto-open', 'field-time', 'panel-reset', 'panel-done']) {
    expect(keys).toContain(key)
  }
  expect(labelDrawnOver(buttons)).toEqual([])

  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：新版提示的按鈕、帶 ⇡ 新版 的打開按鈕也照這個規則`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const world = fakeWorld(on, [surface], {}, { view: { autoOpen: false, autoOpenCli: false }, updateCheckedAt: T0, updateLatest: '1.3.0' })
    put(world, 8701, 'waiting')
    engineBand(on)
    // 終端機：label 有文字說明；Desktop：label 等於畫面上的文字
    const offending = (buttons: { key?: string; text: string; props: { label?: unknown } }[]) =>
      surface === 'terminal'
        ? buttons.filter(one => !hasWords(one.props.label)).map(one => `${one.key}=${String(one.props.label)}`)
        : labelDrawnOver(buttons)

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await clock.settle()
    const band = await $.ui.mount({ ...BAND, surface })
    expect((await band.find({ key: 'open-board' }))?.text).toContain('⇡')
    expect(offending(await band.findAll({ type: 'Button' }))).toEqual([])
    await band.press({ key: 'open-board' })
    await clock.settle()
    await band.unmount()

    const ui = await $.ui.mount({ ...PANE, surface })
    const keys = async () => (await ui.findAll({ type: 'Button' })).map(one => one.key)
    expect(await keys()).toEqual(expect.arrayContaining(['update-now', 'update-skip']))
    expect(offending(await ui.findAll({ type: 'Button' }))).toEqual([])

    // 更新失敗後只剩「這版略過」
    world.claudeFailure = 'missing'
    await ui.press({ key: 'update-now' })
    await clock.settle()
    expect(await keys()).toContain('update-skip')
    expect(offending(await ui.findAll({ type: 'Button' }))).toEqual([])
    await ui.unmount()
  })
}

test('展開鈕畫面是時間加 ▸／▾，label 寫「顯示明細：{標題}」「收起明細：{標題}」，標題被截短時 label 仍是完整標題', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['terminal'])
  const long = '一個很長很長的 Session 標題，終端機窄的時候畫不下'
  world.files.set(
    `${DIR}/8201.json`,
    JSON.stringify({ pid: 8201, sessionId: 's-8201', status: 'busy', cwd: '/work/x', name: long, statusUpdatedAt: T0 }),
  )
  world.alive.add(8201)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, bodyColumns: 40 } })

  expect((await ui.find({ key: 'jump-8201' }))?.text).not.toBe(long)
  const expand = await ui.find({ key: 'expand-8201' })
  expect(expand?.text).toBe('1m ▸')
  expect(expand?.props.label).toBe(`顯示明細：${long}`)

  await ui.press({ key: 'expand-8201' })
  const open = await ui.find({ key: 'expand-8201' })
  expect(open?.text).toBe('1m ▾')
  expect(open?.props.label).toBe(`收起明細：${long}`)

  await ui.unmount()
})

test('PR 的 label 寫出編號和狀態：打開 PR #12（開啟中／已合併／已關閉），畫面文字不變', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['terminal'])
  const states = [
    [8301, 'OPEN', '#12 ↗', '打開 PR #12（開啟中）'],
    [8302, 'MERGED', '#12 ↗ 已合併', '打開 PR #12（已合併）'],
    [8303, 'CLOSED', '#12', '打開 PR #12（已關閉）'],
  ] as const
  for (const [pid, state] of states) {
    put(world, pid, 'busy')
    report(world, pid, { branch: WORK, pr: { number: 12, state, url: `https://github.com/o/r/pull/${pid}` } })
  }

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  for (const [pid, , text, label] of states) {
    const button = await ui.find({ key: `pr-${pid}` })
    expect(button?.text).toBe(text)
    expect(button?.props.label).toBe(label)
  }

  await ui.unmount()
})

test('閒置收合的 label 說明按下會做什麼：收合／展開閒置的 n 個 Session，畫面文字不變', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['terminal'])
  put(world, 8401, 'idle')
  put(world, 8402, 'idle')

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  const toggle = async () => await ui.find({ key: 'toggle-idle' })
  expect((await toggle())?.text).toBe('○ 閒置 2 ▾')
  expect((await toggle())?.props.label).toBe('收合閒置的 2 個 Session')
  await ui.press({ key: 'toggle-idle' })
  expect((await toggle())?.text).toBe('○ 閒置 2 ▸')
  expect((await toggle())?.props.label).toBe('展開閒置的 2 個 Session')

  await ui.unmount()
})

test('自動打開的 ☑/☐ label 帶上「自動打開監看視窗」的上下文；欄位的 ☑/☐ 照舊只寫名稱和狀態', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const find = (key: string) => ui.find({ key })

  await ui.press({ key: 'settings' })
  expect((await find('auto-open'))?.text).toBe('☑ Desktop Session')
  expect((await find('auto-open'))?.props.label).toBe('自動打開監看視窗（Desktop Session）：已開啟')
  expect((await find('auto-open-cli'))?.props.label).toBe('自動打開監看視窗（CLI Session）：已關閉')
  expect((await find('field-time'))?.props.label).toBe('時間：已開啟')

  await ui.unmount()
})

test('打開按鈕的 label 不帶 ▦：沒有計數時是「打開監看視窗」，畫面仍是 ▦ 打開監看視窗', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { view: { autoOpen: false, autoOpenCli: false } })
  put(world, 8501, 'busy')
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  const button = await band.find({ key: 'open-board' })
  expect(button?.text).toBe('▦ 打開監看視窗')
  expect(button?.props.label).toBe('打開監看視窗')
  await band.unmount()
})

test('五種語言都有這些 label：帶上標題、編號、數量，狀態不同時寫法不同', () => {
  for (const { locale } of LOCALES) {
    const { labels } = messagesOf(locale)
    expect(labels.expand('X', false)).toContain('X')
    expect(labels.expand('X', true)).toContain('X')
    expect(labels.expand('X', true)).not.toBe(labels.expand('X', false))

    const prs = ['OPEN', 'MERGED', 'CLOSED'].map(state => labels.pr(12, state))
    for (const one of prs) expect(one).toContain('12')
    expect(new Set(prs).size).toBe(3)

    expect(labels.idle(3, true)).toContain('3')
    expect(labels.idle(3, true)).not.toBe(labels.idle(3, false))

    expect(labels.autoOpen('Y', true)).toContain('Y')
    expect(labels.autoOpen('Y', true)).not.toBe(labels.autoOpen('Y', false))

    for (const one of [labels.expand('X', false), ...prs, labels.idle(3, true), labels.autoOpen('Y', true)]) {
      expect(hasWords(one.replace(/[XY]/g, ''))).toBe(true)
    }
  }
  expect(messagesOf('en').labels.pr(12, 'MERGED')).toBe('Open PR #12 (merged)')
  expect(messagesOf('en').labels.idle(1, false)).toBe('Collapse 1 idle session')
})

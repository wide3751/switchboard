import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import { PANE, SESSIONS, T0, fakeWorld, put, putSelf } from './world'

test('清單是 0 筆（連目前這個都讀不到）時，頁首說看不到 Session 狀態並說明讀不到紀錄，不說沒有其他 Session', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  fakeWorld(on, ['desktop'])

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text ?? ''

  expect(await text('count')).toBe('⚠ 目前看不到 Session 狀態')
  expect(await text('summary')).toContain('/Users/tester/.claude/sessions')
  expect(await text('summary')).toContain('找不到任何 Session 紀錄')
  expect(await text('header')).not.toContain('沒有其他執行中的 Session')
  expect(await text('header')).not.toContain('沒有待處理的 Session')

  await ui.unmount()
})

test('讀不到 sessions 資料夾時，除了路徑還說下一步該檢查什麼', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  world.isSessionsUnreadable = true

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const summary = (await ui.find({ key: 'summary' }))?.text ?? ''

  expect(summary).toContain('/Users/tester/.claude/sessions')
  expect(summary).toContain('讀取權限')
  expect(summary).toContain('CLAUDE_CONFIG_DIR')

  await ui.unmount()
})

for (const surface of ['desktop', 'terminal'] as const) {
  test(`${surface}：清單只有目前這一列時，引導再開其他 Session；有其他 Session 後引導消失`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const world = fakeWorld(on, [surface])
    putSelf(world, 900)

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })

    expect(await ui.find({ key: 'card-900' })).toBeDefined()
    const hint = (await ui.find({ key: 'only-self' }))?.text ?? ''
    expect(hint).toContain('再開其他 Session（Desktop 或終端機）就會出現在這裡')
    expect(hint).toContain('安裝前就開著的要重開')

    put(world, 101, 'idle')
    await clock.advance(3_000)
    expect(await ui.find({ key: 'card-101' })).toBeDefined()
    expect(await ui.find({ key: 'only-self' })).toBeUndefined()

    await ui.unmount()
  })
}

test('清單只有一列但不是目前這個時，不顯示引導', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 101, 'idle')

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await ui.find({ key: 'card-101' })).toBeDefined()
  expect(await ui.find({ key: 'only-self' })).toBeUndefined()

  await ui.unmount()
})

/** 記下 mod 跳出的 toast。 */
const collectToasts = (on: On) => {
  const toasts: string[] = []
  on('ui.toast', (_$, e) => {
    toasts.push(String(e.text))
    return { value: undefined }
  })
  return toasts
}

test('Desktop 手動關掉監看視窗時跳 toast：重開 Session 會再自動打開，並寫出關掉自動打開的完整路徑', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  const toasts = collectToasts(on)
  putSelf(world, 900)

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await clock.settle()
  expect(world.opened).toEqual(['switchboard'])
  expect(toasts).toEqual([])

  // 使用者按下 Pane 的關閉鈕
  world.panes.delete('switchboard')
  await clock.advance(3_000)
  expect(toasts).toHaveLength(1)
  expect(toasts[0]).toBe(
    '已關閉監看視窗。重開 Session 時會再自動打開。要全面關掉：監看視窗 › 設定 ▸ › 一般 › 取消「自動打開監看視窗 › Desktop Session」',
  )

  // 只說一次
  await clock.advance(30_000)
  expect(toasts).toHaveLength(1)
})

test('CLI 開了自動打開時，手動關掉的 toast 指向 CLI 的開關', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { view: { autoOpenCli: true } })
  const toasts = collectToasts(on)
  putSelf(world, 900)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  world.panes.delete('switchboard')
  await clock.advance(3_000)

  expect(toasts).toHaveLength(1)
  expect(toasts[0]).toContain('監看視窗 › 設定 ▸ › 一般 › 取消「自動打開監看視窗 › CLI Session」')
})

test('沒有開自動打開時，手動關掉不跳 toast（重開 Session 也不會自動打開）', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  const toasts = collectToasts(on)
  putSelf(world, 900)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  world.panes.delete('switchboard')
  await clock.advance(3_000)

  expect(toasts).toEqual([])
})

test('監看視窗右上角的按鈕叫「設定 ▸」，打開後是「設定 ▾」', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  putSelf(world, 900)

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await ui.find({ key: 'settings' }))?.text).toBe('設定 ▸')
  await ui.press({ key: 'settings' })
  expect((await ui.find({ key: 'settings' }))?.text).toBe('設定 ▾')

  await ui.unmount()
})

test('macOS 上 /switchboard:open 只說已打開，不多加平台說明', async ($, on) => {
  mock.clock(on, { now: T0 })
  fakeWorld(on, ['desktop'], {}, { view: { autoOpen: false } })

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  const ran = await $.command.run(SESSIONS)

  expect(ran.text).toBe('已打開監看視窗。')
})

test('不在 macOS（例如 Linux）時，/switchboard:open 照樣打開，另外說明點卡片跳轉不能用', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  world.uname = 'Linux'

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  const ran = await $.command.run(SESSIONS)

  expect(world.opened).toEqual(['switchboard'])
  expect(ran.text).toContain('已打開監看視窗。')
  expect(ran.text).toContain('不是 macOS')
  expect(ran.text).toContain('跳轉')
})

test('Windows 上 /switchboard:open 說明沒有 ps、看不到狀態', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], { OS: 'Windows_NT' })
  world.uname = null

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  const ran = await $.command.run(SESSIONS)

  expect(ran.text).toContain('Windows')
  expect(ran.text).toContain('ps')
  expect(ran.text).toContain('跳轉')
})

test('不在 macOS 的說明也跟著使用者的語言', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], { LANG: 'en_US.UTF-8' })
  world.uname = 'Linux'

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  const ran = await $.command.run(SESSIONS)

  expect(ran.text).toContain('Board opened.')
  expect(ran.text).toContain('macOS')
  expect(ran.text).not.toContain('跳轉')
})

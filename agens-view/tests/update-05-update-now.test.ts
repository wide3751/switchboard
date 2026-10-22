import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { On } from 'claude-code'
import { BAND, PANE, SESSIONS, T0, UPDATE_COMMANDS, engineBand, fakeWorld, type World } from './world'

// 立即更新（update-check/05）：只在使用者按下時跑 claude plugin 的兩個指令；失敗時顯示指令讓使用者自己貼

const MINUTE = 60_000
/** 別的 Session 剛檢查過，看到 1.3.0（已安裝的是 1.2.0） */
const SEEN_NEWER = { updateCheckedAt: T0, updateLatest: '1.3.0' }
const MANUAL = '沒有更新成功，請自己執行：claude plugin marketplace update switchboardclaude plugin update switchboard@switchboard'

const claudeRuns = (world: World) => world.commands.filter(argv => argv[0] === 'claude')

/** 打開監看視窗，頁首下方有 1.3.0 的新版提示 */
const boardWithNotice = async (
  $: Parameters<TestBody>[0],
  on: On,
  options: { surface?: 'terminal' | 'desktop'; store?: Record<string, unknown> } = {},
) => {
  const surface = options.surface ?? 'terminal'
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, [surface], {}, { view: { autoOpen: false, autoOpenCli: false }, ...SEEN_NEWER, ...options.store })
  engineBand(on)
  await $.session.start({ cwd: '/work', surface, isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface })
  const text = async (key: string) => (await ui.find({ key }))?.text

  return { clock, world, ui, text, surface }
}

/** 關掉監看視窗，看輸入框上方的打開按鈕 */
const bandText = async ($: Parameters<TestBody>[0], world: World, clock: { advance: (ms: number) => Promise<void> }, surface: 'terminal' | 'desktop') => {
  world.panes.delete('switchboard')
  await clock.advance(3_000)
  const band = await $.ui.mount({ ...BAND, surface })
  const text = (await band.find({ key: 'open-board' }))?.text
  await band.unmount()

  return text
}

test('沒按「立即更新」就從來不跑更新的指令', async ($, on) => {
  const { clock, world, ui, text } = await boardWithNotice($, on, { store: { updateCheckedAt: T0 - 2 * 60 * MINUTE } })
  world.published = '1.3.0'
  await clock.advance(2 * MINUTE)
  expect(world.fetches).toHaveLength(1)
  expect(await text('update-version')).toBe('⇡ 新版 1.3.0')
  expect(claudeRuns(world)).toEqual([])
  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：按「立即更新」依序跑兩個指令；成功後說明怎麼生效，⇡ 新版 也跟著消失`, async ($, on) => {
    const { clock, world, ui, text } = await boardWithNotice($, on, { surface })
    expect(await text('update-now')).toBe('立即更新')

    await ui.press({ key: 'update-now' })
    await clock.settle()
    expect(claudeRuns(world)).toEqual(UPDATE_COMMANDS.map(argv => [...argv]))
    expect(await text('update-done')).toBe('已更新到 1.3.0，重啟 Session 或輸入 /reload-plugins 生效')
    expect(await ui.find({ key: 'update-now' })).toBeUndefined()
    expect(await ui.find({ key: 'update-version' })).toBeUndefined()
    expect(world.stored.get('updateInstalled')).toBe('1.3.0')
    await ui.unmount()

    expect(await bandText($, world, clock, surface)).toBe('▦ 打開監看視窗')
  })
}

test('執行中顯示「更新中…」，沒有按鈕；再按一次也不會多跑一次', async ($, on) => {
  const { clock, world, ui, text } = await boardWithNotice($, on)
  world.claudeWait = () => clock.sleep(5_000)

  const first = ui.press({ key: 'update-now' })
  const second = ui.press({ key: 'update-now' })
  await clock.settle()
  expect(await text('update-running')).toBe('更新中…')
  expect(await ui.find({ key: 'update-now' })).toBeUndefined()
  expect(await ui.find({ key: 'update-skip' })).toBeUndefined()

  await clock.advance(10_000)
  await Promise.allSettled([first, second])
  expect(claudeRuns(world)).toEqual(UPDATE_COMMANDS.map(argv => [...argv]))
  expect(await text('update-done')).toBe('已更新到 1.3.0，重啟 Session 或輸入 /reload-plugins 生效')
  await ui.unmount()
})

test('更新中 mod 被重新載入（session.start 再跑一次）：不會一直停在「更新中…」', async ($, on) => {
  const { clock, world, ui, text } = await boardWithNotice($, on)
  world.claudeWait = () => clock.sleep(5_000)
  void ui.press({ key: 'update-now' })
  await clock.settle()
  expect(await text('update-running')).toBe('更新中…')

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(await text('update-now')).toBe('立即更新')
  await ui.unmount()
})

test('成功之後，檢查更新回報的仍是同一版：不會再亮', async ($, on) => {
  const { clock, world, ui, text, surface } = await boardWithNotice($, on)
  await ui.press({ key: 'update-now' })
  await clock.settle()

  // 一小時後的檢查：main 上仍是 1.3.0，這次載入的程式仍是 1.2.0（重新載入前不會變）
  world.published = '1.3.0'
  world.stored.set('updateCheckedAt', T0 - 60 * MINUTE)
  await clock.advance(MINUTE)
  expect(world.fetches).toHaveLength(1)
  expect(await ui.find({ key: 'update-now' })).toBeUndefined()
  expect(await text('update-done')).toBe('已更新到 1.3.0，重啟 Session 或輸入 /reload-plugins 生效')
  await ui.unmount()

  expect(await bandText($, world, clock, surface)).toBe('▦ 打開監看視窗')
})

test('別的 Session 更新成功：這個 Session 的 ⇡ 新版 在輕量掃描時消失，重開也不再出現', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], {}, { view: { autoOpen: false, autoOpenCli: false }, ...SEEN_NEWER })
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await band.find({ key: 'open-board' }))?.text).toBe('⇡ 新版 · ▦ 打開')

  world.stored.set('updateInstalled', '1.3.0')
  await clock.advance(15_000)
  expect((await band.find({ key: 'open-board' }))?.text).toBe('▦ 打開監看視窗')
  await band.press({ key: 'open-board' })
  await clock.settle()
  await band.unmount()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'update-notice' })).toBeUndefined()
  await ui.unmount()
})

for (const [name, failure, ran] of [
  ['找不到 claude 指令', 'missing', 1],
  ['第一步以非零結束：不跑第二步', { step: 1, exitCode: 1 }, 1],
  ['第二步以非零結束', { step: 2, exitCode: 1 }, 2],
] as const) {
  test(`${name}：改顯示兩個指令讓使用者自己執行，不顯示錯誤細節`, async ($, on) => {
    const { clock, world, ui, text } = await boardWithNotice($, on)
    world.claudeFailure = failure

    await ui.press({ key: 'update-now' })
    await clock.settle()
    expect(claudeRuns(world)).toEqual(UPDATE_COMMANDS.slice(0, ran).map(argv => [...argv]))
    expect(await text('update-commands')).toBe(MANUAL)
    expect(await text('update-version')).toBe('⇡ 新版 1.3.0')
    expect(await ui.find({ key: 'update-now' })).toBeUndefined()
    expect(world.stored.get('updateInstalled')).toBeUndefined()
    // 自己更新之前，打開按鈕上的 ⇡ 新版 照樣在
    await ui.unmount()
    expect(await bandText($, world, clock, 'terminal')).toBe('⇡ 新版 · ▦ 打開')
  })
}

test('失敗後按「這版略過」：指令和提示一起收起來', async ($, on) => {
  const { clock, world, ui } = await boardWithNotice($, on)
  world.claudeFailure = { step: 1, exitCode: 1 }
  await ui.press({ key: 'update-now' })
  await clock.settle()
  expect(await ui.find({ key: 'update-commands' })).toBeDefined()

  await ui.press({ key: 'update-skip' })
  expect(await ui.find({ key: 'update-notice' })).toBeUndefined()
  expect(world.stored.get('updateSkipped')).toBe('1.3.0')
  await ui.unmount()
})

test('卡住超過 60 秒：放棄並顯示兩個指令', async ($, on) => {
  const { clock, world, ui, text } = await boardWithNotice($, on)
  world.claudeFailure = { step: 1, hang: timeoutMs => clock.sleep(timeoutMs) }

  void ui.press({ key: 'update-now' })
  await clock.settle()
  await clock.advance(59_000)
  expect(await text('update-running')).toBe('更新中…')
  await clock.advance(1_000)
  expect(await text('update-commands')).toBe(MANUAL)
  expect(claudeRuns(world)).toHaveLength(1)
  await ui.unmount()
})

test('60 秒是兩個指令合計：第一步花了 50 秒，第二步只剩 10 秒', async ($, on) => {
  const { clock, world, ui, text } = await boardWithNotice($, on)
  world.claudeWait = step => (step === 1 ? clock.sleep(50_000) : Promise.resolve())
  world.claudeFailure = { step: 2, hang: timeoutMs => clock.sleep(timeoutMs) }

  void ui.press({ key: 'update-now' })
  await clock.settle()
  await clock.advance(59_000)
  expect(claudeRuns(world)).toHaveLength(2)
  expect(await text('update-running')).toBe('更新中…')
  await clock.advance(1_000)
  expect(await text('update-commands')).toBe(MANUAL)
  await ui.unmount()
})

for (const [locale, now, running, done, manual] of [
  ['en', 'Update now', 'Updating…', 'Updated to 1.3.0. Restart the session or run /reload-plugins to use it', 'The update didn’t go through. Run these yourself:'],
  ['ja', '今すぐ更新', '更新中…', '1.3.0 に更新しました。セッションを再起動するか /reload-plugins を入力すると反映されます', '更新できませんでした。次のコマンドを自分で実行してください：'],
  ['ko', '지금 업데이트', '업데이트 중…', '1.3.0(으)로 업데이트했습니다. 세션을 다시 시작하거나 /reload-plugins를 입력하면 적용됩니다', '업데이트하지 못했습니다. 다음 명령을 직접 실행하세요:'],
  ['zh-CN', '立即更新', '更新中…', '已更新到 1.3.0，重启 Session 或输入 /reload-plugins 生效', '没有更新成功，请自己运行：'],
  ['zh-TW', '立即更新', '更新中…', '已更新到 1.3.0，重啟 Session 或輸入 /reload-plugins 生效', '沒有更新成功，請自己執行：'],
] as const) {
  test(`多國語言（${locale}）：立即更新、更新中、已更新、自己執行`, async ($, on) => {
    const { clock, world, ui, text } = await boardWithNotice($, on, { store: { view: { locale } } })
    expect(await text('update-now')).toBe(now)

    world.claudeWait = () => clock.sleep(1_000)
    void ui.press({ key: 'update-now' })
    await clock.settle()
    expect(await text('update-running')).toBe(running)
    await clock.advance(2_000)
    expect(await text('update-done')).toBe(done)

    // 再來一版，這次失敗
    world.claudeWait = undefined
    world.claudeFailure = 'missing'
    world.stored.set('updateLatest', '1.4.0')
    await clock.advance(3_000)
    await ui.press({ key: 'update-now' })
    await clock.settle()
    expect(await text('update-commands')).toBe(`${manual}${UPDATE_COMMANDS.map(argv => argv.join(' ')).join('')}`)
    await ui.unmount()
  })
}

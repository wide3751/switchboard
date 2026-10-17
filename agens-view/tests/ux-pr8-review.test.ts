import { expect, mock, test } from 'claude-code/testing'

import { maskSecrets, summarizeTool } from '../hooks/board'
import { BAND, T0, engineBand, fakeWorld, put } from './world'

// ── PR #8 review：遮罩的漏網 ──────────────────────────────────────────

test('遮罩：多行指令的引號在第一行沒閉合，第一行的值照樣遮掉', () => {
  expect(summarizeTool('Bash', { command: 'export DB_PASSWORD="abc\ndef" && run' })).toBe('$ export DB_PASSWORD=••• && run')
  expect(summarizeTool('Bash', { command: "export API_KEY='abc\ndef' && run" })).toBe('$ export API_KEY=••• && run')
  // 只取第一行的話，引號沒閉合的值也要遮到結尾
  expect(maskSecrets('export DB_PASSWORD="abc')).toBe('export DB_PASSWORD=•••')
})

test('遮罩：網址帳密的密碼含 @ 時整段遮掉，不只遮前半', () => {
  expect(maskSecrets('psql postgres://admin:p@ss@db:5432/app')).toBe('psql postgres://admin:•••@db:5432/app')
  expect(maskSecrets('git clone https://oauth2:a@b@gitlab.com/o/r.git')).toBe('git clone https://oauth2:•••@gitlab.com/o/r.git')
  // 一般網址不受影響
  expect(maskSecrets('curl https://user@example.com/a@b')).toBe('curl https://user@example.com/a@b')
})

// ── PR #8 review：關掉監看視窗後，按鈕不能顯示打開之前的舊計數 ─────────

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：開著的期間處理完了，關掉後按鈕不帶打開之前的計數，輕量掃描卡住也一樣`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const world = fakeWorld(on, [surface], {}, { view: { autoOpen: false, autoOpenCli: false } })
    put(world, 341, 'waiting')
    engineBand(on)

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await clock.settle()
    const band = await $.ui.mount({ ...BAND, surface })
    expect((await band.find({ key: 'open-board' }))?.text).toBe('▦ 打開監看視窗 · ▲1')
    await band.press({ key: 'open-board' })
    await clock.settle()

    // 開著的期間 341 處理完了
    put(world, 341, 'idle')
    await clock.advance(3_000)

    // 關掉之後的輕量掃描卡住（ps 不回答）
    world.psWait = () => clock.sleep(60_000)
    world.panes.delete('switchboard')
    await clock.advance(3_000)
    expect((await band.find({ key: 'open-board' }))?.text).toBe('▦ 打開監看視窗')
    await band.unmount()
  })
}

test('打開監看視窗前就在跑的輕量掃描很晚才回來：不蓋掉監看視窗掃到的較新計數', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'], {}, { view: { autoOpen: false } })
  put(world, 351, 'waiting')
  engineBand(on)

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })

  // 下一次輕量掃描的 ps 卡住 20 秒；這段時間使用者打開監看視窗，351 處理完了
  world.psWait = () => clock.sleep(20_000)
  await clock.advance(15_000)
  world.psWait = undefined
  put(world, 351, 'idle')
  await band.press({ key: 'open-board' })
  await clock.advance(6_000)

  // 使用者關掉，卡住的輕量掃描（看到的還是 351 在等）之後才回來
  world.panes.delete('switchboard')
  await clock.advance(3_000)
  // t=36：卡住的那次在 t=35 回來，下一次輕量掃描要到 t=39
  await clock.advance(12_000)
  expect((await band.find({ key: 'open-board' }))?.text).toBe('▦ 打開監看視窗')
  await band.unmount()
})

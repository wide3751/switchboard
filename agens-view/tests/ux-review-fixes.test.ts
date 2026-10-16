import { expect, mock, test } from 'claude-code/testing'

import { BAND, REPORTS, T0, engineBand, fakeWorld, put, putSelf, type World } from './world'

/** 這個 Session 自己（sessionId 是 me）寫出的狀態回報。 */
const mine = (world: World) => JSON.parse(world.files.get(`${REPORTS}/me.json`) ?? 'null')

// ── 1. poll 進行中關掉監看視窗 ─────────────────────────────────────────
// 測試工具發不出 ui.close（mod 自己不呼叫 $.ui.close，引擎不讓測試呼叫），
// 和既有測試一樣，以把 Pane 從 panes() 拿掉代表使用者關掉

test('掃描卡住時關掉監看視窗：掃描回來、等你計數變了，也不會把監看視窗重新打開', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  engineBand(on)
  putSelf(world, 900)

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await clock.settle()
  expect(world.opened).toEqual(['switchboard'])

  // 下一次掃描的 ps 一分鐘後才回答；這段時間有 Session 進入需要你處理，使用者關掉監看視窗
  world.psWait = () => clock.sleep(60_000)
  put(world, 101, 'waiting')
  await clock.advance(3_000)
  world.psWait = undefined
  world.panes.delete('switchboard')
  await clock.advance(60_000)

  expect(world.panes.has('switchboard')).toBe(false)
  expect(world.opened).toEqual(['switchboard'])
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await band.find({ key: 'open-board' }))?.text).toBe('▦ 打開監看視窗 · ▲1')
  await band.unmount()
})

// ── 3. 最後回覆摘要與出錯中止也要遮罩 ───────────────────────────────────

test('最後回覆摘要和出錯中止的訊息寫進狀態回報之前先遮罩', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.turn.start({ turnId: 't1', text: '幫我設定部署' })
  await $.turn.complete({ turnId: 't1', answer: '已經設定好，用 VERCEL_TOKEN=abc123xyz 部署', reason: 'end_turn' })
  expect(mine(world).lastReply).toBe('已經設定好，用 VERCEL_TOKEN=••• 部署')

  await $.turn.start({ turnId: 't2', text: '再試一次' })
  await $.turn.complete({
    turnId: 't2',
    answer: 'API Error: 401 invalid x-api-key sk-ant-api03-AbCdEf1234567890',
    reason: 'error',
  })
  expect(mine(world).turnError).toBe('API Error: 401 invalid x-api-key •••')
})

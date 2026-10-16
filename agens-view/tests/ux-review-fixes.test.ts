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

// ── 4. 一筆 session 紀錄都沒有時不清回報 ─────────────────────────────────

test('sessions 資料夾讀得到但一筆紀錄都沒有（連目前這個都沒有）時，不把其他 Session 的回報當成殘留刪掉', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  world.files.set(`${REPORTS}/s-401.json`, JSON.stringify({ sessionId: 's-401', reportedAt: 1 }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

  expect(world.removed).toEqual([])
  expect(world.files.has(`${REPORTS}/s-401.json`)).toBe(true)
})

// ── 5. 回合結束的第二次寫入不能蓋掉新回合的背景任務 ─────────────────────

/** 讓 git 和 gh 卡住（大 repo、慢網路），回傳放行的函式。 */
const slowDown = (world: World) => {
  let release = () => {}
  world.slowCommands = new Promise<void>(resolve => {
    release = resolve
  })

  return () => release()
}

/** 等還在跑的 hook 做到 check 成立為止（git、gh 放行前一直卡著）。 */
const settle = async (check: () => void) => {
  for (let i = 0; i < 2_000; i += 1) {
    try {
      check()
      return
    } catch {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }
  check()
}

test('回合結束後、分支和 PR 補上之前，新回合開了背景任務：補上的回報不會把背景任務蓋回舊的清單', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', () => ({ result: '' }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.turn.start({ turnId: 't1', text: '跑測試' })
  const release = slowDown(world)
  const completing = $.turn.complete({ turnId: 't1', answer: '測試都過了', reason: 'end_turn' })
  await settle(() => expect(mine(world).lastReply).toBe('測試都過了'))

  // 使用者馬上送出下一句，新回合在背景開了 dev server
  await clock.advance(1_000)
  await $.turn.start({ turnId: 't2', text: '開 dev server' })
  await $.tool.call({ tool: 'Bash', tool_use_id: 'b1', command: 'npm run dev', run_in_background: true })
  expect(mine(world).tasks).toEqual([{ kind: 'bash', label: '$ npm run dev', status: 'running' }])

  release()
  await completing
  expect(mine(world)).toMatchObject({
    tasks: [{ kind: 'bash', label: '$ npm run dev', status: 'running' }],
    branch: { name: 'feature/cards' },
  })
})

// ── 7. 熱重載後沿用回報裡的主題 ─────────────────────────────────────────

test('mod 熱重載（或 resume）後，Session 沿用回報裡原本的主題，不會換成重載後的下一句 prompt', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  // 重載前的這個 Session 已經寫過回報，主題是第一句 prompt
  world.files.set(`${REPORTS}/me.json`, JSON.stringify({ sessionId: 'me', reportedAt: T0 - 60_000, topic: '把監看視窗的標題改成第一句 prompt' }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  expect(mine(world).topic).toBe('把監看視窗的標題改成第一句 prompt')
  await $.turn.start({ turnId: 't9', text: '好，繼續' })

  expect(mine(world).topic).toBe('把監看視窗的標題改成第一句 prompt')
})

// ── 8. 啟動時的輕量掃描不能拖住啟動太久 ─────────────────────────────────

for (const surface of ['vscode', 'terminal'] as const) {
  test(`${surface}：啟動時 ps 卡住不結束，最多等和 git 一樣的 5 秒，之後照樣補上分支和 PR`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    const world = fakeWorld(on, [surface])
    put(world, 801, 'idle')
    world.psHang = timeoutMs => clock.sleep(timeoutMs)

    let isStarted = false
    const starting = $.session.start({ cwd: '/work', surface, isInteractive: true }).then(() => {
      isStarted = true
    })
    await clock.advance(5_000)
    expect(isStarted).toBe(true)
    await starting

    expect(mine(world)).toMatchObject({ branch: { name: 'feature/cards' }, pr: { number: 12 } })
  })
}

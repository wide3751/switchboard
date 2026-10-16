import { expect, mock, test } from 'claude-code/testing'
import { fakeWorld, REPORTS, T0, type World } from './world'

const MINE = `${REPORTS}/me.json`

const mine = (world: World) => JSON.parse(world.files.get(MINE) ?? 'null')

/** 讓 git 和 gh 卡住（大 repo、慢網路），回傳放行的函式。 */
const slowDown = (world: World) => {
  let release = () => {}
  world.slowCommands = new Promise<void>(resolve => {
    release = resolve
  })

  return () => release()
}

/** 讓還在等的 hook 跑到下一個卡住的地方。 */
const flush = async () => {
  for (let i = 0; i < 20; i += 1) await new Promise(resolve => setTimeout(resolve, 0))
}

test('回合出錯中止時，git、gh 還沒回應，狀態回報就先記下出錯；分支和 PR 之後補上', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.turn.start({ turnId: 't1', prompt: '繼續' })
  const release = slowDown(world)
  const completing = $.turn.complete({ turnId: 't1', answer: 'API Error: 529 overloaded', reason: 'error' })
  await flush()

  expect(mine(world)).toMatchObject({
    turnStartedAt: null,
    approval: null,
    turnError: 'API Error: 529 overloaded',
    lastReply: 'API Error: 529 overloaded',
  })

  release()
  await completing
  expect(mine(world)).toMatchObject({
    turnError: 'API Error: 529 overloaded',
    branch: { name: 'feature/cards' },
    pr: { number: 12 },
  })
})

test('回合結束後、分支和 PR 補上之前，使用者馬上送出下一句：補上的回報不會蓋掉新回合的狀態', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.check', () => ({ decision: 'ask' as const }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.turn.start({ turnId: 't1', prompt: '繼續' })
  const release = slowDown(world)
  const completing = $.turn.complete({ turnId: 't1', answer: 'API Error: 529 overloaded', reason: 'error' })
  await flush()
  expect(mine(world).turnError).toBe('API Error: 529 overloaded')

  // 使用者馬上送出下一句，新回合一開始就要核准
  await clock.advance(1_000)
  await $.turn.start({ turnId: 't2', prompt: '再試一次' })
  await $.tool.check({ tool: 'Bash', input: { command: 'npm i' } })

  release()
  await completing
  expect(mine(world)).toMatchObject({
    turnStartedAt: T0 + 1_000,
    turnError: null,
    approval: '$ npm i',
    branch: { name: 'feature/cards' },
  })
})

test('Session 啟動時，git、gh 還沒回應就先寫出回報、自動打開監看視窗；分支和 PR 之後補上', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], { TERM_PROGRAM: 'iTerm.app' }, { view: { autoOpenCli: true } })
  const release = slowDown(world)

  const starting = $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await flush()

  expect(world.opened).toEqual(['switchboard'])
  expect(mine(world)).toMatchObject({ sessionId: 'me', model: 'claude-opus-5-5', terminal: 'iTerm.app', branch: null })

  release()
  await starting
  expect(mine(world)).toMatchObject({
    model: 'claude-opus-5-5',
    terminal: 'iTerm.app',
    branch: { name: 'feature/cards' },
    pr: { number: 12 },
    connectors: { connected: ['chrome-devtools'], needsAuth: ['figma'] },
  })
})

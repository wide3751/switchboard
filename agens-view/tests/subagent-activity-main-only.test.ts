import { expect, mock, test } from 'claude-code/testing'
import { PANE, SESSIONS, REPORTS, T0, fakeWorld, put, report, type World } from './world'

// 最近活動只反映主代理；等前景子代理時顯示「等待子代理 n 個」（subagent-visibility/03）

type Ctx = Parameters<Parameters<typeof test>[1]>[0]
type On = Parameters<Parameters<typeof test>[1]>[1]

const MINE = `${REPORTS}/me.json`
const mineOf = (world: World) => JSON.parse(world.files.get(MINE) ?? 'null')
const activityOf = (world: World) => mineOf(world)?.activity

/** 引擎的 agent.spawn：一啟動就回答，並出現在 agent.list */
const engineSpawns = (on: On, world: World, id: string, description = '找呼叫點') => {
  on('agent.spawn', () => {
    world.agents.push({ id, type: 'Explore', description, status: 'running' })

    return { model: 'haiku', agentId: id }
  })
}
const spawn = ($: Ctx, background: boolean) =>
  $.agent.spawn({ prompt: 'x', description: 'x', subagentType: 'Explore', background })

const start = async ($: Ctx, on: On) => {
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.turn.start({ turnId: 't1', prompt: '幫我查' })
}

const mainCall = ($: Ctx, command: string, id = 'm1') => $.tool.call({ tool: 'Bash', tool_use_id: id, command })
const subCall = ($: Ctx, command: string, id = 's1', agentId = 'a1') =>
  $.tool.call({ tool: 'Bash', tool_use_id: id, command, agentId } as never)

// 前景子代理轉到背景（例如 Ctrl+B）：mod 收不到事件，改由「主代理不可能還在等它」的時機降級
// 主代理的 Agent 呼叫要等前景子代理跑完才回來；這裡讓引擎收到呼叫後停住，release() 才回答
const holdAgentCalls = (on: On) => {
  const held = new Map<string, { enter: () => void; isEntered: Promise<void>; release: () => void; isReleased: Promise<void> }>()
  const of = (id: string) => {
    const known = held.get(id)
    if (known !== undefined) return known
    let enter = () => {}
    let release = () => {}
    const isEntered = new Promise<void>(resolve => (enter = resolve))
    const isReleased = new Promise<void>(resolve => (release = resolve))
    const one = { enter, isEntered, release, isReleased }
    held.set(id, one)

    return one
  }
  on('tool.call', async (_$, e) => {
    if (e.tool === 'Agent') {
      const one = of(e.tool_use_id)
      one.enter()
      await one.isReleased
    }

    return { result: '' }
  })

  /** 主代理呼叫 Agent，等到引擎收到它；回傳讓它回來的 release */
  return async ($: Ctx, id: string) => {
    const call = $.tool.call({ tool: 'Agent', tool_use_id: id, description: '找呼叫點' } as never)
    await of(id).isEntered

    return {
      release: async () => {
        of(id).release()
        await call
      },
    }
  }
}

test('子代理自己的工具呼叫不改變 activity', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  on('tool.call', () => ({ result: '' }))
  await start($, on)

  await mainCall($, 'npm test')
  expect(activityOf(world)).toBe('$ npm test')

  await subCall($, 'find / -name x')
  expect(activityOf(world)).toBe('$ npm test')
})

test('子代理的工具呼叫照樣刷新背景任務（背景 Bash 仍登記）', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  on('tool.call', () => ({ result: '' }))
  await start($, on)

  await $.tool.call({ tool: 'Bash', tool_use_id: 'sb1', command: 'npm run dev', run_in_background: true, agentId: 'a1' } as never)

  expect(mineOf(world).tasks).toEqual([{ kind: 'bash', label: '$ npm run dev', status: 'running' }])
  expect(activityOf(world)).toBeNull()
})

test('有前景子代理執行中：activity 是「等待子代理 n 個」標記，不是子代理的動作', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  on('tool.call', () => ({ result: '' }))
  engineSpawns(on, world, 'a1')
  await start($, on)
  await mainCall($, 'npm test')

  await spawn($, false)
  expect(activityOf(world)).toBe('waiting-subagents:1')

  await subCall($, 'find / -name x')
  expect(activityOf(world)).toBe('waiting-subagents:1')
})

test('n 是執行中的前景數；等待中的前景也算，背景與完成的不算', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  on('tool.call', () => ({ result: '' }))
  on('turn.complete', () => ({ text: '' }))
  const ids = ['a1', 'a2', 'a3']
  on('agent.spawn', () => {
    const id = ids.shift() ?? 'x'
    world.agents.push({ id, type: 'Explore', description: id, status: 'running' })

    return { model: 'haiku', agentId: id }
  })
  await start($, on)
  await mainCall($, 'npm test')

  await spawn($, false)
  expect(activityOf(world)).toBe('waiting-subagents:1')

  await spawn($, false)
  expect(activityOf(world)).toBe('waiting-subagents:2')

  await spawn($, true)
  expect(activityOf(world)).toBe('waiting-subagents:2')

  world.agents[1]!.status = 'idle'
  await subCall($, 'ls', 's2', 'a2')
  expect(activityOf(world)).toBe('waiting-subagents:2')

  world.agents[1]!.status = 'completed'
  await subCall($, 'ls', 's3', 'a2')
  await $.turn.complete({ turnId: 'sub', answer: '', reason: 'answer', agentId: 'a2' })
  expect(activityOf(world)).toBe('waiting-subagents:1')
})

test('前景子代理的 turn.complete 之後回到主代理最近一次呼叫的摘要', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  on('tool.call', () => ({ result: '' }))
  on('turn.complete', () => ({ text: '' }))
  engineSpawns(on, world, 'a1')
  await start($, on)
  await mainCall($, 'npm test')
  await spawn($, false)
  await subCall($, 'find / -name x')

  world.agents[0]!.status = 'completed'
  await $.turn.complete({ turnId: 'sub', answer: '找到了', reason: 'done', agentId: 'a1' })

  expect(activityOf(world)).toBe('$ npm test')
})

test('只有背景子代理：activity 維持主代理自己的動作', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  on('tool.call', () => ({ result: '' }))
  engineSpawns(on, world, 'a1')
  await start($, on)
  await mainCall($, 'npm test')

  await spawn($, true)
  expect(activityOf(world)).toBe('$ npm test')

  await subCall($, 'find / -name x')
  expect(activityOf(world)).toBe('$ npm test')

  await mainCall($, 'git status', 'm2')
  expect(activityOf(world)).toBe('$ git status')
})

test('主代理回合結束：activity 清掉，之後刷新也不會又出現', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  on('tool.call', () => ({ result: '' }))
  on('turn.complete', () => ({ text: '' }))
  engineSpawns(on, world, 'a1')
  await start($, on)
  await mainCall($, 'npm test')
  await spawn($, false)

  await $.turn.complete({ turnId: 't1', answer: '好了', reason: 'done' })
  expect(activityOf(world)).toBeNull()

  await $.turn.complete({ turnId: 'sub', answer: '', reason: 'done', agentId: 'a1' })
  expect(activityOf(world)).toBeNull()
})

test('前景子代理結束後主代理又呼叫工具：顯示新的摘要', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  on('tool.call', () => ({ result: '' }))
  on('turn.complete', () => ({ text: '' }))
  engineSpawns(on, world, 'a1')
  await start($, on)
  await mainCall($, 'npm test')
  await spawn($, false)
  world.agents[0]!.status = 'completed'
  await $.turn.complete({ turnId: 'sub', answer: '', reason: 'done', agentId: 'a1' })

  await mainCall($, 'git diff', 'm2')

  expect(activityOf(world)).toBe('$ git diff')
})

// 卡片上看到的文字
const LANGS = [
  ['en', { LANG: 'en_US.UTF-8' }, 'Waiting on 2 subagents'],
  ['ja', { LANG: 'ja_JP.UTF-8' }, 'サブエージェント 2 件を待機中'],
  ['ko', { LANG: 'ko_KR.UTF-8' }, '서브에이전트 2개 대기 중'],
  ['zh-CN', { LANG: 'zh_CN.UTF-8' }, '等待子代理 2 个'],
  ['zh-TW', {}, '等待子代理 2 個'],
] as const

for (const [locale, env, expected] of LANGS) {
  test(`${locale}：卡片的最近活動顯示「${expected}」`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 + 60_000 })
    const world = fakeWorld(on, ['desktop'], env)
    put(world, 3101, 'busy')
    report(world, 3101, { activity: 'waiting-subagents:2' })

    await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

    expect((await ui.find({ key: 'context' }))?.text).toBe(expected)

    await ui.unmount()
  })
}

test('舊回報的純文字 activity 照舊顯示', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 3111, 'busy')
  report(world, 3111, { activity: '$ npm test' })

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await ui.find({ key: 'context' }))?.text).toBe('$ npm test')

  await ui.unmount()
})

test('並行時序：spawn 之前的 Read 不會蓋過「等待子代理」，spawn 與其後的 tool.call 交錯也不閃回摘要', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  const callAgent = holdAgentCalls(on)
  engineSpawns(on, world, 'a1')
  await start($, on)
  await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: '/work/a.ts' } as never)
  expect(activityOf(world)).toBe('Read a.ts')

  // 主代理的 Agent 呼叫進來、引擎派出子代理；呼叫要等子代理跑完才回來，期間子代理的呼叫交錯
  await callAgent($, 'm2')
  await spawn($, false)
  expect(activityOf(world)).toBe('waiting-subagents:1')
  await subCall($, 'ls', 's1')
  expect(activityOf(world)).toBe('waiting-subagents:1')
  await $.tool.call({ tool: 'Read', tool_use_id: 'r2', file_path: '/work/b.ts' } as never)
  expect(activityOf(world)).toBe('waiting-subagents:1')
})

test('前景轉背景：Agent 呼叫回來、子代理仍在跑，mode 變成 background，activity 回到主代理的摘要', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  const callAgent = holdAgentCalls(on)
  engineSpawns(on, world, 'a1')
  await start($, on)

  const call = await callAgent($, 'm1')
  const summary = activityOf(world)
  expect(summary).not.toBeNull()
  await spawn($, false)
  expect(activityOf(world)).toBe('waiting-subagents:1')

  await call.release()

  expect(mineOf(world).tasks).toEqual([{ kind: 'agent', label: 'Explore·找呼叫點', status: 'running', mode: 'background' }])
  expect(activityOf(world)).toBe(summary)
})

test('前景轉背景：主代理回合結束、再開新回合呼叫 Read，activity 是 Read 的摘要', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  on('tool.call', () => ({ result: '' }))
  on('turn.complete', () => ({ text: '' }))
  engineSpawns(on, world, 'a1')
  await start($, on)
  await spawn($, false)
  expect(activityOf(world)).toBe('waiting-subagents:1')

  await $.turn.complete({ turnId: 't1', answer: '它在背景跑', reason: 'answer' })
  await $.turn.start({ turnId: 't2', text: '順便看一下 a.ts' })
  await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: '/work/a.ts' } as never)

  expect(activityOf(world)).toBe('Read a.ts')
  expect(mineOf(world).tasks).toEqual([{ kind: 'agent', label: 'Explore·找呼叫點', status: 'running', mode: 'background' }])
})

test('兩個並行的前景 Agent 呼叫：一個回來、另一個還沒回來時，仍在等的那個維持前景', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  const callAgent = holdAgentCalls(on)
  const ids = ['a1', 'a2']
  on('agent.spawn', () => {
    const id = ids.shift() ?? 'x'
    world.agents.push({ id, type: 'Explore', description: id, status: 'running' })

    return { model: 'haiku', agentId: id }
  })
  await start($, on)
  const first = await callAgent($, 'm1')
  await spawn($, false)
  await callAgent($, 'm2')
  await spawn($, false)
  expect(activityOf(world)).toBe('waiting-subagents:2')

  world.agents[0]!.status = 'completed'
  await first.release()

  expect(activityOf(world)).toBe('waiting-subagents:1')
  expect(mineOf(world).tasks).toContainEqual({ kind: 'agent', label: 'Explore·a2', status: 'running', mode: 'foreground' })
})

test('和 Agent 呼叫並行的 Read 不會讓前景子代理被降級', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  const callAgent = holdAgentCalls(on)
  engineSpawns(on, world, 'a1')
  await start($, on)
  await callAgent($, 'm1')
  await spawn($, false)

  await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: '/work/a.ts' } as never)

  expect(activityOf(world)).toBe('waiting-subagents:1')
  expect(mineOf(world).tasks).toEqual([{ kind: 'agent', label: 'Explore·找呼叫點', status: 'running', mode: 'foreground' }])
})

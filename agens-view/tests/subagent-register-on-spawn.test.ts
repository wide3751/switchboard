import { expect, mock, test } from 'claude-code/testing'
import { REPORTS, T0, fakeWorld, type World } from './world'

const MINE = `${REPORTS}/me.json`

const tasksOf = (world: World) => JSON.parse(world.files.get(MINE) ?? 'null')?.tasks

/** 引擎的 agent.spawn：子代理一啟動（跑完之前）就回答，並出現在 agent.list */
const engineSpawns = (on: Parameters<Parameters<typeof test>[1]>[1], world: World, id: string) => {
  on('agent.spawn', () => {
    world.agents.push({ id, type: 'Explore', description: '找呼叫點', status: 'running' })

    return { model: 'haiku', agentId: id }
  })
}

const start = async ($: Parameters<Parameters<typeof test>[1]>[0]) => {
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
}

test('前景子代理一派出，還沒呼叫任何工具，狀態回報就列出它，mode 是 foreground', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  engineSpawns(on, world, 'a1')
  await start($)

  await $.agent.spawn({ prompt: '找呼叫點', description: '找呼叫點', subagentType: 'Explore', background: false })

  expect(tasksOf(world)).toEqual([{ kind: 'agent', label: 'Explore·找呼叫點', status: 'running', mode: 'foreground' }])
})

test('背景子代理的 mode 是 background', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  engineSpawns(on, world, 'a2')
  await start($)

  await $.agent.spawn({ prompt: '找呼叫點', description: '找呼叫點', subagentType: 'Explore', background: true })

  expect(tasksOf(world)).toEqual([{ kind: 'agent', label: 'Explore·找呼叫點', status: 'running', mode: 'background' }])
})

test('子代理自己的回合結束時刷新清單，完成後變成 done', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  engineSpawns(on, world, 'a3')
  on('turn.complete', () => ({ text: '' }))
  await start($)
  await $.agent.spawn({ prompt: '找呼叫點', description: '找呼叫點', subagentType: 'Explore', background: false })

  world.agents[0]!.status = 'completed'
  await $.turn.complete({ turnId: 'sub', answer: '找到了', reason: 'done', agentId: 'a3' })

  expect(tasksOf(world)).toEqual([{ kind: 'agent', label: 'Explore·找呼叫點', status: 'done', mode: 'foreground' }])
})

test('等待訊息的子代理（idle）算 waiting，不算 done', async ($, on) => {
  mock.clock(on, { now: T0 })
  on('turn.complete', () => ({ text: '' }))
  const world = fakeWorld(on, ['terminal'])
  engineSpawns(on, world, 'a4')
  await start($)

  await $.agent.spawn({ prompt: '找呼叫點', description: '找呼叫點', subagentType: 'Explore', background: true })
  world.agents[0]!.status = 'idle'
  await $.turn.complete({ turnId: 'sub', answer: '', reason: 'done', agentId: 'a4' })

  expect(tasksOf(world)?.[0]).toMatchObject({ status: 'waiting' })
})

test('不是這個 mod 派的（沒經過 agent.spawn）的子代理，沒有 mode，照舊顯示', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  world.agents.push({ id: 'old', type: 'Plan', description: '設計方案', status: 'running' })
  on('turn.complete', () => ({ text: '' }))
  await start($)

  await $.turn.complete({ turnId: 'sub', answer: '', reason: 'done', agentId: 'old' })

  expect(tasksOf(world)).toEqual([{ kind: 'agent', label: 'Plan·設計方案', status: 'running' }])
})

// 型別檔 AgentSpawnInput.background 是 boolean（必有），所以 undefined 只會出現在舊版引擎或測試；
// 現況：不是 true 一律當前景。固定這個行為，不改程式。
test('agent.spawn 的 background 沒給（undefined）時當前景', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  engineSpawns(on, world, 'a5')
  await start($)

  await $.agent.spawn({ prompt: '找呼叫點', description: '找呼叫點', subagentType: 'Explore' } as never)

  expect(tasksOf(world)).toEqual([{ kind: 'agent', label: 'Explore·找呼叫點', status: 'running', mode: 'foreground' }])
})

test('子代理的標題含疑似機密時，寫進狀態回報前先遮罩（名稱和描述都是）', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  on('agent.spawn', () => {
    world.agents.push(
      { id: 's1', type: 'general-purpose', description: '用 sk-abcdef1234567890 測 API', status: 'running' },
      { id: 's2', type: 'Explore', name: 'run with token=hunter2secret', description: '查設定', status: 'running' },
    )

    return { model: 'haiku', agentId: 's1' }
  })
  await start($)

  await $.agent.spawn({ prompt: 'x', description: 'x', subagentType: 'general-purpose', background: false })

  const report = world.files.get(MINE) ?? ''
  expect(report).not.toContain('sk-abcdef1234567890')
  expect(report).not.toContain('hunter2secret')
  expect(tasksOf(world).map((one: { label: string }) => one.label)).toEqual([
    'general-purpose·用 ••• 測 API',
    'Explore·run with token=•••',
  ])
})

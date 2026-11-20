import { expect, mock, test } from 'claude-code/testing'
import { PANE, REPORTS, SESSIONS, T0, fakeWorld, put, report, type World } from './world'

// 子卡片：前景 ⧗、失敗 !、等待 ⏸︎、背景只有標題；排序、上限、失敗留到下個回合（subagent-visibility/02）
// 前景標示用 ⧗（U+29D7，一格寬）：規格寫的 ⏳（U+23F3）是 EA=W，GLYPHS 的規則不收

type Task = { kind: 'agent' | 'bash'; label: string; status: string; mode?: 'foreground' | 'background' }
const agent = (name: string, status: string, mode?: Task['mode']): Task => ({
  kind: 'agent',
  label: `Explore·${name}`,
  status,
  ...(mode === undefined ? {} : { mode }),
})

type Ctx = Parameters<Parameters<typeof test>[1]>[0]

const mount = async ($: Ctx, clock: { settle: () => Promise<void> }) => {
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text

  return { ui, text }
}

const rows = async (text: (key: string) => Promise<string | undefined>, pid: number, count = 6) =>
  (await Promise.all(Array.from({ length: count }, (_, i) => text(`subtask-${pid}-${i}`)))).filter(one => one !== undefined)

test('標示：前景 ⧗、失敗 !、等待 ⏸︎、背景只有標題；正常完成的不顯示', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 2101, 'busy')
  report(world, 2101, {
    tasks: [
      agent('背景的', 'running', 'background'),
      agent('前景的', 'running', 'foreground'),
      agent('失敗的', 'failed', 'foreground'),
      agent('做完的', 'done', 'foreground'),
    ],
  })
  put(world, 2102, 'busy')
  report(world, 2102, { tasks: [agent('背景的', 'running', 'background'), agent('等待的', 'waiting', 'background')] })

  const { ui, text } = await mount($, clock)

  expect(await rows(text, 2101)).toEqual(['↳ ⧗ 前景的', '↳ ! 失敗的', '↳ 背景的'])
  expect(await rows(text, 2102)).toEqual(['↳ ⏸︎ 等待的', '↳ 背景的'])

  await ui.unmount()
})

test('沒有 mode 的舊回報當背景，只有標題', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 2111, 'busy')
  report(world, 2111, { tasks: [agent('舊的', 'running'), { kind: 'bash', label: '$ make', status: 'running' }] })

  const { ui, text } = await mount($, clock)

  expect(await rows(text, 2111)).toEqual(['↳ 舊的', '↳ $ make'])

  await ui.unmount()
})

test('排序：前景執行中、失敗、等待中、背景執行中；同組維持原順序；背景 Bash 算背景', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 2121, 'busy')
  report(world, 2121, {
    tasks: [
      agent('背景1', 'running', 'background'),
      { kind: 'bash', label: '$ dev', status: 'running' },
      agent('等待1', 'waiting', 'background'),
      agent('失敗1', 'failed', 'background'),
      agent('前景1', 'running', 'foreground'),
      agent('等待2', 'waiting', 'foreground'),
      agent('前景2', 'running', 'foreground'),
    ],
  })
  const { ui, text } = await mount($, clock)

  expect(await rows(text, 2121, 3)).toEqual(['↳ ⧗ 前景1', '↳ ⧗ 前景2', '↳ ! 失敗1'])
  expect(await text('subtasks-more-2121')).toBe('↳ +4 個')

  await ui.press({ key: 'expand-2121' })
  const list = (await text('task-list')) ?? ''
  const order = ['前景1', '前景2', '失敗1', '等待1', '等待2', '背景1', '$ dev'].map(name => list.indexOf(name))
  expect(order.every(at => at >= 0)).toBe(true)
  expect([...order].sort((a, b) => a - b)).toEqual(order)

  await ui.unmount()
})

test('超過 3 行收成 +n；展開明細時完整列出，不再限 5 個', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 2131, 'busy')
  report(world, 2131, { tasks: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(name => agent(name, 'running', 'foreground')) })
  const { ui, text } = await mount($, clock)

  expect(await rows(text, 2131)).toEqual(['↳ ⧗ a', '↳ ⧗ b', '↳ ⧗ c'])
  expect(await text('subtasks-more-2131')).toBe('↳ +4 個')

  await ui.press({ key: 'expand-2131' })
  const list = (await text('task-list')) ?? ''
  for (const name of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) expect(list).toContain(`Explore·${name}`)
  expect(list).not.toContain('個')

  await ui.unmount()
})

test('標題列的計數只算子卡片沒有列出的：等待中、失敗逐列列出後，不在標題列重複', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 2141, 'busy')
  report(world, 2141, {
    tasks: [agent('前景', 'running', 'foreground'), agent('等待', 'waiting', 'background'), agent('失敗', 'failed', 'background')],
  })
  put(world, 2142, 'waiting')
  report(world, 2142, { tasks: [agent('前景', 'running', 'foreground'), agent('等待', 'waiting'), agent('失敗', 'failed')] })

  const { ui, text } = await mount($, clock)

  // 工作中：三種都在子卡片裡，標題列沒有計數
  expect(await text('tasks-2141')).toBeUndefined()
  // 待處理卡片不畫子卡片，三種計數照舊
  expect(await text('tasks-2142')).toBe('↻1⏸︎1!1')

  await ui.unmount()
})

test('展開明細的子代理標示有文字：前景、失敗、等待', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 2151, 'busy')
  report(world, 2151, {
    tasks: [agent('前景的', 'running', 'foreground'), agent('失敗的', 'failed', 'foreground'), agent('等待的', 'waiting', 'background')],
  })
  const { ui, text } = await mount($, clock)

  await ui.press({ key: 'expand-2151' })
  const list = (await text('task-list')) ?? ''
  expect(list).toMatch(/Explore·前景的.*前景/)
  expect(list).toMatch(/Explore·失敗的.*失敗/)
  expect(list).toMatch(/Explore·等待的.*等待中/)

  await ui.unmount()
})

for (const [locale, words] of [
  ['en', ['foreground', 'failed', 'waiting']],
  ['ja', ['フォアグラウンド', '失敗', '待機中']],
  ['ko', ['포그라운드', '실패', '대기 중']],
  ['zh-CN', ['前台', '失败', '等待中']],
  ['zh-TW', ['前景', '失敗', '等待中']],
] as const) {
  test(`${locale}：展開明細的子代理標示用該語言的文字`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 + 60_000 })
    const world = fakeWorld(on, ['desktop'], {}, {
      view: {
        fields: {},
        isIdleCollapsed: false,
        billing: 'auto',
        locale,
        autoOpen: false,
        autoOpenCli: false,
      },
    })
    put(world, 2161, 'busy')
    report(world, 2161, {
      tasks: [agent('x', 'running', 'foreground'), agent('y', 'failed', 'foreground'), agent('z', 'waiting', 'background')],
    })
    const { ui, text } = await mount($, clock)

    await ui.press({ key: 'expand-2161' })
    const list = (await text('task-list')) ?? ''
    for (const word of words) expect(list.toLowerCase()).toContain(word.toLowerCase())

    await ui.unmount()
  })
}

test('回合結束、背景子代理還在跑的 Session 仍算工作中，有子卡片', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 2171, 'idle')
  report(world, 2171, { tasks: [agent('背景的', 'running', 'background')] })

  const { ui, text } = await mount($, clock)

  expect(await text('subtask-2171-0')).toBe('↳ 背景的')

  await ui.unmount()
})

// 失敗的子代理：留到下個回合開始
const MINE = `${REPORTS}/me.json`
const tasksOf = (world: World) => JSON.parse(world.files.get(MINE) ?? 'null')?.tasks

test('失敗的子代理在下個回合開始才清掉，引擎先把它從清單拿掉也一樣', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  on('agent.spawn', () => {
    world.agents.push({ id: 'f1', type: 'Explore', description: '找呼叫點', status: 'running' })

    return { model: 'haiku', agentId: 'f1' }
  })
  on('turn.complete', () => ({ text: '' }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({ prompt: 'x', description: '找呼叫點', subagentType: 'Explore', background: false })

  world.agents[0]!.status = 'failed'
  await $.turn.complete({ turnId: 'sub', answer: '', reason: 'error', agentId: 'f1' })
  expect(tasksOf(world)).toEqual([{ kind: 'agent', label: 'Explore·找呼叫點', status: 'failed', mode: 'foreground' }])

  // 子代理自己的下一個動作、同一回合裡的刷新都不清掉；引擎把它從清單拿掉也留著
  world.agents.length = 0
  await $.turn.complete({ turnId: 'sub2', answer: '', reason: 'done', agentId: 'other' })
  expect(tasksOf(world)).toEqual([{ kind: 'agent', label: 'Explore·找呼叫點', status: 'failed', mode: 'foreground' }])

  // 子代理自己的 turn.start 不清
  await $.turn.start({ turnId: 'sub3', text: 'x', agentId: 'other' })
  expect(tasksOf(world)).toHaveLength(1)

  // 主代理的下個回合開始：清掉
  await $.turn.start({ turnId: 't2', text: '再試一次' })
  expect(tasksOf(world)).toEqual([])
})

test('引擎一直把失敗的子代理留在清單裡，下個回合開始後也不再顯示', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  world.agents.push({ id: 'k1', type: 'Explore', description: '找呼叫點', status: 'failed' })
  on('turn.complete', () => ({ text: '' }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.turn.complete({ turnId: 'sub', answer: '', reason: 'error', agentId: 'k1' })
  expect(tasksOf(world)).toHaveLength(1)

  await $.turn.start({ turnId: 't2', text: '再試一次' })
  expect(tasksOf(world)).toEqual([])

  // 之後再刷新（例如另一個子代理結束），也不會又冒出來
  await $.turn.complete({ turnId: 'sub9', answer: '', reason: 'done', agentId: 'k2' })
  expect(tasksOf(world)).toEqual([])
})

// 失敗從未被 readTasks 讀到：引擎在子代理自己的 turn.complete 與下次刷新之間就把它從清單拿掉
const spawnForeground = async ($: Parameters<Parameters<typeof test>[1]>[0], on: Parameters<Parameters<typeof test>[1]>[1], world: World, id: string) => {
  on('agent.spawn', () => {
    world.agents.push({ id, type: 'Explore', description: '找呼叫點', status: 'running' })

    return { model: 'haiku', agentId: id }
  })
  on('turn.complete', () => ({ text: '' }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({ prompt: 'x', description: '找呼叫點', subagentType: 'Explore', background: false })
}

test('失敗從未被讀到：子代理自己的 turn.complete 帶 error，就算引擎已把它拿掉也記成失敗，到下個回合開始', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  await spawnForeground($, on, world, 'v1')

  world.agents.length = 0
  await $.turn.complete({ turnId: 'sub', answer: '', reason: 'error', agentId: 'v1' })
  expect(tasksOf(world)).toEqual([{ kind: 'agent', label: 'Explore·找呼叫點', status: 'failed', mode: 'foreground' }])

  await $.turn.start({ turnId: 't2', text: '再試一次' })
  expect(tasksOf(world)).toEqual([])
})

test('失敗從未被讀到：引擎回報 completed、但 turn.complete 是 error，仍顯示失敗', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  await spawnForeground($, on, world, 'v2')

  world.agents[0]!.status = 'completed'
  await $.turn.complete({ turnId: 'sub', answer: '', reason: 'error', agentId: 'v2' })

  expect(tasksOf(world)).toEqual([{ kind: 'agent', label: 'Explore·找呼叫點', status: 'failed', mode: 'foreground' }])
})

test('子代理正常結束（answer）或被中止（aborted）後消失：不顯示失敗', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  await spawnForeground($, on, world, 'v3')

  world.agents.length = 0
  await $.turn.complete({ turnId: 'sub', answer: '好了', reason: 'answer', agentId: 'v3' })
  expect(tasksOf(world)).toEqual([])
  await $.turn.complete({ turnId: 'sub', answer: '', reason: 'aborted', agentId: 'v3' })
  expect(tasksOf(world)).toEqual([])
})

// 清理：agentModes、dismissedAgents 不會一直長大，而且清理不改變顯示
test('子代理消失後 id 再被引擎重用：不沿用舊的 mode', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  await spawnForeground($, on, world, 'v4')
  expect(tasksOf(world)?.[0]).toMatchObject({ mode: 'foreground' })

  world.agents.length = 0
  await $.turn.complete({ turnId: 'sub', answer: '好了', reason: 'answer', agentId: 'v4' })
  world.agents.push({ id: 'v4', type: 'Explore', description: '另一件事', status: 'running' })
  await $.turn.complete({ turnId: 'sub', answer: '', reason: 'answer', agentId: 'v4' })

  expect(tasksOf(world)).toEqual([{ kind: 'agent', label: 'Explore·另一件事', status: 'running' }])
})

test('已清掉的失敗子代理消失之後再被重用 id：重新顯示', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  world.agents.push({ id: 'v5', type: 'Explore', description: '找呼叫點', status: 'failed' })
  on('turn.complete', () => ({ text: '' }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.turn.complete({ turnId: 'sub', answer: '', reason: 'error', agentId: 'v5' })
  await $.turn.start({ turnId: 't2', text: '再試一次' })
  expect(tasksOf(world)).toEqual([])

  world.agents.length = 0
  await $.turn.complete({ turnId: 'sub', answer: '', reason: 'answer', agentId: 'x' })
  world.agents.push({ id: 'v5', type: 'Explore', description: '新的', status: 'failed' })
  await $.turn.complete({ turnId: 'sub', answer: '', reason: 'error', agentId: 'v5' })

  expect(tasksOf(world)).toEqual([{ kind: 'agent', label: 'Explore·新的', status: 'failed' }])
})

// 子代理的回合以 error 結束、引擎還沒改狀態：不論引擎寫 running、waiting 或 done，一律算失敗
for (const engineStatus of ['running', 'waiting'] as const) {
  test(`error 結束、引擎仍寫 ${engineStatus}：顯示失敗，不算進等待子代理；它自己的 turn.start 讓它回到引擎的狀態`, async ($, on) => {
    mock.clock(on, { now: T0 })
    const world = fakeWorld(on, ['terminal'])
    await spawnForeground($, on, world, 'v6')
    world.agents[0]!.status = engineStatus

    await $.turn.complete({ turnId: 'sub', answer: '', reason: 'error', agentId: 'v6' })
    const mine = () => JSON.parse(world.files.get(MINE) ?? 'null')
    expect(tasksOf(world)).toEqual([{ kind: 'agent', label: 'Explore·找呼叫點', status: 'failed', mode: 'foreground' }])
    expect(mine().activity).toBeNull()

    // 被訊息叫醒、繼續工作
    world.agents[0]!.status = 'running'
    await $.turn.start({ turnId: 'sub2', text: '繼續', agentId: 'v6' })
    expect(tasksOf(world)).toEqual([{ kind: 'agent', label: 'Explore·找呼叫點', status: 'running', mode: 'foreground' }])
    expect(mine().activity).toBe('waiting-subagents:1')
  })
}

// agent.list() 丟例外：失敗列仍留到下個回合開始，也不做清理
test('讀不到子代理清單時，失敗列仍在；主代理下個回合開始才消失', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  await spawnForeground($, on, world, 'v7')
  world.agents[0]!.status = 'failed'
  await $.turn.complete({ turnId: 'sub', answer: '', reason: 'error', agentId: 'v7' })
  expect(tasksOf(world)).toEqual([{ kind: 'agent', label: 'Explore·找呼叫點', status: 'failed', mode: 'foreground' }])

  world.isAgentListBroken = true
  await $.turn.complete({ turnId: 'sub2', answer: '', reason: 'answer', agentId: 'other' })
  expect(tasksOf(world)).toEqual([{ kind: 'agent', label: 'Explore·找呼叫點', status: 'failed', mode: 'foreground' }])

  await $.turn.start({ turnId: 't2', text: '再試一次' })
  expect(tasksOf(world)).toEqual([])

  // 清單恢復後，引擎還留著的失敗子代理也不再冒出來（讀不到時沒有清掉「已清掉」的記號）
  world.isAgentListBroken = false
  await $.turn.complete({ turnId: 'sub3', answer: '', reason: 'answer', agentId: 'other' })
  expect(tasksOf(world)).toEqual([])
})

test('讀不到子代理清單時不清理：清單恢復後前景子代理仍是前景', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  await spawnForeground($, on, world, 'v8')

  world.isAgentListBroken = true
  await $.turn.complete({ turnId: 'sub', answer: '', reason: 'answer', agentId: 'other' })
  world.isAgentListBroken = false
  await $.turn.complete({ turnId: 'sub2', answer: '', reason: 'answer', agentId: 'other' })

  expect(tasksOf(world)).toEqual([{ kind: 'agent', label: 'Explore·找呼叫點', status: 'running', mode: 'foreground' }])
})

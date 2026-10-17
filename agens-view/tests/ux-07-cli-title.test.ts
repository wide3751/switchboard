import { expect, mock, test } from 'claude-code/testing'
import { DIR, PANE, REPORTS, SESSIONS, T0, fakeWorld, type World } from './world'

/** 這個 Session 自己（sessionId 是 me）的 session 紀錄。 */
const putMe = (world: World, pid: number, fields: Record<string, unknown> = {}) => {
  world.files.set(
    `${DIR}/${pid}.json`,
    JSON.stringify({ pid, sessionId: 'me', status: 'busy', cwd: '/work/switchboard', statusUpdatedAt: T0, ...fields }),
  )
  world.alive.add(pid)
}

const mine = (world: World) => JSON.parse(world.files.get(`${REPORTS}/me.json`) ?? 'null')

test('沒有 /rename 的 CLI Session，監看視窗以它的第一句 prompt 當標題', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['terminal'])
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  putMe(world, 701)

  await $.session.start({ cwd: '/work/switchboard', surface: 'terminal', isInteractive: true })
  await $.turn.start({ turnId: 't1', text: '把監看視窗的標題改成第一句 prompt' })
  await $.turn.start({ turnId: 't2', text: '好，繼續' })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const card = (await ui.find({ key: 'card-701' }))?.text ?? ''

  expect(card).toContain('把監看視窗的標題改成第一句 prompt')
  expect(card).not.toContain('好，繼續')

  await ui.unmount()
})

/** 另一個 Session 的紀錄與回報：在 cwd、從 startedAt 開始、在某個分支上（null 是不在 git 裡）。 */
const putAt = (world: World, pid: number, cwd: string, startedAt: number, branch: string | null, topic?: string) => {
  world.files.set(
    `${DIR}/${pid}.json`,
    JSON.stringify({ pid, sessionId: `s-${pid}`, status: 'idle', cwd, statusUpdatedAt: T0 - pid, startedAt }),
  )
  world.alive.add(pid)
  world.files.set(
    `${REPORTS}/s-${pid}.json`,
    JSON.stringify({
      sessionId: `s-${pid}`,
      reportedAt: 1,
      branch: branch === null ? null : { name: branch, ahead: 0, behind: 0, changed: 0 },
      ...(topic === undefined ? {} : { topic }),
    }),
  )
}

/** 監看視窗上每一列的標題，依 pid */
const titles = async (
  ui: { find: (q: { key: string }) => Promise<{ text?: string } | undefined> },
  pids: readonly number[],
) => Promise.all(pids.map(async pid => (await ui.find({ key: `jump-${pid}` }))?.text ?? ''))

test('worktree 的標題用 repo 名稱；同名的列補上分支名，分支也分不出來時補 #2、#3', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['terminal'])
  // 同一個 repo 的兩個 worktree，在不同分支
  putAt(world, 711, '/Users/tester/code/switchboard/.claude/worktrees/agent-a258963facf6d1907', 3, 'claude/cli-title')
  putAt(world, 712, '/Users/tester/code/switchboard/.claude/worktrees/agent-a4966e6c054c14b79', 4, 'claude/jump')
  // 同一個資料夾開三個 Session，都在 main：依開始的先後補 #2、#3
  putAt(world, 723, '/work/notes', 30, 'main')
  putAt(world, 721, '/work/notes', 10, 'main')
  putAt(world, 722, '/work/notes', 20, 'main')
  // 有主題的不和資料夾名稱撞名
  putAt(world, 731, '/work/notes', 40, 'main', '整理會議紀錄')

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, bodyColumns: 80 } })

  expect(await titles(ui, [711, 712, 721, 722, 723, 731])).toEqual([
    'switchboard · cli-title',
    'switchboard · jump',
    'notes',
    'notes #2',
    'notes #3',
    '整理會議紀錄',
  ])

  await ui.unmount()
})

test('寫進狀態回報的主題先遮罩疑似機密、合併空白，再截成約 40 字', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))

  await $.session.start({ cwd: '/work/switchboard', surface: 'terminal', isInteractive: true })
  await $.turn.start({
    turnId: 't1',
    text: 'GITHUB_TOKEN=ghp_AbCdEfGhIjKlMnOpQrSt\n  幫我列出這個 repo 所有還開著的 PR，並且依照最後更新時間排序',
  })

  expect(mine(world).topic).toBe('GITHUB_TOKEN=••• 幫我列出這個 repo 所有還開著的 PR，…')
})

test('Subagent 的回合和沒有文字的回合（例如接續）不當作第一句 prompt', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'])
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))

  await $.session.start({ cwd: '/work/switchboard', surface: 'terminal', isInteractive: true })
  await $.turn.start({ turnId: 't1', text: '  ' })
  await $.turn.start({ turnId: 'a1', text: '搜尋所有用到 locationOf 的地方', agentId: 'agent-1' })
  expect(mine(world).topic).toBeNull()

  await $.turn.start({ turnId: 't2', text: '整理 README' })
  expect(mine(world).topic).toBe('整理 README')
})

test('來源用標題列右側、時間前面的符號表示，不管密度一律顯示', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['terminal'])
  const session = (pid: number, status: string, entrypoint: string, terminal?: string) => {
    world.files.set(
      `${DIR}/${pid}.json`,
      JSON.stringify({ pid, sessionId: `s-${pid}`, status, cwd: `/work/proj-${pid}`, entrypoint, statusUpdatedAt: T0 }),
    )
    world.alive.add(pid)
    if (terminal !== undefined) {
      world.files.set(`${REPORTS}/s-${pid}.json`, JSON.stringify({ sessionId: `s-${pid}`, reportedAt: 1, terminal }))
    }
  }
  session(741, 'busy', 'claude-desktop') // 標準密度
  session(742, 'idle', 'cli', 'iTerm.app') // 精簡密度
  session(743, 'idle', 'cli', 'Apple_Terminal')
  session(744, 'idle', 'cli', 'vscode')
  session(745, 'waiting', 'cli') // 沒有回報：只知道是 CLI

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const marks = await Promise.all(
    [741, 742, 743, 744, 745].map(async pid => (await ui.find({ key: `source-${pid}` }))?.text ?? ''),
  )

  expect(marks).toEqual(['◧', '❯', '❯', '✎', '❯'])
  // 符號在標題列右側、時間前面
  expect((await ui.find({ key: 'card-742' }))?.text).toContain('proj-742❯1m▸')

  await ui.unmount()
})

test('版面窄到放不下「目前」時，改用一格寬的標記，仍看得出哪一列是目前這個', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['terminal'], { TERM_PROGRAM: 'iTerm.app' })
  putMe(world, 751, { name: '評估放寬 parse_plan 在 AppMCP 後截斷計畫的長度限制' })

  await $.session.start({ cwd: '/work/switchboard', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const current = async (columns: number) => {
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, bodyColumns: columns } })
    const text = (await ui.find({ key: 'current-751' }))?.text
    await ui.unmount()
    return text
  }

  expect(await current(80)).toBe('目前')
  expect(await current(20)).toBe('✦')
})

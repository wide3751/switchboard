import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const HOME = '/Users/tester'
const DIR = `${HOME}/.claude/sessions`

const PANE = {
  plugin: 'switchboard',
  component: 'Pane',
  requestId: 'switchboard',
  props: {
    title: 'Sessions',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

/** 使用者在輸入框打 `/switchboard:on` 按下 Enter。 */
const SESSIONS = {
  command: 'switchboard:on',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 120 },
} as const

type Status = 'busy' | 'idle' | 'waiting'
type World = {
  /** 檔名 → 紀錄內容 */
  records: Map<string, { pid: number; sessionId: string; status: Status }>
  alive: Set<number>
  opened: string[]
  /** 目前開著的 Pane */
  panes: Set<string>
  scans: number
}

/** 假造引擎底下的世界：session 紀錄、pid 存活結果、目前的介面。 */
const fakeWorld = (on: On, surfaces: readonly ('terminal' | 'desktop')[]): World => {
  const world: World = {
    records: new Map(),
    alive: new Set(),
    opened: [],
    panes: new Set(),
    scans: 0,
  }

  mock.env(on, { HOME })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: surfaces }))
  on('ui.panes', () => ({
    value: [...world.panes].map(id => ({
      id,
      title: 'Sessions',
      isShown: true,
      isFocused: false,
      isPlaced: true,
    })),
  }))
  on('ui.open', (_$, e) => {
    world.opened.push(e.id)
    world.panes.add(e.id)

    return { value: { isPlaced: true as const } }
  })
  on('fs.list', (_$, e) => {
    expect(e.path).toBe(DIR)
    world.scans += 1

    return {
      value: [...world.records.keys()].map(name => ({
        name,
        kind: 'file' as const,
        size: 1,
        mtimeMs: 0,
        isLink: false,
      })),
    }
  })
  on('fs.read', (_$, e) => {
    const name = e.path.slice(DIR.length + 1)
    const record = world.records.get(name)
    if (record === undefined) throw new Error(`ENOENT ${e.path}`)

    return { value: JSON.stringify(record) }
  })
  on('process.run', (_$, e) => {
    expect(e.argv.slice(0, 4)).toEqual(['ps', '-o', 'pid=', '-p'])
    const asked = (e.argv[4] ?? '').split(',').map(Number)
    const found = asked.filter(pid => world.alive.has(pid))

    return {
      value: {
        exitCode: found.length === 0 ? 1 : 0,
        stdout: found.map(pid => `  ${pid}\n`).join(''),
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })

  return world
}

const put = (world: World, pid: number, status: Status, isAlive = true) => {
  world.records.set(`${pid}.json`, { pid, sessionId: `s-${pid}`, status })
  if (isAlive) world.alive.add(pid)
  else world.alive.delete(pid)
}

test('Desktop 的 /switchboard:on 打開 Pane，計數只算存活且 waiting 的 Session，並隨 polling 更新', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 101, 'waiting')
  put(world, 102, 'waiting', false) // pid 已死
  put(world, 103, 'busy')

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  const ran = await $.command.run(SESSIONS)
  expect(world.opened).toEqual(['switchboard'])
  expect(ran.text).toContain('已打開監看視窗。')

  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ key: 'count' }))?.text).toBe('等你：1 個 Session')

  // 103 進入權限提示，下一次 polling 反映
  put(world, 103, 'waiting')
  await clock.advance(3_000)
  expect((await ui.find({ key: 'count' }))?.text).toBe('等你：2 個 Session')

  // 全部處理完，或程序結束
  put(world, 101, 'idle')
  put(world, 103, 'waiting', false)
  await clock.advance(3_000)
  expect((await ui.find({ key: 'count' }))?.text).toBe('沒有在等你')

  await ui.unmount()
})

test('CLI 的 /switchboard:on 不打開任何畫面，只回提示', async ($, on) => {
  const clock = mock.clock(on)
  const world = fakeWorld(on, ['terminal'])
  put(world, 201, 'waiting')

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  const ran = await $.command.run(SESSIONS)

  expect(ran.text).toContain('請到 Desktop')
  await clock.advance(10_000)
  expect(world.opened).toEqual([])
  expect(world.scans).toBe(0)
})

test('沒有打開 Pane 的 Session 不做 polling', async ($, on) => {
  const clock = mock.clock(on)
  const world = fakeWorld(on, ['desktop'])
  put(world, 301, 'waiting')

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await clock.advance(10_000)

  expect(world.opened).toEqual([])
  expect(world.scans).toBe(0)
})

test('關掉 Pane 之後停止 polling', async ($, on) => {
  const clock = mock.clock(on)
  const world = fakeWorld(on, ['desktop'])
  put(world, 401, 'waiting')

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.advance(3_000)
  const before = world.scans
  expect(before).toBeGreaterThan(0)

  // 使用者按下 Pane 的關閉鈕
  world.panes.delete('switchboard')
  await clock.advance(30_000)
  expect(world.scans).toBe(before)
})

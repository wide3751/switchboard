import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { On } from 'claude-code'

import { HOST_COMMANDS } from '../hooks/board'
import { DIR, PANE, REPORTS, SESSIONS, T0, fakeWorld, put, putSelf, report, type World } from './world'

const WINDOWS = { OS: 'Windows_NT' }

/** 一個 Desktop Session：有 hostSessionId，跳轉時打開 claude:// 連結。 */
const putDesktop = (world: World, pid: number, host: string) => {
  put(world, pid, 'idle')
  world.files.set(
    `${DIR}/${pid}.json`,
    JSON.stringify({ pid, sessionId: `s-${pid}`, hostSessionId: host, status: 'idle', cwd: `/work/proj-${pid}` }),
  )
}

/** 在 Windows 的 Desktop 打開監看視窗，收集 toast。 */
const openBoard = async ($: Parameters<TestBody>[0], on: On, world: World) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const toasts: string[] = []
  on('ui.toast', (_$, e) => {
    toasts.push(String(e.text))
    return { value: undefined }
  })
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  return { ui, toasts }
}

test('Windows：點 Desktop Session 的卡片，用 rundll32 打開深層連結，不跑 open', async ($, on) => {
  const world = fakeWorld(on, ['desktop'], WINDOWS)
  putDesktop(world, 601, 'local_a')
  const { ui, toasts } = await openBoard($, on, world)

  await ui.press({ key: 'jump-601' })

  expect(world.links).toEqual(['claude://claude.ai/epitaxy/local_a'])
  expect(world.commands.some(argv => argv[0] === 'rundll32')).toBe(true)
  expect(world.commands.some(argv => argv[0] === 'open')).toBe(false)
  expect(toasts).toEqual([])

  await ui.unmount()
})

test('Windows：點終端機裡 CLI Session 的卡片，說還不能跳轉，不跑任何外部指令', async ($, on) => {
  const world = fakeWorld(on, ['desktop'], WINDOWS)
  put(world, 701, 'idle')
  report(world, 701, { terminal: null }) // Windows Terminal 沒有 TERM_PROGRAM
  const { ui, toasts } = await openBoard($, on, world)
  const before = world.commands.length

  await ui.press({ key: 'jump-701' })

  expect(toasts).toEqual([expect.stringContaining('還不能跳轉')])
  expect(world.commands.slice(before)).toEqual([])
  expect(world.links).toEqual([])
  expect(world.scripts).toEqual([])

  await ui.unmount()
})

test('Windows：殘留的回報用 cmd del 刪掉，其他 Session 的回報留著', async ($, on) => {
  mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['terminal'], WINDOWS)
  put(world, 401, 'idle')
  report(world, 401, {})
  world.files.set(`${REPORTS}/s-gone.json`, JSON.stringify({ sessionId: 's-gone', reportedAt: 1 }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

  expect(world.removed).toEqual([`${REPORTS}/s-gone.json`])
  expect(world.files.has(`${REPORTS}/s-gone.json`)).toBe(false)
  expect(world.files.has(`${REPORTS}/s-401.json`)).toBe(true)
  // del 把 `/` 當參數開關，路徑得是反斜線
  const del = world.commands.find(argv => argv[0] === 'cmd')
  expect(del?.slice(6).every(path => !path.includes('/'))).toBe(true)
})

test('Windows：設定目錄含 cmd 會切開的字元（,）時不刪回報，不會刪到別的資料夾', async ($, on) => {
  mock.clock(on, { now: T0 })
  // cmd 會把 `/Users/a,b/.claude` 切成 `/Users/a` 和 `b/.claude`，del /q 就會清空 /Users/a
  const config = '/Users/a,b/.claude'
  const world = fakeWorld(on, ['terminal'], { ...WINDOWS, CLAUDE_CONFIG_DIR: config })
  world.files.set(`${config}/sessions/501.json`, JSON.stringify({ pid: 501, sessionId: 's-501', status: 'idle', cwd: '/work', statusUpdatedAt: T0 }))
  world.alive.add(501)
  const gone = `${config}/switchboard/reports/s-gone.json`
  world.files.set(gone, JSON.stringify({ sessionId: 's-gone', reportedAt: 1 }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

  expect(world.removed).toEqual([])
  expect(world.files.has(gone)).toBe(true)
  expect(world.commands.some(argv => argv[0] === 'cmd')).toBe(false)
})

test('Windows：開 PR 連結走 rundll32', async ($, on) => {
  const world = fakeWorld(on, ['desktop'], WINDOWS)
  put(world, 961, 'busy')
  report(world, 961, { pr: { number: 12, state: 'OPEN', url: 'https://github.com/o/r/pull/12' } })
  const { ui } = await openBoard($, on, world)

  await ui.press({ key: 'pr-961' })

  expect(world.links).toEqual(['https://github.com/o/r/pull/12'])
  expect(world.commands.some(argv => argv[0] === 'rundll32')).toBe(true)
  expect(world.commands.some(argv => argv[0] === 'open')).toBe(false)

  await ui.unmount()
})

test('Windows 刪檔指令：路徑換成反斜線、允許非 ASCII；含 cmd 特殊字元就不刪', () => {
  const { remove } = HOST_COMMANDS.windows

  expect(remove(['C:/Users/王小明/.claude/switchboard/reports/s-1.json'])).toEqual([
    'cmd', '/d', '/c', 'del', '/f', '/q', 'C:\\Users\\王小明\\.claude\\switchboard\\reports\\s-1.json',
  ])
  for (const bad of ['&', '|', '<', '>', '^', '%', '"', '!', '(', ')', ',', ';', '=']) {
    expect(remove(['C:/ok/a.json', `C:/Users/a${bad}b/s.json`])).toBeNull()
  }
})

test('unix 的指令寫法和以前一樣', () => {
  const { alive, open, remove } = HOST_COMMANDS.unix

  expect(alive([12, 34])).toEqual(['ps', '-o', 'pid=,tty=', '-p', '12,34'])
  expect(open('https://example.com')).toEqual(['open', 'https://example.com'])
  expect(remove(['/a/b.json', '/c d/e.json'])).toEqual(['rm', '-f', '--', '/a/b.json', '/c d/e.json'])
})

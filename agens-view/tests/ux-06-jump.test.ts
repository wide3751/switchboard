import { mock, test, expect } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { On } from 'claude-code'
import { DIR, PANE, SESSIONS, T0, asPerson, fakeWorld, put, report, type Status, type World } from './world'

/** 一個在終端機分頁裡的 CLI Session：TERM_PROGRAM 與 tty。 */
const putCli = (world: World, pid: number, status: Status, terminal: string, tty: string) => {
  put(world, pid, status)
  report(world, pid, { terminal })
  world.ttys.set(pid, tty)
}

/** 打開監看視窗（終端機），收集 toast。 */
const openBoard = async ($: Parameters<TestBody>[0], on: On, world: World) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const toasts: string[] = []
  on('ui.toast', (_$, e) => {
    toasts.push(String(e.text))
    return { value: undefined }
  })
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await asPerson(world, () => $.command.run(SESSIONS))
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  return { ui, toasts, clock }
}

test('iTerm、Terminal.app 的需要你處理卡片有「前往處理 →」，按下去切到分頁；Warp 的沒有', async ($, on) => {
  const world = fakeWorld(on, ['terminal'])
  putCli(world, 301, 'waiting', 'iTerm.app', 'ttys003')
  putCli(world, 302, 'waiting', 'Apple_Terminal', 'ttys004')
  putCli(world, 303, 'waiting', 'WarpTerminal', 'ttys005')
  const { ui } = await openBoard($, on, world)

  expect((await ui.find({ key: 'go-button-301' }))?.text).toBe('前往處理 →')
  expect((await ui.find({ key: 'go-button-302' }))?.text).toBe('前往處理 →')
  expect(await ui.find({ key: 'go-button-303' })).toBeUndefined()

  await ui.press({ key: 'go-button-302' })
  expect(world.scripts).toEqual([{ app: 'Terminal', tty: '/dev/ttys004' }])

  await ui.unmount()
})

test('iTerm 裡有變更、還沒有 PR 的工作中 Session 有「前往建立 PR →」，按下去切到分頁', async ($, on) => {
  const world = fakeWorld(on, ['terminal'])
  putCli(world, 311, 'busy', 'iTerm.app', 'ttys003')
  report(world, 311, {
    terminal: 'iTerm.app',
    branch: { name: 'feature/x', ahead: 1, behind: 0, changed: 1, insertions: 12, deletions: 3 },
  })
  const { ui } = await openBoard($, on, world)

  expect((await ui.find({ key: 'create-pr-311' }))?.text).toBe('前往建立 PR →')
  await ui.press({ key: 'create-pr-311' })
  expect(world.scripts).toEqual([{ app: 'iTerm2', tty: '/dev/ttys003' }])

  await ui.unmount()
})

test('頁首摘要提示可以點標題前往；需要你處理的 Session 都跳不過去時不提示', async ($, on) => {
  const world = fakeWorld(on, ['terminal'])
  putCli(world, 321, 'waiting', 'WarpTerminal', 'ttys005')
  const { ui, clock } = await openBoard($, on, world)
  expect((await ui.find({ key: 'summary' }))?.text).not.toContain('點選標題前往')

  putCli(world, 322, 'waiting', 'iTerm.app', 'ttys003')
  await clock.advance(3_000)
  expect((await ui.find({ key: 'summary' }))?.text).toContain('點選標題前往')

  await ui.unmount()
})

test('自動化權限被拒（osascript -1743）時，指向系統設定的自動化，而不是說找不到分頁', async ($, on) => {
  const world = fakeWorld(on, ['terminal'])
  putCli(world, 331, 'waiting', 'iTerm.app', 'ttys003')
  world.scriptFailure = {
    exitCode: 1,
    stderr: '43:120: execution error: Not authorized to send Apple events to iTerm2. (-1743)\n',
  }
  const { ui, toasts } = await openBoard($, on, world)

  await ui.press({ key: 'go-button-331' })
  expect(toasts).toEqual(['沒有控制 iTerm 的權限。請到「系統設定 › 隱私權與安全性 › 自動化」允許後再試'])

  await ui.unmount()
})

test('osascript 以其他錯誤結束時，說找不到分頁並帶上 Session 的位置', async ($, on) => {
  const world = fakeWorld(on, ['terminal'])
  putCli(world, 341, 'waiting', 'Apple_Terminal', 'ttys004')
  world.scriptFailure = { exitCode: 1, stderr: 'execution error: Terminal got an error: Can’t get window 1. (-1728)\n' }
  const { ui, toasts } = await openBoard($, on, world)

  await ui.press({ key: 'go-button-341' })
  expect(toasts).toEqual(['在 Terminal 裡找不到對應的分頁，Session 在 /work/proj-341'])

  await ui.unmount()
})

test('osascript 卡住不結束時，逾時後告訴使用者沒切過去', async ($, on) => {
  const world = fakeWorld(on, ['terminal'])
  putCli(world, 342, 'waiting', 'iTerm.app', 'ttys003')
  world.scriptFailure = 'hang'
  const { ui, toasts } = await openBoard($, on, world)

  await ui.press({ key: 'go-button-342' })
  expect(toasts).toEqual(['沒辦法切換到「proj-342」，它在 /work/proj-342'])

  await ui.unmount()
})

test('不支援的終端機：toast 說出是哪裡的 Session 不能跳轉', async ($, on) => {
  const world = fakeWorld(on, ['terminal'])
  putCli(world, 351, 'waiting', 'vscode', 'ttys006')
  const { ui, toasts } = await openBoard($, on, world)

  await ui.press({ key: 'jump-351' })
  expect(world.scripts).toEqual([])
  expect(toasts).toEqual(['VS Code 裡的 Session 還不能直接跳轉，它在 /work/proj-351'])

  await ui.unmount()
})

/** 一筆 CLI 開的 session 紀錄（entrypoint 是 cli），可另外加欄位。 */
const putCliRecord = (world: World, pid: number, cwd: string) => {
  world.files.set(
    `${DIR}/${pid}.json`,
    JSON.stringify({ pid, sessionId: `s-${pid}`, status: 'idle', cwd, entrypoint: 'cli', statusUpdatedAt: T0 }),
  )
  world.alive.add(pid)
  world.ttys.set(pid, 'ttys007')
}

test('0.6.0 之前開的 CLI Session（回報沒有 terminal）：提示重開這個 Session 後才能跳轉', async ($, on) => {
  const world = fakeWorld(on, ['terminal'])
  putCliRecord(world, 361, '/work/old')
  // 舊版的回報沒有 terminal 欄位
  report(world, 361, { model: 'claude-opus-5-5' })
  // 沒載入 switchboard 的 Session 沒有回報，也要重開才能跳轉
  putCliRecord(world, 362, '/work/bare')
  // 新版回報：終端機沒有設 TERM_PROGRAM，重開也沒用
  putCliRecord(world, 363, '/work/unknown')
  report(world, 363, { terminal: null })
  const { ui, toasts } = await openBoard($, on, world)

  await ui.press({ key: 'jump-361' })
  await ui.press({ key: 'jump-362' })
  await ui.press({ key: 'jump-363' })
  expect(world.scripts).toEqual([])
  expect(toasts).toEqual([
    '重開這個 Session 後才能跳轉，它在 /work/old',
    '重開這個 Session 後才能跳轉，它在 /work/bare',
    '這個終端機還不能跳轉，Session 在 /work/unknown',
  ])

  await ui.unmount()
})

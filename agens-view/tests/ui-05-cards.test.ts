import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { DIR, PANE, SESSIONS, T0, cellsAcross, fakeWorld, put, report, rowsDown, type Status, type World } from './world'

// 卡片（ui-consensus/05）

type Drawn = { type: string; key?: string; props: Record<string, unknown>; text?: string; children?: unknown[] }

/** 元素底下的所有元素，依畫面順序；子元素的 key 在 props.key */
const all = (node: unknown): Drawn[] => {
  if (typeof node !== 'object' || node === null) return []
  const one = node as Drawn

  return [{ ...one, key: one.key ?? (one.props.key as string | undefined) }, ...(one.children ?? []).flatMap(all)]
}

/** 元素底下每個 Text 自己的字串與樣式，依畫面順序 */
const textsOf = (node: unknown): { text: string; props: Record<string, unknown> }[] =>
  all(node)
    .filter(one => one.type === 'Text')
    .map(one => ({ text: (one.children ?? []).filter(kid => typeof kid === 'string').join(''), props: one.props }))

/** 元素底下所有字串依畫面順序直接串起來（和 find 的 text 一樣） */
const textOf = (node: unknown): string =>
  typeof node === 'string' ? node : ((node as Drawn | undefined)?.children ?? []).map(textOf).join('')

/** 元素的直接子元素（拿掉空的） */
const kidsOf = (node: unknown): Drawn[] =>
  (((node as Drawn | undefined)?.children ?? []) as unknown[]).filter(
    (kid): kid is Drawn => typeof kid === 'object' && kid !== null,
  )

/** 卡片畫出來的每一列：引擎把 Fragment 畫成沒有 key 的直向 Box，攤開來算 */
const rowsOf = (node: unknown): Drawn[] =>
  kidsOf(node).flatMap(kid =>
    kid.type === 'Box' && kid.props.key === undefined && kid.props.flexDirection === 'column' ? rowsOf(kid) : [kid],
  )

/** Desktop Session：有 hostSessionId，可以跳轉 */
const putDesktop = (world: World, pid: number, status: Status) => {
  world.files.set(
    `${DIR}/${pid}.json`,
    JSON.stringify({ pid, sessionId: `s-${pid}`, status, cwd: `/work/proj-${pid}`, entrypoint: 'claude-desktop', hostSessionId: `local_${pid}`, statusUpdatedAt: T0 }),
  )
  world.alive.add(pid)
}

const WORK = { name: 'feature/x', ahead: 1, behind: 0, changed: 1, insertions: 12, deletions: 3 }

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：待處理卡片的「前往處理 →」和中繼資料帶同一列，在右端，寬度不夠才換列；不再獨佔一列`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 + 60_000 })
    const world = fakeWorld(on, [surface])
    putDesktop(world, 5101, 'waiting')
    report(world, 5101, { approval: '$ npm i', branch: WORK })
    putDesktop(world, 5102, 'waiting')

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })

    for (const pid of [5101, 5102]) {
      const card = await ui.find({ key: `card-${pid}` })
      // 標題列、（情境行）、中繼資料帶：按鈕不另佔一列
      const rows = rowsOf(card)
      const strip = rows.at(-1)
      expect(strip?.props).toMatchObject({ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 'xs' })
      const go = all(strip).find(one => one.key === `go-button-${pid}`)
      expect(go?.props.variant).toBe('secondary')
      // 前面是數字快捷鍵（ticket 10）
      expect((await ui.find({ key: `go-button-${pid}` }))?.text).toMatch(/^[12]\s+前往處理 →$/u)
      // 按鈕在這一列的最右端
      expect(kidsOf(strip).at(-1)?.props.key).toBe(`go-button-${pid}`)
      // 5101：標題列、指令、帶；5102 沒有回報：標題列、僅基本狀態、帶
      expect(rows.length).toBe(3)
      expect(await ui.find({ key: `go-${pid}` })).toBeUndefined()
    }

    await ui.unmount()
  })

  test(`${surface}：時間是不可點的 caption tabular；展開鈕只畫 ▸／▾；來源符號在右側、時間前面`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 + 5 * 60_000 })
    const world = fakeWorld(on, [surface])
    putDesktop(world, 5111, 'busy')

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })

    expect((await ui.find({ key: 'expand-5111' }))?.text).toBe('▸')
    const age = await ui.find({ key: 'age-5111' })
    expect(age?.text).toBe('5m')
    expect(all(age).some(one => one.type === 'Button')).toBe(false)
    expect(textsOf(age)[0]?.props).toMatchObject({ size: 'caption', dimColor: true, tabular: true })
    // 標題在前，右側依序是來源、時間、展開鈕
    expect(textOf(kidsOf(await ui.find({ key: 'card-5111' }))[0])).toBe('◉proj-5111◧5m▸')
    expect(textsOf(await ui.find({ key: 'source-5111' }))[0]?.props.dimColor).toBe(true)

    await ui.press({ key: 'expand-5111' })
    expect((await ui.find({ key: 'expand-5111' }))?.text).toBe('▾')

    await ui.unmount()
  })
}

/** 在不同欄寬下畫一次，記下標題列右側的狀態，依欄寬由窄到寬、只留變化的地方 */
const states = async (
  $: Parameters<TestBody>[0],
  pid: number,
  stateOf: (find: (key: string) => Promise<Drawn | undefined>) => Promise<string>,
) => {
  const seen: string[] = []
  for (let columns = 20; columns <= 70; columns++) {
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, bodyColumns: columns } })
    const state = await stateOf(async key => (await ui.find({ key: `${key}-${pid}` })) as Drawn | undefined)
    await ui.unmount()
    if (seen.at(-1) !== state) seen.push(state)
  }

  return seen
}

test('終端機：標題列空間不夠時，先拿掉徽章，再拿掉來源符號', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['terminal'])
  world.files.set(
    `${DIR}/5121.json`,
    JSON.stringify({ pid: 5121, sessionId: 's-5121', status: 'busy', cwd: '/work/proj-5121', name: '評估放寬計畫長度的限制', statusUpdatedAt: T0 }),
  )
  world.alive.add(5121)
  report(world, 5121, { terminal: 'iTerm.app', tasks: [{ kind: 'agent', label: 'Explore', status: 'running' }] })

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()

  const seen = await states($, 5121, async find =>
    `${(await find('source')) === undefined ? '-' : 'source'} ${(await find('tasks')) === undefined ? '-' : 'tasks'}`,
  )
  expect(seen).toEqual(['- -', 'source -', 'source tasks'])
})

test('終端機：拿掉來源符號之後還不夠，才把「目前」換成 ✦', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['terminal'], { TERM_PROGRAM: 'iTerm.app' })
  world.files.set(
    `${DIR}/5131.json`,
    JSON.stringify({ pid: 5131, sessionId: 'me', status: 'busy', cwd: '/work/me', name: '評估放寬計畫長度的限制', statusUpdatedAt: T0 }),
  )
  world.alive.add(5131)

  await $.session.start({ cwd: '/work/me', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()

  const seen = await states($, 5131, async find =>
    `${(await find('source')) === undefined ? '-' : 'source'} ${(await find('current'))?.text}`,
  )
  expect(seen).toEqual(['- ✦', '- 目前', 'source 目前'])
})

test('中繼資料帶：分段 columnGap md、不插 ·；位置和分支用 subtle；數字為 0 的那一邊不畫；展開時 Context 和分支改由明細顯示', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 5201, 'busy')
  report(world, 5201, {
    branch: { name: 'feature/x', ahead: 1, behind: 0, changed: 1, insertions: 12, deletions: 0, base: 'origin/main' },
    contextPercent: 42,
  })

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text ?? ''

  const meta = await ui.find({ key: 'meta' })
  expect(meta?.props.columnGap).toBe('md')
  expect(textsOf(meta).some(one => one.text.trim() === '·')).toBe(false)
  const where = textsOf(meta).find(one => one.text.startsWith('proj-5201'))
  expect(where?.text).toBe('proj-5201 · feature/x ↑1 ±1')
  expect(where?.props.color).toBe('subtle')
  expect(where?.props.dimColor).toBeUndefined()
  // 只有新增、沒有刪除：不畫 −0
  expect(await text('changes')).toBe('+12')
  // Context 低於 80% 維持 dim
  expect(textsOf(await ui.find({ key: 'ctx' }))[0]?.props.dimColor).toBe(true)

  await ui.press({ key: 'expand-5201' })
  expect(await ui.find({ key: 'ctx' })).toBeUndefined()
  expect(await text('meta')).not.toContain('feature/x')
  expect(await text('context-bar')).toContain('42%')
  expect(await text('detail-branch')).toBe('feature/x ↑1 ±1 · 相對 origin/main')

  await ui.unmount()
})

test('PR 的三種狀態不靠顏色也分得出來：開啟 #12 ↗、已合併 #12 ↗ 已合併、已關閉 #12 加刪除線', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  const states = [
    [5301, 'OPEN'],
    [5302, 'MERGED'],
    [5303, 'CLOSED'],
  ] as const
  for (const [pid, state] of states) {
    put(world, pid, 'busy')
    report(world, pid, { branch: WORK, pr: { number: 12, state, url: `https://github.com/o/r/pull/${pid}` } })
  }

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const prOf = async (pid: number) => {
    const button = await ui.find({ key: `pr-${pid}` })
    const [one] = textsOf(button)
    return { text: one?.text, color: one?.props.color, strikethrough: one?.props.strikethrough ?? false }
  }

  expect(await prOf(5301)).toEqual({ text: '#12 ↗', color: 'success', strikethrough: false })
  expect(await prOf(5302)).toEqual({ text: '#12 ↗ 已合併', color: 'merged', strikethrough: false })
  expect(await prOf(5303)).toEqual({ text: '#12', color: 'inactive', strikethrough: true })
  // 拿掉顏色之後三種寫法仍然不同
  const looks = await Promise.all(states.map(async ([pid]) => JSON.stringify({ ...(await prOf(pid)), color: null })))
  expect(new Set(looks).size).toBe(3)

  await ui.press({ key: 'pr-5302' })
  expect(world.links).toEqual(['https://github.com/o/r/pull/5302'])

  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：有工作、沒有 PR 時是不可點的 dim「無 PR」；閒置或沒有工作時不顯示`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 + 60_000 })
    const world = fakeWorld(on, [surface])
    // 能跳轉的 iTerm Session：以前會有「前往建立 PR →」按鈕
    put(world, 5401, 'busy')
    report(world, 5401, { terminal: 'iTerm.app', branch: WORK })
    world.ttys.set(5401, 'ttys003')
    put(world, 5402, 'busy')
    report(world, 5402, { branch: { name: 'feature/y', ahead: 0, behind: 0, changed: 0 } })
    put(world, 5403, 'idle')
    report(world, 5403, { branch: WORK })
    world.stored.set('view', {
      fields: {
        waiting: ['time', 'location', 'branch', 'changes', 'pr'],
        busy: ['time', 'location', 'branch', 'changes', 'pr'],
        idle: ['time', 'location', 'branch', 'changes', 'pr'],
      },
      isIdleCollapsed: false,
      billing: 'auto',
      locale: 'auto',
      autoOpen: true,
      autoOpenCli: false,
    })

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })
    const card = async (pid: number) => await ui.find({ key: `card-${pid}` })

    const noPr = textsOf(await card(5401)).find(one => one.text === '無 PR')
    expect(noPr?.props).toMatchObject({ size: 'caption', dimColor: true })
    expect(all(await card(5401)).filter(one => one.type === 'Button').map(one => one.key)).toEqual([
      'jump-5401',
      'expand-5401',
    ])
    expect((await card(5402))?.text).not.toContain('無 PR')
    expect((await card(5403))?.text).toContain('+12')
    expect((await card(5403))?.text).not.toContain('無 PR')

    await ui.unmount()
  })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：卡片內距加大一級（終端機仍是 1 格）；閒置列和卡片內文對齊（終端機 2 格）`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 + 60_000 })
    const world = fakeWorld(on, [surface])
    put(world, 5501, 'waiting')
    put(world, 5502, 'busy')
    put(world, 5503, 'idle')

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })
    const props = async (pid: number) => (await ui.find({ key: `card-${pid}` }))?.props ?? {}

    for (const pid of [5501, 5502]) {
      const one = await props(pid)
      expect(one).toMatchObject({ paddingX: surface === 'terminal' ? 'sm' : 'md', paddingY: 'xs' })
      expect({ across: cellsAcross(one.paddingX), down: rowsDown(one.paddingY) }).toEqual({
        across: surface === 'terminal' ? 1 : 2,
        down: 0,
      })
    }
    const idle = await props(5503)
    expect(idle.borderStyle).toBeUndefined()
    // 終端機：外框 1 格加內距 1 格＝閒置列的內距 2 格；Desktop 和卡片內距一樣
    expect(idle.paddingX).toBe('md')

    await ui.unmount()
  })
}

test('工作中的 ◉ 維持 claude 色', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 5601, 'busy')

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  const [glyph] = textsOf(await ui.find({ key: 'card-5601' }))
  expect(glyph?.text).toBe('◉')
  expect(glyph?.props.color).toBe('claude')

  await ui.unmount()
})

for (const locale of ['en', 'zh-TW'] as const) {
  test(`帳號用量卡片（${locale}）：平常是淡色外框，用量快用完提到頂端時加強；5h／週標籤補到同寬，整行 mono tabular`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 + 60_000 })
    const world = fakeWorld(on, ['desktop'])
    put(world, 5701, 'busy')
    report(world, 5701, {
      rateLimits: [
        { kind: 'five_hour', percentUsed: 72 },
        { kind: 'seven_day', percentUsed: 21 },
      ],
    })
    world.stored.set('view', {
      fields: {
        waiting: ['time', 'location'],
        busy: ['time', 'location'],
        idle: ['time'],
      },
      isIdleCollapsed: false,
      billing: 'auto',
      locale,
      autoOpen: true,
      autoOpenCli: false,
    })

    await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    const text = async (key: string) => (await ui.find({ key }))?.text ?? ''

    expect((await ui.find({ key: 'account' }))?.props).toMatchObject({ borderStyle: 'round', borderDimColor: true })
    const [five] = textsOf(await ui.find({ key: 'rate-fiveHour' }))
    expect(five?.props).toMatchObject({ mono: true, tabular: true })
    // 兩行的用量條從同一欄開始（中日韓的「週」2 格，和「5h」同寬，不用補）
    const barAt = async (key: string) => (await text(key)).indexOf('▰')
    if (locale === 'en') {
      expect(await text('rate-fiveHour')).toStartWith('5h   ▰')
      expect(await barAt('rate-fiveHour')).toBe(await barAt('rate-week'))
    } else {
      expect(await text('rate-week')).toStartWith('週 ▰')
    }

    report(world, 5701, { rateLimits: [{ kind: 'five_hour', percentUsed: 96 }] })
    await clock.advance(3_000)
    expect((await ui.find({ key: 'account' }))?.props.borderDimColor).toBe(false)

    await ui.unmount()
  })
}

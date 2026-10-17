import { expect, mock, test } from 'claude-code/testing'

import { GLYPHS, type Glyph, ambiguousCount, clipToWidth, displayWidth, summarizeTool } from '../hooks/board'
import { LOCALES, messagesOf } from '../hooks/i18n'
import { DIR, PANE, SESSIONS, T0, cellsAcross, fakeWorld, put, report } from './world'

// 符號總表與狀態標籤（ui-consensus/03）

const entries: [string, Glyph][] = Object.entries(GLYPHS)

test('GLYPHS：一符一義、一義一符', () => {
  const chars = entries.map(([, one]) => one.char)
  const meanings = entries.map(([, one]) => one.meaning)
  expect(new Set(chars).size).toBe(chars.length)
  expect(new Set(meanings).size).toBe(meanings.length)
})

test('GLYPHS：碼位與字元一致，每個字在終端機上都是一格', () => {
  for (const [name, one] of entries) {
    const code = [...one.char].map(char => `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`)
    expect({ name, code: one.code }).toEqual({ name, code: code.join(' ') })
    expect({ name, width: displayWidth(one.char) }).toEqual({ name, width: 1 })
  }
})

test('GLYPHS：沒有 EA=W 的字；Ambiguous 只限原本就在用的五個，之後新增的一律選非 Ambiguous', () => {
  for (const [name, one] of entries) {
    expect({ name, wide: one.ea === 'W' }).toEqual({ name, wide: false })
    // 表上寫的 EA 和 ambiguousCount 查到的一致
    expect({ name, ambiguous: ambiguousCount(one.char) > 0 }).toEqual({ name, ambiguous: one.ea === 'A' })
  }
  const ambiguous = entries.filter(([, one]) => one.ea === 'A').map(([, one]) => one.char)
  expect(ambiguous.sort()).toEqual(['▲', '○', '→', '↗', '▦'].sort())
})

test('背景任務：執行中是 ↻（不是 ⟳），等待中的 ⏸ 帶 VS15 以文字樣式顯示', () => {
  expect(GLYPHS.taskRunning.char).toBe('↻')
  expect(GLYPHS.taskWaiting.char).toBe('⏸︎')
})

test('五種語言的字串裡出現的符號都在 GLYPHS 裡', () => {
  const known = new Set<string>(entries.map(([, one]) => one.char))
  const symbols = (value: unknown): string[] =>
    typeof value === 'string'
      ? (value.match(/[^\x00-\x7f]/gu) ?? []).filter(char => /[\p{So}\p{Sm}]/u.test(char))
      : typeof value === 'function'
        ? symbols(String(value))
        : typeof value === 'object' && value !== null
          ? Object.values(value).flatMap(symbols)
          : []
  for (const { locale } of LOCALES) {
    const unknown = symbols(messagesOf(locale)).filter(char => !known.has(char))
    expect({ locale, unknown }).toEqual({ locale, unknown: [] })
  }
})

test('ambiguousCount：數出 East Asian Ambiguous 的字，不含變體選擇符', () => {
  expect(ambiguousCount('abc 中文')).toBe(0)
  expect(ambiguousCount('▲ ○ → ↗')).toBe(4)
  expect(ambiguousCount('Привет · …')).toBe(8)
  expect(ambiguousCount('⏸︎')).toBe(0)
})

test('clipToWidth：Ambiguous 字可以算 2 格，截斷用的 … 也算 2 格', () => {
  expect(clipToWidth('①②③④⑤', 6, 2)).toBe('①②…')
  expect(clipToWidth('①②③', 6, 2)).toBe('①②③')
  expect(clipToWidth('①②③④⑤', 6)).toBe('①②③④⑤')
})

test('clipToWidth：放不下 … 時回傳空字串，不超出寬度', () => {
  expect(clipToWidth('①②③', 1, 2)).toBe('')
  expect(clipToWidth('abc', 1)).toBe('…')
})

test('displayWidth：Ambiguous 字可以算 2 格（算最寬的情況），預設 1 格', () => {
  expect(displayWidth('▲ 待處理')).toBe(8)
  expect(displayWidth('▲ 待處理', 2)).toBe(9)
  expect(displayWidth('⏸︎3', 2)).toBe(2)
})

test('情境行：Edit／Write／MultiEdit／NotebookEdit 都寫成「Edit 檔名」，✎ 只留給 VS Code 來源', () => {
  expect(summarizeTool('Edit', { file_path: '/work/app/theme.css' })).toBe('Edit theme.css')
  expect(summarizeTool('Write', { file_path: '/work/app/new.ts' })).toBe('Edit new.ts')
  expect(summarizeTool('MultiEdit', { file_path: '/work/app/board.ts' })).toBe('Edit board.ts')
  expect(summarizeTool('NotebookEdit', { notebook_path: '/work/a.ipynb' })).toBe('Edit a.ipynb')
  expect(summarizeTool('Read', { file_path: '/work/README.ja.md' })).toBe('Read README.ja.md')
})

type Drawn = { type: string; props: Record<string, unknown>; text?: string; children?: unknown[] }

/** 元素底下每個 Text 的字串，依畫面順序 */
const textsOf = (node: unknown): string[] => {
  if (typeof node !== 'object' || node === null) return []
  const one = node as Drawn
  if (one.type === 'Text') return [(one.children ?? []).filter(kid => typeof kid === 'string').join('')]

  return (one.children ?? []).flatMap(textsOf)
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：狀態標籤是「glyph」和「標籤」兩個 Text，字串不帶空格；出錯用 ✕`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 + 60_000 })
    const world = fakeWorld(on, [surface])
    put(world, 3101, 'waiting')
    report(world, 3101, { approval: '$ rm -rf node_modules' })
    put(world, 3102, 'waiting')
    report(world, 3102, { question: { text: '要用哪個方案？', options: ['A', 'B'] } })
    put(world, 3103, 'idle')
    report(world, 3103, { turnError: 'boom' })
    put(world, 3104, 'waiting')

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })
    const texts = async (pid: number) => textsOf(await ui.find({ key: `card-${pid}` }))

    expect((await texts(3101)).slice(0, 2)).toEqual(['▲', '核准'])
    expect((await texts(3102)).slice(0, 2)).toEqual(['▲', '回答'])
    expect((await texts(3103)).slice(0, 2)).toEqual(['✕', '出錯'])
    expect((await texts(3104)).slice(0, 2)).toEqual(['▲', '待處理'])
    expect((await ui.find({ key: 'card-3103' }))?.text).not.toContain('▲')

    await ui.unmount()
  })
}

test('狀態不明：◌ 和「未知」也是兩個 Text', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['terminal'])
  world.files.set(
    `${DIR}/3111.json`,
    JSON.stringify({ pid: 3111, sessionId: 's-3111', status: 'compacting', cwd: '/work/proj-3111', statusUpdatedAt: T0 }),
  )
  world.alive.add(3111)

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(textsOf(await ui.find({ key: 'card-3111' })).slice(0, 2)).toEqual(['◌', '未知'])

  await ui.unmount()
})

test('背景任務徽章用 ↻ 和 ⏸︎', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 3121, 'busy')
  report(world, 3121, {
    tasks: [
      { kind: 'agent', label: 'Explore', status: 'running' },
      { kind: 'bash', label: '$ npm run dev', status: 'waiting' },
    ],
  })

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await ui.find({ key: 'tasks-3121' }))?.text).toBe('↻1⏸︎1')

  await ui.unmount()
})

/** 終端機上最寬的情況：中日韓與全形 2 格，Ambiguous 也當 2 格（CJK locale 的終端機） */
const worstCells = (text: string): number => displayWidth(text) + ambiguousCount(text)

/** 一個元素排成一列時的最寬寬度：橫向加總子元素與間距（間距可能是 step 名稱，換成終端機格數） */
const rowCells = (node: unknown): number => {
  if (typeof node === 'string') return worstCells(node)
  const one = node as Drawn
  const kids = (one.children ?? []).filter(kid => kid !== null && kid !== undefined && kid !== false && kid !== '')
  if (one.type === 'Text') return kids.reduce((sum: number, kid) => sum + rowCells(kid), 0)
  const isRow = one.type !== 'Box' || (one.props.flexDirection ?? 'row') === 'row'
  const gap = cellsAcross(one.props.columnGap ?? one.props.gap)
  const inner = isRow
    ? kids.reduce((sum: number, kid) => sum + rowCells(kid), 0) + gap * Math.max(0, kids.length - 1)
    : Math.max(0, ...kids.map(rowCells))

  return inner + cellsAcross(one.props.paddingX) * 2 + (one.props.borderStyle === undefined ? 0 : 2)
}

test('終端機：標題滿是 Ambiguous 字時，就算每個都畫成 2 格，標題列也不超過 Pane 的寬度', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 5 * 60_000 })
  const world = fakeWorld(on, ['terminal'])
  const title = 'Обновить парсер ①②③ — «план» → проверка ±5°'
  for (const [pid, status] of [
    [3131, 'waiting'],
    [3132, 'idle'],
    [3133, 'busy'],
  ] as const) {
    world.files.set(
      `${DIR}/${pid}.json`,
      JSON.stringify({ pid, sessionId: `s-${pid}`, status, cwd: `/work/p-${pid}`, name: title, statusUpdatedAt: T0 }),
    )
    world.alive.add(pid)
  }

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  for (const columns of [40, 60]) {
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, bodyColumns: columns } })
    for (const pid of [3131, 3132, 3133]) {
      const card = (await ui.find({ key: `card-${pid}` })) as Drawn | undefined
      const row = (card?.children ?? []).find(kid => typeof kid === 'object' && kid !== null)
      const frame = cellsAcross(card?.props.paddingX) * 2 + (card?.props.borderStyle === undefined ? 0 : 2)
      expect({ pid, columns, fits: rowCells(row) + frame <= columns }).toEqual({ pid, columns, fits: true })
    }
    await ui.unmount()
  }
})

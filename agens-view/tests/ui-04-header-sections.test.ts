import { expect, mock, test } from 'claude-code/testing'

import { LOCALES, messagesOf } from '../hooks/i18n'
import { PANE, SESSIONS, T0, fakeWorld, put, putSelf, report, rowsDown } from './world'

// 頁首與分區（ui-consensus/04）

type Drawn = { type: string; key?: string; props: Record<string, unknown>; text?: string; children?: unknown[] }

/** 元素底下每個 Text（含巢狀的 Text）自己的字串與樣式，依畫面順序 */
const textsOf = (node: unknown): { text: string; props: Record<string, unknown> }[] => {
  if (typeof node !== 'object' || node === null) return []
  const one = node as Drawn
  const kids = (one.children ?? []).flatMap(textsOf)
  if (one.type !== 'Text') return kids
  const own = (one.children ?? []).filter(kid => typeof kid === 'string').join('')

  return [{ text: own, props: one.props }, ...kids]
}

/** 元素底下的所有元素，依畫面順序；子元素的 key 在 props.key */
const all = (node: unknown): Drawn[] => {
  if (typeof node !== 'object' || node === null) return []
  const one = node as Drawn

  return [{ ...one, key: one.key ?? (one.props.key as string | undefined) }, ...(one.children ?? []).flatMap(all)]
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：有在等時頁首沒有外框；第一行是 heading 的等你計數，右端是設定；第二行只細分種類和最長`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 + 3 * 60_000 })
    const world = fakeWorld(on, [surface])
    put(world, 4101, 'waiting')
    report(world, 4101, { approval: '$ npm i' })
    put(world, 4102, 'waiting')
    report(world, 4102, { question: { text: '要用哪個方案？', options: ['A', 'B'] } })
    put(world, 4103, 'busy')

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })

    const header = (await ui.find({ key: 'header' })) as Drawn | undefined
    expect(header?.props.borderStyle).toBeUndefined()
    expect((await ui.find({ key: 'count' }))?.text).toBe('▲ 2 個待處理')
    const [count] = textsOf(await ui.find({ key: 'count' }))
    expect(count?.props).toMatchObject({ size: 'heading', color: 'warning', weight: 'bold' })
    // 設定和等你計數在同一行（頁首裡），不再單獨一行
    expect(await ui.find({ key: 'toolbar' })).toBeUndefined()
    expect(all(header).some(one => one.key === 'settings')).toBe(true)
    expect((await ui.find({ key: 'summary' }))?.text).toBe('核准 1 · 回答 1 · 最長 3m')
    const [summary] = textsOf(await ui.find({ key: 'summary' }))
    expect(summary?.props.size).toBe('caption')

    await ui.unmount()
  })

  test(`${surface}：沒有在等時頁首只有一行「✓ 沒有待處理的 Session」和設定，不重複各分區數量`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 + 60_000 })
    const world = fakeWorld(on, [surface])
    putSelf(world, 900)
    put(world, 4111, 'busy')
    put(world, 4112, 'idle')

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })

    const header = (await ui.find({ key: 'header' })) as Drawn | undefined
    expect(header?.props.borderStyle).toBeUndefined()
    expect((await ui.find({ key: 'count' }))?.text).toBe('✓ 沒有待處理的 Session')
    expect(all(header).some(one => one.key === 'settings')).toBe(true)
    expect(await ui.find({ key: 'toolbar' })).toBeUndefined()
    expect(await ui.find({ key: 'summary' })).toBeUndefined()
    expect(header?.text).not.toContain('工作中')

    await ui.unmount()
  })
}

test('看不到狀態：round 加 warning 的警示卡；說明用預設色、路徑另起一行從中間截斷；每 3 秒自動重試和疑難排解連結；設定單獨一行在上方', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  world.isSessionsUnreadable = true

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  const header = (await ui.find({ key: 'header' })) as Drawn | undefined
  expect(header?.props).toMatchObject({ borderStyle: 'round', borderColor: 'warning' })
  expect((await ui.find({ key: 'count' }))?.text).toBe('⚠ 目前看不到 Session 狀態')
  const texts = textsOf(await ui.find({ key: 'summary' }))
  // 沒有引擎的原始錯誤：整段都不用 error 色
  expect(texts.filter(one => one.props.color === 'error')).toEqual([])
  expect(texts[0]?.text).toContain('讀取權限')
  expect(texts[0]?.text).not.toContain('/Users/tester')
  const path = texts.find(one => one.props.wrap === 'truncate-middle')
  expect(path?.text).toBe('/Users/tester/.claude/sessions')

  const retry = await ui.find({ key: 'retry' })
  expect(retry?.text).toBe('每 3 秒自動重試 · 疑難排解 ↗')
  expect(textsOf(retry)[0]?.props.dimColor).toBe(true)
  const link = all(retry).find(one => one.type === 'Link')
  expect(link?.props).toEqual({ href: messagesOf('zh-TW').header.troubleshootUrl, label: '疑難排解 ↗' })

  // 設定維持單獨一行，在警示卡上方，不在卡片裡
  expect(all(await ui.find({ key: 'toolbar' })).some(one => one.key === 'settings')).toBe(true)
  expect(all(header).some(one => one.key === 'settings')).toBe(false)

  await ui.unmount()
})

test('看不到狀態（讀取失敗）：只有引擎的原始錯誤用 error 色，前面的固定說明用預設色', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'])
  put(world, 4121, 'idle')
  world.psFailure = 'throws'

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  const texts = textsOf(await ui.find({ key: 'summary' }))
  const lead = texts.find(one => one.text.includes('switchboard 讀取狀態失敗'))
  expect(lead?.props.color).toBeUndefined()
  const raw = texts.filter(one => one.props.color === 'error')
  expect(raw.length).toBe(1)
  expect(raw[0]?.text).not.toContain('switchboard 讀取狀態失敗')

  await ui.unmount()
})

test('疑難排解連結指向各語言 README 的疑難排解錨點', () => {
  const base = 'https://github.com/wide3751/switchboard/blob/main/'
  const want: Record<string, string> = {
    en: `${base}README.md#troubleshooting`,
    ja: `${base}README.ja.md#${encodeURIComponent('トラブルシューティング')}`,
    ko: `${base}README.ko.md#${encodeURIComponent('문제-해결')}`,
    'zh-CN': `${base}README.zh-CN.md#${encodeURIComponent('故障排除')}`,
    'zh-TW': `${base}README.zh-TW.md#${encodeURIComponent('疑難排解')}`,
  }
  for (const { locale } of LOCALES) {
    expect({ locale, url: messagesOf(locale).header.troubleshootUrl }).toEqual({ locale, url: want[locale] })
    expect(messagesOf(locale).header.troubleshoot.endsWith(' ↗')).toBe(true)
  }
})

test('粗框只給待處理卡片：琥珀色給待處理，紅色給出錯中止；頁首和其他卡片都不是粗框', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['terminal'])
  put(world, 4131, 'waiting')
  put(world, 4132, 'idle')
  report(world, 4132, { turnError: 'boom' })
  put(world, 4133, 'busy')
  put(world, 4134, 'idle')

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  const bold = (await ui.findAll({ type: 'Box' }))
    .filter(one => one.props.borderStyle === 'bold')
    .map(one => [one.key, one.props.borderColor])
  expect(bold).toEqual([
    ['card-4131', 'warning'],
    ['card-4132', 'error'],
  ])

  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：分區標題前有狀態 glyph：◉ 只有符號用 claude 色，○ 閒置整列是收合按鈕，▾ 在文字後面`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 + 60_000 })
    const world = fakeWorld(on, [surface])
    put(world, 4141, 'busy')
    put(world, 4142, 'busy')
    put(world, 4143, 'idle')

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })

    expect((await ui.find({ key: 'section-busy' }))?.text).toBe('◉ 工作中 2')
    const busy = textsOf(await ui.find({ key: 'section-busy' }))
    expect(busy.filter(one => one.props.color === 'claude').map(one => one.text)).toEqual(['◉'])
    expect(busy.every(one => one.props.size === 'footnote' || one.text === '◉')).toBe(true)

    const toggle = await ui.find({ key: 'toggle-idle' })
    expect(toggle?.type).toBe('Button')
    expect(toggle?.text).toBe('○ 閒置 1 ▾')
    expect(textsOf(toggle).every(one => one.props.color === 'inactive')).toBe(true)
    await ui.press({ key: 'toggle-idle' })
    expect((await ui.find({ key: 'toggle-idle' }))?.text).toBe('○ 閒置 1 ▸')
    expect(await ui.find({ key: 'card-4143' })).toBeUndefined()

    await ui.unmount()
  })
}

test('終端機：分區之間空 1 行，分區內（標題和卡片、閒置列之間）不空行；間距都用 step 名稱', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 60_000 })
  const world = fakeWorld(on, ['terminal'])
  put(world, 4151, 'waiting')
  put(world, 4152, 'busy')
  put(world, 4153, 'idle')
  put(world, 4154, 'idle')

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  const [root] = await ui.findAll({ type: 'Box' })
  expect(root?.props.rowGap).toBe('md')
  expect(rowsDown(root?.props.rowGap)).toBe(1)
  for (const key of ['waiting-group', 'busy-group', 'idle-group']) {
    const group = await ui.find({ key })
    expect({ key, rowGap: group?.props.rowGap }).toEqual({ key, rowGap: 'xs' })
    expect(rowsDown(group?.props.rowGap)).toBe(0)
  }
  // 待處理分區：頁首和待處理卡片在同一組
  const waiting = all(await ui.find({ key: 'waiting-group' })).map(one => one.key)
  expect(waiting).toContain('header')
  expect(waiting).toContain('card-4151')
  // 閒置列之間 0
  const rows = await ui.find({ key: 'idle-rows' })
  expect(rows?.props.rowGap ?? rows?.props.gap).toBeUndefined()
  expect(all(rows).filter(one => one.key?.startsWith('card-')).map(one => one.key)).toEqual(['card-4153', 'card-4154'])
  // 不再用數字寫間距
  for (const box of await ui.findAll({ type: 'Box' })) {
    for (const prop of ['gap', 'rowGap', 'columnGap', 'paddingX'] as const) {
      if (!['board', 'waiting-group', 'busy-group', 'idle-group', 'idle-rows', 'header'].includes(box.key ?? '') && !box.key?.startsWith('card-'))
        continue
      expect({ key: box.key, prop, numeric: typeof box.props[prop] === 'number' }).toEqual({ key: box.key, prop, numeric: false })
    }
  }

  await ui.unmount()
})

import { expect, mock, test } from 'claude-code/testing'
import { DIR, PANE, SESSIONS, T0, fakeWorld, put, report } from './world'

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：別的 Session 改了語言與密度，開著的監看視窗在下次 poll 跟著變`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 + 60_000 })
    const world = fakeWorld(on, [surface])
    put(world, 1101, 'idle')
    report(world, 1101, { branch: { name: 'idle-branch', ahead: 0, behind: 0, changed: 0 } })

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })
    const text = async (key: string) => (await ui.find({ key }))?.text ?? ''
    expect(await text('count')).toContain('沒有 Session 需要你處理')
    expect(await text('card-1101')).not.toContain('idle-branch')

    // 另一個 Session 在它的檢視面板改成英文、閒置改用標準密度，寫進共用的設定
    world.stored.set('view', {
      fields: {
        waiting: ['time', 'location', 'branch', 'progress', 'activity', 'changes', 'context', 'pr', 'reply', 'tasks'],
        busy: ['time', 'location', 'branch', 'progress', 'activity', 'changes', 'context', 'pr', 'reply', 'tasks'],
        idle: ['time', 'location', 'branch', 'progress', 'activity', 'changes', 'context', 'pr', 'reply', 'tasks'],
      },
      isIdleCollapsed: false,
      billing: 'auto',
      locale: 'en',
      autoOpen: true,
      autoOpenCli: false,
    })
    await clock.advance(3_000)

    expect(await text('count')).toContain('Nothing needs you')
    expect(await text('card-1101')).toContain('idle-branch')

    await ui.unmount()
  })
}

/** 終端機上的格數：中日韓與全形字 2 格，其他 1 格 */
const cells = (text: string): number =>
  [...text].reduce((sum, char) => sum + (/[ᄀ-ᅟ⺀-꓏가-힣＀-｠]/.test(char) ? 2 : 1), 0)

type Drawn = { type: string; props: Record<string, unknown>; text?: string; children?: unknown[] }

/** 一個元素在終端機上排成一列時的寬度：橫向排列加總子元素與間距，直向取最寬，再加內距與外框 */
const widthOf = (node: unknown): number => {
  if (typeof node === 'string') return cells(node)
  const one = node as Drawn
  const kids = (one.children ?? []).filter(kid => kid !== null && kid !== undefined && kid !== false && kid !== '')
  if (one.type === 'Text') return kids.reduce((sum: number, kid) => sum + widthOf(kid), 0)
  const isRow = one.type !== 'Box' || (one.props.flexDirection ?? 'row') === 'row'
  const gap = Number(one.props.columnGap ?? one.props.gap ?? 0)
  const inner = isRow
    ? kids.reduce((sum: number, kid) => sum + widthOf(kid), 0) + gap * Math.max(0, kids.length - 1)
    : Math.max(0, ...kids.map(widthOf))
  const frame = Number(one.props.paddingX ?? 0) * 2 + (one.props.borderStyle === undefined ? 0 : 2)

  return inner + frame
}

/** 一張卡片的標題列（含卡片自己的外框與內距）在終端機上的寬度 */
const titleRowWidth = (card: Drawn): number => {
  const row = (card.children ?? []).find(kid => typeof kid === 'object' && kid !== null)
  const frame = Number(card.props.paddingX ?? 0) * 2 + (card.props.borderStyle === undefined ? 0 : 2)

  return widthOf(row) + frame
}

test('終端機：中日韓長標題截在可用欄數內，每一列都不超過 Pane 的寬度，時間照樣看得到', async ($, on) => {
  const clock = mock.clock(on, { now: T0 + 5 * 60_000 })
  const world = fakeWorld(on, ['terminal'])
  const long = '評估放寬 parse_plan 在 AppMCP 後截斷計畫的長度限制與相關測試'
  const record = (pid: number, status: string, sessionId = `s-${pid}`) => {
    world.files.set(
      `${DIR}/${pid}.json`,
      JSON.stringify({ pid, sessionId, status, cwd: `/work/proj-${pid}`, name: `${long}${pid}`, statusUpdatedAt: T0 }),
    )
    world.alive.add(pid)
  }
  record(1121, 'waiting') // ▲ 等你
  record(1122, 'idle') // ✕ 出錯
  report(world, 1122, { turnError: 'boom' })
  record(1123, 'busy')
  report(world, 1123, {
    tasks: [
      { kind: 'agent', label: 'Explore', status: 'running' },
      { kind: 'agent', label: 'Plan', status: 'failed' },
    ],
  })
  record(1124, 'busy', 'me') // 目前這個
  record(1125, 'idle')

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()

  for (const columns of [40, 60]) {
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, bodyColumns: columns } })
    for (const pid of [1121, 1122, 1123, 1124, 1125]) {
      const card = (await ui.find({ key: `card-${pid}` })) as Drawn | undefined
      expect(card).toBeDefined()
      expect({ pid, columns, width: titleRowWidth(card!) <= columns }).toEqual({ pid, columns, width: true })
      expect(card!.text).toContain('5m ▸')
    }
    await ui.unmount()
  }
})

/** 監看視窗裡的帳號用量卡片與 Session 卡片，依畫面上由上到下的順序 */
const order = async (ui: { findAll: (q: { type: string }) => Promise<{ key: string | undefined }[]> }) =>
  (await ui.findAll({ type: 'Box' }))
    .map(one => one.key ?? '')
    .filter(key => key === 'account' || key.startsWith('card-'))

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：需要你處理的卡片排在帳號用量卡片之前；用量 ≥95% 時帳號卡片才提到上方`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 + 60_000 })
    const world = fakeWorld(on, [surface])
    put(world, 1111, 'waiting')
    put(world, 1112, 'busy')
    report(world, 1112, { rateLimits: [{ kind: 'five_hour', percentUsed: 72 }] })

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await $.command.run(SESSIONS)
    await clock.settle()
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await order(ui)).toEqual(['card-1111', 'card-1112', 'account'])

    // 5 小時用量快用完：帳號卡片提到需要你處理的卡片之前
    report(world, 1112, { rateLimits: [{ kind: 'five_hour', percentUsed: 96 }] })
    await clock.advance(3_000)
    expect(await order(ui)).toEqual(['account', 'card-1111', 'card-1112'])

    await ui.unmount()
  })
}

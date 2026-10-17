import { expect, mock, test } from 'claude-code/testing'

import { PANE, SESSIONS, T0, fakeWorld, put, report } from './world'

// ── field-settings/01：連接器和完整路徑的欄位設定要有作用 ─────────────────

const FIELDS = ['time', 'location'] as const

const viewWith = (idle: readonly string[]) => ({
  view: {
    fields: { waiting: [...FIELDS], busy: [...FIELDS], idle },
    isIdleCollapsed: false,
    billing: 'auto',
    locale: 'en',
    autoOpen: false,
    autoOpenCli: false,
  },
})

const putIdle = (world: ReturnType<typeof fakeWorld>) => {
  put(world, 1201, 'idle')
  report(world, 1201, { connectors: { connected: ['chrome-devtools', 'linear'], needsAuth: ['figma'] } })
}

test('勾了連接器和完整路徑：卡片上顯示；展開後改由展開明細顯示，不重複', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'], {}, viewWith([...FIELDS, 'connectors', 'path']))
  putIdle(world)

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text

  expect(await text('field-connectors-1201')).toContain('Connectors 2')
  expect(await text('field-connectors-1201')).toContain('Needs auth figma')
  expect(await text('field-path-1201')).toBe('/work/proj-1201')

  await ui.press({ key: 'expand-1201' })
  expect(await text('field-connectors-1201')).toBeUndefined()
  expect(await text('field-path-1201')).toBeUndefined()
  expect(await text('connectors')).toContain('Connectors 2: chrome-devtools, linear')
  expect(await text('detail-path')).toBe('/work/proj-1201')

  await ui.unmount()
})

test('沒勾連接器和完整路徑：卡片上不顯示，只在展開明細出現', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, ['desktop'], {}, viewWith([...FIELDS]))
  putIdle(world)

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = async (key: string) => (await ui.find({ key }))?.text

  expect(await text('field-connectors-1201')).toBeUndefined()
  expect(await text('field-path-1201')).toBeUndefined()

  await ui.press({ key: 'expand-1201' })
  expect(await text('connectors')).toContain('Connectors 2: chrome-devtools, linear')
  expect(await text('detail-path')).toBe('/work/proj-1201')

  await ui.unmount()
})

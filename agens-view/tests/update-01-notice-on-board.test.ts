import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { On } from 'claude-code'
import { PANE, SESSIONS, T0, fakeWorld, put, report, type World } from './world'

// 新版提示（update-check/01）：main 上公布的版本嚴格大於已安裝的版本，監看視窗頁首下方才出現一行提示

const LATEST_URL = 'https://raw.githubusercontent.com/wide3751/switchboard/main/agens-view/.claude-plugin/plugin.json'

/** 打開監看視窗，等過啟動後的第一次檢查更新（約一分鐘） */
const boardAfterCheck = async (
  $: Parameters<TestBody>[0],
  on: On,
  arrange: (world: World) => void,
  options: { surface?: 'terminal' | 'desktop'; store?: Record<string, unknown>; wait?: number } = {},
) => {
  const surface = options.surface ?? 'terminal'
  const clock = mock.clock(on, { now: T0 })
  const world = fakeWorld(on, [surface], {}, options.store ?? {})
  arrange(world)
  await $.session.start({ cwd: '/work', surface, isInteractive: true })
  await $.command.run(SESSIONS)
  await clock.advance(options.wait ?? 60_000)
  const ui = await $.ui.mount({ ...PANE, surface })
  const text = async (key: string) => (await ui.find({ key }))?.text

  return { world, ui, text }
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}：公布的版本比已安裝的新，頁首下方出現新版提示，有版本號和開啟自動更新的說明`, async ($, on) => {
    const { world, ui, text } = await boardAfterCheck(
      $,
      on,
      world => {
        world.installed = '1.2.0'
        world.published = '1.3.0'
        put(world, 101, 'busy')
      },
      { surface },
    )

    expect(await text('update-version')).toBe('⇡ 新版 1.3.0')
    expect(await text('update-hint')).toBe('到 /plugin › Marketplaces 開啟 switchboard 的自動更新，以後就不用手動')
    // 只讀 main 上那份 plugin.json：不帶標頭、內容或驗證，不送出任何本機資料
    expect(world.fetches.map(one => one.url)).toEqual([LATEST_URL])
    expect(world.fetches.map(one => one.init ?? {})).toEqual([{}])
    await ui.unmount()
  })
}

for (const [installed, published] of [
  ['1.2.0', '1.2.0'],
  ['1.3.0', '1.2.0'],
  ['2.0.0', '1.9.9'],
  ['0.10.0', '0.9.0'],
] as const) {
  test(`已安裝 ${installed}、公布 ${published}：不是更新的版本，什麼都不顯示`, async ($, on) => {
    const { world, ui, text } = await boardAfterCheck($, on, world => {
      world.installed = installed
      world.published = published
      put(world, 102, 'busy')
    })

    expect(world.fetches).toHaveLength(1)
    expect(await ui.find({ key: 'update-notice' })).toBeUndefined()
    expect(await text('count')).toBe('✓ 沒有待處理的 Session')
    await ui.unmount()
  })
}

for (const [installed, published] of [
  ['0.9.0', '0.10.0'],
  ['0.11.9', '0.12.0'],
  ['1.2.3', '1.2.10'],
] as const) {
  test(`版本號照每一段的數字比：已安裝 ${installed}、公布 ${published} 是新版`, async ($, on) => {
    const { ui, text } = await boardAfterCheck($, on, world => {
      world.installed = installed
      world.published = published
    })

    expect(await text('update-version')).toBe(`⇡ 新版 ${published}`)
    await ui.unmount()
  })
}

for (const [name, arrange, wait] of [
  ['連不上網路', (world: World) => (world.fetchFailure = 'throws'), 60_000],
  ['回應不是 2xx', (world: World) => (world.fetchFailure = 'status'), 60_000],
  ['回應不是 JSON', (world: World) => (world.fetchFailure = 'json'), 60_000],
  ['回應沒有 version', (world: World) => (world.fetchFailure = 'no-version'), 60_000],
  ['公布的版本號讀不懂', (world: World) => (world.published = 'v1.3'), 60_000],
  ['公布的是預發布版本', (world: World) => (world.published = '1.3.0-beta.1'), 60_000],
  ['一直沒有回應', (world: World) => (world.fetchFailure = 'hang'), 70_000],
  ['讀不到已安裝的 plugin.json', (world: World) => (world.installed = null), 60_000],
  ['已安裝的版本號讀不懂', (world: World) => (world.installed = 'dev'), 60_000],
] as const) {
  test(`${name}：當作沒有新版，不顯示也不報錯，監看視窗其他部分照常`, async ($, on) => {
    const { ui, text } = await boardAfterCheck(
      $,
      on,
      world => {
        world.published = '9.0.0'
        put(world, 103, 'waiting')
        arrange(world)
      },
      { wait },
    )

    expect(await ui.find({ key: 'update-notice' })).toBeUndefined()
    expect(await text('count')).toBe('▲ 1 個待處理')
    expect(await ui.find({ key: 'card-103' })).toBeDefined()
    await ui.unmount()
  })
}

/** 頁首、帳號用量卡片、新版提示和 Session 卡片，依畫面上由上到下的順序 */
const order = async (ui: { findAll: (q: { type: string }) => Promise<{ key: string | undefined }[]> }) =>
  (await ui.findAll({ type: 'Box' }))
    .map(one => one.key ?? '')
    .filter(key => ['header', 'account', 'update-notice'].includes(key) || key.startsWith('card-'))

for (const [name, arrange, expected] of [
  [
    '有待處理',
    (world: World) => {
      put(world, 111, 'waiting')
      put(world, 112, 'busy')
      report(world, 112, { rateLimits: [{ kind: 'five_hour', percentUsed: 96 }] })
    },
    ['header', 'account', 'update-notice', 'card-111', 'card-112'],
  ],
  [
    '沒有待處理',
    (world: World) => {
      put(world, 112, 'busy')
      report(world, 112, { rateLimits: [{ kind: 'five_hour', percentUsed: 96 }] })
    },
    ['header', 'account', 'update-notice', 'card-112'],
  ],
  ['看不到狀態', (world: World) => (world.psFailure = 'throws'), ['header', 'update-notice']],
] as const) {
  test(`${name}：新版提示在頁首下方；用量 ≥95% 的帳號提醒也在時兩個都看得到`, async ($, on) => {
    const { ui } = await boardAfterCheck($, on, world => {
      world.published = '1.3.0'
      arrange(world)
    })

    expect(await order(ui)).toEqual([...expected])
    await ui.unmount()
  })
}

for (const [locale, version, hint] of [
  ['en', '⇡ New version 1.3.0', 'Turn on auto-update for switchboard in /plugin › Marketplaces and you won’t have to update by hand'],
  ['ja', '⇡ 新しいバージョン 1.3.0', '/plugin › Marketplaces で switchboard の自動更新をオンにすると、今後は手動で更新する必要はありません'],
  ['ko', '⇡ 새 버전 1.3.0', '/plugin › Marketplaces에서 switchboard 자동 업데이트를 켜면 앞으로 직접 업데이트하지 않아도 됩니다'],
  ['zh-CN', '⇡ 新版 1.3.0', '到 /plugin › Marketplaces 开启 switchboard 的自动更新，以后就不用手动'],
  ['zh-TW', '⇡ 新版 1.3.0', '到 /plugin › Marketplaces 開啟 switchboard 的自動更新，以後就不用手動'],
] as const) {
  test(`多國語言（${locale}）：新版提示的版本號和開啟自動更新的說明`, async ($, on) => {
    const { ui, text } = await boardAfterCheck($, on, world => (world.published = '1.3.0'), { store: { view: { locale } } })

    expect(await text('update-version')).toBe(version)
    expect(await text('update-hint')).toBe(hint)
    await ui.unmount()
  })
}

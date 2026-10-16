import { expect, mock } from 'claude-code/testing'
import type { On, RenderElement } from 'claude-code'


export const HOME = '/Users/tester'
export const DIR = `${HOME}/.claude/sessions`

export const PANE = {
  plugin: 'switchboard',
  component: 'Pane',
  requestId: 'switchboard',
  props: {
    title: 'Switchboard',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

/** 使用者在輸入框打 `/switchboard:open` 按下 Enter。 */
export const SESSIONS = {
  command: 'switchboard:open',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 120 },
} as const

export type Status = 'busy' | 'idle' | 'waiting'
export type World = {
  /** 假的檔案系統：路徑 → 內容 */
  files: Map<string, string>
  alive: Set<number>
  opened: string[]
  /** 目前開著的 Pane */
  panes: Set<string>
  scans: number
  /** 用 open 打開過的連結 */
  links: string[]
  /** 用 rm 刪掉的檔案 */
  removed: string[]
  /** `defaults read -g AppleLanguages` 的輸出 */
  appleLanguages: string
  /** ui.open 收到的標題，依序 */
  titles: string[]
  /** mod 的全域設定（store），依鍵 */
  stored: Map<string, unknown>
  /** 終端機太窄：mod 自己主動打開的 Pane 不畫出來（引擎要 ≥144 欄） */
  isNarrow: boolean
  /** 已經畫出來的 Pane */
  placed: Set<string>
  /** 正在處理使用者自己的動作（輸入指令、按按鈕）：引擎不管寬度都會畫 */
  isAsked: boolean
  /** 各 pid 所在的終端機（ps 的 tty 欄）；沒列的是 `??` */
  ttys: Map<number, string>
  /** 用 osascript 叫終端機切換分頁：哪個 app、哪個 tty */
  scripts: { app: string; tty: string }[]
  /** osascript 找不到對應分頁 */
  isTabMissing: boolean
  /**
   * osascript 以錯誤結束（例如自動化權限被拒時的 -1743），或卡住不結束（`'hang'`：
   * 有給 timeoutMs 就照引擎的行為在逾時後 reject，沒給就一直不結束）。沒設時照 isTabMissing 回答。
   */
  scriptFailure?: { exitCode: number; stderr: string } | 'hang'
  /** 列不出內容的資料夾（例如沒有權限）：fs.list 會丟錯 */
  unreadable: Set<string>
  /** 設了的話，git 和 gh 要等它 resolve 才回應（模擬大 repo、慢網路） */
  slowCommands?: Promise<void>
}

/** Session 啟動時清理殘留的狀態回報，會讀一次 session 紀錄（算一次 scans）；之後才是監看視窗的 polling */
export const STARTUP_SCANS = 1

/** 一個實際的時間點（毫秒） */
export const T0 = 1_760_000_000_000

export const REPORTS = `${HOME}/.claude/switchboard/reports`
export const GIT_STATUS = '# branch.oid abc\n# branch.head feature/cards\n# branch.upstream origin/feature/cards\n# branch.ab +2 -1\n1 .M N... 100644 100644 100644 a b hooks/board.ts\n? notes.md\n'

export const ok = (stdout: string, exitCode = 0) => ({
  value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
})

/** 假造引擎底下的世界：檔案、pid 存活結果、git、目前的介面，以及這個 Session 自己。 */
export const fakeWorld = (
  on: On,
  surfaces: readonly ('terminal' | 'desktop' | 'vscode')[],
  env: Readonly<Record<string, string>> = {},
  store: Readonly<Record<string, unknown>> = {},
  options: { isNarrow?: boolean } = {},
): World => {
  const world: World = {
    files: new Map(),
    alive: new Set(),
    opened: [],
    panes: new Set(),
    scans: 0,
    links: [],
    removed: [],
    appleLanguages: '(\n    "zh-Hant-TW",\n    "en-TW"\n)\n',
    titles: [],
    stored: new Map(),
    isNarrow: options.isNarrow ?? false,
    placed: new Set(),
    isAsked: false,
    ttys: new Map(),
    scripts: [],
    isTabMissing: false,
    unreadable: new Set(),
  }

  mock.env(on, { HOME, ...env })
  // 記憶體裡的全域設定：和 mock.store 一樣，另外讓測試讀得到 mod 存了什麼
  for (const [key, value] of Object.entries(store)) world.stored.set(key, value)
  on('store.get', (_$, e) => ({ value: world.stored.get(e.key) }))
  on('store.set', (_$, e) => {
    world.stored.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', (_$, e) => {
    world.stored.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...world.stored.keys()] }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: surfaces }))
  on('session.id', () => ({ value: 'me' }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.turns', () => ({ value: 3 }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200_000, percent: 42 }, rateLimits: [], cost: { usd: 1.5 } },
  }))
  on('ui.focus', () => ({}))
  on('ui.panes', () => ({
    value: [...world.panes].map(id => ({
      id,
      title: 'Switchboard',
      isShown: true,
      isFocused: false,
      isPlaced: !world.isNarrow || world.placed.has(id),
    })),
  }))
  // 使用者主動打開的不管寬度都畫；mod 自己主動打開的，終端機太窄就不畫
  on('ui.open', (_$, e) => {
    world.titles.push(e.title ?? '')
    if (!world.panes.has(e.id)) world.opened.push(e.id)
    world.panes.add(e.id)
    if (!world.isNarrow || world.isAsked) world.placed.add(e.id)
    if (world.isNarrow && !world.placed.has(e.id)) {
      return { value: { isPlaced: false as const, reason: 'narrow: 80 columns, needs 144' } }
    }

    return { value: { isPlaced: true as const } }
  })
  on('fs.list', (_$, e) => {
    if (world.unreadable.has(e.path)) throw new Error(`EACCES ${e.path}`)
    if (e.path === DIR) world.scans += 1
    const names = [...world.files.keys()]
      .filter(path => path.startsWith(`${e.path}/`))
      .map(path => path.slice(e.path.length + 1))

    return {
      value: names.map(name => ({ name, kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })),
    }
  })
  on('fs.read', (_$, e) => {
    const text = world.files.get(e.path)
    if (text === undefined) throw new Error(`ENOENT ${e.path}`)

    return { value: text }
  })
  on('fs.write', (_$, e) => {
    world.files.set(e.path, e.text)

    return { value: undefined }
  })
  on('tool.list', () => ({
    value: [
      { name: 'Bash', description: '', mcp: false },
      { name: 'mcp__chrome-devtools__click', description: '', mcp: true },
      { name: 'mcp__plugin_figma_figma__authenticate', description: '', mcp: true },
    ],
  }))
  on('process.run', async (_$, e) => {
    const argv = e.argv
    if ((argv[0] === 'git' || argv[0] === 'gh') && world.slowCommands !== undefined) await world.slowCommands
    if (argv[0] === 'git') {
      // 一律帶上關掉外部程式的設定
      expect(argv).toContain('core.fsmonitor=')
      if (argv.includes('status')) return ok(GIT_STATUS)
      if (argv.includes('symbolic-ref')) return ok('origin/main\n')
      if (argv.includes('merge-base')) return ok('abc123\n')
      if (argv.includes('diff')) {
        expect(argv).toContain('--no-ext-diff')
        expect(argv).toContain('--no-textconv')
        expect(argv.at(-1)).toBe('abc123')
        return ok('10\t2\thooks/board.ts\n-\t-\tlogo.png\n5\t0\tREADME.md\n')
      }
      return ok('')
    }
    // 系統語言：繁體中文（測試預設）
    if (argv[0] === 'defaults') return ok(world.appleLanguages)
    if (argv[0] === 'gh') return ok('{"number":12,"state":"OPEN","url":"https://github.com/o/r/pull/12"}')
    if (argv[0] === 'open') {
      world.links.push(argv[1] ?? '')
      return ok('')
    }
    if (argv[0] === 'rm') {
      for (const path of argv.slice(3)) world.files.delete(path)
      world.removed.push(...argv.slice(3))
      return ok('')
    }
    if (argv[0] === 'osascript') {
      // 腳本在 -e 參數裡，tty 是最後一個參數（不拼進腳本）
      const script = argv.filter((_, i) => argv[i - 1] === '-e').join('\n')
      const app = /tell application "([^"]+)"/.exec(script)?.[1] ?? ''
      world.scripts.push({ app, tty: argv.at(-1) ?? '' })
      const failure = world.scriptFailure
      if (failure === 'hang') {
        const timeoutMs = e.init?.timeoutMs
        if (timeoutMs === undefined) return new Promise<never>(() => {})
        return Promise.reject(new Error(`process.run: osascript timed out after ${timeoutMs}ms`))
      }
      if (failure !== undefined) {
        return { value: { exitCode: failure.exitCode, stdout: '', stderr: failure.stderr, isStdoutTruncated: false, isStderrTruncated: false } }
      }
      return ok(world.isTabMissing ? 'missing\n' : 'ok\n')
    }
    expect(argv.slice(0, 4)).toEqual(['ps', '-o', 'pid=,tty=', '-p'])
    const found = (argv[4] ?? '').split(',').map(Number).filter(pid => world.alive.has(pid))

    return ok(found.map(pid => `  ${pid} ${world.ttys.get(pid) ?? '??'}\n`).join(''), found.length === 0 ? 1 : 0)
  })

  return world
}

/** 使用者自己的動作（輸入指令、按按鈕）：期間打開的 Pane 不管寬度都畫。 */
export const asPerson = async <T,>(world: World, act: () => Promise<T>): Promise<T> => {
  world.isAsked = true
  try {
    return await act()
  } finally {
    world.isAsked = false
  }
}

export const put = (world: World, pid: number, status: Status, isAlive = true) => {
  world.files.set(
    `${DIR}/${pid}.json`,
    JSON.stringify({ pid, sessionId: `s-${pid}`, status, cwd: `/work/proj-${pid}`, statusUpdatedAt: T0 }),
  )
  if (isAlive) world.alive.add(pid)
  else world.alive.delete(pid)
}

/** 另一個 Session 寫出的狀態回報。 */
export const report = (world: World, pid: number, fields: Record<string, unknown>) => {
  world.files.set(`${REPORTS}/s-${pid}.json`, JSON.stringify({ sessionId: `s-${pid}`, reportedAt: 1, ...fields }))
}


export const BAND = {
  plugin: 'switchboard',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

/** 引擎自己的 band：外掛不畫時輪到它。 */
export const engineBand = (on: On) =>
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return h(Box, { key: 'engine-band' }) as RenderElement
  })

export const putTerminals = (world: World) => {
  for (const [pid, terminal, tty] of [
    [231, 'iTerm.app', 'ttys003'],
    [232, 'Apple_Terminal', 'ttys004'],
    [233, 'WarpTerminal', 'ttys005'],
  ] as const) {
    put(world, pid, 'idle')
    report(world, pid, { terminal })
    world.ttys.set(pid, tty)
  }
}

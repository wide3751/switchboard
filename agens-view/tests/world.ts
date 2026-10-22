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

export type Status = 'busy' | 'idle' | 'waiting' | 'shell'
export type World = {
  /** 假的檔案系統：路徑 → 內容 */
  files: Map<string, string>
  alive: Set<number>
  opened: string[]
  /** 目前開著的 Pane */
  panes: Set<string>
  /** 監看視窗的掃描：監看視窗畫出來時讀 session 紀錄的次數 */
  scans: number
  /** 輕量掃描（ADR-0006）：監看視窗沒畫出來時讀 session 紀錄的次數，給打開按鈕的等你計數用 */
  lightScans: number
  /** 跑過的外部指令（argv），依序 */
  commands: string[][]
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
  /** sessions 資料夾讀不到（fs.list 丟例外） */
  isSessionsUnreadable?: boolean
  /** ps 壞掉：丟例外，或什麼都不輸出 */
  psFailure?: 'throws' | 'empty'
  /** Windows 的 tasklist 壞掉：丟例外、什麼都不輸出，或以錯誤結束（結束碼 1，只印錯誤訊息） */
  tasklistFailure?: 'throws' | 'empty' | 'exit'
  /** ps 回答前先等這個（模擬卡住的 ps） */
  psWait?: () => Promise<void>
  /**
   * ps 卡住不結束：照引擎的行為，等到逾時（timeoutMs，沒給是引擎預設的 30 秒）才 reject。
   * 收到要等的毫秒數，由測試決定怎麼等（通常是 mock clock 的 sleep）
   */
  psHang?: (timeoutMs: number) => Promise<void>
  /** 設了的話，git 和 gh 要等它 resolve 才回應（模擬大 repo、慢網路） */
  slowCommands?: Promise<void>
  /** `uname -s` 的輸出；沒設是 macOS 的 `Darwin`，設成 null 是沒有 uname（丟例外） */
  uname?: string | null
  /** 設了的話，store.set 要等它 resolve 才寫進去（模擬寫入設定比較慢） */
  storeSetWait?: () => Promise<void>
  /** 這台電腦已安裝的 switchboard 版本（plugin 目錄裡 plugin.json 的 version）；null 是讀不到 plugin.json */
  installed: string | null
  /** GitHub main 上 plugin.json 公布的版本；沒設時和已安裝的一樣，看不到新版提示 */
  published?: string
  /** 讀公布的版本失敗：丟例外（斷線）、非 2xx、不是 JSON、沒有 version、卡住不回應 */
  fetchFailure?: 'throws' | 'status' | 'json' | 'no-version' | 'hang'
  /** http.fetch 收到的請求，依序 */
  fetches: { url: string; init: unknown }[]
  /**
   * claude plugin … 失敗：找不到 claude（丟例外）、第幾步（1 是 marketplace update，2 是 plugin update）以非零結束，
   * 或第幾步卡住不結束：照引擎的行為等到逾時（timeoutMs）才 reject，等法由測試決定（通常是 mock clock 的 sleep）
   */
  claudeFailure?: 'missing' | { step: 1 | 2; exitCode: number } | { step: 1 | 2; hang: (timeoutMs: number) => Promise<void> }
  /** claude plugin … 回答前先等這個（模擬慢網路）；收到第幾步 */
  claudeWait?: (step: 1 | 2) => Promise<void>
}

/** 立即更新依序跑的兩個指令 */
export const UPDATE_COMMANDS = [
  ['claude', 'plugin', 'marketplace', 'update', 'switchboard'],
  ['claude', 'plugin', 'update', 'switchboard@switchboard'],
] as const

/**
 * Session 啟動時清理殘留的狀態回報：監看視窗沒畫出來時由輕量掃描順便清（算在 lightScans），
 * 畫出來時由監看視窗的掃描清，所以啟動本身不算 scans
 */
export const STARTUP_SCANS = 0

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
  /** 值是 undefined 的變數視為沒設（例如拿掉 HOME 模擬 Windows） */
  env: Readonly<Record<string, string | undefined>> = {},
  store: Readonly<Record<string, unknown>> = {},
  options: { isNarrow?: boolean } = {},
): World => {
  const world: World = {
    files: new Map(),
    alive: new Set(),
    opened: [],
    panes: new Set(),
    scans: 0,
    lightScans: 0,
    commands: [],
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
    installed: '1.2.0',
    fetches: [],
  }

  mock.env(
    on,
    Object.fromEntries(
      Object.entries({ HOME, ...env }).filter((entry): entry is [string, string] => entry[1] !== undefined),
    ),
  )
  // 記憶體裡的全域設定：和 mock.store 一樣，另外讓測試讀得到 mod 存了什麼
  for (const [key, value] of Object.entries(store)) world.stored.set(key, value)
  on('store.get', (_$, e) => ({ value: world.stored.get(e.key) }))
  on('store.set', (_$, e) => {
    const wait = world.storeSetWait
    const write = () => {
      world.stored.set(e.key, e.value)
      return { value: undefined }
    }
    // 沒設 storeSetWait 時照舊同步寫入
    return wait === undefined ? write() : wait().then(write)
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
    if (e.path === DIR) {
      if (isBoardPlaced(world)) world.scans += 1
      else world.lightScans += 1
    }
    if (e.path === DIR && world.isSessionsUnreadable === true) throw new Error(`EACCES ${e.path}`)
    const names = [...world.files.keys()]
      .filter(path => path.startsWith(`${e.path}/`))
      .map(path => path.slice(e.path.length + 1))

    return {
      value: names.map(name => ({ name, kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })),
    }
  })
  on('fs.read', (_$, e) => {
    // 這份 plugin 自己的 plugin.json 在 $.plugin.root 底下，測試拿不到那個路徑，只看結尾
    if (e.path.endsWith('/.claude-plugin/plugin.json')) {
      if (world.installed === null) throw new Error(`ENOENT ${e.path}`)
      return { value: JSON.stringify({ name: 'switchboard', version: world.installed }) }
    }
    const text = world.files.get(e.path)
    if (text === undefined) throw new Error(`ENOENT ${e.path}`)

    return { value: text }
  })
  on('fs.write', (_$, e) => {
    world.files.set(e.path, e.text)

    return { value: undefined }
  })
  on('http.fetch', (_$, e) => {
    world.fetches.push({ url: e.url, init: e.init })
    const failure = world.fetchFailure
    if (failure === 'throws') throw new Error('getaddrinfo ENOTFOUND raw.githubusercontent.com')
    if (failure === 'hang') return new Promise<never>(() => {})
    const manifest = failure === 'no-version' ? { name: 'switchboard' } : { name: 'switchboard', version: world.published ?? world.installed }
    const text = failure === 'json' ? '<!DOCTYPE html>' : JSON.stringify(manifest)
    // 非 2xx 時內容照樣是一份 plugin.json：只看得懂內容、不看狀態碼的話就會誤報
    const status = failure === 'status' ? 503 : 200

    return { value: { status, ok: status < 300, headers: {}, text } }
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
    world.commands.push([...argv])
    // 立即更新：每個平台的寫法一樣
    if (argv[0] === 'claude') {
      const step = argv[2] === 'marketplace' ? 1 : 2
      expect([...argv]).toEqual([...UPDATE_COMMANDS[step - 1]!])
      const failure = world.claudeFailure
      if (failure === 'missing') throw new Error('claude: command not found')
      await world.claudeWait?.(step)
      if (failure !== undefined && failure.step === step) {
        if ('exitCode' in failure) return ok('', failure.exitCode)
        const timeoutMs = e.init?.timeoutMs ?? 30_000
        await failure.hang(timeoutMs)
        throw new Error(`process.run: claude timed out after ${timeoutMs}ms`)
      }
      return ok('')
    }
    // Windows 沒有 ps、rm、uname、open、osascript，改用 tasklist、cmd del、rundll32
    if (env.OS === 'Windows_NT') {
      if (argv[0] === 'tasklist') {
        expect(argv).toEqual(['tasklist', '/FO', 'CSV', '/NH'])
        if (world.tasklistFailure === 'throws') throw new Error('tasklist: Access is denied.')
        if (world.tasklistFailure === 'empty') return ok('')
        if (world.tasklistFailure === 'exit') return ok('ERROR: The RPC server is unavailable.\r\n', 1)
        const rows = [...world.alive].map(pid => `"claude.exe","${pid}","Console","1","123,456 K"\r\n`)
        return ok(`"System","4","Services","0","152 K"\r\n${rows.join('')}`)
      }
      if (argv[0] === 'rundll32') {
        expect(argv.slice(0, 2)).toEqual(['rundll32', 'url.dll,FileProtocolHandler'])
        world.links.push(argv[2] ?? '')
        return ok('')
      }
      if (argv[0] === 'cmd') {
        expect(argv.slice(0, 6)).toEqual(['cmd', '/d', '/c', 'del', '/f', '/q'])
        // del 收到的是反斜線路徑，假檔案系統存的是正斜線
        const paths = argv.slice(6).map(path => path.replaceAll('\\', '/'))
        for (const path of paths) world.files.delete(path)
        world.removed.push(...paths)
        return ok('')
      }
      if (['ps', 'rm', 'uname', 'open', 'osascript'].includes(argv[0] ?? '')) throw new Error(`${argv[0]}: not found`)
    }
    if (argv[0] === 'ps') {
      if (world.psHang !== undefined) {
        const timeoutMs = e.init?.timeoutMs ?? 30_000
        await world.psHang(timeoutMs)
        throw new Error(`process.run: ps timed out after ${timeoutMs}ms`)
      }
      await world.psWait?.()
      if (world.psFailure === 'throws') throw new Error('ps: fork: Resource temporarily unavailable')
      if (world.psFailure === 'empty') return ok('')
    }
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
    if (argv[0] === 'uname') {
      if (world.uname === null) throw new Error('uname: command not found')
      return ok(`${world.uname ?? 'Darwin'}\n`)
    }
    expect(argv.slice(0, 4)).toEqual(['ps', '-o', 'pid=,tty=', '-p'])
    const found = (argv[4] ?? '').split(',').map(Number).filter(pid => world.alive.has(pid))

    return ok(found.map(pid => `  ${pid} ${world.ttys.get(pid) ?? '??'}\n`).join(''), found.length === 0 ? 1 : 0)
  })

  return world
}

/** 監看視窗已經打開而且畫出來了（和 ui.panes 回報的 isPlaced 一致）。 */
export const isBoardPlaced = (world: World): boolean =>
  world.panes.has('switchboard') && (!world.isNarrow || world.placed.has('switchboard'))

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

/** 目前這個 Session 自己的 session 紀錄（sessionId 是 `me`）。 */
export const putSelf = (world: World, pid: number, status: Status = 'busy') => {
  world.files.set(
    `${DIR}/${pid}.json`,
    JSON.stringify({ pid, sessionId: 'me', status, cwd: '/work/me', statusUpdatedAt: T0 }),
  )
  world.alive.add(pid)
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

const ACROSS: Record<string, number> = { xs: 1, sm: 1, md: 2, lg: 3, xl: 4 }
const DOWN: Record<string, number> = { xs: 0, sm: 0, md: 1, lg: 1, xl: 2 }

/** 終端機上間距（Space）的橫向格數：xs、sm 1 格，md 2，lg 3，xl 4；數字照原樣，沒設是 0 */
export const cellsAcross = (space: unknown): number =>
  typeof space === 'number' ? space : (ACROSS[String(space)] ?? 0)

/** 終端機上間距的縱向行數：xs、sm 0 行，md、lg 1 行，xl 2 行；數字照原樣，沒設是 0 */
export const rowsDown = (space: unknown): number =>
  typeof space === 'number' ? space : (DOWN[String(space)] ?? 0)

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Density, Field, Group, Report, SessionCard, Snapshot, View } from '../types'
import {
  DEFAULT_FIELDS,
  PRESETS,
  applyPlan,
  branchLabel,
  clipToWidth,
  commonModel,
  configDirOf,
  countNeedsYou,
  densityOf,
  displayWidth,
  groupOf,
  describeProgress,
  desktopLinkOf,
  locationOf,
  parseAlive,
  parseGitStatus,
  parseNumstat,
  parseRecord,
  parseReport,
  progressOfTodos,
  shortAge,
  shortModel,
  summarizeTool,
  toCards,
  usageBar,
  usageColor,
} from './board'
import type { PlanItem } from './board'

// 指令來自 commands/on.md，以 plugin 名稱為命名空間
const COMMAND = 'switchboard:on'
const PANE = 'switchboard'
const TITLE = 'Sessions'
const POLL_MS = 3000
/** Desktop 的任務清單工具 */
const PLAN_TOOL = 'mcp__ccd_turn__update_plan'
const VIEW_KEY = 'view'

/** 狀態的圖示、顏色與外框：重要程度主要靠外框粗細區分，顏色只是輔助 */
const LOOK: Record<SessionCard['status'], { glyph: string; color: string }> = {
  waiting: { glyph: '▲', color: 'warning' },
  busy: { glyph: '◉', color: 'claude' },
  idle: { glyph: '○', color: 'inactive' },
  unknown: { glyph: '◌', color: 'inactive' },
}

/** 檢視面板裡可以開關的欄位，依卡片上的順序 */
const FIELDS: readonly { field: Field; label: string }[] = [
  { field: 'time', label: '時間' },
  { field: 'location', label: '位置' },
  { field: 'branch', label: '分支' },
  { field: 'progress', label: '進度' },
  { field: 'activity', label: '目前動作' },
  { field: 'changes', label: '變更行數' },
  { field: 'model', label: '模型' },
  { field: 'usage', label: '用量' },
  { field: 'source', label: '來源' },
  { field: 'path', label: '完整路徑' },
]

const DENSITIES: readonly { density: Density; label: string }[] = [
  { density: 'compact', label: '精簡' },
  { density: 'standard', label: '標準' },
  { density: 'detailed', label: '詳細' },
]

const GROUPS: readonly { group: Group; label: string }[] = [
  { group: 'waiting', label: '需要你處理' },
  { group: 'busy', label: '工作中' },
  { group: 'idle', label: '閒置' },
]

const DEFAULT_VIEW: View = {
  fields: {
    waiting: [...DEFAULT_FIELDS.waiting],
    busy: [...DEFAULT_FIELDS.busy],
    idle: [...DEFAULT_FIELDS.idle],
  },
  isIdleCollapsed: false,
}

const snapshot = atom({ plugin: 'switchboard', key: 'snapshot' } as const, null)
const view = atom({ plugin: 'switchboard', key: 'view' } as const, DEFAULT_VIEW)
const isSettingsOpen = atom({ plugin: 'switchboard', key: 'isSettingsOpen' } as const, false)
const settingsGroup = atom({ plugin: 'switchboard', key: 'settingsGroup' } as const, 'busy')

// 用到 $ 的函式都寫在這個檔案：Desktop 自帶的 Claude Code 不讓 $ 跨 import 傳遞

async function configDir($: EngineInterface): Promise<string> {
  return configDirOf(await $.env.get('CLAUDE_CONFIG_DIR'), await $.env.get('HOME'))
}

// ── 回報者：每個 Session 寫出自己的狀態回報 ──────────────────────────

// 這個 Session 的回報；模組重新載入時從頭開始
let own: Report | null = null
let plan: PlanItem[] = []

async function readBranch($: EngineInterface): Promise<Report['branch']> {
  try {
    const status = await $.process.run(['git', 'status', '--porcelain=v2', '--branch'], { timeoutMs: 5000 })
    const branch = status.exitCode === 0 ? parseGitStatus(status.stdout) : null
    if (branch === null) return null
    // 還沒有任何 commit 時 HEAD 不存在，行數就不算
    const diff = await $.process.run(['git', 'diff', '--numstat', 'HEAD'], { timeoutMs: 5000 })

    return diff.exitCode === 0 ? { ...branch, ...parseNumstat(diff.stdout) } : branch
  } catch {
    return null
  }
}

async function readUsage($: EngineInterface): Promise<Pick<Report, 'contextPercent' | 'costUsd' | 'turns'>> {
  try {
    const usage = await $.session.usage()

    return {
      contextPercent: usage.context.percent ?? null,
      costUsd: usage.cost?.usd ?? null,
      turns: await $.session.turns(),
    }
  } catch {
    return { contextPercent: null, costUsd: null, turns: null }
  }
}

/** 合併這次的變化並寫出回報；任何失敗都不能影響 Session 本身。 */
async function writeReport($: EngineInterface, patch: Partial<Report>) {
  try {
    if (own === null) {
      own = {
        sessionId: await $.session.id(),
        reportedAt: 0,
        model: null,
        branch: null,
        progress: null,
        activity: null,
        turnStartedAt: null,
        turns: null,
        contextPercent: null,
        costUsd: null,
      }
    }
    own = { ...own, ...patch, reportedAt: await $.clock.now() }
    await $.fs.write(`${await configDir($)}/switchboard/reports/${own.sessionId}.json`, JSON.stringify(own))
  } catch {
    // 回報失敗時，監看視窗只顯示基本狀態
  }
}

// ── 監看視窗：只在打開 Pane 的 Session 裡 polling ─────────────────────

async function readTexts($: EngineInterface, dir: string): Promise<{ name: string; text: string }[]> {
  const entries = await $.fs.list(dir)
  const files = entries.filter(one => one.kind === 'file' && one.name.endsWith('.json'))
  const texts = await Promise.all(
    files.map(one =>
      $.fs
        .read(`${dir}/${one.name}`)
        .then(text => (typeof text === 'string' ? { name: one.name, text } : null))
        // 紀錄可能在列出之後、讀取之前被刪掉
        .catch(() => null),
    ),
  )

  return texts.filter(one => one !== null)
}

async function readReports($: EngineInterface, dir: string, sessionIds: readonly string[]): Promise<Map<string, Report>> {
  const reports = await Promise.all(
    sessionIds.map(id =>
      $.fs
        .read(`${dir}/${id}.json`)
        .then(text => (typeof text === 'string' ? parseReport(text) : null))
        // 沒載入 mod 的 Session 沒有回報
        .catch(() => null),
    ),
  )

  return new Map(reports.filter(one => one !== null).map(one => [one.sessionId, one]))
}

async function alivePids($: EngineInterface, pids: readonly number[]): Promise<Set<number>> {
  if (pids.length === 0) return new Set()
  // 一個都不存活時 ps 以 1 結束，輸出是空的
  const { stdout } = await $.process.run(['ps', '-o', 'pid=', '-p', pids.join(',')])

  return parseAlive(stdout)
}

/** 讀所有 session 紀錄與狀態回報、檢查 pid，算出這一次的結果。 */
async function scan($: EngineInterface): Promise<Snapshot> {
  const base = await configDir($)
  const scannedAt = await $.clock.now()
  let texts: { name: string; text: string }[]
  try {
    texts = await readTexts($, `${base}/sessions`)
  } catch {
    return { needsYou: 0, error: `讀不到 ${base}/sessions`, sessions: [], scannedAt }
  }
  const records = texts.map(one => parseRecord(one.name, one.text)).filter(one => one !== null)
  const alive = await alivePids($, [...new Set(records.map(one => one.pid))])
  const liveIds = records.filter(one => alive.has(one.pid)).flatMap(one => (one.sessionId === null ? [] : [one.sessionId]))
  const reports = await readReports($, `${base}/switchboard/reports`, liveIds)

  return {
    needsYou: countNeedsYou(records, alive),
    error: null,
    sessions: toCards(records, alive, reports),
    scannedAt,
  }
}

let poller: { cancel: () => void } | undefined
let isScanning = false

async function poll($: EngineInterface) {
  if (isScanning) return
  isScanning = true
  try {
    // Pane 被關掉（不管是誰關的）就停止 polling
    const panes = await $.ui.panes()
    if (!panes.some(pane => pane.id === PANE)) {
      stopPolling()
      return
    }
    const next = await scan($)
    await update($, snapshot, () => next)
  } finally {
    isScanning = false
  }
}

function startPolling($: EngineInterface) {
  if (poller !== undefined) return
  poller = $.clock.every(POLL_MS, () => poll($))
  void poll($)
}

function stopPolling() {
  poller?.cancel()
  poller = undefined
}

async function loadView($: EngineInterface) {
  const stored = (await $.store.get(VIEW_KEY)) as { fields?: unknown; isIdleCollapsed?: unknown } | undefined
  if (stored === undefined) return
  const raw = stored.fields
  // 舊版存的是一份共用清單：套用到每一組
  const fields: View['fields'] = Array.isArray(raw)
    ? { waiting: [...raw], busy: [...raw], idle: [...raw] }
    : { ...DEFAULT_VIEW.fields, ...((raw ?? {}) as Partial<View['fields']>) }
  await update($, view, () => ({ fields, isIdleCollapsed: stored.isIdleCollapsed === true }))
}

async function changeView($: EngineInterface, change: (current: View) => View) {
  const next = await update($, view, change)
  await $.store.set(VIEW_KEY, next)
}

async function toggleField($: EngineInterface, group: Group, field: Field) {
  await changeView($, current => {
    const list = current.fields[group]
    const next = list.includes(field) ? list.filter(one => one !== field) : [...list, field]

    return { ...current, fields: { ...current.fields, [group]: next } }
  })
}

async function setDensity($: EngineInterface, group: Group, density: Density) {
  await changeView($, current => ({
    ...current,
    fields: { ...current.fields, [group]: [...PRESETS[density]] },
  }))
}

async function toggleIdle($: EngineInterface) {
  await changeView($, current => ({ ...current, isIdleCollapsed: !current.isIdleCollapsed }))
}

/** 點卡片：Desktop 的 Session 用 deep link 切過去；CLI 先顯示路徑；目前這個什麼都不做。 */
async function jump($: EngineInterface, card: SessionCard) {
  if (card.sessionId !== null && card.sessionId === own?.sessionId) return
  const link = desktopLinkOf(card.hostSessionId)
  if (link === null) {
    $.ui.toast(`CLI Session 還不能跳轉，它在 ${card.path}`)
    return
  }
  const { exitCode } = await $.process.run(['open', link])
  if (exitCode !== 0) $.ui.toast(`沒辦法切換到「${card.title}」，它在 ${card.path}`)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await writeReport($, { model: await $.session.model(), branch: await readBranch($), ...(await readUsage($)) })
    // 熱重載後 Pane 還開著，就接著 polling
    const panes = await $.ui.panes()
    if (panes.some(pane => pane.id === PANE)) {
      await loadView($)
      startPolling($)
    }

    return started
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await writeReport($, { model: await $.session.model(), turnStartedAt: await $.clock.now(), activity: null })
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const input = e as unknown as Record<string, unknown>
    const tool = String(e.tool)
    const patch: Partial<Report> = { activity: summarizeTool(tool, input) }
    if (tool === 'TodoWrite' && Array.isArray(input.todos)) {
      patch.progress = progressOfTodos(input.todos as Parameters<typeof progressOfTodos>[0])
    } else if (tool === PLAN_TOOL) {
      plan = applyPlan(plan, input)
      patch.progress = progressOfTodos(plan)
    }
    await writeReport($, patch)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) {
      await writeReport($, {
        turnStartedAt: null,
        activity: null,
        branch: await readBranch($),
        ...(await readUsage($)),
      })
    }

    return done
  })

  // 自己回答，不呼叫 next：commands/on.md 的內容不會送給模型
  on('command.run', { command: COMMAND }, async $ => {
    const surfaces = await $.session.surfaces()
    if (!surfaces.includes('desktop')) {
      return { text: `監看視窗只在 Claude Desktop 打開：請到 Desktop 的 Code 分頁輸入 /${COMMAND}。` }
    }
    await loadView($)
    const opened = await $.ui.open({ id: PANE, title: TITLE })
    startPolling($)
    if (!opened.isPlaced) {
      return { text: `監看視窗已開啟，但介面還沒有放上它：${opened.reason}` }
    }

    return { text: '已打開監看視窗。' }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) stopPolling()

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    let current: Snapshot | null
    let settings: View
    let isOpen: boolean
    let editing: Group
    try {
      current = await read($, snapshot)
      settings = await read($, view)
      isOpen = await read($, isSettingsOpen)
      editing = await read($, settingsGroup)
    } catch (error) {
      return (
        <Box flexDirection="column">
          <Box key="count">
            <Text>switchboard 讀取狀態失敗：{String(error)}</Text>
          </Box>
        </Box>
      )
    }

    if (current === null) {
      return (
        <Box flexDirection="column">
          <Box key="count">
            <Text dimColor>讀取中…</Text>
          </Box>
        </Box>
      )
    }

    const now = current.scannedAt
    const showsIn = (group: Group, field: Field) => settings.fields[group].includes(field)
    const mainModel = commonModel(current.sessions)
    const density = densityOf(settings.fields[editing])
    const waiting = current.sessions.filter(card => card.status === 'waiting')
    const busy = current.sessions.filter(card => card.status === 'busy')
    const idle = current.sessions.filter(card => card.status !== 'waiting' && card.status !== 'busy')
    // Desktop 不會截斷按鈕裡的文字，改由這裡依 Pane 的欄寬截斷；留 2 格餘裕給比例字型
    const columns = Math.max(20, e.props.bodyColumns - 2)
    const cardWidth = columns - 4 // 外框加左右內距
    const rowWidth = columns - 2 // 閒置列只有左右內距

    /** 標題列：圖示＋可點的標題（跳轉）＋目前這個＋時間；標題依剩下的寬度截斷 */
    const titleRow = (card: SessionCard, width: number) => {
      const look = LOOK[card.status]
      const isCurrent = card.sessionId !== null && card.sessionId === own?.sessionId
      const shows = (field: Field) => showsIn(groupOf(card.status), field)
      const age = shows('time') && card.since !== null ? shortAge(now - card.since) : null
      const left = card.status === 'waiting' ? displayWidth(' 等你 ') : 1
      const right = (isCurrent ? displayWidth('目前') + 1 : 0) + (age === null ? 0 : age.length)
      const title = clipToWidth(card.title, width - left - right - 2)

      return (
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Box flexDirection="row" gap={1}>
            {card.status === 'waiting' ? (
              <Text backgroundColor="warning" color="inverseText" weight="semibold">
                {' 等你 '}
              </Text>
            ) : (
              <Text color={look.color}>{look.glyph}</Text>
            )}
            <Button key={`jump-${card.pid}`} plain onPress={() => jump($, card)}>
              <Text weight={card.status === 'idle' ? 'regular' : 'semibold'}>{title}</Text>
            </Button>
          </Box>
          <Box flexDirection="row" gap={1}>
            {isCurrent && (
              <Text size="caption" color="suggestion">
                目前
              </Text>
            )}
            {age !== null && (
              <Text size="caption" dimColor>
                {age}
              </Text>
            )}
          </Box>
        </Box>
      )
    }

    /** 依欄位設定組出的明細行（每行一段淡色小字） */
    const detailLines = (card: SessionCard): string[] => {
      const shows = (field: Field) => showsIn(groupOf(card.status), field)
      const report = card.report
      const lines: string[] = []
      const where = [
        shows('location') ? locationOf(card.path) : null,
        shows('branch') && report?.branch != null ? branchLabel(report.branch, card.path) || null : null,
        shows('source') && card.source !== 'Desktop' ? card.source : null,
      ].filter(one => one !== null)
      if (where.length > 0) lines.push(where.join(' · '))
      const doing = [
        shows('progress') && report?.progress != null ? describeProgress(report.progress) : null,
        shows('activity') && card.status === 'busy' && report?.activity != null ? report.activity : null,
      ].filter(one => one !== null)
      if (doing.length > 0) lines.push(doing.join(' · '))
      const model = report?.model
      if (model != null && (shows('model') || (model !== mainModel && card.status !== 'idle'))) {
        lines.push(shortModel(model))
      }
      if (shows('path') && card.path !== '') lines.push(card.path)

      return lines
    }

    /** 未 commit 變更的行數：+新增（綠）−刪除（紅）；沒有變更時不顯示 */
    const changesLine = (card: SessionCard) => {
      const branch = card.report?.branch
      if (!showsIn(groupOf(card.status), 'changes') || branch == null) return null
      const added = branch.insertions ?? 0
      const removed = branch.deletions ?? 0
      if (added === 0 && removed === 0) return null

      return (
        <Box key="changes" flexDirection="row" gap={1}>
          <Text size="caption" color="diffAdded">
            +{added}
          </Text>
          <Text size="caption" color="diffRemoved">
            −{removed}
          </Text>
          <Text size="caption" dimColor>
            行
          </Text>
        </Box>
      )
    }

    const usageLine = (card: SessionCard) => {
      const report = card.report
      if (!showsIn(groupOf(card.status), 'usage') || report === null) return null
      const parts = [
        report.costUsd != null ? `$${report.costUsd.toFixed(2)}` : null,
        report.turns != null ? `${report.turns} 輪` : null,
      ].filter(one => one !== null)

      return (
        <Box key="usage" flexDirection="row" gap={1}>
          {report.contextPercent != null && (
            <Text size="caption" color={usageColor(report.contextPercent)}>
              ctx {usageBar(report.contextPercent)}
            </Text>
          )}
          {parts.length > 0 && (
            <Text size="caption" dimColor>
              {parts.join(' · ')}
            </Text>
          )}
        </Box>
      )
    }

    const body = (card: SessionCard, width: number) => (
      <>
        {detailLines(card).map((line, index) => (
          <Text key={`line-${index}`} size="caption" dimColor>
            {clipToWidth(line, width)}
          </Text>
        ))}
        {changesLine(card)}
        {usageLine(card)}
        {card.report === null && card.status !== 'idle' && (
          <Text key="no-report" size="caption" dimColor>
            基本狀態
          </Text>
        )}
      </>
    )

    const longestWait = Math.max(0, ...waiting.map(card => (card.since === null ? 0 : now - card.since)))
    const summary =
      waiting.length > 0
        ? `最長等待 ${shortAge(longestWait)} · 點選標題前往`
        : current.sessions.length === 0
          ? '沒有其他執行中的 Session'
          : [busy.length > 0 ? `執行中 ${busy.length}` : null, idle.length > 0 ? `閒置 ${idle.length}` : null]
              .filter(one => one !== null)
              .join(' · ')

    const section = (key: string, label: string, color: string, n: number, action?: JSX.Element) => (
      <Box key={key} flexDirection="row" justifyContent="space-between" alignItems="center">
        <Text size="footnote" weight="semibold" color={color}>
          {label} {n}
        </Text>
        {action}
      </Box>
    )

    return (
      <Box flexDirection="column" gap={1}>
        <Box key="toolbar" flexDirection="row" justifyContent="flex-end">
          <Button key="settings" plain dimColor onPress={() => update($, isSettingsOpen, value => !value)}>
            {isOpen ? '⚙ 檢視 ▴' : '⚙ 檢視 ▾'}
          </Button>
        </Box>
        <Box
          key="header"
          flexDirection="column"
          borderStyle={waiting.length > 0 ? 'bold' : 'round'}
          borderColor={waiting.length > 0 ? 'warning' : 'success'}
          borderDimColor={waiting.length === 0}
          paddingX={1}
        >
          <Box key="count">
            {current.needsYou === 0 ? (
              <Text color="success" weight="semibold">
                ✓ 無待處理項目
              </Text>
            ) : (
              <Text color="warning" size="heading" weight="bold">
                ▲ {current.needsYou} 個 Session 待處理
              </Text>
            )}
          </Box>
          <Box key="summary">
            <Text size="caption" dimColor>
              {summary}
            </Text>
          </Box>
        </Box>

        {isOpen && (
          <Box key="view-panel" flexDirection="column" borderStyle="round" borderDimColor paddingX={1} gap={1}>
            <Box flexDirection="row" gap={1} alignItems="center">
              <Text size="caption" dimColor>
                設定
              </Text>
              {GROUPS.map(one => (
                <Button
                  key={`group-${one.group}`}
                  variant={editing === one.group ? 'primary' : 'secondary'}
                  onPress={() => update($, settingsGroup, () => one.group)}
                >
                  {one.label}
                </Button>
              ))}
            </Box>
            <Box flexDirection="row" gap={1} alignItems="center">
              <Text size="caption" dimColor>
                密度
              </Text>
              {DENSITIES.map(one => (
                <Button
                  key={`density-${one.density}`}
                  variant={density === one.density ? 'primary' : 'secondary'}
                  onPress={() => setDensity($, editing, one.density)}
                >
                  {one.label}
                </Button>
              ))}
              {density === null && (
                <Text size="caption" color="suggestion">
                  自訂
                </Text>
              )}
            </Box>
            <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
              {FIELDS.map(({ field, label }) => (
                <Button key={`field-${field}`} plain onPress={() => toggleField($, editing, field)}>
                  {showsIn(editing, field) ? `☑ ${label}` : `☐ ${label}`}
                </Button>
              ))}
            </Box>
          </Box>
        )}

        {current.error !== null && (
          <Box key="error">
            <Text color="error">{current.error}</Text>
          </Box>
        )}

        {waiting.length > 0 && section('section-waiting', '需要你處理', 'warning', waiting.length)}
        {waiting.map(card => (
          <Box
            key={`card-${card.pid}`}
            flexDirection="column"
            borderStyle="bold"
            borderColor="warning"
            paddingX={1}
          >
            {titleRow(card, cardWidth)}
            {body(card, cardWidth)}
          </Box>
        ))}

        {busy.length > 0 && section('section-busy', '工作中', 'claude', busy.length)}
        {busy.map(card => (
          <Box
            key={`card-${card.pid}`}
            flexDirection="column"
            borderStyle="round"
            borderColor="claude"
            borderDimColor
            paddingX={1}
          >
            {titleRow(card, cardWidth)}
            {body(card, cardWidth)}
          </Box>
        ))}

        {idle.length > 0 &&
          section(
            'section-idle',
            '閒置',
            'inactive',
            idle.length,
            <Button key="toggle-idle" plain dimColor onPress={() => toggleIdle($)}>
              {settings.isIdleCollapsed ? '展開 ▾' : '收合 ▴'}
            </Button>,
          )}
        {!settings.isIdleCollapsed &&
          idle.map(card => (
            <Box key={`card-${card.pid}`} flexDirection="column" paddingX={1}>
              {titleRow(card, rowWidth)}
              {body(card, rowWidth)}
            </Box>
          ))}
      </Box>
    )
  })
}

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { SessionCard, Snapshot } from '../types'
import { countNeedsYou, parseAlive, parseRecord, sessionsDirOf, toCards } from './board'

// 指令來自 commands/on.md，以 plugin 名稱為命名空間
const COMMAND = 'switchboard:on'
const PANE = 'switchboard'
const TITLE = 'Sessions'
const POLL_MS = 3000

/** 每種狀態的標籤與卡片顏色（主題色，深淺色模式都會跟著換） */
const LOOK: Record<SessionCard['status'], { label: string; color: string }> = {
  waiting: { label: '需要你處理', color: 'warning' },
  busy: { label: '工作中', color: 'claude' },
  idle: { label: '閒置', color: 'subtle' },
  unknown: { label: '未知', color: 'inactive' },
}

const snapshot = atom({ plugin: 'switchboard', key: 'snapshot' } as const, null)

// 用到 $ 的函式都寫在這個檔案：Desktop 自帶的 Claude Code 不讓 $ 跨 import 傳遞

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

async function alivePids($: EngineInterface, pids: readonly number[]): Promise<Set<number>> {
  if (pids.length === 0) return new Set()
  // 一個都不存活時 ps 以 1 結束，輸出是空的
  const { stdout } = await $.process.run(['ps', '-o', 'pid=', '-p', pids.join(',')])

  return parseAlive(stdout)
}

/** 讀所有 session 紀錄、檢查 pid，算出這一次的結果。 */
async function scan($: EngineInterface): Promise<Snapshot> {
  const dir = sessionsDirOf(await $.env.get('CLAUDE_CONFIG_DIR'), await $.env.get('HOME'))
  let texts: { name: string; text: string }[]
  try {
    texts = await readTexts($, dir)
  } catch {
    return { needsYou: 0, error: `讀不到 ${dir}`, sessions: [] }
  }
  const records = texts.map(one => parseRecord(one.name, one.text)).filter(one => one !== null)
  const alive = await alivePids($, [...new Set(records.map(one => one.pid))])

  return { needsYou: countNeedsYou(records, alive), error: null, sessions: toCards(records, alive) }
}

// 只有打開監看視窗的 Session 才 polling；模組重新載入時計時器會被清掉
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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // 熱重載後 Pane 還開著，就接著 polling
    const panes = await $.ui.panes()
    if (panes.some(pane => pane.id === PANE)) startPolling($)

    return next(e)
  })

  // 自己回答，不呼叫 next：commands/on.md 的內容不會送給模型
  on('command.run', { command: COMMAND }, async $ => {
    const surfaces = await $.session.surfaces()
    if (!surfaces.includes('desktop')) {
      return { text: `監看視窗只在 Claude Desktop 打開：請到 Desktop 的 Code 分頁輸入 /${COMMAND}。` }
    }
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
    const { Box, Text } = $.ui.resolve(e)
    let current: Snapshot | null
    try {
      current = await read($, snapshot)
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

    return (
      <Box flexDirection="column" gap={1}>
        <Box key="count">
          {current.needsYou === 0 ? (
            <Text color="success" size="heading" weight="semibold">
              沒有在等你
            </Text>
          ) : (
            <Text color="warning" size="heading" weight="semibold">
              等你：{current.needsYou} 個 Session
            </Text>
          )}
        </Box>
        {current.error !== null && (
          <Box key="error">
            <Text color="error">{current.error}</Text>
          </Box>
        )}
        {current.sessions.map(card => {
          const look = LOOK[card.status]

          return (
            <Box
              key={`card-${card.pid}`}
              flexDirection="column"
              borderStyle="round"
              borderColor={look.color}
              paddingX={1}
            >
              <Box flexDirection="row" gap={1}>
                <Text color={look.color} weight="semibold">
                  {look.label}
                </Text>
                <Text weight="medium" wrap="truncate-end">
                  {card.title}
                </Text>
              </Box>
              {card.title !== card.folder && (
                <Text dimColor size="caption" wrap="truncate-middle">
                  {card.folder}
                </Text>
              )}
            </Box>
          )
        })}
      </Box>
    )
  })
}

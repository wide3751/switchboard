import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { scan } from './board'

const PANE = 'agens-view'
const TITLE = 'Sessions'
const POLL_MS = 3000

const snapshot = atom({ plugin: 'agens-view', key: 'snapshot' } as const, null)

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
    await $.command.register({
      name: 'sessions',
      description: '打開監看視窗：所有本機 Session 的狀態與等你計數（Desktop 限定）',
    })
    // 熱重載後 Pane 還開著，就接著 polling
    const panes = await $.ui.panes()
    if (panes.some(pane => pane.id === PANE)) startPolling($)

    return next(e)
  })

  on('command.run', { command: 'sessions' }, async $ => {
    const surfaces = await $.session.surfaces()
    if (!surfaces.includes('desktop')) {
      return { text: '監看視窗只在 Claude Desktop 打開：請到 Desktop 的 Code 分頁輸入 /sessions。' }
    }
    await $.ui.open({ id: PANE, title: TITLE })
    startPolling($)

    return { text: '已打開監看視窗。' }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) stopPolling()

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const current = await read($, snapshot)

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
      <Box flexDirection="column">
        <Box key="count">
          {current.needsYou === 0 ? (
            <Text color="green">沒有在等你</Text>
          ) : (
            <Text bold color="yellow">
              等你：{current.needsYou} 個 Session
            </Text>
          )}
        </Box>
        {current.error !== null && (
          <Box key="error">
            <Text color="red">{current.error}</Text>
          </Box>
        )}
      </Box>
    )
  })
}

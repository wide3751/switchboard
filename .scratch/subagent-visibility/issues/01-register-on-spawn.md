# 01 — 子代理一啟動就登記，並記下前景／背景

**What to build:** 修掉「前景子代理在主代理等它的期間，狀態回報的 `tasks` 是空的」。在 `agent.spawn` 登記子代理並記下 `background`，`Task` 加可省略的 `mode`（`foreground` / `background`）；子代理自己的 `turn.complete` 也刷新清單。舊回報沒有 `mode` 時照舊當背景顯示。規格見 `.scratch/subagent-visibility/spec.md`。

先實測再寫：用 `verify-switchboard` 在真的 `claude` 裡派前景子代理（啟動時帶 `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`），確認 `agent.spawn` 的 `next(e)` 對前景子代理是啟動時還是跑完才回來；若是跑完才回來，進入 hook 時就登記，不等 `next(e)`。

**Blocked by:** 無

**Status:** resolved

- [x] 實測並把 `agent.spawn` 的 `next(e)` 時機寫在 ticket 底下的 `## Comments`
- [x] 前景子代理派出的當下（它還沒呼叫任何工具）狀態回報的 `tasks` 就有它，`mode` 是 `foreground`
- [x] 背景子代理的 `mode` 是 `background`
- [x] 子代理自己的 `turn.complete` 刷新清單；完成後從 `tasks` 變成 `done`
- [x] 舊回報（沒有 `mode`）照舊顯示，不報錯
- [x] `taskStatusOf` 把 `idle` 對應成 `waiting`，不算 `done`
- [x] 整合測試涵蓋以上；`claude plugin test agens-view` 通過
- [x] 真實引擎證據（前景、背景各一）留在 `.verify/runs/<run>/evidence/`

## Comments

### 實測：`agent.spawn` 的 `next(e)` 時機

真的 `claude`（2.1.x，`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`，run `r1117-162536-3df0`）在 `agent.spawn` hook 裡前後各記一筆：前景子代理（`background=false`）進 hook 時 `agent.list()` 是 0 個，**`next(e)` 約 23ms 就回來**，回傳 `agentId`，此時 `agent.list()` 已有它、狀態 `running`。也就是 `agent.spawn` 的 `next(e)` 是「啟動時」回來，不是跑完才回來；跑完才回來的是 Agent 這個 **tool** 的 `tool.call` `next(e)`，所以舊程式要等到子代理自己的 Bash 才刷新。

因此做法是在 `agent.spawn` 的 `next(e)` 之後（拿到 `agentId`）就記下 mode 並刷新 `tasks`；不需要在進入 hook 時登記（那時子代理還不在清單裡）。

證據：`.verify/runs/r1117-162536-3df0/evidence/probe1-next-timing.txt`

### 實作後驗證（真實引擎）

- 前景（run `r1117-162926-47da`）：派出後 `tasks` 立刻有 `running`、`mode: foreground`，整段等待期間都在，見 `evidence/fg-tasks-timeline.txt`、`fg-screen.txt`。
- 背景（run `r1117-163009-f433`）：`mode: background`，一直到取樣結束都是 `running`，見 `evidence/bg-tasks-timeline.txt`、`bg-screen.txt`。
- 整合測試：`agens-view/tests/subagent-register-on-spawn.test.ts`。

### review 後修正：前景子代理轉到背景後仍被當前景

- **問題**：`mode` 只在 `agent.spawn` 記一次；前景子代理執行中被轉到背景（例如 Ctrl+B）時 mod 收不到事件，activity 一直是 `waiting-subagents:n`、子卡片一直 `⧗`。
- **做法**：`register.tsx` 記 `pendingAgentCalls`（主代理還沒回來的 Agent／Task 呼叫數）。`tool.call` 且 `e.agentId === undefined`、工具是 Agent 或 Task 時進入加一，`next(e)` 的 `finally` 減一（被拒絕、出錯、丟例外都會減）；降回 0 時 `demoteForeground()` 把 `agentModes` 裡的 `foreground` 改成 `background`，接著照原本的 Agent／Task 後刷新重算 tasks 與 activity。主代理的 `turn.complete`（在最後補上 tasks 之前）與 `turn.start`（有改到就重寫 tasks）也降級。依據：前景子代理會讓那次 Agent 呼叫一直不回來，呼叫回來或回合結束、開始，主代理就不可能還在等它。
- **不降級的情況**：主代理呼叫 Read 等其他工具時不降級（同一則訊息裡並行的 Read 和前景 Agent 呼叫可能同時進行）；子代理自己迴圈裡的 Agent 呼叫（`e.agentId` 有值）不算進數字；數字沒歸 0（另一個並行的前景 Agent 呼叫還沒回來）也不降級。
- **和建議做法的差異**：降級對象是 `agentModes` 裡所有 `foreground`、但跳過 `failedAgents` 裡的（失敗列保留原本的 mode），不另外判斷「仍在執行中」；完成的子代理改成 background 不影響顯示（完成的不列、也不算等待）。`next(e)` 丟例外時只改 mode、不立刻寫回報，下一次刷新才反映（丟例外時 `.catch` 會接手）。
- **限制**：主代理的 Agent 呼叫若被引擎以 `tool.call` 以外的方式派出（沒有包住 `agent.spawn` 的 Agent／Task 呼叫），只能等回合結束或開始才降級。真實引擎造不出「前景轉背景」：前景子代理只在 `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` 時出現，那時也不能轉到背景；這條路徑由整合測試固定（`tests/subagent-activity-main-only.test.ts` 的「前景轉背景：…」、「兩個並行的前景 Agent 呼叫…」、「和 Agent 呼叫並行的 Read…」）。
- **舊測試的調整**：「n 是執行中的前景數…」最後一步原本用一次會立刻回來的 Agent 呼叫刷新，改成 a2 自己的 `turn.complete`；「並行時序…」原本讓 Agent 呼叫在 spawn 之後進來又立刻回來，改成 Agent 呼叫先進來、引擎在呼叫裡派出子代理、期間不回來（符合真實引擎：spawn 發生在 Agent 呼叫裡）。兩者的期望值不變。
- **真實引擎未退化**（`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`，run `r1119-135606-df05`，子代理只用 Read）：等待期間 `activity` 是 `waiting-subagents:1`、`tasks` 為 running／foreground；Agent 呼叫回來後、回合結束前 `activity` 是主代理的 `Agent Read six big text files`、`tasks` 為空；回合結束後 `activity` 為 null。證據：`.verify/runs/r1119-135606-df05/evidence/fg-timeline.txt`、`fg-waiting-screen.txt`、`fg-report-waiting.json`、`after-screen.txt`、`fg-report-after.json`。

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

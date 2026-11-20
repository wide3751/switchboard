# 03 — 最近活動只反映主代理，等前景子代理時顯示「等待子代理 n 個」

**What to build:** 子代理自己的 `tool.call`（`e.agentId` 有值）不再改寫整個 **Session** 的 `activity`。有 **前景 Subagent** 執行中時，`activity` 存成語言中立的標記，由監看視窗依語言顯示「等待子代理 n 個」；沒有前景時沿用主代理最近一次呼叫的摘要。規格見 `.scratch/subagent-visibility/spec.md`。

**Blocked by:** 01

**Status:** resolved

- [x] 子代理的工具呼叫不改變狀態回報的 `activity`
- [x] 有前景子代理執行中：卡片的最近活動顯示「等待子代理 n 個」，n 是執行中的前景數
- [x] 前景子代理都結束後，回到主代理最近一次呼叫的摘要（或回合結束時清掉）
- [x] 只有背景子代理時，最近活動維持主代理自己的動作
- [x] 五種語言的 i18n 文字
- [x] 整合測試涵蓋以上；`claude plugin test agens-view` 通過
- [x] 真實引擎證據：前景子代理執行期間，`activity` 不出現子代理的指令

## Comments

### 決策與實作（ticket 03）

- **標記格式**：`activity` 仍是 `string | null`，等前景子代理時存 `waiting-subagents:<n>`（沿用 `API_ERROR` 存標記的做法）。監看視窗的 `activityText` 認得這個格式就依語言顯示，其他字串（含舊回報）照原樣顯示；型別沒放寬，只在 `Report.activity` 加註解。和 spec 範例 `{ waitingOnSubagents: n }` 不同：物件會讓 `parseReport` 的 `str()` 丟掉，且舊版監看視窗會當成 null。
- **n 的算法**：`tasks` 裡 `kind === 'agent'`、`mode === 'foreground'`、status 為 `running` 或 `waiting` 的數量（等待中的前景也算，它主代理仍在等）。背景、完成、失敗不算。
- **activity 的來源**：`register.tsx` 記 `mainActivity`（主代理最近一次呼叫的摘要）與 `mainTurnOver`。`activityOf(tasks)`：回合已結束回 null；有前景就回標記；否則回 `mainActivity`。`refreshTasks` 把 tasks 與 activity 一起重算。
- **刷新點**：`agent.spawn` 之後、子代理的 `turn.complete`、`tool.call` 之後（Agent／Bash／有核准時）、背景任務完成通知（`session.append`）。主代理的 `turn.start`／`turn.complete` 清掉 `mainActivity`；回合結束後的刷新不會把 activity 寫回來。
- **子代理的 `tool.call`（`e.agentId` 有值）**：只不寫 `activity`，其他照舊：TodoWrite／計畫的 `progress`、AskUserQuestion 的 `question`、背景 Bash 登記、核准／回答後清 `approval`／`question`、`tasks` 刷新。`progress` 被子代理的 TodoWrite 蓋掉的問題不在本 ticket 範圍，沒動。
- **i18n**：`Messages.waitingOnSubagents(n)`，五種語言（en 有單複數）。
- **測試**：`tests/subagent-activity-main-only.test.ts`（回報的 activity、卡片 `context` 列文字、五種語言、舊純文字回報）。`claude plugin test agens-view`：391 pass、11 fail（同 main，全是 `ui.focus`）；`claude plugin validate agens-view` 通過。
- **真實引擎**（`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`，run `r1117-164450-16d7`，子代理只用 Read 讀六個大檔）：整段等待期間（約 56 秒）回報 `activity` 都是 `waiting-subagents:1`、`tasks` 為 running／foreground；卡片顯示 `↳ ⧗ …` 與「等待子代理 1 個」，而同時主畫面捲動的是子代理的 Read。子代理結束、回合結束後 `activity` 為 null、`tasks` 為空。證據：`.verify/runs/r1117-164450-16d7/evidence/waiting-screen.txt`、`fg-report-waiting.json`、`after-screen.txt`、`fg-report-after.json`。「前景結束但回合未結束時回到主代理摘要」沒有在真實引擎抓到（取樣間隔內回合就結束了），由整合測試涵蓋。

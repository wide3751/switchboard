# 02 — 子卡片的狀態、標示、排序與上限

**What to build:** 工作中卡片底下的 `↳` 子卡片，依 spec 顯示前景、背景、等待中、失敗的子代理：標示不同、排序為「前景執行中 → 失敗 → 等待中 → 背景執行中」、最多 3 行其餘 `+n 個`，展開明細時全列。正常完成的立刻消失；失敗的留到下個回合開始才清掉。符號登記進 `GLYPHS`，五種語言的文字與螢幕閱讀器用字都補上。規格見 `.scratch/subagent-visibility/spec.md`。

**Blocked by:** 01

**Status:** resolved

- [x] 前景 `↳ ⏳ 描述`、失敗 `↳ ! 描述`、等待 `↳ ⏸︎ 描述`、背景 `↳ 描述`
- [x] 排序符合 spec，同組維持原順序
- [x] 超過 3 行收成 `+n 個`；展開明細時完整列出（不再限 5 個）
- [x] 正常完成的子代理不顯示；失敗的留到下個回合開始才清掉
- [x] 標題列的 `⏸︎n`、`!n` 計數維持，不和子卡片重複顯示 `↻`
- [x] 回合已結束、背景子代理還在跑的 Session 仍算工作中（不退化）
- [x] 五種語言的 i18n 文字；前景、失敗標示在螢幕閱讀器 label 裡有文字
- [x] 整合測試涵蓋以上；`claude plugin test agens-view` 通過


## Comments

### 決策與實作（ticket 02）

- **前景符號用 `⧗`（U+29D7），不是 `⏳`**：`⏳`（U+23F3）是 East Asian Width = W，終端機畫成 2 格，違反 `GLYPHS` 的規則（`ui-03-glyphs` 測試：沒有 W、每個字一格）。`⧗` 是 N、一格，已登記為 `taskForeground`。要改回 `⏳` 得先放寬 GLYPHS 規則。
- **標題列計數**：子卡片已逐列列出的任務（含收成 `+n 個` 的）不在標題列重複。工作中卡片有子卡片時，標題列的 `↻`、`⏸︎`、`!` 全部不顯示；待處理卡片不畫子卡片、展開時改由明細列出，所以計數照舊。依據：同一件事不在兩處出現；等待、失敗現在也逐列列出，保留 `⏸︎n`、`!n` 會重複。舊測試（`background-task-subcards`、`needs-you-count`、`ui-05-cards`、`ux-12-i18n-metadata`）的期望已隨之更新；`ui-05-cards` 的標題列截斷測試改用待處理卡片來看徽章。
- **失敗留到下個回合**：`register.tsx` 內記 `failedAgents`（id → 最後看到的 Task）。`readTasks` 看到 failed 就記下，引擎之後把它從清單拿掉也會補回；主代理的 `turn.start`（`agentId` 為空）把它們移到 `dismissedAgents` 並重寫 `tasks`，之後引擎就算還留著也不顯示。`Task` 型別沒動。子代理自己的 `turn.start` 不清。
- **排序**：`board.ts` 的 `orderTasks`（前景執行中、失敗、等待中、背景執行中、完成；同組穩定）；`subtaskList` 濾掉完成的。展開明細也用同一個排序，並放寬 5 個上限，全列。
- **螢幕閱讀器**：這版 SDK 的 `Text` 沒有 label 屬性，收合時的子卡片列只能是 `↳ ⧗ 描述` 純符號。文字說明放在展開明細：子代理後面加 `· 前景／失敗／等待中`（五種語言，`i18n.ts` 的 `taskStates`）。若要收合列也有文字，需要引擎提供 Text 的 label，或接受在列上多一個字。
- **等待／失敗在子卡片的顏色**：失敗列用 error 色。

### 驗證

- `claude plugin test agens-view`：377 pass、11 fail（和 main 一樣，全是 `ui.focus`）；`claude plugin validate agens-view` 通過。新測試 `tests/subagent-subcards.test.ts`。
- 真實引擎（`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`，run `r1117-163639-48b4`）：前景子代理等待期間卡片出現 `↳ ⧗ 掃描專案檔案`，結束後消失。證據 `.verify/runs/r1117-163639-48b4/evidence/fg-subcard-waiting2.txt`、`fg-report-running.json`、`fg-subcard-after.txt`。`fg-subcard-waiting.txt` 是子代理用了 Bash 停在核准的那次（卡片是待處理，不畫子卡片，屬預期）。

### review 後補充（失敗從未被讀到、清理）

- **失敗從未被 `readTasks` 讀到**：引擎在子代理自己的 `turn.complete` 與下次刷新之間就把它拿掉時，舊程式不會顯示失敗。型別檔 `TurnCompleteReason = 'answer' | 'aborted' | 'refusal' | 'error'`，註解明說 `error` 是「API 錯誤（重試用完、context 上限）結束回合」，所以子代理自己的 `turn.complete` 帶 `reason === 'error'` 時，hook 內直接把它記成失敗（用清單裡最近看到的樣子 `seenAgents`），留到主代理下個回合開始。引擎回報 `completed` 但回合是 error 也算失敗。限制：只在這個 mod 刷新清單時看過這個子代理（`seenAgents` 有它）才記得到；`aborted`／`refusal` 不算失敗（沿用 `taskStatusOf`：只有引擎的 `failed`／`killed` 算）。沒做真實引擎驗證：這是純 hook 內記錄，行為由 `tests/subagent-subcards.test.ts` 固定。
- **清理**：`agentModes`、`dismissedAgents`、`seenAgents` 在子代理「看過、現在不在 `agent.list()`」時刪除（`agent.list()` 拿不到時不清）；`session.end` 全部清掉。`failedAgents` 仍由主代理 `turn.start` 清。id 被引擎重用時當新的子代理。
- **`agent.spawn` 的 `background`**：型別檔 `AgentSpawnInput.background` 是必有的 `boolean`，所以 `undefined` 只是防禦；現況（非 `true` 一律當前景）用測試固定，沒改程式。
- **並行時序**：spawn 之前主代理剛 Read、spawn 後 `activity` 是 `waiting-subagents:1`，與其後的 `tool.call` 交錯也不閃回摘要（測試通過，沒有改 `tool.call`）。
- `board.ts` 新增 `taskLook`／`taskGlyph`／`TASK_STATE_WORDS`／`isWaitedOn`，子卡片、展開明細、`activityOf` 共用；行為不變。

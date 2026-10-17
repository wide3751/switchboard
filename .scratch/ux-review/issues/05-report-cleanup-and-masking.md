# 05 — 狀態回報：每個 Session 都會清理殘留，寫入前遮罩機密

**What to build:**

- **清理：** `removeStaleReports` 只在 `scan()` 裡呼叫（`register.tsx:357`），而 scan 只在監看視窗畫出來時執行。從沒開過監看視窗的使用者，`~/.claude/switchboard/reports/` 會一直累積。改成每個 Session 在 `session.start` 時也清一次（重用 `staleReports`）。
- **遮罩：** 依 `GLOSSARY.md` 的 **狀態回報** 定義，寫入前把指令、核准請求摘要、提問裡疑似機密的片段換成 `•••`：`Bearer …`、`token=…`／`--token …`、`*KEY=…`、`*SECRET=…`、`*PASSWORD=…`、`sk-…`、`ghp_…` 等。做成純函式加測試。
- **README：** 五種語言的隱私段寫明：回報以明碼存在哪裡、什麼時候清掉、遮罩只是盡力而為。

**Status:** resolved

- [x] 沒開過監看視窗也會清掉已結束 Session 的回報
- [x] 遮罩函式有涵蓋上列格式的測試，不會遮掉一般指令
- [x] 核准請求摘要也經過遮罩
- [ ] 五種語言的隱私段更新

## Comments

- 遮罩函式是 `board.ts` 的 `maskSecrets(text)`（純函式，可重用）。`summarizeTool`（目前動作、核准請求摘要、背景 Bash 的標籤）與 `questionOf`／`wrapUpQuestionOf`（提問與選項）都在截斷之前先遮罩，免得截斷後的金鑰短到認不出來。最後回覆摘要沒有遮罩（不在這張 ticket 的範圍）。
- 清理：`session.start` 寫完自己的回報後呼叫 `cleanUpReports`，重用 `staleReports`／`removeStaleReports`。讀不到 session 紀錄時不清，免得把所有回報當成殘留刪掉。
- 因為啟動時多讀一次 session 紀錄，假世界的 `scans` 會多 1；`needs-you-count.test.ts` 裡「不掃描」的斷言改成和 `world.ts` 新增的 `STARTUP_SCANS` 比較。`world.ts` 另外加了選用的 `unreadable`（列不出內容的資料夾）。
- 五種語言的隱私段：依約定不直接改 README，改動寫在 ux-notes 的 `readme-05.md`，由 ticket 09 一起改，所以最後一項先不勾。

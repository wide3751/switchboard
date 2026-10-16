# 05 — 狀態回報：每個 Session 都會清理殘留，寫入前遮罩機密

**What to build:**

- **清理：** `removeStaleReports` 只在 `scan()` 裡呼叫（`register.tsx:357`），而 scan 只在監看視窗畫出來時執行。從沒開過監看視窗的使用者，`~/.claude/switchboard/reports/` 會一直累積。改成每個 Session 在 `session.start` 時也清一次（重用 `staleReports`）。
- **遮罩：** 依 `CONTEXT.md` 的 **狀態回報** 定義，寫入前把指令、核准請求摘要、提問裡疑似機密的片段換成 `•••`：`Bearer …`、`token=…`／`--token …`、`*KEY=…`、`*SECRET=…`、`*PASSWORD=…`、`sk-…`、`ghp_…` 等。做成純函式加測試。
- **README：** 五種語言的隱私段寫明：回報以明碼存在哪裡、什麼時候清掉、遮罩只是盡力而為。

**Status:** ready-for-agent

- [ ] 沒開過監看視窗也會清掉已結束 Session 的回報
- [ ] 遮罩函式有涵蓋上列格式的測試，不會遮掉一般指令
- [ ] 核准請求摘要也經過遮罩
- [ ] 五種語言的隱私段更新

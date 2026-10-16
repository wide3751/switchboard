# 13 — 待實測：選項卡期間的狀態、pid 重複使用

**What to build:** 先實測，再決定要不要改：

- **選項卡期間的狀態：** `statusOf`（`board.ts:357-363`）在 session 紀錄是 busy 或 waiting 時一律以紀錄為準，回報裡的 question 不會讓狀態變成需要你處理。如果 AskUserQuestion、elicitation 期間紀錄仍是 busy，使用者會看到「工作中」而不是「▲ 回答」，也不算進計數。實測紀錄的值；不是 waiting 就照 `GLOSSARY.md` 實作「較新的為準」。
- **平行 Subagent：** 任一個 Subagent 的工具跑完都會清掉 approval（`register.tsx:650-652`），另一個還在等核准的摘要會消失。考慮只在對應的 tool_use_id 完成時才清。
- **pid 重複使用：** session 紀錄有 `procStart`，但 `parseRecord`（`board.ts:67-85`）沒讀，判斷存活只看 `ps -p`。Claude Code 當掉留下紀錄、pid 又被別的程序拿到時，會出現幽靈列。考慮 `ps` 多取 `lstart=` 比對。先確認 Claude Code 啟動時會不會自己清掉死掉的紀錄。

**Status:** needs-triage

- [ ] 實測結果記在 Comments，再拆成可做的 ticket 或關掉

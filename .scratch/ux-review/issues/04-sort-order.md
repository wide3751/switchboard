# 04 — 新的排序規則

**What to build:** 依 `GLOSSARY.md` 更新後的清單排序：**需要你處理** 依進入該狀態的時間由舊到新；**工作中** 依 Session 開始的時間；**閒置** 維持依最後活動時間由新到舊。目前 `board.ts:398` 一律 `b.at - a.at`。工作中若 session 紀錄沒有開始時間，就用 `procStart` 或 pid 當作穩定的次序。頁首的「最長 n」對應的卡片應該在需要你處理區的最上面。

**Status:** resolved

- [x] 需要你處理由舊到新，新進來的加在底部
- [x] 工作中不因狀態來回（核准）而改變位置
- [x] 閒置維持由新到舊
- [x] 測試涵蓋三個分組各自的順序
- [ ] README 的排序說明更新（五種語言）

## Comments

- 實作在 `agens-view/hooks/board.ts` 的 `toCards`／`withinGroup`；`parseRecord` 多讀 session 紀錄的 `startedAt`。測試在 `agens-view/tests/ux-04-sort-order.test.ts`。
- 工作中：有 `startedAt` 的依它由早到晚；紀錄沒有 `startedAt` 的排在後面，依 pid 維持固定次序（沒有用 `procStart`：它在不同平台的格式未確認，留給 ticket 13 一起看）。
- 需要你處理的紀錄沒有狀態變化時間（`statusUpdatedAt` 為 0）時排在該區底部，和頁首「最長」把它算成 0 一致。
- 「README 的排序說明更新（五種語言）」沒勾：依約定不在這張 ticket 改 README，五種語言的替換文字寫在 scratchpad 的 `ux-notes/readme-04.md`（各 README 第 97 行「分區」那一條），由 ticket 09 一起改。

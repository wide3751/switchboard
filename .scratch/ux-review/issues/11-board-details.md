# 11 — 監看視窗的細節：設定同步、帳號卡片位置、終端機寬度

**What to build:**

- **設定同步：** `loadView` 只在 session.start、command.run 呼叫（`register.tsx:602/607/712`），在 Session A 改語言、密度，B 的監看視窗不會變。poll 時順便讀一次 store，有變化才更新。
- **帳號卡片：** 目前順序是工具列 → 頁首 → 帳號用量 → 需要你處理卡片（`register.tsx:1323-1360`），終端機裡真正要處理的卡片被擠下去。帳號卡片移到清單最後或縮成頁首一行，用量 ≥95% 才提到上方。
- **終端機寬度：** 終端機版面用比例字型的 `estimateWidth`／`fitToWidth`（`register.tsx:846-870`），等寬的 `displayWidth`／`clipToWidth`（`board.ts:549-570`）寫好卻沒用。terminal 介面改用後者；左側寬度把 ▲／✕ 算進去（`register.tsx:861` 少算一格）。測試加一條：每一列寬度不超過可用欄數。

**Status:** ready-for-agent

- [ ] 在一個 Session 改設定，其他開著的監看視窗在下次 poll 跟著變
- [ ] 需要你處理卡片在帳號卡片之前
- [ ] 中日韓長標題在終端機不會擠掉時間

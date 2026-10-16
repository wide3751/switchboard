# 11 — 監看視窗的細節：設定同步、帳號卡片位置、終端機寬度

**What to build:**

- **設定同步：** `loadView` 只在 session.start、command.run 呼叫（`register.tsx:602/607/712`），在 Session A 改語言、密度，B 的監看視窗不會變。poll 時順便讀一次 store，有變化才更新。
- **帳號卡片：** 目前順序是工具列 → 頁首 → 帳號用量 → 需要你處理卡片（`register.tsx:1323-1360`），終端機裡真正要處理的卡片被擠下去。帳號卡片移到清單最後或縮成頁首一行，用量 ≥95% 才提到上方。
- **終端機寬度：** 終端機版面用比例字型的 `estimateWidth`／`fitToWidth`（`register.tsx:846-870`），等寬的 `displayWidth`／`clipToWidth`（`board.ts:549-570`）寫好卻沒用。terminal 介面改用後者；左側寬度把 ▲／✕ 算進去（`register.tsx:861` 少算一格）。測試加一條：每一列寬度不超過可用欄數。

**Status:** resolved

- [x] 在一個 Session 改設定，其他開著的監看視窗在下次 poll 跟著變
- [x] 需要你處理卡片在帳號卡片之前
- [x] 中日韓長標題在終端機不會擠掉時間

## Comments

- 設定同步：poll 時讀一次 store，和上次讀到或寫入的內容不同才重新載入（語言、欄位、計費等全部跟著變）。本 Session 寫入完成後才記下新內容，寫入途中的 poll 不會把設定蓋回舊值。
- 帳號卡片：移到清單最後（閒置區之後）；5h／週任一用量 ≥95% 時放在頁首下方。README 的對應說明寫在 scratchpad 的 `ux-notes/readme-11.md`，交給 ticket 09。
- 終端機寬度：terminal 介面的標題列改用 `displayWidth`／`clipToWidth`，左側寬度含 ▲／✕；Desktop 仍用比例字型估算（左側同樣補上 ▲／✕）。測試量的是每張卡片的標題列（唯一由 mod 自己算寬度的列；其他列交給引擎的 wrap／truncate），40 與 60 欄都不超出。
- 未實測：▲、◉ 等 East Asian Ambiguous 寬度的字元，在部分終端機的 CJK 設定下會佔 2 格；`displayWidth` 算 1 格。標題列另留 3 格餘裕，應該吸收得了，但沒在真機上確認。

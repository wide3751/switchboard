# 05 — 卡片

**What to build:**
- 待處理卡片只有一個主要動作「前往處理 →」，放在中繼資料帶同一列右端（`row` + `space-between` + `flexWrap`），寬度不夠才換列；全部 secondary。標題仍可點，但不再教。
- 換列時按鈕和上一行留 `xs` 間距；卡片內距加大一級（依原型）。
- 時間獨立成 `Text caption dimColor tabular`，不可點；展開鈕只畫 ▸／▾。
- 來源符號移到標題列右側群組、時間前面（dim），所有密度都顯示；空間不夠時依序拿掉徽章、來源符號，最後把「目前」換成 ✦。
- 中繼資料帶：分段 `columnGap="md"`，不另插 ·；位置和分支用 `color="subtle"`；Context 低於 80% 維持 dim；數字為 0 的那一邊不畫；展開明細不再重複 Context 和分支。
- PR：開啟 `#12 ↗`；已合併 `#12 ↗ 已合併`（merged）；已關閉 `#12` 加刪除線（inactive）。
- 沒有 PR：「前往建立 PR →」改成不可點的 dim「無 PR」，只在有工作時顯示。
- 工作中的 ◉ 維持 claude 色。
- 閒置列：`paddingX={isTerminal ? 2 : 1}`，終端機寬度用 cardWidth。
- 帳號用量卡片平常 `borderDimColor`，達到門檻提到頂端時加強外框；5h／週標籤用 `displayWidth` 補到同寬，整行 `mono tabular`。

**Blocked by:** 03, 04

**Status:** ready-for-agent

- [ ] 待處理卡片少一列，`ux-11-board-details`、`ux-06-jump` 等測試依新結構更新
- [ ] PR 三種狀態不靠顏色也分得出來

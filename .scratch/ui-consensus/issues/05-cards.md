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

**Status:** resolved

- [x] 待處理卡片少一列，`ux-11-board-details`、`ux-06-jump` 等測試依新結構更新
- [x] PR 三種狀態不靠顏色也分得出來

## Comments

- **前往處理**：`go-button-${pid}`（key 不變，secondary）搬進中繼資料帶那一列：外層 `strip-${pid}`（row、space-between、flexWrap、columnGap md、rowGap xs），左邊是分段 `meta`（row wrap、columnGap md、flexShrink 1），右邊是按鈕。分段排不滿一行時按鈕在同一列右端，否則整個換到下一行、和上一行留 xs。沒有分段的卡片（只有按鈕）也有這一列。原本獨佔一列的 `go-${pid}` 拿掉。10 要加 hotkey 和數字時只改這顆按鈕。
- **沒有回報的卡片**：「未載入 switchboard，僅基本狀態」從帶的下面移到情境行的位置（帶的上面），讓按鈕所在的那一列維持在卡片底部（展開時明細接在帶的後面，和原型一樣）。
- **標題列**：右側依序是來源符號（dim）、目前、徽章、時間（`age-${pid}`，`Text caption dimColor tabular`，不可點）、展開鈕（只畫 ▸／▾）。縮減順序是徽章 → 來源 → 「目前」換成 ✦，終端機的寬度預算照 03 的「格數加 Ambiguous 字數」把來源和時間也算進去。展開鈕的 label 留給 08。
- **卡片內距**：待處理、工作中、展開的閒置卡片和帳號卡片改成 `paddingX={isTerminal ? 'sm' : 'md'}` 加 `paddingY="xs"`。終端機不用 md，因為 md 是 2 格，卡片內文會和閒置列、頁首對不齊；xs 在終端機是 0 行，所以終端機的畫面和寬度（`cardWidth = columns - 4`）都不變，只有 Desktop 加大（原型 5px 10px → 8px 12px）。頁首的警示卡（04 的範圍）沒動。
- **閒置列**：ticket 寫 `paddingX={isTerminal ? 2 : 1}`，實作成 `paddingX="md"`：終端機是 2 格（與 ticket 相同），Desktop 和卡片的 md 內距同一級，卡片改成 md 之後仍然對齊（ticket 的 1 是卡片還是 paddingX 1 時的值）。終端機寬度改用 cardWidth，`rowWidth` 拿掉。
- **中繼資料帶**：位置·分支 `color="subtle"`；變更行數 0 的那一邊不畫；展開時帶上不畫 ctx 和分支，展開明細的分支改成一律顯示（`detail-branch`：分支標籤含 ↑↓±，有 base 時加「相對 origin/main」），原本只在有 base 時才顯示。變更、ctx 加 `tabular`。
- **PR**：開啟 `#12 ↗`（success）、已合併 `#12 ↗ 已合併`（merged）、已關閉 `#12`（inactive、strikethrough，不畫 ↗）；三種都仍可點開頁面。PR 的 label 留給 08。
- **無 PR**：不可點的 caption dim「無 PR」，條件是有工作而且不是閒置，不再需要 canJump。新增 `merged`、`noPr`（五種語言：merged/No PR、マージ済み/PR なし、병합됨/PR 없음、已合并/无 PR、已合併/無 PR），刪掉 `goCreatePr`。ux-06 的「前往建立 PR」測試改寫成「無 PR」，跳轉改從標題（`jump-311`）。
- **帳號卡片**：平常 `borderDimColor`，用量 ≥95% 提到頂端時拿掉淡色（不用粗框，粗框只給待處理卡片）。標籤用 `displayWidth` 補到同寬，用量那一段 `mono tabular`，重置倒數 `tabular`。
- **◉** 維持 claude 色（測試鎖住）。
- 測試：新增 `tests/ui-05-cards.test.ts`（15 個）。改了 ux-06（無 PR）、ux-07（來源在標題後面：`proj-742❯1m▸`）、ux-11（`5m▸`）。
- 沒做：README（README.md、README.zh-TW.md）還寫著「前往建立 PR」，歸 11；`assets/board/render.mjs` 的示意圖也歸 11。Desktop 上 md／xs 實際是幾 px、`meta` 的 flexShrink 讓按鈕換行的效果，要在 12 真機確認。

**Desktop 實機回饋（2026-10-17）**：時間改回和 ▸／▾ 黏成一顆展開鈕（`7s ▸`，`Text caption dimColor tabular`），拿掉獨立的 `age-${pid}`。使用者看過覺得上一版的寫法比較好。ui-05、ux-07、ux-11 的斷言跟著改成 `5m ▸`、`1m ▸`。

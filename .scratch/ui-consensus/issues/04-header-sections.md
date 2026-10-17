# 04 — 頁首與分區

**What to build:** `register.tsx` 的頁首與分區結構：
- 有 Session 在等：拿掉外框，改成分區標題。第一行 `▲ n 個待處理`（warning bold，Desktop `size="heading"`），同一行右端是「設定 ▸」；第二行 caption 細分 `核准 1 · 回答 1 · 最長 3m`，拿掉「點選標題前往」。
- 沒有在等：一行 `✓ 沒有待處理的 Session`，右端「設定 ▸」，不重複各分區數量；只有 0 筆 Session 時才補「沒有其他執行中的 Session」。
- 看不到狀態：有框警示卡 `round` + warning，⚠ 標題；說明用預設色，只有引擎原始錯誤用 error；結論和路徑（`truncate-middle`）分兩行；一行 dim「每 3 秒自動重試」和指向對應語言 README 錨點的「疑難排解 ↗」`Link`。「設定 ▸」維持單獨一行在上方。
- 粗琥珀框只給待處理卡片，紅色粗框只給出錯中止。
- 每個分區（標題＋卡片）包一層 `Box flexDirection="column" rowGap="xs"`，根節點 `rowGap="md"`，閒置列之間 0。間距一律用 step 名稱。
- 分區標題前加狀態 glyph：`◉ 工作中 2`（claude 色）、`○ 閒置 3 ▾`。
- 字級四級：heading＝等你計數；body semibold＝卡片標題；footnote＝分區標題、情境行；caption＝中繼資料。

**Blocked by:** 02, 03

**Status:** resolved

- [x] 三種頁首形態與測試（`ux-01-scan-failure` 的斷言依新結構更新）
- [x] 終端機組內 0 行、組間 1 行

## Comments

- **給 11 的錨點**：疑難排解的 `Link` 指向 `https://github.com/wide3751/switchboard/blob/main/<README>#<slug>`，slug 用 `encodeURIComponent` 編碼（終端機的 OSC 8 只收 ASCII）。五個 slug 依 README 現在的二級標題（各檔 242 行）：`README.md#troubleshooting`（## Troubleshooting）、`README.ja.md#トラブルシューティング`、`README.ko.md#문제-해결`（## 문제 해결）、`README.zh-CN.md#故障排除`、`README.zh-TW.md#疑難排解`。**改寫 README 時這五個標題不能改名**；要改就同步改 `i18n.ts` 各語言的 `header.troubleshootUrl`（`readmeAnchor(檔名, slug)`），`tests/ui-04-header-sections.test.ts` 會檢查網址。
- **給 06 的插入點**：設定面板只經過 `register.tsx` 的 `panelSlot` 一個變數，已經放在頁首下方：有在等時在 `waiting-group` 裡（頁首和待處理卡片之間），沒有在等時在頁首下一個，看不到狀態時在警示卡下方（「設定 ▸」維持單獨一行 `toolbar` 在警示卡上方）。06 只要改 `viewPanel` 本身（內容、完成按鈕），不必再搬位置。
- 骨架：根節點 `key="board"` `rowGap="md"`；分區是 `waiting-group`／`busy-group`／`idle-group`（`rowGap="xs"`），閒置列另包 `idle-rows`（不設 gap）。卡片的 `paddingX` 改成 `"sm"`（終端機仍是 1 格，`cardWidth = columns - 4` 不變）；卡片內部（titleRow、metaStrip、帳號卡片、設定面板）的數字間距留給 05、06。
- 保留 `header`、`count`、`summary` 這三個 key，既有測試大多不用改。頁首那一行是 `title-row`（`count` 加右端的 `settings`），所以 `count` 的文字不含「設定 ▸」。看不到狀態時若還有上一次的待處理卡片，照原型在警示卡下方畫待處理分區，標題用 `waiting-header`／`waiting-count`／`waiting-summary`，避免和警示卡的 `count`、`summary` 重複。
- 「資料是 n 秒前的」（`stale`）和第一次使用的引導（`only-self`）放進 `header` 裡，跟著頁首，不另佔一個分區的間距；看不到狀態時在警示卡裡。
- 用量 ≥95% 時帳號卡片照舊排在待處理卡片之前：有在等時放進 `waiting-group`（設定面板之後、卡片之前）。
- 工作中標題：只有 ◉ 用 claude 色（巢狀 Text），文字用預設色 footnote semibold（07-decisions 第 9 點）。閒置標題整列是 `Button plain key="toggle-idle"`，裡面一個 inactive 的 Text `○ 閒置 n ▾`；Button 的 `label` 留給 08。原本的 `dimColor` 拿掉（inactive 已經是淡色）。
- 字串：`readFailed` 改成固定說明（含冒號），原始錯誤另用 error 色接在後面；`cannotRead`、`header.noRecords` 拿掉路徑參數（改寫成「下面這個資料夾…」），路徑另起一行 `truncate-middle`。新增 `header.retry`、`header.troubleshoot`、`header.troubleshootUrl`。刪掉不再用的 `header.longestWait`（「點選標題前往」）、`header.running`、`header.idle`；`assets/board/render.mjs` 唯一用到 `longestWait` 的地方改成 `status.longest`，示意圖其他部分仍歸 11。
- `Link` 不帶 key（引擎會把 inline 元素的 key 拿掉），測試從 `retry` 這個 Box 找。
- GLYPHS 沒有新增：用到的 ◉ ○ ▲ ✓ ⚠ ↗ ▸ ▾ 03 都已收錄。
- 測試：新增 `tests/ui-04-header-sections.test.ts`（三種頁首、heading、只有原始錯誤用 error、Link 網址、粗框只給待處理卡片、分區 glyph、終端機組內 0 行組間 1 行）。`world.ts` 新增 `cellsAcross`／`rowsDown`（Space step 換成終端機格數），ux-11 的 `widthOf`／`titleRowWidth` 和 ui-03 的 `rowCells` 改用它，不再 `Number('sm')` 變 NaN。ux-06「點選標題前往」那個測試改寫成「不再教點標題」；nyc 的 `section-busy` 斷言加上 `◉ `，`工作中 1 · 閒置 1` 改成「頁首不重複各分區數量」。
- 沒做：Desktop 上 `size="heading"` 與 rowGap xs／md 的實際間距要在 12 真機確認。

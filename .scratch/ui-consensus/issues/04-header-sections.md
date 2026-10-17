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

**Status:** ready-for-agent

- [ ] 三種頁首形態與測試（`ux-01-scan-failure` 的斷言依新結構更新）
- [ ] 終端機組內 0 行、組間 1 行

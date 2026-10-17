# 03 — 符號總表與狀態標籤

**What to build:** `board.ts` 建 `GLYPHS` 表，每個 glyph 註明意思、碼位、EA 寬度（狀態、來源、背景任務、揭露、目前、跳轉 →、外部連結 ↗、PR）。
- ✎ 只代表 VS Code 來源：`summarizeTool` 的 Edit／Write／MultiEdit／NotebookEdit 改寫成 `Edit 檔名`，和 `Read 檔名` 一致。
- 背景任務 ⟳ 改 ↻；⏸ 加 VS15（U+FE0E）。
- 狀態標籤拆成「glyph Text＋標籤 Text」，字串不帶空格，拿掉 `.replace('▲ ', '✕ ')`。
- 測試：一符一義、一義一符；新增的字不是 EA=W。
- 終端機標題列的寬度預算加上 Ambiguous 字元的數量作為餘裕（不分語言）。

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] GLYPHS 表與測試
- [ ] ✎ 不再出現在情境行
- [ ] 狀態標籤不靠字串替換

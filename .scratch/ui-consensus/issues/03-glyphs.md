# 03 — 符號總表與狀態標籤

**What to build:** `board.ts` 建 `GLYPHS` 表，每個 glyph 註明意思、碼位、EA 寬度（狀態、來源、背景任務、揭露、目前、跳轉 →、外部連結 ↗、PR）。
- ✎ 只代表 VS Code 來源：`summarizeTool` 的 Edit／Write／MultiEdit／NotebookEdit 改寫成 `Edit 檔名`，和 `Read 檔名` 一致。
- 背景任務 ⟳ 改 ↻；⏸ 加 VS15（U+FE0E）。
- 狀態標籤拆成「glyph Text＋標籤 Text」，字串不帶空格，拿掉 `.replace('▲ ', '✕ ')`。
- 測試：一符一義、一義一符；新增的字不是 EA=W。
- 終端機標題列的寬度預算加上 Ambiguous 字元的數量作為餘裕（不分語言）。

**Blocked by:** 02

**Status:** resolved

- [x] GLYPHS 表與測試
- [x] ✎ 不再出現在情境行
- [x] 狀態標籤不靠字串替換

## Comments

- `GLYPHS`（`agens-view/hooks/board.ts`）收 24 個符號：狀態 5、來源 3、背景任務 ↻ ⏸︎ ! 與 ✓、揭露 ▸▾、✦、→、↗、PR 的 `#`、☑☐、▦、⚠、用量條 ▰▱。register.tsx 的 LOOK、CURRENT_MARK、徽章、展開明細的任務 mark、▸▾、☑☐、↗、`#`、▦ 都改成引用它；i18n.ts 裡的 → ✓ ⚠ ▲ 沒有改寫（避免和 07 衝突），改由測試檢查五種語言字串裡的 \p{So}／\p{Sm} 符號都在表裡。
- ✓ 同時用在「背景任務完成」和頁首「沒有待處理」，表上寫成一個意思「完成、沒有待處理」。
- 測試（`tests/ui-03-glyphs.test.ts`）：字元與意思都不重複、碼位和字元一致、每個字 displayWidth 1、沒有 EA=W；EA=A 只限原本就在用的 ▲ ○ → ↗ ▦ 五個，之後新增的符號加 A 會失敗。測試環境沒有 unicodedata，EA 寫死在表上，再和 `ambiguousCount` 交叉檢查。
- Ambiguous 餘裕：board.ts 新增 `ambiguousCount`（Unicode 15.1 的 A 範圍，排除組合字元、格式字元、私用區與已算 2 格的寬字元），`clipToWidth` 多一個參數讓 Ambiguous 字（含結尾的 …）算 2 格。終端機的標題列把每一段的寬度都加上 Ambiguous 字數，標題本身也照這樣截斷，等於「預算加上 Ambiguous 字數當餘裕」，而且西里爾、希臘字母這類整串都是 A 的標題不會超出。代價是西文 locale 的終端機上，含 ▲／○ 的列標題少 1 格。Desktop 不受影響。
- `displayWidth`／`clipToWidth`／比例估算把 U+FE00–FE0F 當 0 格，否則 ⏸︎ 會被算成 2 格。
- 狀態標籤：glyph 和標籤各一個 Text，靠外層 Box 的 gap；狀態不明的 ◌ 和「未知」也拆開。拆開後測試的 `.text` 沒有空格，nyc、ux-12 的斷言改成 `▲核准`、`◌未知proj-1241` 等。
- 沒做：`assets/board/render.mjs` 的樣本還寫著 `⟳1` 和 `✎ theme.css`，示意圖重新產生歸 11。

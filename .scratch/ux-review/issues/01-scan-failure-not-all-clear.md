# 01 — 掃描失敗或停擺時不能顯示「沒有在等你」

**What to build:** 掃描失敗時，監看視窗現在會說「一切正常」，要改成誠實地說「看不到狀態」：

- `scan()` 讀不到 sessions 資料夾時，畫面同時出現紅字錯誤和綠色的「✓ 沒有在等你」（`register.tsx:1317-1357`）。`error` 不是 null 時改畫警告樣式的頁首，例如「目前看不到 Session 狀態」，不畫綠框。
- `poll()` 只有 try/finally（`register.tsx:378-407`）。`ps` 或 `$.ui.panes()` 丟例外時，snapshot 停在上一次（或永遠是 null，畫面卡在「Loading…」）。加 catch，把錯誤寫進 `snapshot.error`。
- `ps` 回傳空輸出時，所有 Session 都被濾掉（`board.ts:376`）。自我檢查：清單裡找不到「目前這個」就代表掃描壞了，也顯示警告。
- 「最長 2m」等時間是用 `scannedAt` 算的，掃描停了數字就凍住。`$.clock.now()` 比 `scannedAt` 晚超過約 10 秒時，顯示「n 秒前更新」。

**Status:** ready-for-agent

- [ ] 讀不到 sessions 資料夾時不畫綠色頁首
- [ ] poll 裡的例外會顯示在畫面上，不會卡在 Loading
- [ ] 清單沒有「目前這個」時顯示警告
- [ ] 掃描停擺超過約 10 秒時顯示資料的時間
- [ ] 假世界補上 `ps` 丟例外、`ps` 回傳空的情境

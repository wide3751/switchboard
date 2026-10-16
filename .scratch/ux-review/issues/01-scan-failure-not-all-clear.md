# 01 — 掃描失敗或停擺時不能顯示「沒有在等你」

**What to build:** 掃描失敗時，監看視窗現在會說「一切正常」，要改成誠實地說「看不到狀態」：

- `scan()` 讀不到 sessions 資料夾時，畫面同時出現紅字錯誤和綠色的「✓ 沒有在等你」（`register.tsx:1317-1357`）。`error` 不是 null 時改畫警告樣式的頁首，例如「目前看不到 Session 狀態」，不畫綠框。
- `poll()` 只有 try/finally（`register.tsx:378-407`）。`ps` 或 `$.ui.panes()` 丟例外時，snapshot 停在上一次（或永遠是 null，畫面卡在「Loading…」）。加 catch，把錯誤寫進 `snapshot.error`。
- `ps` 回傳空輸出時，所有 Session 都被濾掉（`board.ts:376`）。自我檢查：清單裡找不到「目前這個」就代表掃描壞了，也顯示警告。
- 「最長 2m」等時間是用 `scannedAt` 算的，掃描停了數字就凍住。`$.clock.now()` 比 `scannedAt` 晚超過約 10 秒時，顯示「n 秒前更新」。

**Status:** resolved

- [x] 讀不到 sessions 資料夾時不畫綠色頁首
- [x] poll 裡的例外會顯示在畫面上，不會卡在 Loading
- [x] 清單沒有「目前這個」時顯示警告
- [x] 掃描停擺超過約 10 秒時顯示資料的時間
- [x] 假世界補上 `ps` 丟例外、`ps` 回傳空的情境

## Comments

- 自我檢查的範圍：只在 sessions 資料夾裡**有**目前這個 Session 的紀錄、清單（ps 確認存活之後）卻沒有它時才警告，正好抓到「ps 回傳空輸出」這種情況。整個資料夾裡都沒有自己的紀錄時不警告：既有測試和其他 ticket 的假世界大多沒有放「目前這個」的紀錄，一律警告會讓它們全部變成警告畫面；真機上自己的紀錄應該都在，若之後發現紀錄格式變了導致全部解析失敗，可以再收緊。測試用的 `putSelf()` 已加進 `tests/world.ts`。
- poll 丟例外時保留上一次的卡片與 `scannedAt`，頁首改成警告樣式，並靠「n 秒前更新」標出資料是舊的；掃描卡住（ps 遲遲不回）時，每次 polling 會請引擎重畫（`$.ui.invalidate('ui.render')`），時間才不會凍住。
- 測試引擎會把丟例外的 hook 當成「沒有實作」，所以 ps 丟例外時畫面上的原因文字是引擎給的，測試只檢查「讀取狀態失敗」本身。
- 新字串：`header.unknown`、`header.selfMissing`、`header.updatedAgo`（五種語言）；`Snapshot.error` 改成 `ScanError`（`unreadable`／`failed`／`self-missing`）。原本頁首上方的紅字 `key="error"` 併進警告頁首的 `summary`。

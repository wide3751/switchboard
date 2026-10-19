# 01 — Windows 上清掉殘留的狀態回報

**What to build:** Windows 上 Session 結束後，它的狀態回報要和 macOS 一樣被清掉，而且 tasklist 出錯時畫面要誠實地顯示看不到狀態：

- `removeStaleReports()` 用 `rm -f` 刪殘留回報（`register.tsx` 的 `removeStaleReports`）。Windows 沒有 `rm`，`$.process.run` 找不到執行檔就 reject，錯誤被 catch 吞掉，`~/.claude/switchboard/reports/` 裡的回報一直累積。畫面不受影響（只讀存活 Session 的回報），回報也已經遮罩過，但它們是明碼的 JSON，README 和 privacy 文件寫著「Session 結束後自動清掉」，Windows 上目前做不到（README 已註明）。
- 引擎的 `$.fs` 只有 read、write、list、exists、stat，沒有刪除。可行的方向：Windows 上改跑 `cmd /c del /f /q`，路徑要先換成反斜線（`del` 會把 `/` 當成參數）；或是確認引擎之後有沒有刪除 API。裝了 Git for Windows 的機器 PATH 上可能有 `rm`，不能靠它。
- `tests/windows.test.ts` 只測了正常路徑。補一個測試：`tasklist` 結束碼不是 0 或輸出是空的時，自我檢查回報 self-missing，頁首是「⚠ 目前看不到 Session 狀態」，不是「沒有待處理的 Session」。

**Status:** needs-triage

- [x] Windows 上 Session 結束後，它的回報會被刪掉
- [x] 假世界在 Windows 下模擬刪檔指令，測試確認殘留回報被刪
- [x] tasklist 失敗或沒有輸出時的測試
- [x] 五份 README 拿掉「Windows 上還不會清」的註記

## Comments

- 來源：PR #16（Windows 支援）審查的第 5 則建議。審查認為不擋合併，另開 ticket。
- PR #17 做了前兩項和 README：Windows 上改跑 `cmd /d /c del /f /q`，路徑含 cmd 的特殊字元（含 `,` `;` `=`）時不刪。剩下 tasklist 失敗或沒有輸出時的測試。
- PR #18 補了 tasklist 失敗或沒有輸出時的測試，四項都完成。

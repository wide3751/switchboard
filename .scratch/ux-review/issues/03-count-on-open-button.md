# 03 — 打開按鈕顯示等你計數

**What to build:** 依 ADR-0006，監看視窗沒打開時，輸入框上方的按鈕顯示 **等你計數**，例如 `▦ 打開監看視窗 · ▲2`；沒有 Session 在等時只顯示按鈕本身。沒開監看視窗的 Session 每 15 秒做一次輕量掃描：只讀 Session 紀錄、狀態回報，跑一次 `ps`，不跑 git、gh。打開監看視窗後改用原本的 3 秒掃描並停止輕量掃描，關掉後恢復。

**Blocked by:** 01（掃描失敗的處理方式要一致）

**Status:** resolved

- [x] Desktop 和 CLI 的打開按鈕都帶等你計數
- [x] 輕量掃描每 15 秒一次，不跑 git、gh
- [x] 打開監看視窗後輕量掃描停止，關掉後恢復
- [x] 輕量掃描失敗時按鈕不顯示計數，不能顯示 0
- [x] 五種語言的按鈕文字、README 說明更新
- [ ] plugin.json 版本號調高；`claude plugin test` 與 `claude plugin validate` 通過

## Comments

- plugin.json 版本號依實作約定不在這張 ticket 調，整合完成後統一調一次；`claude plugin test`、`claude plugin validate` 都已通過。
- README 依約定不在這張 ticket 改，改動寫在 ux-notes 的 `readme-03.md`，由 ticket 09 五種語言一起改。按鈕文字在 `i18n.ts` 的 `band.openWaiting`，五種語言都有。
- 輕量掃描沿用監看視窗的 `scan()`（Session 紀錄、`ps`、狀態回報、清殘留回報），結果只寫進按鈕的計數；`toCards` 算的其他欄位是純函式、不額外讀檔或跑指令。掃描失敗、讀不到 sessions 資料夾、清單裡沒有目前這個 Session（ticket 01 的 `ScanError`）時計數是 null，按鈕只顯示本身。
- Session 啟動時原本的「清殘留回報」併進第一次輕量掃描（監看視窗已畫出來時由它的掃描清），所以啟動時一樣只讀一次 Session 紀錄。只有畫得出監看視窗的介面（Desktop、終端機）會每 15 秒掃描；VS Code 擴充套件與非互動 Session 只在啟動時掃一次（清回報）。
- 測試：`world.ts` 依「監看視窗有沒有畫出來」把讀 Session 紀錄分成 `scans`（監看視窗的掃描）與新的 `lightScans`（輕量掃描），另加 `commands` 紀錄跑過的指令。啟動時的那一次現在算輕量掃描，`STARTUP_SCANS` 因此從 1 改成 0；`needs-you-count.test.ts` 的斷言一行都沒改。

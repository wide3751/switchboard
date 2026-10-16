# 06: 跳轉：iTerm / Terminal.app

**What to build:** 在 **監看視窗** 的 Pane 上點一個跑在 iTerm 或 Terminal.app 裡的 CLI Session，就把使用者帶到那個終端機 app 裡對應的分頁（依 tty 定位）。清單不代替使用者核准或回答。

**Blocked by:** 02, 04

**Status:** resolved

- [x] 點 iTerm 的 CLI Session，切到 iTerm 對應的分頁並帶到前面
- [x] 點 Terminal.app 的 CLI Session，切到 Terminal.app 對應的分頁並帶到前面
- [x] 點「目前這個」Session 的列，什麼事都不發生
- [x] 找不到對應分頁時，至少把該終端機 app 帶到前面並顯示 Session 的資料夾路徑
- [x] 從 desktop 介面的監看視窗 Pane 觸發跳轉（測試檢查送出的 AppleScript）

## Comments

**完成（2026-10-16）**：Session 啟動時把 `TERM_PROGRAM` 寫進狀態回報，監看視窗掃描時用 `ps -o pid=,tty=` 取得 tty。點 iTerm 或 Terminal.app 的 CLI Session 時，用 osascript 依 tty 切到對應分頁；找不到時把終端機帶到前面，並顯示資料夾路徑。tty 以參數傳給腳本、只接受 `ttysNNN`。已在真的 iTerm 實測：對存在的 tty 回 `ok` 並切過去，對不存在的回 `missing`。Terminal.app 的腳本只做了編譯檢查。新版之前就開著的 Session 沒有記下終端機，要 `/reload-plugins` 或重開才能跳轉。

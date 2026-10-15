# 06: 跳轉：iTerm / Terminal.app

**What to build:** 在 **監看視窗** 的 Pane 上點一個跑在 iTerm 或 Terminal.app 裡的 CLI Session，就把使用者帶到那個終端機 app 裡對應的分頁（依 tty 定位）。清單不代替使用者核准或回答。

**Blocked by:** 02, 04

**Status:** ready-for-agent

- [ ] 點 iTerm 的 CLI Session，切到 iTerm 對應的分頁並帶到前面
- [ ] 點 Terminal.app 的 CLI Session，切到 Terminal.app 對應的分頁並帶到前面
- [ ] 點「目前這個」Session 的列，什麼事都不發生
- [ ] 找不到對應分頁時，至少把該終端機 app 帶到前面並顯示 Session 的資料夾路徑
- [ ] 從 desktop 介面的監看視窗 Pane 觸發跳轉（測試檢查送出的 AppleScript）

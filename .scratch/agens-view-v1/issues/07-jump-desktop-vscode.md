# 07: 跳轉：Desktop、VS Code 與退回處理

**What to build:** 在 **監看視窗** 的 Pane 上點一個 Desktop Session，就帶到 Claude Desktop 裡對應的 Session；點一個 VS Code 整合終端機裡的 CLI Session，就把開著對應資料夾的 VS Code 視窗帶到前面。沒辦法精準跳轉時，帶到該 app 並顯示 Session 的資料夾路徑。

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] 點 Desktop Session，透過 deep link 帶到 Claude Desktop 裡對應的 Session（依 02 的實測結果；做不到指定 Session 時，退回成只把 Desktop app 帶到前面，並顯示 Session 標題）
- [ ] 點 VS Code 的 CLI Session，把開著對應資料夾的 VS Code 視窗帶到前面
- [ ] 無法精準跳轉時，帶到該 app 並顯示 Session 的資料夾路徑
- [ ] 點「目前這個」Session 的列，什麼事都不發生
- [ ] 測試檢查送出的 deep link 或指令

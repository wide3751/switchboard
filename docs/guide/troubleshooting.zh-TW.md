[English](troubleshooting.md) | 繁體中文 | [简体中文](troubleshooting.zh-CN.md) | [日本語](troubleshooting.ja.md) | [한국어](troubleshooting.ko.md)

# 疑難排解

[← 回到 README](../../README.zh-TW.md)

| 症狀 | 處理方式 |
|---|---|
| `/switchboard:open` 回覆 hooks 沒有載入 | 1. 確認 Claude Code 版本支援 mods，不支援就更新。2. 重開這個 Session：安裝前就開著的 Session 不會載入。3. 還是不行，用 `claude --debug` 啟動，在 debug log 查看 `hooks module switchboard` 的錯誤訊息 |
| 指令回覆這裡無法顯示監看視窗 | 你在 VS Code 擴充套件的圖形介面輸入了指令；改到 Desktop 的 Code 分頁，或終端機裡的 Claude Code 輸入 |
| 頁首顯示 `⚠ 目前看不到 Session 狀態`，下面說找不到任何 Session 紀錄，連目前這個都沒有 | Claude Code 版本太舊、還不寫 Session 紀錄，或 `CLAUDE_CONFIG_DIR` 指到 Claude Code 實際用的以外的資料夾 |
| 頁首顯示 `⚠ 目前看不到 Session 狀態`，下面是 `switchboard 讀取狀態失敗：` 加上一段紅字 | 紅字是原始的錯誤訊息。監看視窗每 3 秒自動重試，暫時的錯誤會自己消失；一直出現的話，用 `claude --debug` 啟動，在 debug log 查看 `hooks module switchboard` 的錯誤訊息 |
| 頁首顯示 `⚠ 目前看不到 Session 狀態`，下面說讀不到某個資料夾 | 確認那個資料夾存在、你有讀取權限；有設 `CLAUDE_CONFIG_DIR` 的話，確認它指向 Claude Code 實際使用的資料夾 |
| 某一列顯示 `未載入 switchboard，僅基本狀態` | 那個 Session 在安裝前就開著；重新啟動它 |
| 沒有顯示 PR | 安裝 `gh` 並執行 `gh auth login`；Session 的資料夾必須是 GitHub repository |
| 點 CLI Session 只顯示路徑 | 只有 iTerm、Terminal.app 能跳轉；其他終端機請自己切過去。iTerm、Terminal.app 也跳不過去時，依提示到「系統設定 › 隱私權與安全性 › 自動化」允許控制它們，或重新啟動那個 Session（0.6.0 之前開的 Session 沒有記下終端機） |
| 勾選了「自動打開監看視窗 › CLI Session」，終端機裡卻沒有監看視窗 | 終端機太窄（不到 144 欄），自動打開的 Pane 不會畫出來。按輸入框上方的 **▦ 打開監看視窗**、輸入 `/switchboard:open`，或把終端機拉寬 |
| 修改程式碼後沒有效果 | 已安裝的副本依 `plugin.json` 的 `version` 快取。開發時改在專案資料夾執行 `claude --plugin-dir ./agens-view`，改了就會熱重載。已安裝的副本拿不到新版時，執行 `claude plugin marketplace update switchboard` 和 `claude plugin update switchboard@switchboard` 後重新啟動 |

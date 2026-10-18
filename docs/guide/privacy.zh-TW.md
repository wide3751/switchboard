[English](privacy.md) | 繁體中文 | [简体中文](privacy.zh-CN.md) | [日本語](privacy.ja.md) | [한국어](privacy.ko.md)

# 隱私與資料

[← 回到 README](../../README.zh-TW.md)

switchboard 完全在你的 Mac 上執行，不會把資料送到任何自己的服務。

- **寫在本機**：每個 Session 的狀態回報，以明碼 JSON 存在 `<Claude 設定目錄>/switchboard/reports/<sessionId>.json`，內容有第一句 prompt 的前約 40 字（當作標題）、模型、分支、待辦進度、目前動作、核准請求摘要、問題、錯誤、最後回覆的簡短節錄、背景任務、rate limit、連接器、Pull Request、所在的終端機（`TERM_PROGRAM`）、Context 用量、花費、回合數和時間戳記。`sessionId` 不在任何 session 紀錄裡、而且超過一分鐘沒更新的回報，下次有任何 Session 掃描時就會被刪除；從沒開過監看視窗也一樣。一筆 session 紀錄都找不到時不刪
- **遮罩只是盡力而為**：寫入前，指令、核准請求摘要、問題、第一句 prompt、最後回覆的節錄和錯誤訊息裡疑似機密的片段（例如 `Bearer …`、`token=…`、`--token …`、`API_KEY=…`、`sk-…`、`ghp_…`）會換成 `•••`。不保證抓得到全部，指令的其餘部分仍以明碼存放
- **在本機讀取**：Claude Code 自己的 `<Claude 設定目錄>/sessions/*.json` 紀錄和這些狀態回報。不會讀其他 Session 的 `.jsonl` 對話紀錄
- **會執行的指令**：掃描時跑 `ps`（哪些 Session 還活著；監看視窗沒開時也每 15 秒跑一次，給打開按鈕的計數）和 `rm`（刪掉殘留的回報）；每個 Session 啟動時和每個回合結束後，在自己的資料夾裡跑 `git`（分支與變更）和 `gh pr view`（Pull Request，會用你自己的 `gh` 登入連到 GitHub）；另外還有 `uname -s`（`/switchboard:open` 時判斷作業系統）、`defaults read -g AppleLanguages`（介面語言，只在 `LC_ALL`、`LANG` 判斷不出語言時才跑）、`open`（跳轉到 Desktop Session，以及打開 Pull Request 頁面和作者連結）、`osascript`（切到 iTerm、Terminal.app 對應的分頁）。逾時：`ps` 和 `git` 5 秒、`gh` 8 秒、`osascript` 10 秒、`defaults` 和 `uname` 3 秒

## 運作原理

每個 Session 都會載入 mod，它有兩個職責：

1. **回報者**：監聽自己所在 Session 的事件（`session.start`、`turn.start`、`tool.call`、`turn.complete` 等），寫出狀態回報。Session 啟動時和每個回合結束後，也會在自己的資料夾裡跑 `git`、`gh`，取得分支、變更和 Pull Request。
2. **監看視窗**：顯示監看視窗的 Session 每 3 秒把狀態回報和 Claude Code 的 Session 紀錄合併，排除程序已不存在的 Session，再繪製清單，自己不跑 `git`、`gh`。沒開監看視窗的 Session 改成每 15 秒做一次同樣的合併，只算等你計數給輸入框上方的按鈕用。

Session 存不存在，只看 Claude Code 自己的紀錄和程序是否還活著，所以殘留的狀態回報不會讓已結束的 Session 繼續出現在清單上。兩個來源不一致時，依固定的順序判斷：紀錄是工作中或待處理時用紀錄；否則回報裡有回合錯誤就算出錯中止，回報裡有問題而紀錄是閒置時算待處理；其餘都用紀錄。

# 06 — 跳轉：CLI 也有「前往處理」，失敗訊息講對原因

**What to build:**

- 「前往處理 →」只在 `desktopLinkOf(...) !== null` 時出現（`register.tsx:1151`）。改成「能跳轉」就出現：有 Desktop 連結，或 `tabScriptOf` 不是 null。「建立 PR ↗」的條件（`register.tsx:1031`）同樣只看 Desktop，一併檢查，並考慮改名為「前往建立 PR」。
- 標題能點但看不出來。頁首摘要改用已經翻好卻沒用到的 `header.longestWait`（「…點標題前往」）。
- `jump()` 只看 stdout 是不是 `ok`，不看 exitCode（`register.tsx:580-581`）。自動化權限被拒（osascript 錯誤碼 -1743，待實測）時要指向「系統設定 › 隱私權與安全性 › 自動化」，不是「找不到分頁」。osascript 加 timeoutMs。
- `cliNoJump` 只說「這個終端機」，要帶上目標 Session 的來源名稱（例如「VS Code 裡的 Session 還不能直接跳轉」）。
- 回報沒有 terminal 但 entrypoint 是 cli 時（0.6.0 之前開的 Session），改說「重開這個 Session 後才能跳轉」。
- `card.source` 是 null 時不能出現「Couldn't find the tab in . 」這種殘缺句子。

**Status:** ready-for-agent

- [ ] iTerm、Terminal.app 的需要你處理卡片有「前往處理 →」
- [ ] 頁首提示可以點標題前往
- [ ] 權限被拒、舊 Session、不支援的終端機各有正確的 toast
- [ ] 假世界補上「osascript 以錯誤結束」的情境
- [ ] 五種語言的 README 更新

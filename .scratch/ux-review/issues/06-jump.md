# 06 — 跳轉：CLI 也有「前往處理」，失敗訊息講對原因

**What to build:**

- 「前往處理 →」只在 `desktopLinkOf(...) !== null` 時出現（`register.tsx:1151`）。改成「能跳轉」就出現：有 Desktop 連結，或 `tabScriptOf` 不是 null。「建立 PR ↗」的條件（`register.tsx:1031`）同樣只看 Desktop，一併檢查，並考慮改名為「前往建立 PR」。
- 標題能點但看不出來。頁首摘要改用已經翻好卻沒用到的 `header.longestWait`（「…點標題前往」）。
- `jump()` 只看 stdout 是不是 `ok`，不看 exitCode（`register.tsx:580-581`）。自動化權限被拒（osascript 錯誤碼 -1743，待實測）時要指向「系統設定 › 隱私權與安全性 › 自動化」，不是「找不到分頁」。osascript 加 timeoutMs。
- `cliNoJump` 只說「這個終端機」，要帶上目標 Session 的來源名稱（例如「VS Code 裡的 Session 還不能直接跳轉」）。
- 回報沒有 terminal 但 entrypoint 是 cli 時（0.6.0 之前開的 Session），改說「重開這個 Session 後才能跳轉」。
- `card.source` 是 null 時不能出現「Couldn't find the tab in . 」這種殘缺句子。

**Status:** resolved

- [x] iTerm、Terminal.app 的需要你處理卡片有「前往處理 →」
- [x] 頁首提示可以點標題前往
- [x] 權限被拒、舊 Session、不支援的終端機各有正確的 toast
- [x] 假世界補上「osascript 以錯誤結束」的情境
- [ ] 五種語言的 README 更新

## Comments

- 實作：`canJump`（Desktop 連結或 `tabScriptOf` 不是 null）同時決定「前往處理 →」與 PR 按鈕；PR 按鈕改用新 key `goCreatePr`（「前往建立 PR →」），舊的 `createPr` 沒刪，留給 ticket 12 清理。頁首摘要只有在至少一張需要你處理的卡片能跳轉時才用 `header.longestWait`，否則維持 `status.longest`，避免提示點了也跳不過去。
- `jump()`：osascript 帶 `timeoutMs: 10000`，逾時（引擎 reject）顯示 `jumpFailed`；exitCode 不是 0 或 stdout 不是 `ok` 都算失敗；exitCode 不是 0 且 stderr 有 `-1743` 時顯示新的 `toast.automationDenied`，其他失敗維持 `tabMissing`。`card.source` 是 null 時改用 `jumpFailed`，不拼出殘缺句子。
- 跳不過去的說明：來源已知用新的 `toast.noJumpIn(source, path)`；來源是 CLI 且回報沒有 `terminal` 欄位（0.6.0 之前的回報，或沒載入 switchboard 而沒有回報）用 `toast.reopenToJump`；新版回報裡 `terminal` 是 null（終端機沒設 `TERM_PROGRAM`）重開也沒用，維持 `cliNoJump`。為了分出「沒有欄位」和「null」，`Report.terminal` 改成選用欄位，`parseReport` 在原始資料沒有這個欄位時不填。
- 假世界：`world.scriptFailure` 可設成 `{ exitCode, stderr }`（osascript 以錯誤結束）或 `'hang'`（有給 timeoutMs 就在逾時後 reject，沒給就一直不結束）。測試在 `agens-view/tests/ux-06-jump.test.ts`。
- **待真機確認**：雲端容器沒有 macOS，-1743 是照 ticket 實作，沒有實測。要確認的是：(1) 自動化權限被拒時 osascript 確實以非 0 結束，stderr 帶 `(-1743)`；(2) 第一次詢問權限的對話框出現時 osascript 會等，10 秒逾時夠不夠，逾時砍掉 osascript 後使用者的回答是否仍會被記住；(3) 被拒時「系統設定 › 隱私權與安全性 › 自動化」裡要打開的是哪個 app（Claude Desktop，或執行 Claude Code 的終端機）對哪個終端機的權限，toast 的說法是否夠清楚。
- README 沒改（依約定由 ticket 09 一起改五種語言），需要的改動寫在 scratchpad 的 `ux-notes/readme-06.md`。

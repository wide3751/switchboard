Status: ready-for-agent

# 檢查更新與新版提示

## Problem Statement

我用 `claude plugin marketplace add wide3751/switchboard` 和 `claude plugin install` 裝了 switchboard 之後，就再也不會想到它。Claude Code 本身能自動更新 plugin，但第三方 marketplace 的自動更新**預設是關的**，而且 README 沒說要去開。Claude Code 也不會告訴我「有新版但你還沒裝」。結果是：新功能和 bug 修正永遠到不了我手上，除非我哪天剛好想起來跑 `claude plugin update`，或剛好去 GitHub 看。

## Solution

switchboard 自己 **檢查更新**，發現新版時顯示 **新版提示**，讓我點一下就 **更新**：

- 所有 **Session** 共用一個時鐘，每小時最多向 GitHub 讀一次 main 上公布的版本號，和這台電腦已安裝的版本比較。
- 公布的版本嚴格大於已安裝版本時，**監看視窗** 頁首下方出現一行 **新版提示**（版本號、「立即更新」、「這版略過」，以及一句「到 /plugin › Marketplaces 開啟自動更新，以後就不用手動」）；沒打開監看視窗時，輸入框上方的打開按鈕也加上 `⇡ 新版`。
- 按「立即更新」，switchboard 代為執行 Claude Code 的 plugin 更新指令；成功後告訴我要重啟 Session 或輸入 `/reload-plugins` 才生效。失敗或找不到 `claude` 指令時，改顯示指令本身讓我自己貼。**更新只在我點擊時執行，從不自動。**
- 按「這版略過」，提示和按鈕上的標記一起消失，直到更高的版本出現。
- **設定 ▸ › 一般** 有「檢查更新」開關，預設開啟。我已經用 Claude Code 自己的環境變數表明不要非必要流量時，switchboard 也不檢查。
- README 的 Quick start 教我開啟 Claude Code 的自動更新；隱私段誠實寫出這個新的連網行為。

名詞定義見 `GLOSSARY.md` 的 **新版提示**、**檢查更新**、**更新**。

## User Stories

1. 身為 switchboard 使用者，我想在有新版時於監看視窗看到一行提示，這樣我不用自己去 GitHub 看也知道該更新了。
2. 身為 switchboard 使用者，我想在提示上看到新版的版本號，這樣我知道差了多少。
3. 身為沒打開監看視窗的使用者（例如 CLI Session 預設不自動打開），我想在打開按鈕上看到 `⇡ 新版`，這樣不打開監看視窗也知道有新版。
4. 身為有 Session 在等我的使用者，我想讓打開按鈕上的 **等你計數** 仍然排在最前面，`⇡ 新版` 放在它後面，這樣新版標記不會搶走「有 Session 在等我」的注意力。
5. 身為 switchboard 使用者，我想點「立即更新」就完成更新，這樣不用切到終端機打兩行指令。
6. 身為 switchboard 使用者，我想在更新執行中看到「更新中…」，這樣我知道按下去有反應、不會重複按。
7. 身為 switchboard 使用者，我想在更新成功後看到「已更新到 X，重啟 Session 或輸入 /reload-plugins 生效」，這樣我知道為什麼畫面還是舊的、下一步該做什麼。
8. 身為 switchboard 使用者，我想在更新成功後立刻看不到 `⇡ 新版`，這樣我不會以為更新沒成功。
9. 身為在 Desktop 使用、PATH 裡沒有 `claude` 的使用者，我想在更新失敗時看到可以複製的指令，而不是一個看不懂的錯誤，這樣我還是有辦法更新。
10. 身為更新指令失敗（例如網路斷了）的使用者，我想看到同樣的指令，這樣我可以晚點自己重試。
11. 身為更新指令卡住的使用者，我想讓它在 60 秒後放棄並顯示指令，這樣按鈕不會永遠停在「更新中…」。
12. 身為暫時不想升級的使用者，我想按「這版略過」讓提示和按鈕標記消失，這樣它不會一直佔著我的畫面。
13. 身為按過「這版略過」的使用者，我想在更高的版本出現時再看到提示，這樣我不會永遠錯過之後的更新。
14. 身為同時開好幾個 Session 的使用者，我想在一個 Session 按「這版略過」後，其他 Session 的提示也跟著消失，這樣不用每個 Session 都按一次。
15. 身為同時開好幾個 Session 的使用者，我想讓 switchboard 不管開幾個 Session 每小時都只連一次 GitHub，這樣不會因為開了很多 Session 就多出很多網路請求。
16. 身為剛打開 Session 的使用者，我想讓檢查延到啟動一段時間後才做，這樣不會和 Claude Code 自己啟動時的工作擠在一起，只開一下就關的 Session 也不會發請求。
17. 身為網路不通或 GitHub 掛掉時的使用者，我想讓 switchboard 安靜地當作沒有新版，這樣不會看到一個我無法處理的錯誤。
18. 身為已經是最新版的使用者，我想完全看不到任何新版相關的東西，這樣畫面維持乾淨。
19. 身為用 `--plugin-dir` 載入開發中分支的 switchboard 開發者，我想在分支版本號已經高於 main 時看不到新版提示，這樣開發時不會被誤報干擾。
20. 身為在意隱私或公司限制外連的使用者，我想在 **設定 ▸ › 一般** 關掉「檢查更新」，這樣 switchboard 不會主動連網。
21. 身為已經設定 `DISABLE_UPDATES`、`DISABLE_AUTOUPDATER` 或 `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` 的使用者，我想讓 switchboard 跟著不檢查，這樣我不用為它另外再設一次。
22. 身為關掉「檢查更新」的使用者，我想讓原本顯示中的提示和按鈕標記一起消失，這樣關掉就是真的關掉。
23. 身為 switchboard 使用者，我想讓「檢查更新」開關在所有 Session 共用，這樣和其他設定的行為一致。
24. 身為看到新版提示的使用者，我想在提示上被告知可以開啟 Claude Code 自己的自動更新，這樣以後就不需要這個提示。
25. 身為新安裝的使用者，我想在 README 的 Quick start 看到「開啟自動更新」的步驟，這樣一開始就設定好。
26. 身為在意隱私的使用者，我想在 README 的隱私段看到這個新的連網行為（讀什麼、多久一次、不帶本機資料、怎麼關），這樣我能判斷要不要開著。
27. 身為非中文使用者，我想讓新版提示、按鈕標記、更新結果和設定項目都依我選的語言顯示（English、日本語、한국어、简体中文、繁體中文），這樣和其他介面一致。
28. 身為終端機使用者，我想用鍵盤（`tab`、`enter`）操作「立即更新」和「這版略過」，這樣不需要滑鼠。
29. 身為讀螢幕閱讀器的使用者，我想讓打開按鈕的 label 也講出有新版，這樣不只看得到符號的人才知道。
30. 身為用量快用完的使用者，我想讓用量提醒和新版提示都在頁首下方而且彼此不擋住，這樣兩個訊息都看得到。

## Implementation Decisions

**檢查更新**
- 「最新版」的來源是 GitHub 上 main 分支 `plugin.json` 的 `version`，以 `raw.githubusercontent.com` 讀取，透過 mod API 的 `$.http.fetch`。這和 Claude Code 安裝時判定版本讀的是同一份；不用 git tag、不用 GitHub API（tag 沒有逐版打，API 有匿名限額）。
- 「已安裝版本」用 `$.fs.read` 讀 `$.plugin.root` 底下這份 plugin 自己的 `plugin.json`，不從快取路徑推斷。
- 比較用 semver：只有公布版本**嚴格大於**已安裝版本才算新版。任何失敗（逾時、非 2xx、JSON 壞掉、沒有 `version`、版本號解析不了、讀不到本機 `plugin.json`）一律當作沒有新版，不顯示錯誤，也不清掉之前看到的結果以外的狀態。
- 頻率：所有 Session 共用 `$.store` 裡的檢查狀態（上次檢查時間、上次看到的公布版本）。每小時最多一次；Session 啟動後約一分鐘才做第一次判斷，到期才連網，否則直接用 store 裡的結果。不搭監看視窗的輪詢或輕量掃描那兩班車。
- 停用條件：設定「檢查更新」關閉，或環境變數 `DISABLE_UPDATES`、`DISABLE_AUTOUPDATER`、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` 任一有值。停用時不連網，也不顯示任何新版相關的東西。

**新版提示**
- 監看視窗頁首下方一行，和「用量達 95% 時提到頁首下方」的帳號提醒在同一區，兩者同時出現時都顯示。
- 內容：新版版本號、「立即更新」按鈕、「這版略過」按鈕、一句教使用者開啟 Claude Code 自動更新（`/plugin › Marketplaces`）。
- 打開按鈕（ADR-0006 那顆）在有新版時加上 `⇡ 新版` 標記，放在等你計數之後；終端機的 label 也帶上這個資訊。
- 「這版略過」把略過的版本記在 store，所有 Session 共用；之後看到的公布版本大於略過版本才再出現。

**更新**
- 只在使用者點「立即更新」時執行，依序跑 `claude plugin marketplace update switchboard`、`claude plugin update switchboard@switchboard`（文件沒寫 `plugin update` 會不會先刷新 marketplace，所以先刷）。marketplace 名稱固定是 `switchboard`，因為 README 是唯一的安裝途徑。
- 執行中顯示「更新中…」並防止重複觸發；整體逾時 60 秒。
- 成功：那一行改成「已更新到 X，重啟 Session 或輸入 /reload-plugins 生效」；把剛裝好的版本記進 store，所有 Session 的 `⇡ 新版` 立刻消失，不等下一次檢查（目前 Session 載入的仍是舊程式，`$.plugin.root` 的版本號在重新載入前不會變）。
- 失敗（找不到 `claude`、任一步非零結束、逾時）：那一行改成顯示這兩個指令，讓使用者自己執行；不顯示錯誤細節。

**設定**
- **設定 ▸ › 一般** 新增「檢查更新」開關，預設開啟，和其他設定一樣存在共用的設定裡、所有 Session 共用。精簡／標準／詳細這類卡片預設組不受影響。

**多國語言**
- 所有新文字加進 i18n 的五種語言。

**文件**
- README 五種語言：Quick start 加「開啟 Claude Code 對 switchboard marketplace 的自動更新」；隱私段把「`gh pr view` 是唯一會連上網路的指令」改成兩項，寫明每小時最多讀一次公開的 `plugin.json`、不帶任何本機資料、可以在設定或用環境變數關閉；設定清單加「檢查更新」；監看視窗上有什麼加新版提示。
- `docs/guide/usage.*`、`docs/guide/privacy.*` 五種語言同步。
- 這是使用者看得到的新功能，合併的 PR 跳 minor。

## Testing Decisions

- 只有一個 seam：`tests/world.ts` 的整合測試世界。從使用者看得到的結果驗收：打開按鈕的文字和 label、監看視窗頁首下方那一行、按下按鈕後跑了哪些外部指令、store 裡共用的狀態。不測版本比較之類的內部函式。
- world 要補：
  - 假的 `http.fetch`：可設定回傳的公布版本、失敗（丟例外、非 2xx、壞 JSON、逾時），並記錄呼叫次數與 URL。若測試框架沒有現成的 `http.fetch` 事件，第一張 ticket 先處理這件事。
  - plugin 目錄裡已安裝的 `plugin.json`。
  - `process.run` 認得 `claude plugin marketplace update` 和 `claude plugin update`，可設定成功、非零結束、找不到指令、卡住。
- 要涵蓋的情境：有新版／相同／較舊／遠端失敗各一；啟動後延遲才檢查；一小時內第二個 Session 不連網、過了一小時才連；略過後消失、更高版本再出現、跨 Session 生效；設定關閉、各環境變數；更新成功、失敗、逾時、重複點擊；五種語言的文字；用量提醒和新版提示同時出現。
- 前例：`ux-03-count-on-open-button.test.ts`（打開按鈕帶計數、多國語言表格寫法）、`ui-07-stop-auto-open.test.ts` 與 `field-settings.test.ts`（共用設定）、`ux-01-scan-failure.test.ts`（外部失敗時的行為）、`windows.test.ts`（`process.run` 失敗與逾時）。

## Out of Scope

- 自動安裝新版：**更新** 只在使用者點擊時執行。
- 用 `$.ui.toast` 或系統通知提示新版（ADR-0005 的精神：switchboard 不主動打斷使用者）。
- 顯示 changelog 或版本差異內容。
- 替使用者開啟 Claude Code 的自動更新（mod API 沒有送斜線指令或改 marketplace 設定的方法）。
- 支援 `switchboard` 以外的 marketplace 名稱、私有 fork。
- 補 git tag 或 GitHub Releases 流程。
- 雲端 Session。

## Further Notes

- Claude Code 的 plugin 自動更新：第三方 marketplace 預設關閉；開啟後在互動式 Session 送出第一則訊息後最多 10 分鐘刷新，只比對版本字串，更新後要 `/reload-plugins` 或重啟才生效。來源：Claude Code 文件 plugins/loading、plugins/install。開了自動更新的使用者通常在提示出現前就已經裝好，提示幾乎只給沒開的人看，這是預期的。
- 版本號規則（`docs/agents/versioning.md`）讓「公布版本」只在 PR 合併進 main 時改變，所以每小時檢查一次已經夠即時。
- 決策討論過程見 `GLOSSARY.md` 的 Flagged ambiguities；沒有另開 ADR，因為這個決定容易回頭改。

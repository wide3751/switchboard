# 01 — 在 CLI 輸入 `/switchboard:open` 打開監看視窗

**What to build:** 在 **CLI Session** 輸入 `/switchboard:open`，終端機裡就出現完整的 **監看視窗**，內容和 Desktop 一樣：所有本機 Session 的清單、**等你計數**、檢視面板、每一列的展開、閒置區收合。打開後開始 polling，關掉後停止。跳轉維持現狀：點 Desktop Session 用 deep link 切到 Desktop，點 CLI Session 顯示它所在的資料夾，點「目前這個」不做事。VS Code 擴充套件的圖形介面輸入指令時，仍然只回不支援的提示，提示文字改成說明可以在 Desktop 或終端機開。規格見 `.scratch/cli-board/spec.md`，決策見 ADR-0004。

Desktop 有一個特殊處理：焦點移到卡片標題時就直接跳轉（因為 Desktop 的 Pane 沒有焦點時，第一下點擊只會取得焦點）。在終端機用鍵盤移動焦點時，這會變成每經過一張卡片就跳轉一次，所以這個處理必須只在 Desktop 生效。

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] 在 `terminal` 介面輸入 `/switchboard:open` 會打開 Pane、開始 polling，指令回覆「已打開」
- [x] 在 `vscode` 介面（沒有 `desktop` 也沒有 `terminal`）輸入指令只回提示，不打開 Pane、不掃描；提示文字不再只說「請到 Desktop 開」
- [x] 在 `terminal` 介面掛載 Pane，清單、等你計數、檢視面板、展開都畫得出來，長標題依寬度截斷
- [x] 在 `terminal` 介面點 Desktop Session 用 deep link 跳轉，點 CLI Session 顯示路徑，點目前這個不做事
- [x] 在 `terminal` 介面焦點移到卡片標題時不會跳轉；Desktop 的行為不變
- [x] 在 `terminal` 介面關掉 Pane 後停止 polling
- [x] 指令描述拿掉「僅 Desktop」
- [x] 五種語言的 i18n 文字更新
- [x] 五種語言的 README 更新：使用方式、限制、疑難排解不再寫 CLI 不顯示畫面，改寫成 CLI 也能用指令打開
- [x] 既有測試「CLI 的 /switchboard:open 不打開任何畫面，只回提示」改寫成會打開；新增 `vscode` 只回提示的測試
- [x] plugin.json 版本號調高；`claude plugin test` 與 `claude plugin validate` 通過

## Comments

**原型結論（2026-10-16）**：問題是「監看視窗在終端機裡應該長怎樣？」。比較了三種樣式：A 照搬 Desktop（外框卡片、分區、[ 前往處理 → ] 按鈕）、B 精簡表格（一個 Session 一行）、C 待處理優先（只完整列出需要你處理，其餘各折成一行）。使用者選 A：終端機和 Desktop 共用同一套畫法，不為終端機另做版面。這張 ticket 照現有的 Pane 畫法在終端機顯示即可，只依 Pane 寬度截斷。原型檔案：`.scratch/cli-board/prototype-terminal-board.html`。

**完成（2026-10-16）**：在整合分支 `claude/grill-with-docs-cli-support-592d23` 的 commit `f506a90` 實作；code review 後的重構與補測試在 `f9ca260`。整合分支目前 38 個測試全過，validate 通過。

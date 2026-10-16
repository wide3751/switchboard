# 04 — 窄終端機：自動打開沒畫出來時照樣顯示按鈕

**What to build:** 「所有 CLI Session 都顯示」打開、但終端機太窄時，引擎不會畫出 mod 自己主動打開的 Pane（要 ≥144 欄，使用者以前開過則 110 欄）。這時要當作 **監看視窗** 還沒打開：輸入框上方照樣顯示「▦ 打開監看視窗」按鈕，也不做 polling。使用者按下按鈕或輸入指令屬於主動打開，引擎不管寬度都會畫，畫出來之後按鈕消失、開始 polling。判斷「已打開」一律看 Pane 是否已經畫出來，不只看 Pane 存不存在；Desktop 的行為也跟著用同一個判斷。規格見 `.scratch/cli-board/spec.md`，決策見 ADR-0004。

測試要擴充既有的假世界：目前它讓每次打開都回傳「已畫出」，要加一個選項，讓 mod 自己主動打開的回傳「沒畫出」，使用者主動打開的回傳「已畫出」，Pane 清單也反映這個狀態。這是擴充現有的測試接縫，不是新的接縫。

**Blocked by:** 02 — CLI 輸入框上方的「▦ 打開監看視窗」按鈕；03 — 「所有 CLI Session 都顯示」開關

**Status:** resolved

- [x] 假世界可以模擬「mod 自己打開的 Pane 沒畫出來」
- [x] 開關打開、自動打開但沒畫出來時，輸入框上方照樣有按鈕，而且不掃描
- [x] 按下按鈕後 Pane 畫出來、開始 polling、按鈕消失
- [x] 終端機變寬、引擎畫出原本等待中的 Pane 後，按鈕消失、開始 polling
- [x] Desktop 的按鈕與自動打開在 Pane 已畫出時行為不變
- [x] 五種語言的 README「限制」或「疑難排解」說明窄終端機時自動打開不會出現、可以按按鈕打開
- [x] plugin.json 版本號調高；`claude plugin test` 與 `claude plugin validate` 通過

## Comments

**完成（2026-10-16）**：在整合分支 `claude/grill-with-docs-cli-support-592d23` 的 commit `da2910c` 實作；code review 後的重構與補測試在 `f9ca260`。整合分支目前 38 個測試全過，validate 通過。

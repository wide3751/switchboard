# 02 — CLI 輸入框上方的「▦ 打開監看視窗」按鈕

**What to build:** **CLI Session** 的 **監看視窗** 關著時，輸入框上方和 Desktop 一樣出現「▦ 打開監看視窗」按鈕。按下就打開監看視窗並開始 polling，打開後按鈕消失，換回引擎自己的內容；關掉監看視窗後按鈕再出現。不管「所有 CLI Session 都顯示」開關怎麼設，這個按鈕都一律顯示（使用者明確選擇的取捨，見 ADR-0004）。規格見 `.scratch/cli-board/spec.md`。

**Blocked by:** 01 — 在 CLI 輸入 `/switchboard:open` 打開監看視窗

**Status:** resolved

- [x] 在 `terminal` 介面、監看視窗關著時，輸入框上方有「▦ 打開監看視窗」按鈕
- [x] 按下按鈕會打開 Pane 並開始 polling，之後按鈕消失、引擎自己的內容照常顯示
- [x] 關掉監看視窗後按鈕再出現
- [x] 有提問框時不顯示按鈕，和 Desktop 一樣
- [x] `vscode` 介面不顯示按鈕
- [x] 既有測試「…CLI 不顯示」改寫成 CLI 也顯示，並涵蓋按下後打開
- [x] 五種語言的 README 更新：說明 CLI 也有這個按鈕
- [x] plugin.json 版本號調高；`claude plugin test` 與 `claude plugin validate` 通過

## Comments

**完成（2026-10-16）**：在整合分支 `claude/grill-with-docs-cli-support-592d23` 的 commit `a34a8e3` 實作；code review 後的重構與補測試在 `f9ca260`。整合分支目前 38 個測試全過，validate 通過。

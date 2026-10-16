# 03 — 「所有 CLI Session 都顯示」開關

**What to build:** 檢視面板多一個勾選項「所有 CLI Session 都顯示」，預設關閉，存在 mod 的全域設定，和既有的「所有 Desktop Session 都顯示」分開控制，兩項在任何介面的檢視面板都看得到、都能切換。打開後，**CLI Session** 啟動時和每個回合結束時都會自動打開 **監看視窗**（已經開著的 Session 在下一個回合結束時補開）。使用者在某個 CLI Session 手動關掉監看視窗後，那個 Session 不再自動打開，直到再次輸入 `/switchboard:open` 或按下按鈕。Desktop 的開關只管 Desktop，不會讓 CLI 自動打開；反之亦然。規格見 `.scratch/cli-board/spec.md`。

**Blocked by:** 01 — 在 CLI 輸入 `/switchboard:open` 打開監看視窗

**Status:** resolved

- [x] 檢視面板有「所有 CLI Session 都顯示」，預設是未勾選；切換後存進全域設定，Desktop 的開關不受影響
- [x] 開關關閉時，CLI Session 啟動不會打開監看視窗、不掃描
- [x] 開關打開時，CLI Session 啟動就打開監看視窗並開始 polling
- [x] 開關打開時，已經開著的 CLI Session 在回合結束後補開
- [x] CLI Session 手動關掉監看視窗後，回合結束不再自動打開；再次輸入指令才打開
- [x] Desktop 的開關打開、CLI 的開關關閉時，CLI Session 不會自動打開；Desktop 的自動打開行為不變
- [x] 五種語言的 i18n 文字新增開關標籤
- [x] 五種語言的 README 設定表新增這一項
- [x] 既有測試「CLI Session 不會自動打開監看視窗」改寫成依開關判斷
- [x] plugin.json 版本號調高；`claude plugin test` 與 `claude plugin validate` 通過

## Comments

**完成（2026-10-16）**：在整合分支 `claude/grill-with-docs-cli-support-592d23` 的 commit `2f7e982` 實作；code review 後的重構與補測試在 `f9ca260`。整合分支目前 38 個測試全過，validate 通過。

# 07 — 打開按鈕、Pane 標題、自動打開的 toast

**What to build:**
- 打開按鈕有計數時 `▲2 待處理 · ▦ 打開`（▲2 用 warning bold 的 Text children），沒有計數時 `▦ 打開監看視窗`；`label` 寫「打開監看視窗，2 個待處理」。
- Pane 標題 `Switchboard · ▲2`。
- 手動關掉監看視窗後的 toast 寫完整路徑（監看視窗 › 設定 ▸ › 一般 › 取消「…」）。「不再自動打開」按鈕只在這個 Session 剛被手動關掉、而且自動打開開著時出現，下一次打開或回合結束後消失。

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `ux-03-count-on-open-button` 依新字序更新
- [ ] 計數失敗時仍只顯示 `▦ 打開監看視窗`

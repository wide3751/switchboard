# 10 — 第一次使用時的訊息與引導

**What to build:**

- `commands/open.md` 的 hooks 沒載入訊息寫死繁中。改成「用使用者的語言回覆」，並列出三步：確認 Claude Code 版本支援 mods → 重開 Session → `claude --debug`。
- 不在 macOS 時，`/switchboard:open` 回一句說明（跳轉不能用；Windows 沒有 `ps`）。
- 清單只有「目前這個」一列時，加一行引導：「再開其他 Session（Desktop 或終端機）就會出現在這裡；安裝前就開著的要重開」。
- 清單是 0 筆時（連自己都讀不到），不能說「沒有其他執行中的 Session」，改顯示讀不到紀錄的診斷（和 01 一致）。
- `cannotRead(dir)` 補上下一步該做什麼。
- 使用者手動按 ✕ 關掉監看視窗時，跳一個 toast，說明重開 Session 會再自動打開、要全面關掉請到設定關「所有 Desktop Session 都顯示」。
- 「檢視 ▸」改名為「設定 ▸」（五種語言）。

**Status:** ready-for-agent

- [ ] hooks 沒載入的訊息跟著使用者的語言
- [ ] 只有一列時有引導
- [ ] 手動關掉時有 toast，按鈕改名為設定

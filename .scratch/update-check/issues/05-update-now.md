# 05 — 立即更新

**What to build:** **新版提示** 上有「立即更新」按鈕。按下後，switchboard 依序跑 `claude plugin marketplace update switchboard`、`claude plugin update switchboard@switchboard`，執行中按鈕顯示「更新中…」，不能重複觸發，整體 60 秒逾時。**更新只在使用者點擊時執行，從不自動。**

- 成功：那一行改成「已更新到 X，重啟 Session 或輸入 /reload-plugins 生效」。剛裝好的版本記進 `$.store`，所有 Session 的 `⇡ 新版` 標記和提示都立刻消失，不用等下一次 **檢查更新**。目前的 Session 載入的還是舊程式，`$.plugin.root` 的版本號在重新載入前不會變，所以判斷「有沒有新版」時，要把 store 裡剛裝好的版本也算進去。
- 失敗（找不到 `claude`、任一步非零結束、逾時）：那一行改成顯示這兩個指令，讓使用者自己執行，不顯示錯誤細節。第一步失敗就不跑第二步。

終端機可以用 `tab`、`enter` 操作。規格見 `.scratch/update-check/spec.md`。

**Blocked by:** 01、03

**Status:** ready-for-agent

- [ ] world 的 `process.run` 認得這兩個指令，可以設定成功、非零結束、找不到指令、卡住
- [ ] 按下後依序跑兩個指令；沒按就從來不跑
- [ ] 執行中顯示「更新中…」，再按不會多跑一次
- [ ] 成功：顯示已更新的版本和重啟／`/reload-plugins` 的說明；這個 Session 和其他 Session 的 `⇡ 新版` 都消失
- [ ] 成功後下一次檢查更新回報的仍是同一版：不會再亮
- [ ] 找不到 `claude`：顯示兩個指令
- [ ] 第一步非零結束：不跑第二步，顯示兩個指令
- [ ] 第二步非零結束：顯示兩個指令
- [ ] 卡住超過 60 秒：放棄並顯示兩個指令
- [ ] 五種語言的 i18n 文字

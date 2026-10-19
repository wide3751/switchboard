# 01 — 監看視窗顯示新版提示

**What to build:** Session 啟動後做一次 **檢查更新**：讀 GitHub 上 main 分支 `plugin.json` 的版本號（`$.http.fetch` 讀 raw 檔），和這份 plugin 自己 `$.plugin.root` 底下 `plugin.json` 的版本比較。公布的版本嚴格大於已安裝版本時，**監看視窗** 頁首下方出現一行 **新版提示**：新版版本號，和一句「到 /plugin › Marketplaces 開啟 switchboard 的自動更新，以後就不用手動」。版本相同、較舊，或任何失敗（逾時、非 2xx、JSON 壞掉、沒有 `version`、解析不了、讀不到本機 `plugin.json`），一律當作沒有新版，畫面上什麼都不顯示，也不報錯。和「用量達 95%」的帳號提醒同時出現時，兩個都看得到。這張還不做按鈕（立即更新、這版略過見 04、05），頻率也還不限制（見 02）。規格見 `.scratch/update-check/spec.md`。

測試 seam 只用 `tests/world.ts`：補一個假的 `http.fetch`（可設定回傳的版本、失敗方式，並記錄呼叫次數和 URL），再在 plugin 目錄放已安裝的 `plugin.json`。如果測試框架沒有 `http.fetch` 事件可以攔，就在這張決定怎麼假造它。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] world 能假造 `http.fetch`（成功回版本、丟例外、非 2xx、壞 JSON、逾時），也記錄呼叫
- [ ] world 的 plugin 目錄有已安裝的 `plugin.json`
- [ ] 公布版本 > 已安裝版本：監看視窗頁首下方出現新版提示，有版本號和開啟自動更新的說明
- [ ] 公布版本 = 或 < 已安裝版本：不顯示
- [ ] 各種失敗：不顯示、不報錯、監看視窗其他部分照常
- [ ] 版本比較依 semver（例如 0.10.0 > 0.9.0）
- [ ] 和用量 ≥95% 的帳號提醒同時出現時，兩者都顯示
- [ ] 讀的 URL 是 main 上 `agens-view/.claude-plugin/plugin.json` 的 raw 檔
- [ ] 五種語言的 i18n 文字

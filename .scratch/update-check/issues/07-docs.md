# 07 — README 與使用說明

**What to build:** 讓文件反映 **檢查更新**、**新版提示**、**更新** 的實際行為，五種語言都要改（README、`docs/guide/usage.*`、`docs/guide/privacy.*`）：

- **Quick start**：裝好之後，到 `/plugin › Marketplaces` 開啟 switchboard 的自動更新。
- **監看視窗上有什麼**：加一條新版提示（立即更新、這版略過），打開按鈕的 `↑ 新版`。
- **設定**：一般設定加「檢查更新」，預設開啟。
- **隱私與安全**：「`gh pr view` 是唯一會連上網路的指令」改成兩項。新的一項寫明每小時最多讀一次 GitHub 上公開的 `plugin.json`，不帶任何本機資料，可以在設定裡關掉，也可以用 `DISABLE_UPDATES`、`DISABLE_AUTOUPDATER`、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` 停用。「它會跑什麼指令」加上使用者點「立即更新」時才會跑的 `claude plugin …`。

這張只改文件，依 `docs/agents/versioning.md` 不調版本號。整個功能合併進 main 的 PR 跳 minor。規格見 `.scratch/update-check/spec.md`。

**Blocked by:** 01、02、03、04、05、06

**Status:** ready-for-agent

- [ ] 五種語言的 README：Quick start、監看視窗上有什麼、設定、隱私與安全
- [ ] 五種語言的 `docs/guide/usage.*`
- [ ] 五種語言的 `docs/guide/privacy.*`
- [ ] 文件裡寫的文字、預設值、指令和實作一致

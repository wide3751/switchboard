# 06 — 檢查更新開關與環境變數

**What to build:** **設定 ▸ › 一般** 新增「檢查更新」開關，預設開啟，和其他設定一樣存在共用的設定裡、所有 Session 共用。關掉時，switchboard 不連網，原本顯示的 **新版提示** 和打開按鈕上的 `⇡ 新版` 也一起消失；再打開，下一次判斷時照常檢查。環境變數 `DISABLE_UPDATES`、`DISABLE_AUTOUPDATER`、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` 任一有值時，同樣不連網、不顯示，不管設定開關是什麼。精簡／標準／詳細這些卡片預設組不受影響。規格見 `.scratch/update-check/spec.md`。

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] 一般設定裡有「檢查更新」，預設勾選
- [ ] 舊的設定沒有這一項時，當作開啟
- [ ] 關掉：不連網；已經顯示的提示和按鈕標記消失
- [ ] 重新打開：下一次判斷時照常檢查
- [ ] 三個環境變數各自都能停用，而且不連網
- [ ] 卡片內容的預設組判定不受新設定影響
- [ ] 五種語言的 i18n 文字

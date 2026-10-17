# 11 — README 與示意圖

**What to build:**
- 五種語言的 README 依新介面改寫：「待處理」用詞（zh-TW、zh-CN）、頁首、卡片、設定面板、鍵盤表、疑難排解錨點（04 的 Link 指向這裡）。
- `assets/board/render.mjs` 的 Desktop 版和終端機版共用同一份樣本、版面順序和 i18n 字串，拿掉程式沒有的淡橘底色，重新產生 10 張圖。補一張狀態總覽圖（出錯中止、看不到狀態、沒有在等你、展開明細）。
- PR 檢查清單加一條「動到 i18n.ts、LOOK、GLYPHS 或卡片版面時要重新產生 assets/board」。

**Blocked by:** 02–10

**Status:** ready-for-agent

- [ ] 五種 README 與新介面一致
- [ ] 10 張示意圖重新產生

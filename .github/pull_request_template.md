## 做了什麼

<!-- 一兩句話說明改了什麼、為什麼。有對應的 ticket 或 issue 就附上。 -->

## 檢查清單

- [ ] `claude plugin test agens-view` 和 `claude plugin validate agens-view` 都通過
- [ ] 使用者看得到的文字五種語言都加進 `agens-view/hooks/i18n.ts`
- [ ] 行為或介面改了：五種語言的 README 跟著改
- [ ] 動到 `i18n.ts`、`LOOK`、`GLYPHS` 或卡片版面時，`assets/board/render.mjs` 跟著改，並重新產生 `assets/board` 的圖：
      `node assets/board/render.mjs . <輸出資料夾>`，再 `node assets/board/shot.mjs <輸出資料夾> assets/board`
- [ ] 用語和決策和 `GLOSSARY.md`、`docs/adr/` 一致（要改決策就同步改那裡）
- [ ] 版本號照 `docs/agents/versioning.md`：合併前的最後一個 commit 調一次；只改 README、`docs/`、`.scratch/`、測試的 PR 不調

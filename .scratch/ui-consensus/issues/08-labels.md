# 08 — 只有符號的控件補上 label

**What to build:** 展開鈕（「顯示明細：{標題}」）、PR（「打開 PR #12（已合併）」）、閒置收合、窄版 ✦、打開按鈕、☑/☐ 都傳 `label`。畫面不變。

**Blocked by:** 05, 06, 07

**Status:** resolved

- [x] 測試檢查只有符號的 Button 都帶 label

## Comments

- 新增 `Messages.labels`（五種語言）：`expand(title, isOpen)`、`pr(n, state)`、`idle(n, isCollapsed)`、`autoOpen(option, isOn)`。放在各語言物件最後，避開別張 ticket 常改的區塊。
- 展開鈕：`顯示明細：{標題}`／`收起明細：{標題}`，用完整的 `card.title`，不用畫面上截短後的標題。
- PR：`打開 PR #12（開啟中／已合併／已關閉）`。已關閉的 PR 仍可點開頁面，所以照樣給 label。
- 閒置收合（04 留下的）：`收合閒置的 3 個 Session`／`展開閒置的 3 個 Session`，寫按下會做什麼。
- ☑/☐：自動打開的兩個改成帶標題當上下文，`自動打開監看視窗（Desktop Session）：已開啟`；`ui-06-settings-panel` 的斷言依此更新。欄位的 ☑/☐ 照舊是 `時間：已開啟`（列在「卡片內容 · 分區」底下，名稱本身就夠清楚）。
- 打開按鈕：有計數時本來就是完整的一句（07）。沒有計數時原本 label 是 `▦ 打開監看視窗`，改成不帶 ▦ 的 `打開監看視窗`，畫面文字改由 children 畫，維持 `▦ 打開監看視窗`。
- ✦（`current-*`）：是 Text 不是 Button，沒有 label 屬性，依 07-decisions 第 6 點記為不適用。
- 沒動「前往處理」（`go-button-*`），留給 10。「設定 ▸」、標題、作者連結、語言／計費／分區／密度、完成這些按鈕的 children 本身就有文字，引擎自動拿來當 label，沒另外給。
- 測試：`agens-view/tests/ui-08-labels.test.ts`。通用檢查是「監看視窗裡每個 Button 的 label 至少有一個字母或漢字」（`\p{L}`），因為沒給 label 時引擎會拿 children 當 label（例如 `▸`、`#12 ↗`），只看有沒有 label 會漏掉。另外逐一檢查各 label 的字串、截短標題時 label 仍是全文、五種語言的 labels 函式。
- 真機上看不看得到 label（滑過提示、VoiceOver）已列進 12。ja、ko 的 label 用詞是自己寫的，請母語者一併確認。

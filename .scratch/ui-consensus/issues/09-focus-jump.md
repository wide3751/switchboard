# 09 — 焦點跳轉的 10 秒規則

**What to build:** 取代 `ux-review/08`。記下同一個 Pane 上一次 `ui.focus` 的時間（任何 element 都算）：間隔少於 10 秒視為 Tab 瀏覽，不跳轉；超過 10 秒或第一次取得焦點才跳轉；Enter／按下一律跳轉。README 鍵盤表寫明這個例外，並提示數字快捷鍵（10）。

**Status:** resolved

- [x] 測試：連續焦點不跳、第一次焦點跳、press 一律跳
- [x] ADR-0004 Consequences 關於焦點跳轉的那一條更新
- [x] 真機確認列入 12

## Comments

- 實作在 `agens-view/hooks/register.tsx` 的 `ui.focus` hook 與 `jump()`；測試在 `agens-view/tests/ui-09-focus-jump.test.ts`。
- 「上一次焦點」只看監看視窗這個 Pane（requestId），任何元素都算，包括引擎自己的關閉鈕（沒有 `element`），也不分 origin（plugin 的 autoFocus 也算）。間隔剛好 10 秒算「超過」，會跳轉。焦點移動失敗（`next(e)` 回了原因）也照樣記時間。
- 取捨：保留 1.5 秒防重複，但只防「同一下點擊同時觸發焦點跳轉和按下」：焦點跳轉前後 1.5 秒內，同一張卡片只跳一次；單純的按下（前面沒有焦點跳轉）每次都跳，連按兩下會跳兩次。所以「Enter／按下一律跳轉」有這一個例外：焦點剛跳轉完馬上按同一張卡片，不會再跳。既有測試「緊接著的第二下按下不會再跳一次」（needs-you-count）因此不用改。已列進 12 的真機確認。
- 維持只限 Desktop（`surfaces.includes('desktop')`）：終端機的焦點移動仍然不跳。同時在 Desktop 和終端機畫的 Session，在終端機第一次移動焦點（或隔 10 秒以上）仍會跳轉，ADR-0004 已寫明。
- README 只改五種語言的鍵盤表：Tab 那一列寫明 Desktop 的例外、Enter 一律跳轉，並新增 `1`–`9` 數字快捷鍵那一列。數字快捷鍵是 ticket 10 的功能，這裡先寫進表格；10 合併前 README 會領先程式。
- `.scratch/ux-review/issues/08-desktop-tab-focus.md` 改成 wontfix（superseded by ui-consensus/09），`ux-review/spec.md` 表格同步。

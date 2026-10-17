# 07 — 打開按鈕、Pane 標題、自動打開的 toast

**What to build:**
- 打開按鈕有計數時 `▲2 待處理 · ▦ 打開`（▲2 用 warning bold 的 Text children），沒有計數時 `▦ 打開監看視窗`；`label` 寫「打開監看視窗，2 個待處理」。
- Pane 標題 `Switchboard · ▲2`。
- 手動關掉監看視窗後的 toast 寫完整路徑（監看視窗 › 設定 ▸ › 一般 › 取消「…」）。「不再自動打開」按鈕只在這個 Session 剛被手動關掉、而且自動打開開著時出現，下一次打開或回合結束後消失。

**Blocked by:** 02

**Status:** resolved

- [x] `ux-03-count-on-open-button` 依新字序更新
- [x] 計數失敗時仍只顯示 `▦ 打開監看視窗`

## Comments

- 打開按鈕在 `agens-view/hooks/register.tsx` 的 AbovePrompt render；Pane 標題是 `titleOf`。i18n 的 `band` 拿掉 `openWaiting`，改成 `need(n)`、`openShort`、`label(n)`、`never`（五種語言）。en 的 `need` 分單複數（`▲1 needs you`），ko 的按鈕上省略「개」（`▲1 확인 필요`），label 裡保留。
- 計數為 null（掃描失敗）或 0 時只有 `▦ 打開監看視窗`，label 同文字；`ux-03` 的失敗案例原樣通過。
- toast：`toast.closed(path, setting)`，由 register.tsx 組出 `設定 ▸ › 一般` 和 `自動打開監看視窗 › Desktop Session`（CLI 是 `CLI Session`），「監看視窗 ›」和「取消「…」」的動詞寫在各語言的字串裡。zh-TW 全文：`已關閉監看視窗。重開 Session 時會再自動打開。要全面關掉：監看視窗 › 設定 ▸ › 一般 › 取消「自動打開監看視窗 › Desktop Session」`。
- 為了不和 06 在 i18n 衝突，先在 `Messages.panel` 新增 `general`、`autoOpenTitle`、`autoOpenDesktop`、`autoOpenTerminal`（五種語言），toast 已經在用；設定面板本身沒改，還是舊的 `autoOpen`、`autoOpenCli`（「所有 … Session 都顯示」）。CLI 選項的鍵叫 `autoOpenTerminal`，因為 `autoOpenCli` 已經是舊的開關名稱；06 改版面板時用這四個鍵，可以順便拿掉舊的兩個。**06 合併前，toast 寫的路徑（一般 › 自動打開監看視窗 › …）和面板上的實際文字對不上。**
- 「不再自動打開」：toast 放不了按鈕，畫在輸入框上方、打開按鈕右邊（key `stop-auto-open`）。狀態是新 atom `offersStopAutoOpen`（宣告在 `types/index.d.ts`）：`closedByPerson` 跳 toast 時設成 true；`openBoard`（按鈕、指令、自動打開都經過）、主 agent 的 turn.complete、按下時清掉。畫的時候再讀一次 store 確認開關還開著（別的 Session 可能已經關了）。按下是「寫成關」而不是切換，寫之前先 `syncView`，免得蓋掉別的 Session 剛改的設定。
- 看哪個開關（Desktop 或 CLI）依 Session 的介面（`boardSurfaceOf`），和 toast 一致，不看 band 畫在哪個 surface。
- 新測試：`agens-view/tests/ui-07-stop-auto-open.test.ts`（出現、按下關掉對應的開關、自動打開關著時不出現、沒被手動關掉不出現、回合結束後消失、下一次打開後消失）。
- 沒做到：按下「不再自動打開」之後沒有額外的確認 toast；是否需要留給 12 實機看。真機確認的項目已加進 12。

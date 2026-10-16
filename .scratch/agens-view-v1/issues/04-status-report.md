# 04: 狀態回報與細分狀態

**What to build:** 每個 Session 的 mod 利用自己的 hook 事件，維護並寫出這個 Session 的 **狀態回報**（見 ADR-0002）。清單和等你計數因此能分辨 **待核准**、**待回答**、**出錯中止**，並在每一列顯示 **最後訊息摘要**；**待核准** 時改成顯示 **核准請求摘要**。

**Blocked by:** 02, 03

**Status:** in-progress（部分完成）

- [x] 權限請求 → 待核准，列上顯示核准請求摘要（例如它想執行的指令）
- [x] 選項卡或 elicitation → 待回答
- [x] 回合因錯誤失敗 → 出錯中止，計入等你計數；session 紀錄隨後變成 idle 也不會解除，要等使用者送出新的 prompt
- [ ] 判定邏輯以狀態模型原型（`.scratch/agens-view-v1/PROTOTYPE-status-model.html` 裡的 `StatusModel`）為起點
- [x] 使用者自己中斷的回合 → 閒置
- [x] 回合結束時用文字提問（沒有選項卡）→ 閒置，但顯示最後訊息摘要
- [ ] 狀態回報和 session 紀錄不一致時，以時間較新的為準；例如核准之後，幾秒內回到工作中，而且不再顯示舊的核准請求摘要
- [x] 狀態回報中的細節，只在它的狀態和最終判定一致時才顯示
- [ ] pid 已死的 Session，殘留的狀態回報會被刪除，不會讓它繼續出現
- [x] 沒有狀態回報的 Session（例如沒載入 mod 的）仍然以基本狀態列出
- [ ] 狀態回報裡記錄跳轉需要的來源資訊（終端機種類、tty、Desktop host session id，依 02 的實測結果決定取得方式）

## Comments

**2026-10-15 狀態模型原型的結論**（`.scratch/agens-view-v1/PROTOTYPE-status-model.html`）

要回答的問題：「時間較新的為準 + 細節只在一致時顯示 + 只在轉進時通知」這套合併規則，在真實的事件順序下會不會判錯？

- 發現：回合失敗時，mod 先收到 StopFailure 寫下出錯中止，session 紀錄稍晚才變成 idle，依「時間較新的為準」，出錯中止只會存在約 1 秒。決議：出錯中止遇到 session 紀錄為 idle 時一律保留，直到下一個 hook 事件（例如送出 prompt）。已寫進 spec 和 CONTEXT.md。
- 其他 6 個情境（權限提示到核准、待核准轉待回答、Esc 中斷、文字提問、Session 當掉、沒載入 mod）的行為都符合 spec。
- 原型裡的 `StatusModel`（reportReducer、resolve、board）已經包含上述決議，可以直接當作實作起點。

**2026-10-16 進度（agent）**

狀態回報已實作（`agens-view/hooks/register.tsx` 的回報者），每個 Session 寫到 `<Claude 設定目錄>/switchboard/reports/<sessionId>.json`，內容：模型、分支與同步狀態、未 commit 行數、待辦進度、目前動作、回合開始時間、Context、花費、回合數、rate limit、核准請求摘要、選項卡問題、出錯原因、最後回覆、背景任務。

- 待核准：攔 `tool.check`，引擎判定 `ask` 時記下動作摘要；工具結束或回合結束時清掉。卡片只在 session 紀錄為 waiting 時顯示摘要，所以核准之後舊摘要不會殘留。
- 待回答：只處理 AskUserQuestion（記下第一題與選項）；elicitation 還沒處理。
- 出錯中止：`turn.complete` 的 reason 為 `error` 時記下原因；session 紀錄不是 busy／waiting 時判定為出錯中止並計入等你計數；下一個 `turn.start` 清掉。使用者中斷（reason `aborted`）不算。
- 文字提問：維持閒置，顯示最後回覆。
- 沒有回報的 Session 照樣以基本狀態列出，標示「基本狀態」。

尚未完成或與 spec 不同：
- 判定沒有直接沿用原型的 `StatusModel`，而是以 session 紀錄為主、回報只補細節與出錯中止；「時間較新的為準」只在出錯中止這一條上生效。之後若要完整依原型，需要重整。
- pid 已死的殘留回報沒有刪除（mod 的 `$.fs` 沒有刪除檔案的 API），只是彙整時忽略。
- 來源資訊：Desktop 用 session 紀錄的 `hostSessionId`；終端機種類與 tty 還沒有（等 02 第 2 題）。
- 回報者端（權限請求、選項卡、出錯、背景 Bash 完成通知）只有監看視窗側的自動測試，尚未在真實 Session 觸發驗證。

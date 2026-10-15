# 04: 狀態回報與細分狀態

**What to build:** 每個 Session 的 mod 利用自己的 hook 事件，維護並寫出這個 Session 的 **狀態回報**（見 ADR-0002）。清單和等你計數因此能分辨 **待核准**、**待回答**、**出錯中止**，並在每一列顯示 **最後訊息摘要**；**待核准** 時改成顯示 **核准請求摘要**。

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] 權限請求 → 待核准，列上顯示核准請求摘要（例如它想執行的指令）
- [ ] 選項卡或 elicitation → 待回答
- [ ] 回合因錯誤失敗 → 出錯中止，計入等你計數；session 紀錄隨後變成 idle 也不會解除，要等使用者送出新的 prompt
- [ ] 判定邏輯以狀態模型原型（`.scratch/agens-view-v1/PROTOTYPE-status-model.html` 裡的 `StatusModel`）為起點
- [ ] 使用者自己中斷的回合 → 閒置
- [ ] 回合結束時用文字提問（沒有選項卡）→ 閒置，但顯示最後訊息摘要
- [ ] 狀態回報和 session 紀錄不一致時，以時間較新的為準；例如核准之後，幾秒內回到工作中，而且不再顯示舊的核准請求摘要
- [ ] 狀態回報中的細節，只在它的狀態和最終判定一致時才顯示
- [ ] pid 已死的 Session，殘留的狀態回報會被刪除，不會讓它繼續出現
- [ ] 沒有狀態回報的 Session（例如沒載入 mod 的）仍然以基本狀態列出
- [ ] 狀態回報裡記錄跳轉需要的來源資訊（終端機種類、tty、Desktop host session id，依 02 的實測結果決定取得方式）

## Comments

**2026-10-15 狀態模型原型的結論**（`.scratch/agens-view-v1/PROTOTYPE-status-model.html`）

要回答的問題：「時間較新的為準 + 細節只在一致時顯示 + 只在轉進時通知」這套合併規則，在真實的事件順序下會不會判錯？

- 發現：回合失敗時，mod 先收到 StopFailure 寫下出錯中止，session 紀錄稍晚才變成 idle，依「時間較新的為準」，出錯中止只會存在約 1 秒。決議：出錯中止遇到 session 紀錄為 idle 時一律保留，直到下一個 hook 事件（例如送出 prompt）。已寫進 spec 和 CONTEXT.md。
- 其他 6 個情境（權限提示到核准、待核准轉待回答、Esc 中斷、文字提問、Session 當掉、沒載入 mod）的行為都符合 spec。
- 原型裡的 `StatusModel`（reportReducer、resolve、board）已經包含上述決議，可以直接當作實作起點。

# 05: 需要你處理通知

**What to build:** Session 從其他狀態轉進 **需要你處理**（待核准、待回答、出錯中止）的那一刻，由這個 Session 自己的 mod 發一次 macOS 通知（**需要你處理通知**），內容寫明是哪個 Session、為什麼需要使用者。不管開了幾個 Session，同一次轉換只會有一則通知。

**Blocked by:** 02, 04

**Status:** ready-for-agent

- [ ] 從工作中或閒置轉進需要你處理時，發一次通知
- [ ] 在需要你處理的子狀態之間切換（例如待核准轉成待回答）時不重複通知
- [ ] 轉成閒置不發通知
- [ ] 通知內容包含 Session 標題和原因（待核准、待回答、出錯中止）
- [ ] 多個 Session 同時開著時，同一次轉換只有一則通知（只由該 Session 自己發）
- [ ] 依 02 的實測結果，記錄是否和 Desktop app 或 cc-status 的通知重複，以及給使用者的建議

## Comments

**2026-10-15 狀態模型原型的結論**：已確認「待核准轉待回答」這類需要你處理之間的切換不會重複通知；沒載入 mod 的 Session 不會發通知，這點已決議接受（spec 的 Out of Scope 有記錄）。判定通知的邏輯見原型 `StatusModel.reportReducer`。

# 08 — Desktop 用 Tab 移動焦點不能直接跳走

**What to build:** `ui.focus` 只要落在卡片標題就跳轉（`register.tsx:724-743`），是為了讓 Desktop「第一下點擊就跳」。副作用是鍵盤使用者 Tab 到第一張卡片就被帶走，到不了其他卡片和按鈕。改成只在焦點從 Pane 外直接落到標題時跳轉；焦點從 Pane 內其他元素移過來（Tab、方向鍵）時不跳。若引擎的 origin 能分辨滑鼠和鍵盤，直接用那個判斷。

需要在真的 Desktop app 上實測焦點事件的順序，所以標成 ready-for-human。

**Status:** ready-for-human

- [ ] 實測 Desktop 上滑鼠點擊與 Tab 的 ui.focus 事件差異，記在 Comments
- [ ] 用 Tab 能走過所有卡片與按鈕，不會跳走
- [ ] 第一下點擊標題仍然直接跳轉
- [ ] 更新 ADR-0004 Consequences 裡關於焦點跳轉的那一條

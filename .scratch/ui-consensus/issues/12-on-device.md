# 12 — 實機確認

**What to build:** 在真的 Desktop app 和 iTerm／Terminal.app 上確認，結果記在 Comments：
- `subtle` 色在淺色、深色主題的對比
- claude 橘的 ◉ 和 warning 外框在兩種主題下分不分得開
- CJK 在真實終端機能不能畫粗體
- 終端機 `Select` 展開後的高度（決定 06 終端機要不要改用 Select）
- 09 的焦點規則：滑鼠第一下點擊仍然跳轉、Tab 能走完所有卡片；一下點擊不會跳兩次（焦點跳轉後 1.5 秒內同一張卡片的按下不再跳）；連按兩下標題會跳兩次
- 07 的打開按鈕：▲2 的 warning 粗體在 band 裡畫得出來；手動關掉後「不再自動打開」排在打開按鈕右邊，終端機寬度不夠時怎麼換行；VoiceOver 念的是 label（「打開監看視窗，2 個待處理」）
- ja「待機中」、ko「유휴」請母語者確認不會讀成「在等你」

**Blocked by:** 04–10

**Status:** ready-for-human

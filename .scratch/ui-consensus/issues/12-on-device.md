# 12 — 實機確認

**What to build:** 在真的 Desktop app 和 iTerm／Terminal.app 上確認，結果記在 Comments：
- `subtle` 色在淺色、深色主題的對比
- claude 橘的 ◉ 和 warning 外框在兩種主題下分不分得開
- CJK 在真實終端機能不能畫粗體
- 終端機 `Select` 展開後的高度（決定 06 終端機要不要改用 Select）
- 09 的焦點規則：滑鼠第一下點擊仍然跳轉、Tab 能走完所有卡片；一下點擊不會跳兩次（焦點跳轉後 1.5 秒內同一張卡片的按下不再跳）；連按兩下標題會跳兩次
- 07 的打開按鈕：▲2 的 warning 粗體在 band 裡畫得出來；手動關掉後「不再自動打開」排在打開按鈕右邊，終端機寬度不夠時怎麼換行；VoiceOver 念的是 label（「打開監看視窗，2 個待處理」）
- 08 的 label：Desktop 滑過展開鈕、PR、閒置標題、☑/☐ 時看得到 label 提示（或 VoiceOver 念 label，不念 ▸、#12 ↗）；ja、ko 的 label 用詞請母語者一併確認
- 10 的凍結與快捷鍵：焦點進出 Pane（點擊、ctrl+x tab、Esc）時引擎會不會重畫，焦點在時卡片真的不動、離開後才重排；終端機和 Desktop 按 1–9 會按到對應的「前往處理」（終端機的 secondary 按鈕不畫 hotkey，數字是 plugin 自己畫的 dim 字）；Desktop 數字後面的 en space 寬度夠不夠
- ja「待機中」、ko「유휴」請母語者確認不會讀成「在等你」
- 11 的示意圖：`assets/board/render.mjs` 假設 Desktop 的 xs／sm／md 是 4／8／12px、Pane 約 56 格；和實機比對間距、「前往處理」換不換行，差很多就改 render.mjs 的 `PX` 再重新產生圖

**Blocked by:** 04–10

**Status:** ready-for-human

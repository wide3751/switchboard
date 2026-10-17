# 09 — 焦點跳轉的 10 秒規則

**What to build:** 取代 `ux-review/08`。記下同一個 Pane 上一次 `ui.focus` 的時間（任何 element 都算）：間隔少於 10 秒視為 Tab 瀏覽，不跳轉；超過 10 秒或第一次取得焦點才跳轉；Enter／按下一律跳轉。README 鍵盤表寫明這個例外，並提示數字快捷鍵（10）。

**Status:** ready-for-agent

- [ ] 測試：連續焦點不跳、第一次焦點跳、press 一律跳
- [ ] ADR-0004 Consequences 關於焦點跳轉的那一條更新
- [ ] 真機確認列入 12

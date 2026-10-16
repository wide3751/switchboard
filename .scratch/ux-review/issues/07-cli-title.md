# 07 — CLI Session 的標題用第一句 prompt，同名時看得出差別

**What to build:** `board.ts:387` 的標題是 `one.name ?? folder`，同一個 repo 開三個 Session，三列同名。`GLOSSARY.md` 的 **Session 標題** 承諾用第一句 prompt，沒有實作。

- Session 在自己的第一個 `turn.start` 把 prompt 截約 40 字（經 05 的遮罩）寫進回報，例如叫 `topic`。標題改成 `name ?? topic ?? folder`。
- 來源（Desktop／iTerm／Terminal.app／VS Code）改成標題前一格的符號，預設一律顯示（目前只在「詳細」密度出現，`board.ts:293-300`）。
- 標題相同的幾列自動補上分支名或 `#2`。
- worktree 的標題去掉隨機名稱和 hash（重用 `locationOf`）。
- 窄的時候「目前這個」改用一格寬的標記，不拿掉（`register.tsx:868-869`）。

**Blocked by:** 05（topic 也要遮罩，隱私段要提到它）

**Status:** ready-for-agent

- [ ] 沒有 /rename 的 CLI Session 以第一句 prompt 當標題
- [ ] 來源符號在各密度都顯示
- [ ] 同名的列看得出差別
- [ ] 窄版面仍看得出哪一列是目前這個

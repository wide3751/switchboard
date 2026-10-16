# 07 — CLI Session 的標題用第一句 prompt，同名時看得出差別

**What to build:** `board.ts:387` 的標題是 `one.name ?? folder`，同一個 repo 開三個 Session，三列同名。`GLOSSARY.md` 的 **Session 標題** 承諾用第一句 prompt，沒有實作。

- Session 在自己的第一個 `turn.start` 把 prompt 截約 40 字（經 05 的遮罩）寫進回報，例如叫 `topic`。標題改成 `name ?? topic ?? folder`。
- 來源（Desktop／iTerm／Terminal.app／VS Code）改成標題前一格的符號，預設一律顯示（目前只在「詳細」密度出現，`board.ts:293-300`）。
- 標題相同的幾列自動補上分支名或 `#2`。
- worktree 的標題去掉隨機名稱和 hash（重用 `locationOf`）。
- 窄的時候「目前這個」改用一格寬的標記，不拿掉（`register.tsx:868-869`）。

**Blocked by:** 05（topic 也要遮罩，隱私段要提到它）

**Status:** resolved

- [x] 沒有 /rename 的 CLI Session 以第一句 prompt 當標題
- [x] 來源符號在各密度都顯示
- [x] 同名的列看得出差別
- [x] 窄版面仍看得出哪一列是目前這個

## Comments

- 實作：主迴圈第一個有文字的 `turn.start` 把 prompt 經 `maskSecrets`、合併空白後截成 40 字，寫進回報的 `topic`；和 02 一樣放在回合開始那次只寫狀態欄位的寫入裡，不等 git、gh。標題是 `name ?? topic ?? locationOf(cwd)`（worktree 用 repo 名稱）。
- 來源符號：`◧` Desktop、`✎` VS Code、`❯` 其他終端機（`board.ts` 的 `sourceMark`），在標題前一格，不受欄位設定影響。「來源」欄位的文字名稱仍只在「詳細」密度和展開明細出現，當作符號的說明；沒改密度預設，免得已存的檢視設定變成「自訂」。
- 同名：分支不全相同時補 ` · <分支>`（去掉 `claude/` 與 hash），仍同名的依 Session 開始時間補 ` #2`、` #3`，不隨排序跳動。
- 窄版面：「目前」放不下時換成 `✦`，不拿掉。
- README 改動（標題說明、來源欄位、隱私段加上 topic）寫在 scratchpad 的 `ux-notes/readme-07.md`，交給 09。
- 已知限制：mod 熱重載後回報從頭開始，主題會變成重載後的下一句 prompt；一般新開的 Session 不受影響。

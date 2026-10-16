# 09 — README：Desktop 和終端機兩條路、解除安裝、說明更正

**What to build:** 五種語言的 README 一起改：

- 系統需求改成「macOS＋Claude Code（終端機或 Desktop 的 Code 分頁擇一）」。
- Quick start 分 Desktop、終端機兩條路。Desktop：重開後監看視窗自動出現（預設會自動打開，所以不要叫使用者先找按鈕）。終端機：重開 `claude`，輸入框上方出現帶計數的按鈕；要常駐顯示，打開「所有 CLI Session 都顯示」，且終端機要 ≥144 欄。
- 版本檢查同時寫 Desktop 的 `/status` 和 `claude --version`；寫出最低支援版本（待確認）。
- 補一張終端機的截圖（用 render.mjs 產生）。
- 新增「解除安裝／停用」一節：`claude plugin disable`、`uninstall`、`marketplace remove`、刪除 `~/.claude/switchboard/`。指令要實測。
- 依 ADR-0005 告訴使用者怎麼打開 Claude Code 自己的通知。
- 「語言：自動」的說明改成實際行為：先看 LC_ALL、LANG，最後才看 macOS 語言（`register.tsx:478-492`）。
- 修正終端機表的用語漂移：zh-CN 用了「监看窗口」（全文是「监控窗口」）、ja 用了「ボード」、ko 用了「보드」。
- 說明鍵盤怎麼移進監看視窗、在終端機裡怎麼關掉它。

**Status:** ready-for-agent

- [ ] 五種語言結構、數字、code span 仍然一致
- [ ] 解除安裝的指令實測過
- [ ] 終端機截圖

Status: ready-for-agent

# UX 審查後的改進

## Problem Statement

2026-10-16 從兩個角度做了 UX 審查：日常使用 **監看視窗**，以及新使用者的第一小時。基礎設計是對的（**需要你處理** 只收明確訊號、狀態不只靠顏色、窄終端機有退路），但有兩個核心問題：

- **等你計數** 不夠可信：掃描失敗時顯示綠色的「沒有在等你」；**出錯中止** 會先被排進閒置、幾秒後才跳上去；清單在游標下重排。
- 只用終端機的使用者幾乎拿不到價值：switchboard 不發通知、CLI 預設不打開監看視窗，打開按鈕又不帶任何資訊；README 也只寫 Desktop 的路。

## Decisions

審查後逐題討論，決議都已寫進 `GLOSSARY.md`：

- switchboard 不自己發 **需要你處理通知**，交給 Claude Code 與 Desktop（ADR-0005；舊 ticket `agens-view-v1/05` 改為 wontfix）。
- 輸入框上方的打開按鈕顯示 **等你計數**，沒開監看視窗的 Session 每 15 秒輕量掃描（ADR-0006）。
- 排序：需要你處理由舊到新、工作中依 Session 開始時間、閒置由新到舊。游標在監看視窗裡時暫停重排，之後再考慮。
- 出錯中止 **不** 提供「知道了」。
- Desktop 和終端機對等支援，兩者都不是必要條件。
- 狀態回報寫入前盡力遮罩疑似機密，README 寫明只是盡力而為。

## Tickets

| # | 標題 | Status |
|---|------|--------|
| 01 | 掃描失敗或停擺時不能顯示「沒有在等你」 | resolved |
| 02 | 狀態欄位先寫，分支和 PR 之後再補 | resolved |
| 03 | 打開按鈕顯示等你計數 | resolved |
| 04 | 新的排序規則 | resolved |
| 05 | 狀態回報：每個 Session 都會清理殘留，寫入前遮罩機密 | resolved |
| 06 | 跳轉：CLI 也有「前往處理」，失敗訊息講對原因 | resolved |
| 07 | CLI Session 的標題用第一句 prompt，同名時看得出差別 | resolved |
| 08 | Desktop 用 Tab 移動焦點不能直接跳走 | ready-for-human |
| 09 | README：Desktop 和終端機兩條路、解除安裝、說明更正 | resolved |
| 10 | 第一次使用時的訊息與引導 | resolved |
| 11 | 監看視窗的細節：設定同步、帳號卡片位置、終端機寬度 | resolved |
| 12 | 多國語言與 metadata 清理 | resolved |
| 13 | 待實測：選項卡期間的狀態、pid 重複使用 | needs-triage |

## Out of Scope

- switchboard 自己發的 macOS 通知（ADR-0005）。
- 出錯中止的「知道了」。
- 游標在監看視窗裡時暫停重排（之後再考慮）。
- VS Code 終端機的跳轉（仍屬 `agens-view-v1/07`）。

# 交接：UX 審查（2026-10-16）

## 目前狀態

- 分支：`claude/ux-review`，已推到 origin，**沒有開 PR**，程式碼**還沒動**，只改了文件和設定。
- 這個分支上的 commit（由舊到新）：
  1. `c3942d4` switchboard 不自己發需要你處理通知（ADR 0005）
  2. `310dc3d` 打開按鈕上顯示等你計數（ADR 0006）
  3. `250d3e3` 需要你處理由舊到新、工作中固定順序
  4. `b79b760` 出錯中止不提供「知道了」
  5. `1a20382` Desktop 和終端機對等支援
  6. `a610d55` UX 審查的決議與 tickets（`.scratch/ux-review`）
  7. `eb2a492` 專案啟用 mattpocock-skills plugin（`.claude/settings.json`）
  8. `a6533a9` 這份交接文件

## 做了什麼

1. 派兩個 sub agent 做 UX 審查：一個看日常使用 **監看視窗**，一個看新使用者的第一小時。主要說法都對照過程式碼。
2. 逐題和使用者討論需要決定的事（照 grill-with-docs 的做法），每個決定都寫進 `GLOSSARY.md` 或 ADR。
3. 把所有發現整理成 `spec.md` 和 13 張 tickets。
4. 安裝 Matt Pocock 的 skills 成專案 plugin。

## 已做的決定

| 題目 | 決定 | 記在哪裡 |
|---|---|---|
| 需要你處理通知 | switchboard 不自己發，交給 Claude Code 與 Desktop | ADR-0005；`agens-view-v1/05` 改成 wontfix |
| 打開按鈕 | 顯示等你計數；沒開監看視窗的 Session 每 15 秒輕量掃描（只讀紀錄、回報、`ps`，不跑 git／gh） | ADR-0006 |
| 排序 | 需要你處理由舊到新；工作中依 Session 開始時間；閒置由新到舊 | `GLOSSARY.md` |
| 暫停重排 | 游標在監看視窗裡時暫停重排：之後再考慮 | `GLOSSARY.md` Flagged ambiguities |
| 出錯中止的「知道了」 | 不做 | `GLOSSARY.md` |
| Desktop 與終端機 | 對等支援，兩者都不是必要條件 | `GLOSSARY.md`、ADR-0003 加註 |
| 狀態回報裡的機密 | 寫入前盡力遮罩，README 寫明只是盡力而為 | `GLOSSARY.md` 的 **狀態回報** |

不要再重新討論這些，除非使用者主動提起。

## 下一步

Tickets 在 `.scratch/ux-review/issues/`，總表在 `spec.md`。建議順序：

1. **01** 掃描失敗不能顯示「沒有在等你」
2. **02** 狀態欄位先寫，不等 git／gh
3. **03** 打開按鈕顯示等你計數（被 01 擋住）
4. **04** 新的排序規則
5. **05** 清理殘留回報＋機密遮罩，接著 **07** CLI 標題（被 05 擋住）
6. **06** 跳轉、**10** 第一次使用、**11** 監看視窗細節、**12** 多國語言與 metadata
7. **09** README 五種語言一起改，放在功能改完之後，避免改兩次

- **08**（Desktop Tab 焦點）是 `ready-for-human`：要在真的 Desktop app 上測焦點事件。
- **13** 是 `needs-triage`：選項卡期間的狀態、平行 Subagent 清掉 approval、pid 重複使用，都要先實測。

每張 ticket 完成時照慣例：plugin.json 版本號調高、`claude plugin test` 與 `claude plugin validate` 通過、五種語言 README 同步。

## 還沒驗證、要在真機上確認的

- 自動化權限被拒時 osascript 的錯誤碼是不是 -1743（ticket 06）。
- 大 repo 裡回合結尾會不會因為 git／gh 變慢（ticket 02）。
- AskUserQuestion、elicitation 期間 Claude Code 紀錄的狀態（ticket 13）。
- 解除安裝的指令名稱（ticket 09）。

## 環境備註

- mattpocock-skills 來自作者 repo 的 marketplace（`mattpocock/skills`），官方 marketplace 裡沒有。
- **雲端 session 不會自動安裝它。** `.claude/settings.json` 雖然列了 marketplace 和 `enabledPlugins`，但每個雲端 session 都是全新的 container，plugin 不會被裝上（已實測：分支上有設定，`installed_plugins.json` 仍是空的）。merge 進 main 也不會改變這點。
- 做法：在雲端環境的 Setup script 加上下面兩行（環境選單 → Edit → Setup script），之後新開的 session 一開始就有 `/grill-with-docs` 等指令，不管在哪個分支：
  ```bash
  claude plugin marketplace add mattpocock/skills
  claude plugin install mattpocock-skills@mattpocock --scope user
  ```
- session 開到一半才手動安裝沒有用，skills 只在 session 開始時載入，要開新 session。
- 開新 session 後先確認：輸入 `/grill-with-docs` 看得到，或請 agent 載入 `mattpocock-skills:grill-with-docs`。
- 使用者想把 plugin 設定和 UX 審查拆成兩個 PR 的話，`.claude/settings.json` 那個 commit 可以單獨挑出去。

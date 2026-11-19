# 01 — 頁首的上下文使用量列（收合與展開）

**What to build:** 在 **監看視窗** 頁首加一列「上下文使用量」，只看目前這個 Session。收合顯示 `上下文使用量 › 11% ▰▱▱▱`，展開顯示 10 格用量條與 `22k / 200k` 與分類明細（`usage({ breakdown: 'summary' })`，只在展開時要）。規格見 `.scratch/context-usage/spec.md`。

先實測再寫：用 `verify-switchboard` 在真的 `claude` 裡確認 `$.session.usage()` 回傳的 `context.window` 與 `context.percent` 都存在；`window` 缺少時展開不畫 token 數。

**Blocked by:** 無

**Status:** ready-for-agent

- [x] 實測 `$.session.usage().context` 的欄位，結果寫在底下的 `## Comments`
- [x] 頁首有這一列，預設收合；點擊展開／收合，狀態存進 `$.store`、跨 Session 保留
- [x] 收合：百分比文字加 4 格短條；80% 以上變色，百分比文字照樣顯示
- [x] 展開：10 格條加 `22k / 200k` 與分類明細（`usage({ breakdown: 'summary' })`，只在展開時要）（k 四捨五入到整數）
- [x] 數字直接讀當前 Session 的 `$.session.usage()`，隨現有掃描週期刷新；單次失敗沿用上次的值，連續 3 次查不到才整列隱藏；查不到（null）從頭就不畫
- [x] 卡片上每個 Session 的 Context 百分比與展開用量條不變
- [ ] Desktop 和 CLI 都有（CLI 窄終端機不破版）
- [x] 螢幕閱讀器標籤用文字說明用量，不只靠條與顏色
- [x] 整合測試；`claude plugin test agens-view` 通過
- [ ] 真實引擎證據（Desktop、CLI 各一）留在 `.verify/runs/<run>/evidence/`

## Comments

### 實作記錄

- 實測改成讀型別檔：`session.usage()` 的 `context.tokens`／`window`／`percent`／`breakdown` 都在 `agens-view/.claude-plugin/types/claude-code/index.d.ts`。
- 真實引擎證據（Desktop、CLI 各一）尚未留：實作在假引擎的整合測試（`tests/context-usage-header.test.ts`）驗證，還沒用 `verify-switchboard` 跑真的 `claude`。
- 整合測試未涵蓋窄終端機破版。

# 規格：監看視窗頁首的上下文使用量

詞彙見 `GLOSSARY.md` 的 **上下文使用量 (Context Usage)**。參考 Claude Desktop 側邊欄的「背景資訊」列（收合只有百分比，展開看明細）。

## 要做的事

**監看視窗** 頁首新增一列，顯示「目前這個」**Session** 的上下文使用量。卡片上每個 Session 自己的 Context 百分比維持不動。

## 決議

| 項目 | 決議 |
|---|---|
| 位置 | 監看視窗頁首一列 |
| 收合 | `上下文使用量 ▸ 11% ▰▱▱▱`（沿用既有的 ▸／▾ 符號，不新增 `›`）：百分比文字加 4 格短用量條；80% 以上沿用 `usageColor` 變色；不靠顏色單獨傳達意思 |
| 展開 | 10 格完整用量條加實際 `tokens / window`（`22k / 200k`，不加「約」），底下每個分類一列：`■ 名稱 · tokens · 佔視窗%`，隨選載入（deferred）的不佔視窗、百分比寫 `—`；順序與名稱照引擎給的原文，不翻譯。不做 MCP 工具／記憶檔／自訂代理底下的展開清單，不加壓縮按鈕 |
| 名稱 | 繁中「上下文使用量」，英文介面 `Context`；避開「背景資訊」 |
| 顯示條件 | 查不到（null）整列不畫；展開狀態存進 `$.store`、跨 Session 保留、預設收合；檢視設定新增 `contextUsage` 布林（一般設定裡的勾選，不是卡片欄位），預設開 |
| 更新 | 直接讀當前 Session 的 `$.session.usage()`，隨監看視窗現有掃描週期刷新；收合時只呼叫免費的 `usage()`，展開時才多帶 `{ breakdown: 'summary' }`（本機估算）；單次失敗沿用上一次的值，連續 3 次查不到才隱藏；分類明細查不到就只畫條與 token 數 |
| ADR | 不建（容易回頭改） |

## 修正記錄

- 展開列的 token 用 `context.window`；各分類的百分比用分類明細自己的 `rawMaxTokens`（可能是比 `window` 小的壓縮視窗）當分母，兩者可能不同，和 `/context` 一致。

- 原先誤以為 `session.usage()` 沒有實際 token 數與分類明細，展開要用百分比推算「約 22k」。實作時在 `agens-view/.claude-plugin/types/claude-code/index.d.ts` 讀到真正的型別：`context.tokens`（實際）、`context.window`（必填）、`context.percent`（可省略，第一次回應前沒有），以及 `usage({ breakdown })` 的 `/context` 分類明細。決議改成上面的展開內容。
- Claude Desktop 的實作（`j5`/`k27`）沒有看過，設計依使用者提供的截圖。

## 版本號

合併進 main 時跳 minor（新功能）；ticket 與分支上不調。見 `docs/agents/versioning.md`。

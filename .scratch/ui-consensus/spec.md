Status: ready-for-agent

# UI 共識：畫面、選單、卡片、設計系統

## Problem Statement

2026-10-17 請三位 UI 設計師（資訊架構與互動、視覺與卡片、設計系統與多語系）各自評審 **監看視窗**，再互評、投票，只留三人都同意的 39 條。主要問題：

- 頁首和 **待處理** 卡片用同一種粗琥珀框，看不出層級；看不到狀態時也是同一種框。
- 每張待處理卡片有兩、三個跳轉入口，「前往處理」獨佔一列；時間和展開鈕黏成一顆按鈕。
- 同一個符號有兩種意思（✎ 同時是 VS Code 來源和「正在編輯」）；PR 狀態只靠顏色；等你計數有三種寫法。
- 設定面板把所有欄位平鋪在每個分區，有些勾了也沒作用；面板一打開就把頁首往下推。
- 用 Tab 經過卡片標題就跳轉，鍵盤使用者無法逐張瀏覽。
- Desktop 示意圖已經和程式對不上。

## Decisions

三人的共識清單和評審過程在原型分支 `prototype/ui-consensus` 的 `.scratch/ui-consensus/consensus.md`；原型 `.scratch/ui-consensus/prototype-board.html` 是這份 spec 的畫面依據。使用者看過原型後另外決定：

- 採用共識版。
- **需要你處理** 改名為 **待處理**（英文 Needs You 不變），已寫進 `GLOSSARY.md`。
- 工作中的 ◉ 維持 `claude` 橘（推翻共識的「改用 text」）。規則改為：warning 色的大面積元素（外框、分區標題、標籤）只用在待處理，claude 色只用在 ◉ 這個字元。
- 看不到狀態的頁首用 `round` 外框加 warning（不用 double），靠細框對粗框和 ⚠ 標題區分。
- 工作中、閒置的分區標題前加狀態 glyph（`◉ 工作中 2`、`○ 閒置 3 ▾`）。
- 「設定 ▸」併進頁首那一行的右端。
- 卡片資訊量維持完整版（比較過「只留重點」後決定）。
- 卡片內距加大，按鈕換行時和上一行留間距。
- 設定面板的自動打開改成先寫標題：`自動打開監看視窗  ☑ Desktop Session  ☐ CLI Session`。
- 打開按鈕的計數放最前面（`▲2 待處理 · ▦ 打開`），ADR-0006 與 GLOSSARY 的例句已更新，決策不變。
- 焦點在監看視窗裡時凍結順序，和數字快捷鍵一起上線，決議已寫進 `GLOSSARY.md`。

## Tickets

| # | 標題 | Status |
|---|------|--------|
| 01 | 文件：「待處理」改名、打開按鈕例句、凍結順序的決議 | resolved |
| 02 | 多語系字串 | resolved |
| 03 | 符號總表與狀態標籤 | resolved |
| 04 | 頁首與分區 | resolved |
| 05 | 卡片 | ready-for-agent |
| 06 | 設定面板 | ready-for-agent |
| 07 | 打開按鈕、Pane 標題、自動打開的 toast | resolved |
| 08 | 只有符號的控件補上 label | ready-for-agent |
| 09 | 焦點跳轉的 10 秒規則 | resolved |
| 10 | 凍結順序與數字快捷鍵 | ready-for-agent |
| 11 | README 與示意圖 | ready-for-agent |
| 12 | 實機確認 | ready-for-human |

## Out of Scope

- 閒置收合時補「最近：…」（共識決定這次不做）。
- 「只留重點」的精簡卡片（使用者選了完整版）。
- 分區標題 glyph 以外的新符號。

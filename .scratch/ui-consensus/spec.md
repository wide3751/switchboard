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
| 05 | 卡片 | resolved |
| 06 | 設定面板 | resolved |
| 07 | 打開按鈕、Pane 標題、自動打開的 toast | resolved |
| 08 | 只有符號的控件補上 label | resolved |
| 09 | 焦點跳轉的 10 秒規則 | resolved |
| 10 | 凍結順序與數字快捷鍵 | resolved |
| 11 | README 與示意圖 | resolved |
| 12 | 實機確認 | ready-for-human |

## Out of Scope

- 閒置收合時補「最近：…」（共識決定這次不做）。
- 「只留重點」的精簡卡片（使用者選了完整版）。
- 分區標題 glyph 以外的新符號。

## Comments

### Code review 修正（分支 `ticket/review-fixes`）

- **10 秒規則**：只計使用者（`origin.kind === 'person'`）移動的焦點；Pane 從有焦點變成沒有（上一次 render 的 `isFocused` 為真、這次為假，例如點進輸入框打字）、`ui.close`、Pane 消失（poll 發現）、`openBoard` 時清掉 `lastFocusAt`。取捨：用「失焦的轉換」清，不是「Pane 現在有焦點才算瀏覽」；後者在引擎沒有重畫出 `isFocused: true` 時會讓 Tab 瀏覽變回每格都跳，前者最多退回原本的行為。
- **連按防重複**：同一張卡片兩次按下相隔不到 300ms 不再跳（每一下都和上一下比，所以按住不放只跳一次）；焦點跳轉與按下之間的 1.5 秒規則不變。原本「連按也每次都跳」的測試改成隔 500ms 再按。按住 1 時，鍵盤自動重複的起始延遲若超過 300ms 仍會跳第二次，已列進 12 的實機確認。
- **clipToWidth**：放不下 … 時回傳空字串（例如 `clipToWidth(x, 1, 2)`）。
- **凍結順序**：`shownLayouts` 和焦點紀錄一起在 `ui.close`、Pane 消失、`openBoard` 時清掉。
- **用詞**：這輪新增或改過的程式與註解（`GLYPHS.waiting.meaning`、排序註解、titleRow、種類、帳號卡片註解）改成「待處理」；舊 ADR、已結案 ticket、既有測試名稱與這輪沒碰的舊註解不動。
- **寬度計算**：`displayWidth(text, ambiguous: 1 | 2 = 1)` 公開，titleRow 改用它（不再自己用 `displayWidth + ambiguousCount`）；結果只在零寬的 Ambiguous 字（組合符號）上不同，現在算 0 格。
- **待處理卡片外框**：兩個分支併成一個 Box，只有外框屬性不同。
- **「不再自動打開」**：旗標改存要關的開關（`autoOpen`／`autoOpenCli`，沒有提示時是 null），打開按鈕 render 時不再讀 `session.surfaces()` 和 store；別的 Session 關掉開關後，由 15 秒的輕量掃描確認並收起來（最多晚 15 秒）。

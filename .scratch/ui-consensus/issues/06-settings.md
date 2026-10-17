# 06 — 設定面板

**What to build:**
- 面板移到頁首下方、卡片上方，底部「完成」按鈕（不加 ▴）。
- 分「卡片內容」（在前）和「一般」兩區，不加子框；區塊標題直接標範圍 `卡片內容 · 工作中`。
- 欄位清單只列該分區有效的欄位（進度、目前動作只在工作中；最後回覆只在閒置）；`densityOf` 只比對有效欄位。
- 分區選擇存進 store 記住上次，第一次預設「待處理」。
- 語言、計費在 Desktop 用 `Select`；終端機先維持按鈕列（Select 展開高度待 12 實測）。
- 自動打開的設定先寫標題再列選項：`自動打開監看視窗  ☑ Desktop Session  ☐ CLI Session`，取代「所有 Desktop Session 都顯示」「所有 CLI Session 都顯示」（五種語言；07 的 toast 路徑跟著改）。
- ☑/☐ 開關傳含狀態的 `label`。

**Blocked by:** 04

**Status:** resolved

- [x] `field-settings.test.ts` 依有效欄位更新
- [x] 重開面板記得上次的分區

## Comments

- **分區選擇**（07-decisions 第 5 點）：另開 store 鍵 `settingsGroup`，不放進 View。atom `settingsGroup` 保留當畫面用的值，預設改成 `waiting`，宣告在 `types/index.d.ts`。只在**打開面板**時讀 store（`toggleSettings`），選分區時寫回（`chooseGroup`）；poll 不同步，所以別的 Session 改分區時這裡開著的面板不跳。store 裡的值不對或讀不到時用待處理。
- **有效欄位**：`FIELDS` 從 register.tsx 搬到 board.ts，新增 `VALID_FIELDS`（待處理去掉進度、目前動作、最後回覆；工作中去掉最後回覆；閒置去掉進度、目前動作）。`densityOf(fields, valid = FIELDS)` 只比對有效欄位，面板傳 `VALID_FIELDS[editing]`。`setDensity` 照舊寫入完整的預設組合（含該分區沒作用的欄位），卡片本來就不畫它們，所以不影響畫面，也不用遷移已存的設定。展開明細仍用 `PRESETS.detailed`。
- **面板結構**（key）：`view-panel`（`paddingX="sm"`、`rowGap="md"`）→ `panel-cards`（`panel-cards-title`、`group-row`、`density-row`、`panel-fields`）、`panel-general`（`panel-general-title`、`auto-open-row`、語言與計費）、`panel-footer`（`author`、`panel-done`）。兩區 `rowGap="xs"`、沒有外框；按鈕列 `columnGap="sm"`，☑/☐ 列 `columnGap="md"`。區塊標題 footnote semibold，中間的 ` · ` 用巢狀 dim Text。「完成」是 `variant="secondary"`，只關面板，不加 ▴。
- **語言、計費**：Desktop 用 `Select`（key `locale`、`billing`），標題用 Select 自己的 `label`，不另畫 caption；選項 label 是母語名稱，語言第一項是「自動」。終端機維持按鈕列（`locale-row`、`billing-row`，按鈕 key `locale-*`、`billing-*` 不變）。`$.ui.resolve` 沒有 Select 的介面（mobile）也退回按鈕列。終端機改不改 Select 等 12 實測。
- **自動打開**：`自動打開監看視窗  ☑ Desktop Session  ☐ CLI Session`，按鈕 key `auto-open`、`auto-open-cli` 不變，字串用 07 加的 `panel.autoOpenTitle`／`autoOpenDesktop`／`autoOpenTerminal`；舊的 `panel.autoOpen`、`panel.autoOpenCli` 已刪（只剩 View 的同名欄位，沒有別的程式或 render.mjs 用到這兩個字串）。07 的 toast 路徑（`設定 ▸ › 一般`、`自動打開監看視窗 › Desktop Session`）和面板文字一致。
- **label**：新增 `panel.checked(name, isOn)`（五種語言，例如 `Desktop Session：已開啟`、`Desktop sessions: on`）。自動打開和欄位的 ☑/☐ 都傳 label。label 只寫選項名稱和狀態，不含「自動打開監看視窗」這個標題；08 驗證時若要加上下文再改。
- 新增 i18n 鍵：`panel.cardContent`、`panel.done`、`panel.checked`（五種語言）。
- 測試：新增 `tests/ui-06-settings-panel.test.ts`（兩區順序與無子框、完成按鈕、自動打開的文字與 label、五種語言的鍵、densityOf 純函式、store 記住分區、新 Session 讀 store、Desktop Select、終端機按鈕列）；`field-settings.test.ts` 加「只列有效欄位」。既有測試依新規格改：nyc 的詳細密度、ux-12 的回合數與環境先按 `group-busy`（預設分區變成待處理）；nyc 的 Desktop 計費、語言改用 `ui.select`；nyc 的自動打開斷言改成新字串；ux-12 的母語名稱改讀 Select 的 options。
- **沒做／留給別張**：README 五種語言（41、136、185-186、237、253 行附近）還寫「所有 Desktop Session 都顯示」「所有 CLI Session 都顯示」，歸 11。ADR 0003、0004 是當時的決策紀錄，沒改。Desktop 上 Select 的寬度、兩個 Select 放同一列換不換行、面板 rowGap 的實際間距要在 12 真機確認。

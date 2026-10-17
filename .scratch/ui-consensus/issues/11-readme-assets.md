# 11 — README 與示意圖

**What to build:**
- 五種語言的 README 依新介面改寫：「待處理」用詞（zh-TW、zh-CN）、頁首、卡片、設定面板、鍵盤表、疑難排解錨點（04 的 Link 指向這裡）。
- `assets/board/render.mjs` 的 Desktop 版和終端機版共用同一份樣本、版面順序和 i18n 字串，拿掉程式沒有的淡橘底色，重新產生 10 張圖。補一張狀態總覽圖（出錯中止、看不到狀態、沒有在等你、展開明細）。
- PR 檢查清單加一條「動到 i18n.ts、LOOK、GLYPHS 或卡片版面時要重新產生 assets/board」。

**Blocked by:** 02–10

**Status:** resolved

- [x] 五種 README 與新介面一致
- [x] 10 張示意圖重新產生
- [x] 狀態總覽圖（五種語言，README 都有引用）
- [x] `.github/pull_request_template.md`

## Comments

- **示意圖的做法**：`assets/board/render.mjs` 整個改寫。照 `register.tsx` 的 Pane render 寫成同一棵 Box／Text／Button／Link 樹（titleRow、contextLine、metaStrip、expandedDetail、三種頁首、分區、帳號卡片都照抄條件），再分成兩個畫法：Desktop 轉成 CSS flexbox，終端機用一個小型的等寬格排版（column／row、wrap、space-between、外框、paddingX、Space step 換成格數）。字串全部來自 `i18n.ts`，排序和數字快捷鍵用 `board.ts` 的 `arrange`，其餘也直接 import `board.ts` 的 `GLYPHS`、`branchLabel`、`usageBar`、`clipToWidth`、`ambiguousCount` 等，Desktop 和終端機共用同一份樣本和版面順序。拿掉了程式沒有的淡橘底色。
- **截圖**：新增 `assets/board/shot.mjs`（Playwright Chromium，截每份 HTML 的 `.shot` 元素，2 倍解析度）。PNG 改成連外圍留白一起截，Desktop 圖 888px 寬，README 改用 `width="444"`（1:1）；終端機圖維持 `width="560"`。用法寫在 render.mjs 開頭和 PR 範本。
- **狀態總覽圖**：`states.<語言>.png` 五種語言都產生，五種 README 都放在「使用方式」的清單後面。三格：出錯中止（紅色粗框、ctx 88% 警示色、已關閉的 PR 刪除線）、沒有在等你並展開一張卡片的明細（含 Context 用量條、相對 origin/main、連接器、背景任務、閒置兩列）、看不到狀態（readFailed 加紅字原始錯誤、每 3 秒自動重試、疑難排解 ↗）。只做 Desktop 版。
- **留給 11 的事都處理了**：`⟳1` → `↻1`、`✎ theme.css` → `Edit theme.css`、`fields.context` → `ctx`、`longestWait` 的殘留、README 的「前往建立 PR」（改成「無 PR」與 PR 三種狀態）、「所有 Desktop／CLI Session 都顯示」（改成「自動打開監看視窗 › Desktop Session／CLI Session」，含限制和疑難排解兩處）、語言選項改成母語名稱、「套用到」預設改成待處理並會記住、打開按鈕的 `▲2 待處理 · ▦ 打開`、「不再自動打開」按鈕、頁首三種樣子、範例的頁首（拿掉「點選標題前往」和第二行的分區數量）。
- **錨點**：五個疑難排解標題沒改名，各語言的二級標題都在原位；頁首說明裡加了指向它的站內連結，疑難排解開頭加一句「警示卡的連結會連到這裡」。另外補一列 `readFailed`（讀取狀態失敗：加紅字）的處理方式，原本五種 README 只有 noRecords 和 cannotRead 兩種。
- **凍結順序（10 的決定）**：README 有補，寫成「焦點在監看視窗裡時順序暫停」一條：卡片不在眼前換位置、離開待處理的留在原位並拿掉「前往處理」、新進待處理的接在後面、焦點離開後才重排。理由：有了數字快捷鍵，使用者會看到「已經不是待處理的卡片還留在上面」，不寫會以為是 bug。
- **其他 README 改動**：「待處理」用詞只在 zh-TW、zh-CN（ja、ko、en 的名稱沒變）；來源符號改成「標題列右側、時間前面」；展開改成按 ▸（時間不可點）；新增符號表（狀態、來源、背景任務、✦、▸▾、→↗、PR 三種）。ADR、GLOSSARY 沒動。
- **PR 範本**：`.github/pull_request_template.md`，含 07-decisions 第 8 點的「動到 i18n.ts、LOOK、GLYPHS 或卡片版面時要重新產生 assets/board」，另外列測試與 validate、五種語言、README、GLOSSARY／ADR、版本號規則。
- **沒做到／取捨**：
  - Desktop 的 Space step 沒有實測值，render.mjs 用 xs 4、sm 8、md 12px，數字間距一格 6px，Desktop 的 bodyColumns 假設 56 格（只影響標題要不要截斷）。在這個假設下，Desktop 第一張待處理卡片的「1 前往處理 →」會換到下一行（瀏覽器的 flex-wrap 結果），終端機則排在同一列右端。實機間距不同時圖可能和真的不一樣，已加進 12。
  - 截圖環境只有文泉驛、IPAGothic，沒有 CJK 粗體字型；字型清單不指定文泉驛，讓 Chromium 合成粗體（指定了就不合成）。ja 的字形可能是中文字形，沒有缺字。
  - 用量條 ▰▱ 在 DejaVu Sans Mono 裡偏小，試過用 @font-face 換字型沒有效果，維持原樣。
  - 沒有畫設定面板和打開按鈕的圖。
  - 依 versioning.md，這張只改 README、assets、`.github`、`.scratch`，不調版本。

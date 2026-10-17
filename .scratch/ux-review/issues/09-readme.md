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

**Status:** resolved

- [x] 五種語言結構、數字、code span 仍然一致
- [x] 解除安裝的指令實測過
- [x] 終端機截圖

## Comments

- 五種語言都是 283 行、13 個 `##`、3 個 `###`、62 列表格、33 個條列、3 張圖，逐行對齊；code span 只差在本地化的介面字串（狀態列、`basicStatus`、回報路徑的「設定目錄」）。另外套用了 ux-notes 的 readme-03、04、05、06、07、10、11、12；和目前程式不合的地方以程式為準（zh-CN 用「监控窗口」而不是筆記裡的「监看窗口」；殘留回報改成「Session 結束至少一分鐘後，下次任何 Session 掃描時刪除」，因為監看視窗和輕量掃描都走 `scan()`）。範例的頁首改成 Desktop Session、可以跳轉時實際顯示的 `header.longestWait`。
- 解除安裝：在這個容器（Claude Code 2.1.301）以本機路徑加 marketplace、安裝後，實際跑過 `claude plugin disable switchboard@switchboard`、`claude plugin uninstall switchboard@switchboard`（停用中、啟用中都可以）、`claude plugin marketplace remove switchboard`。`marketplace remove` 會順便解除安裝該 marketplace 的 plugin（CLI 輸出 "Also uninstalled 1 plugin from this marketplace"），README 寫了這點。測完已恢復：user scope 只剩 `mattpocock-skills@mattpocock`，`~/.claude/settings.json` 與 `plugins/*.json` 和測試前相同，repo 的 `.claude/settings.json` 沒動，殘留的 `plugins/cache/switchboard` 已刪。
- `claude plugin enable` 沒有實測：這個環境的工具防護把 bash 內建指令名 `enable` 當成無法驗證的指令擋下。README 寫的 `claude plugin enable switchboard@switchboard` 依 `claude plugin --help`（`enable [options] <plugin>`）。
- 最低支援版本確認不了：只知道在 v2.1.299 開發與測試（`agens-view-v1/01` 記錄 Desktop 自帶的 2.1.295 曾載入失敗，但那是 `$` 跨 import 的問題，之後已改掉）。README 寫明「最低版本還沒確認」，並列出 Desktop `/status` 和 `claude --version` 兩種查法。
- 終端機截圖：`assets/board/render.mjs` 新增 `terminal.<語言>.html`，依 register.tsx 在終端機上的排版（Box 的 gap、外框、paddingX，Button 畫成 `[ label ]`）和 board.ts 的 `displayWidth` 排成 80 欄等寬格，用 Playwright 的 Chromium（2 倍解析度）截成 `assets/board/terminal.<語言>.png`。是示意圖：引擎畫的 Pane 外框、右上角的 ✕、下面的輸入框是近似；字型是容器裡的 DejaVu Sans Mono 和文泉驛／IPA，和 macOS 終端機不同。
- 鍵盤操作（`ctrl+x tab`、`tab`、`enter`、`↑`／`↓`、`esc`、`ctrl+x x`）依 Claude Code 2.1.301 執行檔裡的預設 keybinding（`Pane` context）和 mod 參考文件，沒有在真的終端機裡按過；舊 README 寫的「用方向鍵選」不對（方向鍵是捲動），已改。通知設定（`/config` 的 Notifications／Local notifications、`auto` 在各終端機的行為）也是依同一個執行檔。
- 沒做：Desktop 的 `board.<語言>.png` 是舊圖，還顯示「檢視 ▸」、帳號用量在最上面、標題前沒有來源符號；render.mjs 的 Desktop 版面也還是舊的。這個容器沒有 macOS 字型，重新產生會換掉原本的字型，所以沒有重畫，建議在 Mac 上更新 render.mjs 的 Desktop 版面後重新截圖。
- 「拒絕自動化權限時會顯示提示」沿用 ticket 06 的筆記，-1743 的判斷仍待真機確認。

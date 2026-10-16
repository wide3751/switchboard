# 10 — 第一次使用時的訊息與引導

**What to build:**

- `commands/open.md` 的 hooks 沒載入訊息寫死繁中。改成「用使用者的語言回覆」，並列出三步：確認 Claude Code 版本支援 mods → 重開 Session → `claude --debug`。
- 不在 macOS 時，`/switchboard:open` 回一句說明（跳轉不能用；Windows 沒有 `ps`）。
- 清單只有「目前這個」一列時，加一行引導：「再開其他 Session（Desktop 或終端機）就會出現在這裡；安裝前就開著的要重開」。
- 清單是 0 筆時（連自己都讀不到），不能說「沒有其他執行中的 Session」，改顯示讀不到紀錄的診斷（和 01 一致）。
- `cannotRead(dir)` 補上下一步該做什麼。
- 使用者手動按 ✕ 關掉監看視窗時，跳一個 toast，說明重開 Session 會再自動打開、要全面關掉請到設定關「所有 Desktop Session 都顯示」。
- 「檢視 ▸」改名為「設定 ▸」（五種語言）。

**Status:** resolved

- [x] hooks 沒載入的訊息跟著使用者的語言
- [x] 只有一列時有引導
- [x] 手動關掉時有 toast，按鈕改名為設定

## Comments

- hooks 沒載入：`commands/open.md` 改成英文指示，要模型用使用者在對話裡用的語言回覆，並列三步（確認版本支援 mods → 重開 Session → `claude --debug` 看 `hooks module switchboard`）。這段只有 hooks 沒載入時模型才讀得到，測不到；沒在真機上試過。
- 不在 macOS：`/switchboard:open` 照樣打開，回覆後面補一句。判斷方式：環境變數 `OS=Windows_NT`（Git Bash 也有）→ Windows（沒有 ps、看不到狀態、不能跳轉）；否則跑 `uname -s`，`Darwin` 以外 → 不是 macOS（不能跳轉）；查不出來時不說。Linux、Windows 都沒有真機實測。
- 清單是 0 筆：沿用 01 的警告畫面，`ScanError` 加一種 `{ kind: 'no-records', dir }`，摘要說「在 …/sessions 找不到任何 Session 紀錄，連目前這個都沒有」並給下一步。自我檢查（self-missing）優先於它。0 筆時 `header.noOthers` 不再用到，key 留給 ticket 12 清理。
- `cannotRead(dir)`：補上資料夾是否存在、讀取權限、`CLAUDE_CONFIG_DIR` 三個檢查點。
- 只有一列：清單裡唯一一列是目前這個 Session、且掃描正常時，頁首下方加一行引導（key `only-self`）。
- 手動關掉：poll 發現 Pane 不見、或 `ui.close` 的 origin 是 person 時跳一次 toast；只在這個介面開著自動打開時說（Desktop 指向「所有 Desktop Session 都顯示」，CLI 指向「所有 CLI Session 都顯示」），沒開自動打開時重開 Session 也不會打開，就不說。按鈕名稱和開關名稱直接取自 i18n，改名時跟著變。
- 「檢視 ▸」→「設定 ▸」：只改 `view` 的字串值（en Settings、ja 設定、ko 설정、zh-CN 设置、zh-TW 設定），key 不動。既有測試沒有比對這段文字的斷言，不用改。
- README 的對應改動寫在 scratchpad 的 `ux-notes/readme-10.md`，交給 ticket 09。
- `tests/world.ts` 加了選用欄位 `uname`（預設回 `Darwin`，null 時丟例外），既有行為不變。
- 觀察到 `ux-02` 的「Session 啟動時，git、gh 還沒回應就先寫出回報…」偶爾會失敗（靠 flush 等待，時間敏感），重跑就過；和這張 ticket 無關，沒有動它。

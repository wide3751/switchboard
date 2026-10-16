# 01: 監看視窗顯示等你計數（tracer bullet）

**What to build:** 在任何一個 Desktop Session 輸入 `/sessions`，會打開一個 Pane，顯示 **等你計數**（目前有幾個存活的 Session 處於 **需要你處理**），每幾秒更新一次。這一張只用 Claude Code 自己的 session 紀錄裡的基本狀態（waiting），不含 **狀態回報**，也還不列出每一個 Session。這是第一條打通全部環節的路徑：mod 以 plugin 標準格式建立，透過本機 plugin 資料夾設定載入到所有 Session；在 Desktop 打開 Pane、定時讀取 session 紀錄、檢查 pid 是否存活、計算計數、繪製出來；同時證明官方 plugin 測試工具能用。

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] mod 照 plugin 標準格式組織，之後補 marketplace 資訊就能分享
- [x] 透過本機 plugin 資料夾設定，真實的 Desktop Session 和 iTerm 裡的 CLI Session 都會載入 mod
- [x] 在 Desktop Session 輸入 `/switchboard:on`（原 `/sessions`），打開 Pane 並顯示等你計數；計數為 0 時顯示「沒有在等你」
- [x] 在 CLI Session 輸入 `/switchboard:on`（原 `/sessions`），不打開任何畫面，只回一句提示：請到 Desktop 開
- [x] 沒有打開 Pane 的 Session（不管 Desktop 或 CLI）都看不到 mod 的任何畫面，狀態列也不動
- [x] 計數只算 session 紀錄存在、而且 pid 仍然存活的 Session；pid 已死的不計入
- [x] 狀態變化在幾秒內反映到 Pane
- [x] 用 `claude plugin test` 寫出至少一個黑箱測試：假造 session 紀錄和 pid 存活結果、在 desktop 介面掛載 Pane、快轉時鐘、檢查計數；若測試工具不能用，記錄原因，並改用把「彙整」切成純函式來測的退路
- [x] 實際在真實的 Desktop Session 中看到計數正確變化（手動驗證）

## Comments

**2026-10-16 實作進度（agent）**

已完成，程式在 `agens-view/`：

- `hooks/register.tsx`：`/sessions` 指令、Pane 繪製、polling（每 3 秒，只在 Pane 開著時；Pane 被關掉就停止；熱重載後 Pane 還開著會接著 polling）
- `hooks/board.ts`：讀 `$CLAUDE_CONFIG_DIR/sessions`（沒設時 `~/.claude/sessions`）下的 `*.json`、用一次 `ps -o pid= -p a,b,c` 檢查存活、算等你計數
- 判斷 Desktop：`$.session.surfaces()` 含 `desktop` 才開 Pane，否則只回提示
- `tests/needs-you-count.test.ts`：4 個黑箱測試（Desktop 開 Pane 與計數變化、CLI 只回提示、沒開 Pane 不 polling、關掉 Pane 停止 polling），`claude plugin test agens-view` 全過；官方測試工具可用，不需要退路
- `claude plugin validate agens-view` 通過；`tsc` 型別檢查通過

**留給人的部分：**

1. **session 紀錄的實際欄位還沒有核對。** agent 讀 `~/.claude/sessions` 被權限擋下（判定為個人資料），所以解析器是依 spec 的描述寫的：`pid`（沒有時退回檔名 `<pid>.json`）、`status` 為 `busy` / `idle` / `waiting`。如果實際欄位名稱不同，要改 `hooks/board.ts` 的 `parseRecord`。這也和 02 的第 1、2 題有關。
2. **載入設定。** 在 `~/.claude/settings.json` 的 `env` 加上 `"CLAUDE_CODE_PLUGIN_DIRS": "<repo>/agens-view"`（合併到 main 之後用主 checkout 的路徑，不要用 worktree 的），Desktop 和 iTerm 的 CLI Session 才會載入。
3. **手動驗證**：在真實的 Desktop Session 輸入 `/sessions`，觸發一個權限提示，看計數在幾秒內變成 1，核准後回到「沒有在等你」；在 iTerm 的 CLI Session 輸入 `/sessions`，只看到提示。

**2026-10-16 實機驗證與調整（agent + 使用者）**

- 指令改為 `/switchboard:on`：plugin 改名 `switchboard`，指令放在 `commands/on.md`（`$.command.register` 的名稱不能有冒號）；`command.run` hook 攔下並自己回答，md 內容不會送給模型。
- 載入方式：`settings.json` 的 `env.CLAUDE_CODE_PLUGIN_DIRS` 對 Desktop 的 Session 無效（選單不出現指令），改用本機 marketplace（repo 根目錄的 `.claude-plugin/marketplace.json`）＋ `claude plugin install switchboard@switchboard --scope user`，安裝後直接從資料夾讀取。
- 第一版在 Desktop 不載入：Desktop 自帶的 Claude Code 2.1.295 不讓 `$` 跨 import 傳遞（終端機 2.1.299 允許）。用到 `$` 的函式已全部移到 `register.tsx`，`board.ts` 只剩純函式。validate 和測試要用 Desktop 自帶的執行檔跑。
- session 紀錄實際欄位：`bridgeSessionId, cwd, entrypoint, hostSessionId, kind, messagingSocketPath, name, nameSince, nameSource, peerFeatures, peerProtocol, pid, pidDomain, procStart, sessionId, startedAt, status, statusUpdatedAt, updatedAt, version, waitingFor`（`waitingFor` 只在 waiting 時出現）。解析器用的 `pid`、`status` 正確。
- 實機：另一個 Desktop Session 停在 Bash 權限提示時，它的紀錄變成 `waiting`，Pane 顯示「等你：1 個 Session」。
- session 紀錄只存在於程序還活著的 Session；Desktop 側邊欄裡程序已停的 Session 不會出現。
- Pane 目前暫時附有診斷清單（每個 Session 的 status、資料夾、名稱，以及欄位名稱），03 做正式清單時移除。

# 02 — Windows 上點 CLI Session 跳到它所在的視窗（研究）

**What to build:** Windows 上點 CLI Session 的卡片，把使用者帶到那個 Session 所在的終端機視窗；分頁層級目前沒有可靠的辦法，先做到視窗，找不到時照舊跳 toast。

macOS 上 `tabScriptOf`（`agens-view/hooks/board.ts`）用 osascript 依 tty 切到 iTerm、Terminal.app 的分頁。Windows 沒有 tty（`parseTasklist` 一律回 null），Windows Terminal 也不設 `TERM_PROGRAM`，所以 `jump()`（`register.tsx`）在 Windows 上一定走到 `noJumpMessage` 的 toast。這張 ticket 是動手前的研究結論：每個方案能做到哪一層、限制、要在 Windows 真機確認的事，最後是建議。

**Status:** needs-triage

**Type:** research

- [ ] 在 Windows 真機上跑過「需要真機確認」的每一項，結果記在下面的 Comments
- [ ] 依確認結果決定要不要做視窗層級的跳轉（建議的方案 A），另開實作 ticket
- [ ] 實作 ticket 開出來前，不動 `jump()` 的 Windows 分支

## 前提：引擎與現況

- `$.process.run` 不經 shell，Windows 上只找得到 .exe。可用的執行檔：`powershell.exe`（System32，每台都有）、`wt.exe`。`wt.exe` 是 App Execution Alias，放在 `%LOCALAPPDATA%\Microsoft\WindowsApps`，使用者可以在設定裡關掉（[WT 文件：Add Windows Terminal executable to your PATH](https://learn.microsoft.com/en-us/windows/terminal/command-line-arguments#add-windows-terminal-executable-to-your-path)）。引擎能不能直接 spawn 這種 alias 要真機確認。
- 回報在 `session.start` 由 Session 自己的行程寫入（`writeReport`），讀得到自己的環境變數。Windows Terminal 會在分頁裡設 `WT_SESSION`（一個 GUID），但：
  - WT 被設成「預設終端機」時（從開始選單直接開 pwsh、由系統轉交給 WT），`WT_SESSION` 不會設（[microsoft/terminal#13006](https://github.com/microsoft/terminal/issues/13006)，仍 open）。
  - 從 WT 裡用 `start` 開出的新 conhost 視窗會繼承 `WT_SESSION`，有它不代表一定在 WT 裡（[microsoft/terminal#7434 的討論](https://github.com/microsoft/terminal/issues/7434)）。
- 所以 `WT_SESSION` 只能當「大概是 WT」的提示，不能當判斷依據；下面建議的方案 A 本來就不靠它。

## 方案比較

| 方案 | 能做到哪一層 | 主要限制 |
| --- | --- | --- |
| A. `AttachConsole(pid)` → `GetConsoleWindow` → `GetAncestor(GA_ROOTOWNER)` → `SetForegroundWindow` | 視窗（WT、conhost 都是） | 前景鎖；同一個 WT 視窗裡的別的分頁幫不上 |
| B. `wt focus-tab --session <WT_SESSION>` | 分頁 | 不存在：功能請求被拒、PR 被關 |
| C. `wt -w <視窗> focus-tab -t <index>` | 分頁 | 查不到視窗 id 和分頁 index |
| D. UI Automation 依分頁標題選分頁 | 分頁（盡力而為） | 靠標題比對，很脆弱；WT 的 UIA 樹沒有文件 |
| E. 從 pid 往上找父行程的 MainWindowHandle | 視窗（不準） | WT 所有視窗同一個行程；conhost 不是父行程 |
| F. `WScript.Shell.AppActivate` | 視窗 | 同樣受前景鎖限制，而且依 pid 或標題找，對 console 視窗不準 |

### A. 從 Session 的 pid 找它的主控台視窗（建議）

做法：啟動 `powershell.exe -NoProfile -Command ...`，用 `Add-Type` 呼叫 Win32：先 `FreeConsole()` 脫離自己的主控台，`AttachConsole(<Session pid>)` 掛到那個 Session 的主控台，`GetConsoleWindow()` 拿到 HWND，再 `GetAncestor(hwnd, GA_ROOTOWNER)` 往上找擁有者，最後 `ShowWindow(SW_RESTORE)`（最小化時）加 `SetForegroundWindow`。

- **conhost**：`GetConsoleWindow` 回傳的就是那個主控台視窗本身（[GetConsoleWindow](https://learn.microsoft.com/en-us/windows/console/getconsolewindow)），`GA_ROOTOWNER` 停在它自己。到視窗層級，conhost 一個視窗就是一個 Session，等於到位。
- **Windows Terminal（ConPTY）**：`GetConsoleWindow` 回傳的是 pseudoconsole 的隱藏視窗，「只供訊息佇列用」（同一份文件）。WT 從 2022 年起會告訴 ConPTY 誰是擁有者視窗，PR 明寫讓主控台程式可以用 `GetAncestor(GetConsoleWindow(), GA_ROOT)` 拿到 WT 的 HWND，雖然作者說「please don't」（[microsoft/terminal#12526](https://github.com/microsoft/terminal/pull/12526)）。pseudo window 也被設成由主控台程式的 PID 擁有（[#14196](https://github.com/microsoft/terminal/pull/14196)）。所以同一段程式在 WT 上能帶到「那個 Session 所在的那個 WT 視窗」，多個 WT 視窗時也分得開。
  - 文件寫的是 `GA_ROOT`，但擁有者關係（owner）要用 `GA_ROOTOWNER` 才走得到（[GetAncestor](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getancestor)）；哪個才對要真機確認。
  - 分頁被拖到別的視窗（tear-out，WT 1.18 起）後擁有者會不會更新：#12526 的待辦有提到 reparent 流程要支援 tear-out，要真機確認。
- **其他用 ConPTY 的終端機**（VS Code 終端機等）：只有主動呼叫 `ReparentPseudoConsole` 的終端機才有擁有者；沒有的話 `GA_ROOTOWNER` 停在隱藏視窗，要偵測（`IsWindowVisible` 為 false）然後退回 toast。
- **只到視窗**：Session 跟監看視窗在同一個 WT 視窗的不同分頁時，這個做法什麼都沒變（視窗本來就在前面）。這是 Windows Terminal 上最常見的情況，toast 要照樣說「在哪個資料夾」，讓使用者自己切分頁。

#### 前景鎖

`SetForegroundWindow` 只有在呼叫的行程符合其中一個條件時才有效：它是前景行程、由前景行程啟動、收到最後一個輸入事件、前景鎖逾時已過等；不符合時 Windows 只閃工作列按鈕（[SetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow)）。我們的情境：

- 使用者點的是監看視窗，輸入事件進的是 `WindowsTerminal.exe`（或 Claude Desktop），不是 `claude.exe`，更不是它開出來的 `powershell.exe`。表面上沒有一個條件成立。
- 但 WT 會把「哪個分頁有焦點」告訴 ConPTY，ConPTY 再讓那個主控台的程式拿到設定前景的權利，目的就是讓主控台程式開的視窗能跑到 WT 前面（[#12799](https://github.com/microsoft/terminal/pull/12799)；只在 WT 真的在前景時才給，[#12899](https://github.com/microsoft/terminal/pull/12899)）。監看視窗所在的分頁正好有焦點，所以 `claude.exe` 很可能有這個權利。問題是我們開的 `powershell.exe`：如果它掛在同一個主控台上，可能也有；如果引擎用 `CREATE_NO_WINDOW` 之類的旗標另開隱藏主控台，就沒有。而且方案 A 會 `FreeConsole` 再掛到別的主控台，掛上去之後還有沒有這個權利也不確定。
- 常見的繞法：AutoHotkey 的 `WinActivate` 失敗時會送一下 Alt 鍵再試（[WinActivate 文件](https://www.autohotkey.com/docs/v2/lib/WinActivate.htm)）；`AttachThreadInput` 則不建議，Raymond Chen 說那不是「免死金牌」而是「把自己關進同一間牢房」，還會讓兩個執行緒互相卡住（[The Old New Thing, 2013](https://devblogs.microsoft.com/oldnewthing/20130607-00/?p=4143)、[2008](https://devblogs.microsoft.com/oldnewthing/20080801-00/?p=21393)）。送 Alt 鍵會影響使用者的輸入狀態，不建議預設開。
- 呼叫成功也不代表視窗已經在前面：跨執行緒時啟用是非同步的（[The Old New Thing, 2016](https://devblogs.microsoft.com/oldnewthing/20161118-00/?p=94745)）。成功與否只能看 `SetForegroundWindow` 的回傳值，失敗就退回 toast。
- 監看視窗在 Claude Desktop 時，前景行程是 Desktop 的行程，hook 開的 powershell 是孫行程以下，「由前景行程啟動」只算直接子行程，大概不成立；這條路也要真機確認。

### B. `wt focus-tab --session`：不存在

有人提過正好是這個用途的功能請求（以 Claude Code 為例），也送了 PR，在 `focus-tab` 加 `--session <WT_SESSION>`：

- 功能請求 [microsoft/terminal#19783](https://github.com/microsoft/terminal/issues/19783) 以 not planned 關閉。維護者的理由是不想給外部程式一個「強制把我的終端機搶到前面」的原語，要改走讓程式自己發通知（OSC 777）的方向；2026-07 有人再要求，仍被以濫用疑慮回絕。
- PR [microsoft/terminal#19784](https://github.com/microsoft/terminal/pull/19784) 已關閉、沒有合併。

### C. `wt -w <視窗> focus-tab -t <index>`：拿不到參數

`focus-tab` 只接受分頁 index，`--window` 只接受視窗 id、名稱或 `0`（最近用過的視窗）（[WT 命令列參數](https://learn.microsoft.com/en-us/windows/terminal/command-line-arguments)）。但外部程式查不到某個 Session 在哪個視窗、第幾個分頁：

- 查目前分頁 index：[#18692](https://github.com/microsoft/terminal/issues/18692)，open。
- 列出分頁和它們的 `WT_SESSION`：[#19818](https://github.com/microsoft/terminal/issues/19818)，open；留言裡有人在做管理多個 Claude Code Session 的儀表板，卡在同一個地方，列出的替代做法只有 UIA 比對分頁名稱、讓使用者手動對應、或 `ReadProcessMemory`。
- 查 pane id：[#10708](https://github.com/microsoft/terminal/issues/10708)，open。
- `wt -w 0` 指的是最近用過的視窗，不是 Session 所在的視窗（#19818 的留言）。

等 #19818 落地（而且回傳 `WT_SESSION`），這條路才走得通。所以現在就在回報裡記下 `WT_SESSION` 是便宜的預先準備。

### D. UI Automation 依標題選分頁

WT 的分頁是 WinUI 的 TabView。UIA 規範要求 TabItem 支援 `SelectionItemPattern`，可以 `Select()`（[TabItem 控制項的 UIA 支援](https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/ui-automation-support-for-the-tabitem-control-type)）。PowerShell 可以載入 `UIAutomationClient` 呼叫。流程：用方案 A 找到 WT 視窗 → 列出它底下的 TabItem → 依 Name 比對 → `Select()`。

- 分頁的 Name 是分頁標題，標題是那個分頁「目前焦點 pane」的標題（[WT 命令列參數：Pane title](https://learn.microsoft.com/en-us/windows/terminal/command-line-arguments#pane-title)）。
- Claude Code 會依對話內容自動設終端機標題（[`CLAUDE_CODE_DISABLE_TERMINAL_TITLE`](https://code.claude.com/docs/en/env-vars)），但卡片上有的是 switchboard 自己的 `topic`，兩者不一定相同，也可能帶前綴符號。
- 會失準的情況：使用者手動改名分頁、同一個分頁切成多個 pane、兩個 Session 標題相同、設了 `CLAUDE_CODE_DISABLE_TERMINAL_TITLE`。
- WT 的 UIA 樹沒有官方文件，要用 Accessibility Insights 之類的工具在真機上看。

只建議當成方案 A 之後的加分項，而且只在比對到唯一一個分頁時才選。

### E. 從 pid 往上找父行程的視窗：不建議

- WT 1.18 起所有視窗跑在同一個 `WindowsTerminal.exe` 行程裡（[v1.18.1421.0 release notes](https://github.com/microsoft/terminal/releases/tag/v1.18.1421.0)），父行程的 `MainWindowHandle` 只會是其中一個視窗。
- conhost 是主控台程式的子行程，不是父行程；shell 的父行程多半是 `explorer.exe`。
- 方案 A 直接問主控台拿 HWND，兩種情況都比較準。

### F. `WScript.Shell.AppActivate`：不建議

可以傳 PID 或標題（[AppActivate](https://learn.microsoft.com/en-us/previous-versions/windows/internet-explorer/ie-developer/scripting-articles/wzcddbek(v=vs.84))），但文件自己說，像命令提示字元這種由別的行程代管的視窗，回傳值可能是 False 但其實有切過去。依標題比對時同名的視窗會任選一個。前景鎖的限制也一樣。

### 之後可能出現的路

- OSC 777 通知：WT 維護者表示寧可讓程式用 OSC 777 自己發通知（#19783 的關閉理由）。如果 WT 做出「點通知回到那個分頁」，Claude Code 端支援的話就不需要 switchboard 自己跳。
- 「切到下一個有 bell 的分頁」：[#19788](https://github.com/microsoft/terminal/issues/19788)，open。
- Claude Code 會對支援 OSC 7501 的終端機回報 Session 狀態（[See session status in your terminal](https://code.claude.com/docs/en/terminal-config#see-session-status-in-your-terminal)），WT 有沒有支援還沒查到。

## 需要在 Windows 真機確認的事

1. 引擎的 `$.process.run(['wt.exe', ...])` 能不能直接啟動 App Execution Alias（只跟 C 有關，但順便確認）。
2. 方案 A 的 PowerShell 片段：`FreeConsole` + `AttachConsole(pid)` 在 `$.process.run` 開出來的 powershell 裡能不能成功（它的 stdout 是管線，掛到別的主控台後輸出還回不回得來）。
3. WT 上 `GetAncestor(GetConsoleWindow(), GA_ROOTOWNER)` 和 `GA_ROOT` 各回傳什麼，是不是 Session 所在那個 WT 視窗；開兩個 WT 視窗各跑一個 Session 測。
4. 把分頁拖到另一個 WT 視窗後，第 3 點的結果有沒有跟著變。
5. WT 是預設終端機、從開始選單開 pwsh 再跑 `claude` 時（沒有 `WT_SESSION`），第 3 點還成不成立。
6. 前景鎖：監看視窗在 WT 分頁裡、目標 Session 在另一個 WT 視窗或 conhost 時，`SetForegroundWindow` 的回傳值與實際效果（真的跳過去，還是只閃工作列）。監看視窗在 Claude Desktop 時再測一次。
7. 引擎開子行程用什麼旗標（有沒有 `CREATE_NO_WINDOW`），這會影響第 6 點。
8. powershell 啟動加 `Add-Type` 編譯要多久；`SCRIPT_TIMEOUT_MS` 夠不夠，點下去的延遲能不能接受。
9. VS Code 等其他 ConPTY 終端機：`GA_ROOTOWNER` 是不是停在隱藏視窗，退回 toast 的判斷對不對。
10. （方案 D 才需要）用 Accessibility Insights 看 WT 分頁的 UIA 樹：TabItem 的 Name 是不是分頁標題、`SelectionItemPattern.Select()` 能不能切分頁。

## 建議

1. **先做方案 A，只承諾到視窗。** 一段 PowerShell 同時涵蓋 conhost 與 WT，不靠 `WT_SESSION`，也不需要 `wt.exe`。conhost 等於到位；WT 在多視窗時有用。`SetForegroundWindow` 回傳失敗、找到的是隱藏視窗、或目標視窗已經是前景視窗（也就是在同一個 WT 視窗的別的分頁）時，照舊跳 toast，訊息說明「在哪個資料夾，請自己切分頁」。不預設送 Alt 鍵。
2. **回報多記 `WT_SESSION`**（`session.start` 時 `$.env.get('WT_SESSION')`），用來在卡片上顯示「Windows Terminal」，也替 #19818 落地後的方案 C 預先準備。不拿它當判斷依據。
3. **分頁層級先不做。** B 被 WT 拒絕，C 缺查詢 API，D 靠標題比對太脆弱。真機確認第 10 點可行後，再考慮把 D 當成「比對到唯一一個分頁時才切」的加分項，另開 ticket。
4. 先跑完上面的真機確認，再開實作 ticket；實作 ticket 要求假世界能模擬 powershell 的輸出（`ok`、`hidden`、`denied`、`same-window`），比照 `tabScriptOf` 的 `ok`／`missing` 慣例。

## Comments

- 來源：PR #17（Windows 上點 Desktop 的 Session 用 `rundll32` 開 `claude://` 連結）之後，CLI Session 還跳不了，先研究再動手。

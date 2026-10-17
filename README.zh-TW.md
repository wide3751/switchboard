<p align="center">
  <img src="assets/logo.svg" width="440" alt="switchboard">
</p>

[English](README.md) | 繁體中文 | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Y8H028VWRF)

# switchboard：Claude Code 的 Session 監看視窗（Claude Code mod）

一個 **Claude Code plugin**，以 **Claude Code mods** 打造，把所有本機 Claude Code Session 列在一個 **監看視窗** Pane 裡，讓你一眼看出哪些 Session 在工作、哪些閒置、哪些**在等你**。Desktop Code 分頁裡的 Session，和 iTerm、Terminal.app、VS Code 終端機裡的 Session，都列在同一份清單上。Desktop 和終端機對等支援，只用其中一種也能完整使用。

<p align="center">
  <img src="assets/board/board.zh-TW.png" alt="switchboard 監看視窗：兩個需要你處理、兩個工作中、一個閒置（示意圖）" width="412">
</p>

<p align="center"><sub>示意圖：兩個需要你處理（一個待核准、一個待回答）、兩個工作中、一個閒置。</sub></p>

就像總機接線生看得到哪幾條線亮著燈，switchboard 讓每個 Session 自己回報狀態，再把在等你的排在最上面：

| 狀態 | 意義 | 例子 |
|---|---|---|
| **需要你處理** | 你不去看，事情就不會往前走 | 停在 `npm install` 的權限提示、用選項卡提問、Desktop 回合結尾的提問框、回合因 API 錯誤停下 |
| **工作中** | Claude 正在執行回合 | 思考、呼叫工具、執行 Subagent |
| **閒置** | 回合已結束，沒有被卡住 | 做完了在等下一個指令；你自己中斷的回合 |
| **已結束** | Session 已關閉或程序已不存在 | 立即從清單移除 |

**為什麼用文字提問算閒置？** 需要你處理只收明確的訊號（權限提示、選項卡、Desktop 回合結尾的提問框、錯誤），所以它亮起來時，一定是真的在等你。Claude 用一般文字提問時算閒置，你可以從那一列的最後回覆摘要看出來。

## 快速開始

```bash
claude plugin marketplace add wide3751/switchboard
claude plugin install switchboard@switchboard
```

接下來依你用 Claude Code 的地方，走其中一條（兩條都走也可以）：

**Desktop**：重新啟動 Claude Desktop，打開 Code 分頁裡的任何一個 Session。監看視窗會自動出現在右側，最上方顯示像 `▲ 2 個需要你處理` 這樣的一行；之後每個 Desktop Session 都會自動打開它。沒有出現的話，輸入 `/switchboard:open`。

**終端機**：重新啟動 `claude`。輸入框上方會出現 **▦ 打開監看視窗** 按鈕，有 Session 在等你時帶上等你計數，例如 **▦ 打開監看視窗 · ▲2**。點一下按鈕或輸入 `/switchboard:open`，監看視窗就出現在終端機裡。想讓它一直顯示，在監看視窗右上角的 **設定 ▸** 打開「所有 CLI Session 都顯示」；終端機要至少 144 欄寬才會自動打開（見[限制](#限制)）。

<p align="center">
  <img src="assets/board/terminal.zh-TW.png" alt="終端機裡的 switchboard 監看視窗：嵌在 Claude Code 輸入框上方（示意圖）" width="560">
</p>

<p align="center"><sub>示意圖：80 欄的終端機裡，監看視窗嵌在輸入框上方。標題前的 <code>❯</code> 是終端機裡的 Session，<code>◧</code> 是 Desktop，<code>✎</code> 是 VS Code。</sub></p>

清單上只有你自己這個 Session 時，監看視窗會提示「再開其他 Session（Desktop 或終端機）就會出現在這裡；安裝前就開著的要重開」。詳見[安裝](#安裝)與[使用方式](#使用方式)。

## 交給 AI 代理安裝

把這段貼給 Claude Code 或其他 coding agent：

> Install switchboard by following https://github.com/wide3751/switchboard/blob/main/README.md

## 系統需求

- macOS
- Claude Code，以下其中一種（兩種都用也可以）：
  - [Claude Desktop](https://claude.ai/download) app 的 Code 分頁
  - 終端機裡的 `claude`（iTerm、Terminal.app、VS Code 整合終端機等）
- 支援 mods 的 Claude Code 版本：在 **v2.1.299** 開發與測試；可以用的最低版本還沒確認。Desktop 在 Code 分頁輸入 `/status` 查看版本，終端機執行 `claude --version`。Desktop 自帶的 Claude Code 版本可能和終端機的不同，兩邊要分開看
- 選用：`git`（分支與變更資訊）、已登入的 [`gh`](https://cli.github.com/)（Pull Request 資訊）

## 安裝

1. 加入 marketplace 並安裝。有兩種方式，**建議用 GitHub**：

   **方式 A：從 GitHub（建議）**，不需要下載專案：

```bash
claude plugin marketplace add wide3751/switchboard
claude plugin install switchboard@switchboard
```

   之後要更新到新版本，先更新 marketplace，再更新 plugin，然後重新啟動 Claude Desktop 或 `claude`（對已安裝的 plugin 再跑一次 `install` 不會升級）：

```bash
claude plugin marketplace update switchboard
claude plugin update switchboard@switchboard
```

   **方式 B：從本機資料夾**，適合已經 clone 專案、想安裝自己修改的版本：

```bash
git clone https://github.com/wide3751/switchboard.git ~/Projects/switchboard
claude plugin marketplace add ~/Projects/switchboard
claude plugin install switchboard@switchboard
```

2. 重新啟動 Claude Desktop 或 `claude`，輸入 `/switchboard:open`，確認監看視窗有打開。

安裝前就已經開著的 Session 不會載入 mod。它們仍然會出現在監看視窗上，但只有基本狀態；重新啟動這些 Session 才會有完整細節。

## 解除安裝與停用

**暫時停用**（保留安裝，之後可以再打開）：

```bash
claude plugin disable switchboard@switchboard
```

要再打開時執行 `claude plugin enable switchboard@switchboard`。

**完整移除**：

```bash
claude plugin uninstall switchboard@switchboard
claude plugin marketplace remove switchboard
rm -rf ~/.claude/switchboard
```

- `marketplace remove` 會順便解除安裝這個 marketplace 的 plugin，所以只跑它也可以；跑過 `uninstall` 再跑它也沒問題
- `~/.claude/switchboard/` 放的是各 Session 的狀態回報，plugin 移除後不會自己刪掉。有設 `CLAUDE_CONFIG_DIR` 的話，改成刪除 `$CLAUDE_CONFIG_DIR/switchboard`
- 停用或移除後，重新啟動 Claude Desktop 和開著的 `claude` 才會生效

## 使用方式

| 指令 | 說明 |
|---|---|
| `/switchboard:open` | 在這個 Session 打開監看視窗，Desktop Session 和 CLI Session 都可以 |

**監看視窗上有什麼：**

- **最上方**：有幾個 Session 在等你，以及等最久的已經等了多久；至少有一個能跳轉時會寫「最長等待 3m · 點選標題前往」。Pane 標題也會帶上這個數字，例如 `Switchboard · 2`
- **分區**：需要你處理 → 工作中 → 閒置。需要你處理依進入的時間由舊到新，等最久的在最上面（頁首的「最長」就是第一張卡片），新進來的加在底部；工作中依 Session 開始的時間排，核准來回不會改變位置；閒置依最後活動時間由新到舊。閒置再久也不會自動消失，閒置區可以收合
- **帳號用量**：訂閱制顯示 5 小時與每週的 rate limit 使用率和重置時間；API 計費顯示所有 Session 的總花費。平常放在清單最後，不擠掉需要你處理的卡片；5 小時或每週用量達到 95% 時才移到最上方的狀態列下面
- **標題**：Desktop 的 Session 用它自己的標題，用 `/rename` 改過名的 CLI Session 用那個名稱；其他 CLI Session 用第一句 prompt 的前約 40 字，還沒送出 prompt 時用專案資料夾名稱（worktree 用 repo 名稱）。標題相同的幾列會補上分支名，分不出來時依 Session 開始的先後補 `#2`、`#3`。標題前一格的符號表示 Session 在哪裡：`◧` Claude Desktop、`❯` 終端機（iTerm、Terminal.app 等）、`✎` VS Code 整合終端機。你所在的 Session 標示「目前」，監看視窗太窄時改成 `✦`
- **點標題** 就跳轉到那個 Session：Desktop Session 切到 Claude Desktop 裡對應的 Session；iTerm、Terminal.app 裡的 CLI Session 切到對應的分頁。這些 Session 在需要你處理時另外有 **前往處理 →**
- 每一列的 **展開 ▾** 會顯示其餘細節
- **設定 ▸** 打開下面的設定

監看視窗關著時，Desktop Session 和 CLI Session 的輸入框上方都會有 **▦ 打開監看視窗** 按鈕，點一下就打開，不用輸入指令。有 Session 在等你時，按鈕會帶上等你計數，例如 **▦ 打開監看視窗 · ▲2**（最多晚約 15 秒）；沒有 Session 在等你、或暫時看不到 Session 狀態時，只顯示按鈕本身。只用終端機時，這是監看視窗沒開時唯一的訊號。

在某個 Session 手動關掉監看視窗後，那個 Session 不會再自動打開，直到重開 Session、再次輸入 `/switchboard:open` 或按這個按鈕。開著自動打開時關掉，會跳一則提示說明這點；要所有 Session 都不再自動打開，到 **設定 ▸** 取消「所有 Desktop Session 都顯示」或「所有 CLI Session 都顯示」。

### 在終端機裡

在 CLI Session（iTerm、Terminal.app、VS Code 整合終端機）輸入 `/switchboard:open`，監看視窗就出現在那個終端機裡，內容和 Desktop 一樣，依終端機寬度截斷。終端機全螢幕且至少 110 欄寬時停靠在對話旁邊，否則嵌在輸入框上方。

終端機不回報滑鼠點擊時，用鍵盤操作（以下是 Claude Code 的預設快捷鍵）：

| 按鍵 | 動作 |
|---|---|
| `ctrl+x tab` | 從輸入框移進監看視窗（監看視窗關著時，移到輸入框上方的 **▦ 打開監看視窗** 按鈕） |
| `tab`／`shift+tab` | 在監看視窗裡的按鈕和標題之間移動 |
| `enter` | 按下目前的按鈕或標題 |
| `↑`／`↓` | 捲動監看視窗 |
| `esc` | 回到輸入框，監看視窗留著 |
| `ctrl+x x` | 關掉監看視窗（也可以點外框右上角的 ✕） |

**支援的終端機：**

| `claude` 在哪裡執行 | 列在清單上 | 打開監看視窗 | 點標題跳轉 | 實測 |
|---|---|---|---|---|
| Claude Desktop 的 Code 分頁 | ✓ | ✓ | ✓ 切到那個 Session | ✓ |
| iTerm | ✓ | ✓ | ✓ 切到對應的分頁 | ✓ |
| Terminal.app | ✓ | ✓ | ✓ 切到對應的分頁 | ✓ |
| VS Code 整合終端機 | ✓ | ✓ | 顯示資料夾 | 還沒 |
| 其他終端機（Warp、Ghostty 等）與 tmux | ✓ | ✓ | 顯示資料夾 | 部分（tmux：列在清單、打開監看視窗） |
| VS Code 擴充套件（圖形介面） | — | ✕ | — | 還沒 |

任何終端機裡的 Session 都會列在清單上並回報狀態，因為這只靠 Claude Code 本身。跳轉需要終端機允許別的 app 切換它的分頁，所以目前只支援 iTerm 和 Terminal.app。在 tmux 裡執行的 Session 算是 tmux，不是外層的終端機，所以也只會顯示資料夾。iTerm 和 Terminal.app 的每一項都實際測過，包含跳轉。tmux 只測了列在清單和打開監看視窗。VS Code 整合終端機、Warp、Ghostty 和 VS Code 擴充套件還沒測過，表格裡寫的是預期的行為。

**跳轉到 iTerm、Terminal.app：** 第一次跳轉時，macOS 會詢問是否允許 Claude Desktop（或執行 Claude Code 的終端機）控制 iTerm 或 Terminal，要按允許。拒絕過的話，到「系統設定 › 隱私權與安全性 › 自動化」打開，switchboard 這時也會顯示指向這裡的提示。跳不過去時會顯示原因和 Session 所在的資料夾：

- VS Code、Warp、Ghostty 等不支援的終端機：「VS Code 裡的 Session 還不能直接跳轉，它在 …」
- 0.6.0 之前開的 CLI Session（沒有記下終端機）：「重開這個 Session 後才能跳轉」
- 終端機 10 秒內沒有回應：放棄跳轉，顯示「沒辦法切換到…」

### 有 Session 在等你時通知你

switchboard 自己不發通知（[ADR-0005](docs/adr/0005-no-own-needs-you-alert.md)）。權限提示、提問時的提醒交給 Claude Code 和 Claude Desktop 本身的通知：

- **終端機**：在 `claude` 裡輸入 `/config`，設定通知方式（依版本顯示為 **Notifications** 或 **Local notifications**）。預設的 `auto` 在 iTerm、kitty、Ghostty 會發桌面通知，在 Terminal.app 是響鈴；VS Code、Warp、tmux 等其他終端機用 `auto` 不會有任何通知，可以改成 `terminal_bell`。另外到「系統設定 › 通知」允許你的終端機 app 發通知
- **Claude Desktop**：到「系統設定 › 通知」允許 Claude 發通知

**設定**（**設定 ▸** 面板；全域儲存，所有 Session 共用。在一個 Session 改了設定，其他開著的監看視窗下次更新時，約 3 秒內就跟著變）：

| 名稱 | 預設 | 可選值 |
|---|---|---|
| 所有 Desktop Session 都顯示 | 開啟 | 開啟：Desktop Session 啟動或回合結束時自動打開監看視窗，切換 Session 時它一直都在；關閉：只在輸入過 `/switchboard:open` 的 Session 顯示 |
| 所有 CLI Session 都顯示 | 關閉 | 開啟：CLI Session（在終端機執行的 `claude`）啟動或回合結束時自動打開監看視窗；關閉：只在輸入過 `/switchboard:open` 的 Session 顯示。和 Desktop 那一項分開設定 |
| 語言 | 自動 | 自動、EN、日本語、한국어、简中、繁中。自動時依序看環境變數 `LC_ALL`、`LANG`，都沒有（或是 `C`、`POSIX`）時才看 macOS 的語言偏好，最後是英文。所以終端機裡通常跟著 `LANG`，Desktop 通常跟著 macOS 語言 |
| 計費 | 自動 | 自動、訂閱制（顯示 rate limit）、API（顯示花費） |
| 套用到 | 工作中 | 下面的密度和欄位要套用到哪一區：需要你處理、工作中、閒置 |
| 密度 | 各區不同 | 精簡、標準、詳細；自己挑欄位時顯示為自訂 |

每一列可以顯示的 **欄位**：

| 欄位 | 顯示內容 |
|---|---|
| 時間 | 在目前狀態待了多久 |
| 位置 | 專案資料夾 |
| 分支 | git 分支、ahead/behind、未 commit 的檔案數 |
| 變更行數 | 相對基底分支的新增／刪除行數，和 Desktop 的 Changes 一致 |
| PR | 這個分支的 Pull Request；有未推送的變更又沒有 PR 時，**前往建立 PR →** 會跳到那個 Session（Desktop 和 iTerm、Terminal.app 的 Session） |
| 進度 | 待辦清單的完成度與目前項目 |
| 目前動作 | 正在進行的工具呼叫 |
| 背景任務 | 執行中的 Subagent 與背景 shell 指令 |
| Context | context window 使用率 |
| 連接器 | 已連線的 MCP 連接器，以及需要驗證的 |
| 最後回覆 | Claude 最近一則回覆的簡短節錄 |
| 模型 | 使用的模型；進行中的 Session 用了和其他不同的模型時一定顯示 |
| 用量 | 回合數，API 計費時加上花費 |
| 環境 | Worktree 或 Remote Control |
| 來源 | CLI Session 所在終端機的名稱（標題前的符號一律顯示） |
| 完整路徑 | 完整的工作目錄 |

需要你處理的列一定會顯示核准請求摘要（想執行的指令）、問題和選項，或讓回合停下的錯誤。

### 範例

開著三個 Desktop Session：一個卡在權限提示、一個在工作、一個做完了。監看視窗最上方顯示：

```
▲ 1 個需要你處理
核准 1 · 最長等待 3m · 點選標題前往
```

那一列會顯示它想執行的指令，例如 `$ npm install jsonwebtoken`，旁邊有 **前往處理 →**。

沒有在等你的時候：

```
✓ 沒有 Session 需要你處理
工作中 1 · 閒置 2
```

## 限制

- **只支援 macOS**：監看視窗可以在 Claude Desktop 和終端機裡的 Claude Code 打開；VS Code 擴充套件的圖形介面不支援。在 Linux 等其他系統上 `/switchboard:open` 照樣會打開，但會說明點卡片跳轉不能用；Windows 沒有 `ps`，看不到 Session 狀態。
- **CLI Session 只能跳轉到 iTerm 和 Terminal.app**：其他終端機（VS Code、Warp、Ghostty 等）點下去只會顯示它所在的資料夾。
- **終端機太窄時不會自動打開**：打開「所有 CLI Session 都顯示」後，Claude Code 只在終端機至少 144 欄寬（在這裡打開過的話 110 欄）時才畫出自動打開的 Pane。在那之前輸入框上方會一直有 **▦ 打開監看視窗** 按鈕；按下按鈕或輸入 `/switchboard:open`，不管多窄都會打開。把終端機拉寬，等待中的監看視窗也會自己出現。
- **以 polling 更新**：監看視窗每 3 秒一次，狀態變化會在幾秒內反映，不是即時。每個顯示監看視窗的 Session 都會各自掃描。監看視窗沒開的 Session 每 15 秒做一次輕量掃描（只讀 Session 紀錄和狀態回報、跑一次 `ps`，不跑 `git`、`gh`），讓打開按鈕帶上等你計數；所以按鈕上的數字和監看視窗的數字短時間內可能不一致。
- **沒有載入 mod 的 Session 只有基本狀態**：沒有出錯中止、核准請求摘要和最後回覆，例如安裝前就開著的 Session。
- **只列本機 Session**：不列 Subagent 和雲端 Session。

## 疑難排解

| 症狀 | 處理方式 |
|---|---|
| `/switchboard:open` 回覆 hooks 沒有載入 | 1. 確認 Claude Code 版本支援 mods，不支援就更新。2. 重開這個 Session：安裝前就開著的 Session 不會載入。3. 還是不行，用 `claude --debug` 啟動，在 debug log 查看 `hooks module switchboard` 的錯誤訊息 |
| 指令回覆這裡無法顯示監看視窗 | 你在 VS Code 擴充套件的圖形介面輸入了指令；改到 Desktop 的 Code 分頁，或終端機裡的 Claude Code 輸入 |
| 頁首顯示 `⚠ 目前看不到 Session 狀態`，下面說找不到任何 Session 紀錄，連目前這個都沒有 | Claude Code 版本太舊、還不寫 Session 紀錄，或 `CLAUDE_CONFIG_DIR` 指到 Claude Code 實際用的以外的資料夾 |
| 頁首顯示 `⚠ 目前看不到 Session 狀態`，下面說讀不到某個資料夾 | 確認那個資料夾存在、你有讀取權限；有設 `CLAUDE_CONFIG_DIR` 的話，確認它指向 Claude Code 實際使用的資料夾 |
| 某一列顯示 `未載入 switchboard，僅基本狀態` | 那個 Session 在安裝前就開著；重新啟動它 |
| 沒有顯示 PR | 安裝 `gh` 並執行 `gh auth login`；Session 的資料夾必須是 GitHub repository |
| 點 CLI Session 只顯示路徑 | 只有 iTerm、Terminal.app 能跳轉；其他終端機請自己切過去。iTerm、Terminal.app 也跳不過去時，依提示到「系統設定 › 隱私權與安全性 › 自動化」允許控制它們，或重新啟動那個 Session（0.6.0 之前開的 Session 沒有記下終端機） |
| 打開了「所有 CLI Session 都顯示」，終端機裡卻沒有監看視窗 | 終端機太窄（不到 144 欄），自動打開的 Pane 不會畫出來。按輸入框上方的 **▦ 打開監看視窗**、輸入 `/switchboard:open`，或把終端機拉寬 |
| 修改程式碼後沒有效果 | 已安裝的副本依 `plugin.json` 的 `version` 快取。調高版本號，執行 `claude plugin update switchboard@switchboard` 後重新啟動 |

## 隱私與資料

switchboard 完全在你的 Mac 上執行，不會把資料送到任何自己的服務。

- **寫在本機**：每個 Session 的狀態回報，以明碼 JSON 存在 `<Claude 設定目錄>/switchboard/reports/<sessionId>.json`，內容有第一句 prompt 的前約 40 字（當作標題）、模型、分支、待辦進度、目前動作、核准請求摘要、問題、錯誤、最後回覆的簡短節錄、背景任務、rate limit、連接器和 Pull Request。Session 結束至少一分鐘後，下次有任何 Session 掃描時，它的回報就會被刪除；從沒開過監看視窗也一樣。一筆 session 紀錄都找不到時不刪
- **遮罩只是盡力而為**：寫入前，指令、核准請求摘要、問題、第一句 prompt、最後回覆的節錄和錯誤訊息裡疑似機密的片段（例如 `Bearer …`、`token=…`、`--token …`、`API_KEY=…`、`sk-…`、`ghp_…`）會換成 `•••`。不保證抓得到全部，指令的其餘部分仍以明碼存放
- **在本機讀取**：Claude Code 自己的 `~/.claude/sessions/*.json` 紀錄和這些狀態回報。不會讀其他 Session 的 `.jsonl` 對話紀錄
- **會執行的指令**：`git`（分支與變更）、`gh pr view`（Pull Request，會用你自己的 `gh` 登入連到 GitHub）、`ps`（哪些 Session 還活著；監看視窗沒開時也每 15 秒跑一次，給打開按鈕的計數）、`defaults read -g AppleLanguages`（介面語言）、`open`（跳轉到 Session）、`osascript`（切到 iTerm、Terminal.app 對應的分頁）

## 運作原理

每個 Session 都會載入 mod，它有兩個職責：

1. **回報者**：監聽自己所在 Session 的事件（`session.start`、`turn.start`、`tool.call`、`turn.complete` 等），寫出狀態回報。
2. **監看視窗**：顯示監看視窗的 Session 每 3 秒把狀態回報和 Claude Code 的 Session 紀錄合併，排除程序已不存在的 Session，再繪製清單。沒開監看視窗的 Session 改成每 15 秒做一次同樣的合併，只算等你計數給輸入框上方的按鈕用，不跑 `git`、`gh`。

Session 存不存在，只看 Claude Code 自己的紀錄和程序是否還活著，所以殘留的狀態回報不會讓已結束的 Session 繼續出現在清單上。兩個來源不一致時，以較新的為準。

## 參與貢獻

歡迎提出 Issue 和 Pull Request。修改行為之前，請先讀 [GLOSSARY.md](GLOSSARY.md) 的用語和 [docs/adr/](docs/adr/) 的決策。新增或修改介面文字時，請同步更新 [agens-view/hooks/i18n.ts](agens-view/hooks/i18n.ts) 的五種語言。

## 文件

- [GLOSSARY.md](GLOSSARY.md)：用語（Session、需要你處理、監看視窗、狀態回報…）
- [docs/adr/](docs/adr/)：架構決策

## 授權

[MIT](LICENSE)

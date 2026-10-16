<p align="center">
  <img src="assets/logo.svg" width="440" alt="switchboard">
</p>

[English](README.md) | 繁體中文 | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Y8H028VWRF)

# switchboard：Claude Code 的 Session 監看視窗（Claude Code mod）

一個 **Claude Code plugin**，以 **Claude Code mods** 打造，把所有本機 Claude Code Session 列在一個 **監看視窗** Pane 裡，讓你一眼看出哪些 Session 在工作、哪些閒置、哪些**在等你**。Desktop Code 分頁裡的 Session，和 iTerm、Terminal.app、VS Code 終端機裡的 Session，都列在同一份清單上。監看視窗在 Desktop 和終端機裡的 Claude Code 都能打開。

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

重新啟動 Claude Desktop，然後在 Code 分頁：

1. 輸入 `/switchboard:open`，或按輸入框上方的 **▦ 打開監看視窗**
2. 監看視窗會出現在右側，最上方顯示像 `▲ 2 個需要你處理` 這樣的一行

之後每個 Desktop Session 預設都會自動打開監看視窗。詳見[安裝](#安裝)與[使用方式](#使用方式)。

## 交給 AI 代理安裝

把這段貼給 Claude Code 或其他 coding agent：

> Install switchboard by following https://github.com/wide3751/switchboard/blob/main/README.md

## 系統需求

- macOS
- 有 Code 分頁的 [Claude Desktop](https://claude.ai/download) app
- 支援 mods 的 Claude Code（在 **v2.1.299** 開發與測試；在 Code 分頁輸入 `/status` 查看版本）
- 選用：`git`（分支與變更資訊）、已登入的 [`gh`](https://cli.github.com/)（Pull Request 資訊）

## 安裝

1. 加入 marketplace 並安裝。有兩種方式，**建議用 GitHub**：

   **方式 A：從 GitHub（建議）**，不需要下載專案：

```bash
claude plugin marketplace add wide3751/switchboard
claude plugin install switchboard@switchboard
```

   之後要更新到新版本，先更新 marketplace，再更新 plugin，然後重新啟動 Claude Desktop（對已安裝的 plugin 再跑一次 `install` 不會升級）：

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

2. 重新啟動 Claude Desktop，在 Code 分頁輸入 `/switchboard:open`，確認監看視窗有打開。

安裝前就已經開著的 Session 不會載入 mod。它們仍然會出現在監看視窗上，但只有基本狀態；重新啟動這些 Session 才會有完整細節。

## 使用方式

| 指令 | 說明 |
|---|---|
| `/switchboard:open` | 在這個 Session 打開監看視窗，Desktop Session 和 CLI Session 都可以 |

**監看視窗上有什麼：**

- **最上方**：有幾個 Session 在等你，以及等最久的已經等了多久。Pane 標題也會帶上這個數字，例如 `Switchboard · 2`
- **帳號用量**：訂閱制顯示 5 小時與每週的 rate limit 使用率和重置時間；API 計費顯示所有 Session 的總花費
- **分區**：需要你處理 → 工作中 → 閒置；同一區內依最後活動時間由新到舊。閒置再久也不會自動消失，閒置區可以收合
- **點標題** 就跳轉到那個 Session：Desktop Session 切到 Claude Desktop 裡對應的 Session；iTerm、Terminal.app 裡的 CLI Session 切到對應的分頁。需要你處理的列另外有 **前往處理 →**
- 每一列的 **展開 ▾** 會顯示其餘細節
- **檢視** 打開下面的設定

Desktop Session 和 CLI Session 的監看視窗關著時，輸入框上方都會有 **▦ 打開監看視窗** 按鈕，點一下就打開，不用輸入指令。在某個 Session 關掉監看視窗後，那個 Session 不會再自動打開，直到再次輸入 `/switchboard:open` 或按這個按鈕。

在 CLI Session（iTerm、Terminal.app、VS Code 整合終端機）輸入 `/switchboard:open`，監看視窗就出現在那個終端機裡，內容和 Desktop 一樣，依終端機寬度截斷。終端機全螢幕且夠寬時停靠在對話旁邊，否則嵌在輸入框上方。終端機不回報滑鼠點擊時，可以用鍵盤移進 Pane、用方向鍵選、按 Enter。

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

**設定**（**檢視** 面板；全域儲存，所有 Session 共用）：

| 名稱 | 預設 | 可選值 |
|---|---|---|
| 所有 Desktop Session 都顯示 | 開啟 | 開啟：Desktop Session 啟動或回合結束時自動打開監看視窗，切換 Session 時它一直都在；關閉：只在輸入過 `/switchboard:open` 的 Session 顯示 |
| 所有 CLI Session 都顯示 | 關閉 | 開啟：CLI Session（在終端機執行的 `claude`）啟動或回合結束時自動打開監看視窗；關閉：只在輸入過 `/switchboard:open` 的 Session 顯示。和 Desktop 那一項分開設定 |
| 語言 | 自動 | 自動（跟隨 macOS 語言）、EN、日本語、한국어、简中、繁中 |
| 計費 | 自動 | 自動、訂閱制（顯示 rate limit）、API（顯示花費） |
| 設定 | 工作中 | 下面的密度和欄位要套用到哪一區：待處理、工作中、閒置 |
| 密度 | 各區不同 | 精簡、標準、詳細；自己挑欄位時顯示為自訂 |

每一列可以顯示的 **欄位**：

| 欄位 | 顯示內容 |
|---|---|
| 時間 | 在目前狀態待了多久 |
| 位置 | 專案資料夾 |
| 分支 | git 分支、ahead/behind、未 commit 的檔案數 |
| 變更行數 | 相對基底分支的新增／刪除行數，和 Desktop 的 Changes 一致 |
| PR | 這個分支的 Pull Request；Desktop Session 有未推送的變更又沒有 PR 時，**建立 PR ↗** 會跳轉過去 |
| 進度 | 待辦清單的完成度與目前項目 |
| 目前動作 | 正在進行的工具呼叫 |
| 背景任務 | 執行中的 Subagent 與背景 shell 指令 |
| Context | context window 使用率 |
| 連接器 | 已連線的 MCP 連接器，以及需要驗證的 |
| 最後回覆 | Claude 最近一則回覆的簡短節錄 |
| 模型 | 使用的模型；進行中的 Session 用了和其他不同的模型時一定顯示 |
| 用量 | 回合數，API 計費時加上花費 |
| 環境 | Worktree 或 Remote |
| 來源 | CLI Session 所在的終端機 |
| 完整路徑 | 完整的工作目錄 |

需要你處理的列一定會顯示核准請求摘要（想執行的指令）、問題和選項，或讓回合停下的錯誤。

### 範例

開著三個 Session：一個卡在權限提示、一個在工作、一個做完了。監看視窗最上方顯示：

```
▲ 1 個需要你處理
核准 1 · 最長 3m
```

那一列會顯示它想執行的指令，例如 `$ npm install jsonwebtoken`，旁邊有 **前往處理 →**。

沒有在等你的時候：

```
✓ 無待處理項目
工作中 1 · 閒置 2
```

## 限制

- **只支援 macOS**：監看視窗可以在 Claude Desktop 和終端機裡的 Claude Code 打開；VS Code 擴充套件的圖形介面不支援。CLI Session 預設不會自動打開，要輸入 `/switchboard:open`，或在檢視面板打開「所有 CLI Session 都顯示」。
- **CLI Session 只能跳轉到 iTerm 和 Terminal.app**：其他終端機（VS Code、Warp、Ghostty 等）點下去只會顯示它所在的資料夾。第一次跳轉時，macOS 會詢問是否允許控制 iTerm 或 Terminal，要按允許。
- **終端機太窄時不會自動打開**：打開「所有 CLI Session 都顯示」後，Claude Code 只在終端機至少 144 欄寬（在這裡打開過的話 110 欄）時才畫出自動打開的 Pane。在那之前輸入框上方會一直有 **▦ 打開監看視窗** 按鈕；按下按鈕或輸入 `/switchboard:open`，不管多窄都會打開。把終端機拉寬，等待中的監看視窗也會自己出現。
- **以 polling 更新**：每 3 秒一次，狀態變化會在幾秒內反映，不是即時。每個顯示監看視窗的 Session 都會各自掃描。
- **沒有載入 mod 的 Session 只有基本狀態**：沒有出錯中止、核准請求摘要和最後回覆，例如安裝前就開著的 Session。
- **只列本機 Session**：不列 Subagent 和雲端 Session。

## 疑難排解

| 症狀 | 處理方式 |
|---|---|
| `/switchboard:open` 回覆 hooks 沒有載入 | 用 `claude --debug` 或 debug log 查看 `hooks module switchboard` 的錯誤訊息 |
| 指令回覆這裡無法顯示監看視窗 | 你在 VS Code 擴充套件的圖形介面輸入了指令；改到 Desktop 的 Code 分頁，或終端機裡的 Claude Code 輸入 |
| 某一列顯示 `未載入 switchboard，僅基本狀態` | 那個 Session 在安裝前就開著；重新啟動它 |
| 沒有顯示 PR | 安裝 `gh` 並執行 `gh auth login`；Session 的資料夾必須是 GitHub repository |
| 點 CLI Session 只顯示路徑 | 只有 iTerm、Terminal.app 能跳轉；其他終端機請自己切過去。iTerm、Terminal.app 也只顯示路徑時，到「系統設定 › 隱私權與安全性 › 自動化」允許控制它們，或重新啟動那個 Session（安裝新版前就開著的 Session 沒有記下終端機） |
| 打開了「所有 CLI Session 都顯示」，終端機裡卻沒有監看視窗 | 終端機太窄（不到 144 欄），自動打開的 Pane 不會畫出來。按輸入框上方的 **▦ 打開監看視窗**、輸入 `/switchboard:open`，或把終端機拉寬 |
| 修改程式碼後沒有效果 | 已安裝的副本依 `plugin.json` 的 `version` 快取。調高版本號，執行 `claude plugin update switchboard@switchboard` 後重新啟動 |

## 隱私與資料

switchboard 完全在你的 Mac 上執行，不會把資料送到任何自己的服務。

- **寫在本機**：每個 Session 的狀態回報，放在 `<Claude 設定目錄>/switchboard/reports/<sessionId>.json`，內容有模型、分支、待辦進度、目前動作、核准請求摘要、問題、錯誤、最後回覆的簡短節錄、背景任務、rate limit、連接器和 Pull Request。已不存在的 Session 的回報會被刪除
- **在本機讀取**：Claude Code 自己的 `~/.claude/sessions/*.json` 紀錄和這些狀態回報。不會讀其他 Session 的 `.jsonl` 對話紀錄
- **會執行的指令**：`git`（分支與變更）、`gh pr view`（Pull Request，會用你自己的 `gh` 登入連到 GitHub）、`ps`（哪些 Session 還活著）、`defaults read -g AppleLanguages`（介面語言）、`open`（跳轉到 Session）、`osascript`（切到 iTerm、Terminal.app 對應的分頁）

## 運作原理

每個 Session 都會載入 mod，它有兩個職責：

1. **回報者**：監聽自己所在 Session 的事件（`session.start`、`turn.start`、`tool.call`、`turn.complete` 等），寫出狀態回報。
2. **監看視窗**：只在顯示監看視窗的 Session 執行。每 3 秒把狀態回報和 Claude Code 的 Session 紀錄合併，排除程序已不存在的 Session，再繪製清單。

Session 存不存在，只看 Claude Code 自己的紀錄和程序是否還活著，所以殘留的狀態回報不會讓已結束的 Session 繼續出現在清單上。兩個來源不一致時，以較新的為準。

## 參與貢獻

歡迎提出 Issue 和 Pull Request。修改行為之前，請先讀 [CONTEXT.md](CONTEXT.md) 的用語和 [docs/adr/](docs/adr/) 的決策。新增或修改介面文字時，請同步更新 [agens-view/hooks/i18n.ts](agens-view/hooks/i18n.ts) 的五種語言。

## 文件

- [CONTEXT.md](CONTEXT.md)：用語（Session、需要你處理、監看視窗、狀態回報…）
- [docs/adr/](docs/adr/)：架構決策

## 授權

[MIT](LICENSE)

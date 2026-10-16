Status: ready-for-agent

# CLI Session 的監看視窗

## Problem Statement

我常常在 iTerm、Terminal.app 或 VS Code 的整合終端機裡用 Claude Code。switchboard 會把我的 **CLI Session** 列進清單、寫出 **狀態回報**、發出 **需要你處理通知**，但 **監看視窗** 只能在 Claude Desktop 打開。在 CLI Session 輸入 `/switchboard:open` 只會收到「請到 Desktop 開」的提示。結果是：我在終端機工作時，想知道哪個 Session 在等我，就得切回 Desktop 才看得到清單；如果我那天根本沒開 Desktop，就完全看不到。

## Solution

**CLI Session** 也可以打開 **監看視窗**，內容和 Desktop 的一樣（同一份清單、同一套設定），排版依終端機寬度調整：

- 在 CLI Session 輸入 `/switchboard:open`，就在那個終端機打開監看視窗。
- 新增設定「所有 CLI Session 都顯示」，預設關閉，和既有的「所有 Desktop Session 都顯示」分開控制。打開後，CLI Session 啟動和每個回合結束時都會自動打開監看視窗。
- 監看視窗沒有畫出來時，CLI 的輸入框上方和 Desktop 一樣有「▦ 打開監看視窗」按鈕。
- 跳轉維持現狀：點 Desktop Session 會切到 Desktop；點 CLI Session 只顯示它所在的資料夾。

決策紀錄見 ADR-0004（部分取代 ADR-0003）。

## User Stories

1. 身為在終端機工作的開發者，我想在 CLI Session 輸入 `/switchboard:open` 就打開監看視窗，這樣我不用切回 Desktop 也看得到所有 Session 的狀態。
2. 身為在終端機工作的開發者，我想讓 CLI 的監看視窗列出和 Desktop 一樣的所有本機 Session（Desktop 和 CLI 在同一份清單），這樣不管從哪裡看，資訊都一致。
3. 身為在終端機工作的開發者，我想在 CLI 的監看視窗最上方看到 **等你計數** 和等最久的時間，這樣我一眼就知道有沒有 Session 在等我。
4. 身為在終端機工作的開發者，我想讓 CLI 的監看視窗依 **需要你處理** → **工作中** → **閒置** 排序，規則和 Desktop 一樣，這樣我不用重新學一套。
5. 身為在終端機工作的開發者，我想讓目前這個 CLI Session 也出現在清單上並標示為「目前這個」，這樣我知道哪一列是我自己。
6. 身為在終端機工作的開發者，我想讓 Pane 標題帶上等你計數（例如 `Switchboard · 2`），這樣 Pane 收在分頁時也看得到數字。
7. 身為在終端機工作的開發者，我想讓 CLI 的監看視窗每 3 秒更新一次，和 Desktop 一樣，這樣狀態變化會在幾秒內反映。
8. 身為在終端機工作的開發者，我想在 **待核准** 的列看到 **核准請求摘要**、在 **待回答** 的列看到問題和選項、在 **出錯中止** 的列看到錯誤，這樣不用切過去就知道要處理什麼。
9. 身為在終端機工作的開發者，我想在 **閒置** 的列看到 **最後訊息摘要**，這樣我能判斷它是不是其實在用文字問我問題。
10. 身為在終端機工作的開發者，我想在 CLI 的監看視窗打開檢視面板，調整密度、欄位、語言和計費顯示，這樣我能在終端機裡自己決定要看多少細節。
11. 身為同時用 Desktop 和終端機的開發者，我想讓密度、欄位、語言等設定在 Desktop 和 CLI 之間完全共用，這樣我只需要設定一次。
12. 身為在終端機工作的開發者，我想讓長標題依終端機寬度截斷、但時間仍然留著，這樣窄終端機上的清單也不會亂掉。
13. 身為在終端機工作的開發者，我想讓每一列的「展開 ▾」在終端機也能用，這樣我能看到收起來的細節。
14. 身為在終端機工作的開發者，我想讓閒置區在終端機也能收合，這樣閒置的 Session 很多時不會把清單撐得太長。
15. 身為想常駐看清單的開發者，我想在檢視面板打開「所有 CLI Session 都顯示」，這樣之後每個 CLI Session 都會自動打開監看視窗。
16. 身為只想用乾淨終端機的開發者，我想讓「所有 CLI Session 都顯示」預設關閉，這樣安裝或更新 switchboard 後，我的終端機不會突然多出一個 Pane。
17. 身為同時用 Desktop 和終端機的開發者，我想讓「所有 CLI Session 都顯示」和「所有 Desktop Session 都顯示」分開控制，這樣我可以讓 Desktop 一直顯示、CLI 只在需要時開。
18. 身為開了「所有 CLI Session 都顯示」的開發者，我想讓 CLI Session 一啟動就自動打開監看視窗，這樣我不用每次都輸入指令。
19. 身為開了「所有 CLI Session 都顯示」的開發者，我想讓已經開著的 CLI Session 在下一個回合結束時補開監看視窗，這樣改了設定之後不用重新啟動 Session。
20. 身為開了「所有 CLI Session 都顯示」的開發者，我想在某個 CLI Session 手動關掉監看視窗後，那個 Session 就不再自動打開，直到我再次輸入 `/switchboard:open` 或按下按鈕，這樣我關掉的東西不會一直跳回來。
21. 身為在終端機工作的開發者，我想在監看視窗沒有畫出來時，看到輸入框上方的「▦ 打開監看視窗」按鈕，這樣我不用記指令也能打開。
22. 身為在終端機工作的開發者，我想按下「▦ 打開監看視窗」就打開監看視窗，然後按鈕消失，這樣輸入框上方不會同時有按鈕和 Pane。
23. 身為用窄終端機的開發者，我想在「所有 CLI Session 都顯示」打開、但終端機太窄導致監看視窗沒畫出來時，仍然看到「▦ 打開監看視窗」按鈕，這樣我不會兩邊都看不到。
24. 身為用窄終端機的開發者，我想按下按鈕後，不管終端機多窄監看視窗都會出現，這樣我在需要時一定看得到清單。
25. 身為用全螢幕終端機的開發者，我想讓監看視窗在夠寬時停靠在對話旁邊，這樣它不會擠壓我的對話紀錄。
26. 身為在終端機工作的開發者，我想在 CLI 的監看視窗點一個 Desktop Session 的標題，就把 Claude Desktop 帶到前面並切到那個 Session，這樣我能直接去處理。
27. 身為在終端機工作的開發者，我想在 CLI 的監看視窗點一個 CLI Session，看到它所在的資料夾，這樣即使還不能跳轉，我也知道要去哪個終端機找。
28. 身為在終端機工作的開發者，我想點「目前這個」時什麼都不發生，和 Desktop 一樣，這樣不會有奇怪的跳轉。
29. 身為用鍵盤操作終端機的開發者，我想能用 Claude Code 的 Pane 鍵盤操作（移進 Pane、方向鍵、Enter）按到監看視窗上的按鈕，這樣在不回報滑鼠點擊的終端機也能用。
30. 身為用 VS Code 擴充套件的開發者，我想在擴充套件的圖形介面輸入 `/switchboard:open` 時，仍然收到提示說這裡不支援，這樣我不會以為 mod 壞了。
31. 身為在終端機工作的開發者，我想讓 CLI 監看視窗的所有文字跟著語言設定（自動、EN、日本語、한국어、简中、繁中），這樣和 Desktop 一致。
32. 身為沒有開監看視窗的 CLI Session 的使用者，我想讓這個 Session 照樣寫出狀態回報、照樣發出需要你處理通知，這樣其他地方的監看視窗仍然看得到它。
33. 身為在終端機工作的開發者，我想讓沒有打開監看視窗的 CLI Session 不掃描其他 Session，這樣不會白白消耗資源。
34. 身為在終端機工作的開發者，我想讓 CLI 的監看視窗在我關掉 Pane 後就停止 polling，這樣關掉之後不會繼續掃描。
35. 身為讀 README 的新使用者，我想看到 `/switchboard:open` 在 CLI 也能用、以及「所有 CLI Session 都顯示」這個設定，這樣我知道終端機也能看清單。
36. 身為讀 README 的新使用者，我想在「限制」和「疑難排解」看到更新過的說明，不再寫「CLI 不顯示任何畫面」，這樣文件和實際行為一致。

## Implementation Decisions

- **只改 mod 的 hooks module 和介面文字**，不新增模組。Pane 的畫法本來就透過 `$.ui.resolve(e)` 取元件，兩種介面共用同一棵樹；Desktop 專用的焦點處理（Pane 沒焦點時第一下點擊）只在 `desktop` 介面生效，不影響 `terminal`。
- **指令**：`/switchboard:open` 在 `desktop` 或 `terminal` 介面都打開 Pane；只有在兩者都沒有（例如 `vscode`）時才回「不支援」的提示。提示文字從「請到 Desktop 開」改成說明可以在 Desktop 或終端機開。指令描述拿掉「僅 Desktop」。
- **設定**：在 mod 的全域設定（store 裡的 view）新增一個布林值，代表「所有 CLI Session 都顯示」，預設 `false`。既有的「所有 Desktop Session 都顯示」維持原本的鍵和預設 `true`。檢視面板多一個勾選項，和 Desktop 那一項並列；兩項都在任一介面顯示、都可以切換。
- **自動打開**：既有的「依設定自動打開」邏輯從「只看 desktop」改成依介面查對應的設定：`desktop` 看 Desktop 的開關，`terminal` 看 CLI 的開關。觸發時機不變（Session 啟動、回合結束）。「使用者手動關掉後，這個 Session 不再自動打開」的規則兩種介面共用。
- **「已打開」的判定**：輸入框上方的按鈕和自動打開都改用「Pane 已畫出」（`$.ui.panes()` 的 `isPlaced`）來判斷，不只看 Pane 存不存在。自動打開回傳 `isPlaced: false`（終端機寬度不足）時，視為沒打開，按鈕照樣顯示；掃描只在 Pane 已畫出時進行。Pane 已打開但還沒畫出來時，每 3 秒只檢查它有沒有畫出來，不掃描，因為終端機變寬時引擎不會通知 mod。使用者按下按鈕或輸入指令屬於使用者主動打開，引擎不管寬度都會畫出來。
- **輸入框上方的按鈕**：顯示條件從「只在 desktop」改成「desktop 或 terminal」，其餘條件不變（監看視窗沒畫出來、沒有提問框）。
- **跳轉**：不變。點 Desktop Session 照樣用 deep link（從終端機執行一樣有效）；點 CLI Session 照樣用提示顯示路徑；點目前這個不做事。
- **排版**：照樣依 Pane 的 `bodyColumns` 截斷，不另外為終端機做一套版面。
- **i18n**：五種語言新增 CLI 開關的標籤，改寫不支援提示的文字；README 五種語言的「使用方式」「設定」「限制」「疑難排解」同步更新。
- **版本**：plugin.json 的 `version` 調高，讓已安裝的使用者拿得到更新。

## Testing Decisions

- **唯一的接縫**：沿用現有的 `claude plugin test`，用 Claude Code 的測試工具從外部驅動整個 mod。透過 `$.session.start`（指定 `surface`）、`$.command.run`、`$.ui.mount`（`Pane` 與 `AbovePrompt`，指定 `surface`）以及 `press`／`find` 操作，再檢查外部看得到的結果：有沒有打開 Pane、有沒有掃描、按鈕在不在、設定存成什麼、標題是什麼。不測內部函式。
- **假世界的擴充**：既有的 `fakeWorld` 讓 `ui.open` 一律回傳已畫出。新增一個選項，讓「mod 主動打開」回傳 `isPlaced: false`、使用者主動打開（指令、按鈕）回傳 `true`，`ui.panes` 也反映這個狀態。這是擴充現有的假世界，不是新的接縫。
- **要改寫的既有測試**：
  - 「CLI 的 /switchboard:open 不打開任何畫面，只回提示」→ CLI 輸入指令會打開 Pane 並開始 polling。
  - 「CLI Session 不會自動打開監看視窗」→ CLI 開關預設關閉時不會；打開後啟動就會開。
  - 「監看視窗關著時，Desktop 輸入框上方有打開按鈕…CLI 不顯示」→ CLI 也顯示，按下會打開，打開後消失。
  - 「所有 Desktop Session 自動顯示監看視窗；在 CLI 不會」→ 確認 Desktop 的開關不會讓 CLI 自動打開。
- **新增的測試**：
  - `vscode` 介面輸入指令只回提示，不打開 Pane、不掃描。
  - 在檢視面板切換 CLI 開關，store 裡的值跟著改；Desktop 開關不受影響。
  - CLI 開關打開時，已經開著的 CLI Session 在回合結束後補開。
  - CLI Session 手動關掉 Pane 後，回合結束不再自動打開；再次輸入指令才打開。
  - 自動打開但沒畫出來（窄終端機）時，按鈕照樣顯示、不做 polling；按下按鈕後打開並開始 polling。
  - 在 `terminal` 介面掛載 Pane，清單、等你計數、檢視面板都畫得出來；點 Desktop Session 用 deep link，點 CLI Session 顯示路徑。
- **Prior art**：既有的 needs-you-count 測試檔。Desktop 的 `/switchboard:open`、自動打開、輸入框按鈕、跳轉、多國語言等測試都可以直接仿照，把 `surface` 換成 `terminal`；可以考慮把同一段測試對 `['terminal', 'desktop']` 各跑一次。

## Out of Scope

- 從監看視窗跳轉到 CLI Session 所在的終端機分頁（ticket 06／07 另外做，且依賴尚未驗證的 tty 取得方式）。
- VS Code 擴充套件圖形介面（`vscode` 介面）的監看視窗。
- 為終端機另做一套密度、欄位設定，或在終端機強制精簡。
- 只在狀態列顯示等你計數的精簡版本。
- 完全不開 Claude Desktop 時的其他支援（例如系統需求、安裝流程的調整）。
- macOS 以外的平台。

## Further Notes

- 原型（`.scratch/cli-board/prototype-terminal-board.html`）比較過三種終端機樣式：照搬 Desktop、精簡表格、待處理優先。使用者選照搬 Desktop，確認「排版照樣依 Pane 寬度截斷，不另外為終端機做一套版面」這個決策。
- ADR-0004 記錄了這次為什麼推翻 ADR-0003「CLI Session 看不到 mod 的任何畫面」，以及考慮過的其他做法。CONTEXT.md 已經同步：**監看視窗** 改成「每個 Session 最多一個，Desktop 和 CLI 都可以有」，並新增 **CLI Session** 的定義（不含 VS Code 擴充套件）。
- 引擎的 Pane 擺放規則：使用者主動打開的不管寬度都會畫；mod 主動打開的要 ≥144 欄才畫（使用者以前開過則 110 欄）。全螢幕且 ≥110 欄時停靠在對話旁邊，否則嵌在輸入框上方。
- 一律顯示的按鈕代表：CLI 開關關著時，每個 CLI Session 的輸入框上方都會多一行。這是使用者明確選擇的取捨。
- 每個開著監看視窗的 CLI Session 都會各自每 3 秒掃描一次，和 Desktop 一樣。

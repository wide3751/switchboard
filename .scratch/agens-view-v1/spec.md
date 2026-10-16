Status: ready-for-agent

# Agens View v1：Session 總覽 mod

## Problem Statement

我同時開著好幾個 Claude Code **Session**，有的在 Desktop app 的 Code 分頁，有的在 iTerm、Terminal.app 或 VS Code 的終端機裡。我沒辦法一眼看出哪些 Session 還在工作、哪些已經做完、哪些卡住在等我。結果是：卡在權限提示的 Session 一放就是好幾分鐘，因為 API 錯誤停下的 Session 我根本不知道；我只能一個一個切過去看，又常常被已經做完、其實沒有被卡住的 Session 打斷。

## Solution

一個全域載入到每一個 Session 的 Claude Code mod，但畫面只出現在單一的 Desktop **監看視窗**（見 ADR-0003）：

- 在任何一個 Desktop Session 輸入 `/sessions`，那個 Session 就成為 **監看視窗**，打開一個 Pane，最上方顯示 **等你計數**（目前有幾個 Session 處於 **需要你處理**），下面列出所有本機 Session（CLI 和 Desktop 在同一份清單），依 **Session 狀態** 排序，每一列都有足夠的資訊讓我不用切過去就能判斷要不要處理。
- 同一時間只有一個監看視窗。在另一個 Desktop Session 輸入 `/sessions`，監看視窗就移過去，原本的自動關閉。其他 Session（包含所有 CLI Session）看不到 mod 的任何畫面。
- 點清單上的一列，就 **跳轉** 到那個 Session 實際所在的地方。
- 某個 Session 轉進 **需要你處理** 的那一刻，那個 Session 自己發一次 macOS 通知。

狀態只分四種：**工作中**、**需要你處理**（**待核准**、**待回答**、**出錯中止**）、**閒置**、**已結束**。其中 **需要你處理** 只收明確的訊號，所以出現時一定是真的在等我。

## User Stories

1. 身為同時跑多個 Session 的開發者，我想在 **監看視窗** 的最上方看到 **等你計數**，這樣一眼就知道有沒有 Session 在等我。
2. 身為開發者，我想在 **等你計數** 為 0 時看到明確的「沒有在等你」狀態，這樣我能放心專注在其他 Session。
3. 身為開發者，我想在任何一個 Desktop Session 輸入 `/sessions`，讓它成為 **監看視窗**，打開一個列出所有本機 Session 的 Pane，這樣我能一次看到全貌。
4. 身為開發者，我想讓 Desktop app 的 Session 和終端機 CLI 的 Session 出現在同一份清單裡，這樣我不必分兩個地方看。
5. 身為開發者，我想讓清單只列頂層 **Session**、不列 **Subagent**，這樣清單只放會等我回應的東西。
6. 身為開發者，我想讓雲端 Session 不出現在清單上，這樣 v1 的清單只反映這台電腦上的狀態。
7. 身為開發者，我想讓 **需要你處理** 的 Session 排在最上面，這樣最急的事最先看到。
8. 身為開發者，我想讓清單依 **需要你處理** → **工作中** → **閒置** 排序，同一種狀態內依最後活動時間由新到舊，這樣很久沒動的閒置 Session 會自然沉到底部。
9. 身為開發者，我想讓閒置很多天的 Session 照樣留在清單上，不要被自動隱藏，這樣它們不會「消失」，也不需要我記得什麼過期規則。
10. 身為開發者，我想讓 **已結束** 的 Session（關掉分頁、程序已不存在）立即從清單消失，這樣清單只反映現在。
11. 身為開發者，我想讓 Session 卡在權限提示時顯示為 **待核准**（屬於 **需要你處理**），這樣我知道它不等我就不會往前走。
12. 身為開發者，我想讓 **待核准** 的那一列顯示 **核准請求摘要**（例如它想執行的指令），這樣我不用切過去就知道它卡在什麼。
13. 身為開發者，我想讓 Claude 用選項卡問我問題時顯示為 **待回答**（屬於 **需要你處理**），這樣我知道它在等我做決定。
14. 身為開發者，我想讓回合因 API 錯誤（例如過載、額度用完）停下的 Session 顯示為 **出錯中止**（屬於 **需要你處理**），這樣我不會一直以為它還在跑。
15. 身為開發者，我想讓我自己按 Esc 中斷的回合顯示為 **閒置**，而不是 **需要你處理**，這樣我不會被自己做的事提醒。
16. 身為開發者，我想讓回合結束時用文字提問（沒有選項卡）的 Session 算 **閒置**，但在清單上顯示 **最後訊息摘要**，這樣 **需要你處理** 永遠不會誤報，我也能看一眼就發現它其實在問我。
17. 身為開發者，我想讓每一列顯示 **Session 標題**，這樣我能認出是哪一個 Session。
18. 身為開發者，我想讓沒有標題的 CLI Session 用第一句 prompt 或專案資料夾名稱當 **Session 標題**，這樣它不會顯示成空白或一串 id。
19. 身為開發者，我想讓每一列顯示專案資料夾名稱，這樣我知道它在哪個專案上工作。
20. 身為開發者，我想讓每一列顯示「在這個狀態待了多久」（例如「需要你處理 · 3 分鐘」），這樣我能判斷它被晾了多久。
21. 身為開發者，我想用一個小圖示看出每個 Session 的來源（Desktop、iTerm、Terminal、VS Code），這樣我知道跳轉會帶我去哪裡。
22. 身為開發者，我想讓我正在看的這個 Session 也出現在清單上並標示「目前這個」，這樣計數和清單對得起來。
23. 身為開發者，我想讓清單在幾秒內反映狀態變化，這樣我看到的不會是過時的資訊。
24. 身為開發者，我想點一個 Desktop Session 的列就切到 Desktop app 裡對應的那個 Session，這樣處理它只要一個動作。
25. 身為開發者，我想點一個 iTerm 裡的 CLI Session 就切到 iTerm 對應的分頁，這樣我不用自己找。
26. 身為開發者，我想點一個 Terminal.app 裡的 CLI Session 就切到 Terminal.app 對應的分頁。
27. 身為開發者，我想點一個 VS Code 整合終端機裡的 CLI Session，至少把開著那個專案資料夾的 VS Code 視窗叫到最前面，這樣即使沒辦法精準定位，我也只差一步。
28. 身為開發者，我想在跳轉無法精準完成時看到 Session 的資料夾路徑，這樣我還是找得到它。
29. 身為開發者，我想讓點「目前這個」Session 的列時什麼事都不發生，這樣不會出現奇怪的切換。
30. 身為開發者，我想讓 Session 從其他狀態轉進 **需要你處理** 的那一刻，收到一次 macOS 通知，這樣我不用一直盯著清單。
31. 身為開發者，我想讓同一次轉換只收到一則通知，不管我開了幾個 Session，這樣通知不會重複轟炸。
32. 身為開發者，我想讓 Session 轉成 **閒置**（做完了）時不跳通知，這樣我不會因為通知太多而把通知關掉。
33. 身為開發者，我想讓通知的內容告訴我是哪個 Session、為什麼需要我（待核准、待回答、出錯中止），這樣我能決定要不要立刻處理。
34. 身為開發者，我想讓我在 Session 裡核准權限之後，清單上那個 Session 在幾秒內就回到 **工作中**，並且不再顯示舊的核准請求摘要，這樣清單不會誤導我。
35. 身為開發者，我想讓當掉的 Session 留下的舊狀態不會讓它繼續出現在清單上，這樣清單不會有幽靈列。
36. 身為開發者，我想讓安裝 mod 之前就開著的 Session 也出現在清單上（至少顯示基本的工作中、閒置或在等），這樣清單不會漏掉它們。
37. 身為開發者，我想讓同一時間只有一個 **監看視窗**，在另一個 Desktop Session 輸入 `/sessions` 時，監看視窗移過去、原本的自動關閉，這樣畫面不會重複，我也不會被擋住。
38. 身為開發者，我想讓沒有監看視窗的 Session（包含所有 CLI Session）完全看不到 mod 的畫面，連狀態列都不動，這樣我原本的介面保持乾淨。
39. 身為開發者，我想讓清單不能代我核准權限或回答問題，這樣安全邊界維持在各個 Session 本身。
40. 身為開發者，我想讓 mod 透過一個本機資料夾載入到所有 Session（包含 Desktop），這樣我不需要逐一設定每個 Session。
41. 身為未來可能分享這個 mod 的作者，我想讓專案一開始就照 plugin 標準格式組織，這樣之後只需要補上 marketplace 資訊就能分享。
42. 身為開發者，我想在 CLI Session 輸入 `/sessions` 時看到一句提示，告訴我要到 Desktop 開，這樣我不會以為 mod 壞了。
43. 身為開發者，我想讓 **監看視窗** 所在的 Session 被關閉或封存時，監看視窗就直接消失，不會自己跑到別的 Session，這樣清單不會出現在我沒預期的地方。
44. 身為開發者，我想讓沒有開著監看視窗時，需要你處理的 Session 仍然會發通知，這樣我不會漏掉。

## Implementation Decisions

**整體形態**（見 ADR-0001）
- 做成 Claude Code mod（plugin 格式），全域載入到每一個 Session，不做獨立的 menu bar app。
- 畫面只出現在單一的 Desktop **監看視窗**（見 ADR-0003），取代 ADR-0001 原本「每個 Session 的狀態列都顯示等你計數」的做法。
- v1 只給作者自己用，透過本機 plugin 資料夾設定讓每個 Session（含 Desktop 託管的 Session）自動載入。專案結構照 plugin 標準格式，之後補 marketplace 資訊就能分享。

**每個 mod 實例的兩個職責**
1. **回報者（Reporter）**：只負責它自己所在的 Session。監聽自身的 hook 事件，維護並寫出這個 Session 的 **狀態回報**，在自己轉進 **需要你處理** 的那一刻發一次 macOS 通知。
2. **彙整者（Board）**：只在 **監看視窗** 所在的 Session 啟動。定時（每幾秒）讀取所有 Session 的資料，算出清單和 **等你計數**，繪製在 Pane 上。其他 Session 不做 polling。

**監看視窗的唯一性**
- 有一個跨 Session 共用的「目前的監看視窗」標記，記錄擁有者的 sessionId 和 pid。
- 在 Desktop Session 輸入 `/sessions` 時，寫入標記（接管）並打開 Pane。
- 每個監看視窗定時檢查標記；發現擁有者已經不是自己，就關掉自己的 Pane、停止 polling。
- 監看視窗所在的 Session 結束時，標記失效（pid 不存在就視為沒有監看視窗），不會自動移到別的 Session。
- 在 CLI Session 輸入 `/sessions`，不打開 Pane，只回一句提示：請到 Desktop 開。

**資料來源**（見 ADR-0002）
- Claude Code 自己維護的每個存活 Session 一份的 session 紀錄（位於使用者的 Claude 設定目錄下的 sessions 資料夾），提供：pid、sessionId、cwd、entrypoint、名稱、status（busy / idle / waiting）、waitingFor、狀態更新時間，以及 Desktop 的 host session id。
- 各 Session mod 寫出的 **狀態回報**：放在共用資料夾，每個 Session 一個檔案，以 sessionId 命名。
- **不讀** 其他 Session 的 `.jsonl` 對話紀錄：那是內部格式，而且 mod 一次讀檔有 4 MiB 上限。

**狀態回報的內容**（契約）
- sessionId、回報時間戳
- 判定狀態：工作中 / 待核准 / 待回答 / 出錯中止 / 閒置
- 進入該狀態的時間
- **核准請求摘要**（只在待核准時有值，來自權限請求事件的工具名稱與輸入）
- **最後訊息摘要**（來自回合結束事件的最後一則回覆，截斷）
- 錯誤摘要（只在出錯中止時有值）
- 來源資訊：終端機種類與 tty（用於跳轉）、Desktop host session id

**回報者的狀態轉換**（由自身 hook 事件驅動）
- 送出 prompt、回合開始、工具開始執行 → 工作中
- 權限請求、權限提示通知 → 待核准
- 選項卡、elicitation 對話框 → 待回答
- 回合因錯誤失敗 → 出錯中止
- 回合正常結束、使用者中斷 → 閒置
- 只有在「轉進」需要你處理（待核准、待回答、出錯中止）而且前一個狀態不屬於需要你處理時，才發通知。

**彙整規則**
- 存在性：只有 session 紀錄存在、而且 pid 仍然存活的 Session 才會列出。程序不在的 Session 視為 **已結束**，從清單移除，並刪掉它殘留的狀態回報。
- 狀態：session 紀錄和狀態回報兩邊比時間戳，取較新的那一份。例外：狀態回報是出錯中止、而 session 紀錄是 idle 時，一律維持出錯中止，因為回合失敗後 session 紀錄本來就會在稍晚變成 idle；要等同一個 Session 的下一個 hook 事件（例如送出 prompt）才解除。這條例外是用狀態模型原型驗證後加上的。session 紀錄的 busy → 工作中，idle → 閒置，waiting → 需要你處理（細分不了時，就只標示為需要你處理）。
- 細節：狀態回報中的核准請求摘要、最後訊息摘要、錯誤摘要，只在狀態回報的狀態和最終判定一致時才顯示。
- 沒有狀態回報的 Session（例如沒載入 mod 的）只顯示基本狀態。
- 排序：需要你處理 → 工作中 → 閒置；同狀態內依最後活動時間由新到舊。
- 標示正在看的那個 Session 為「目前這個」。
- **Session 標題**：優先用 session 紀錄的名稱，其次用第一句 prompt，再其次用資料夾名稱。

**介面**
- 等你計數顯示在監看視窗 Pane 的最上方；任何 Session 的狀態列都不顯示 mod 的東西。
- `/sessions` 斜線指令只在 desktop 介面打開 Pane；在 terminal 介面只回提示。
- 每一列：狀態、Session 標題、資料夾、停在這個狀態多久、最後訊息摘要（待核准時改成核准請求摘要）、來源小圖示、「目前這個」標示。

**跳轉**
- iTerm / Terminal.app：用 AppleScript 依 tty 找到對應的分頁並帶到前面。
- VS Code：盡力而為，把開著對應資料夾的視窗帶到前面。
- Desktop：用 Claude Desktop 的 `claude://` deep link 帶到對應的 Session（能不能指定到特定 Session 待實測）。
- 無法精準跳轉時，帶到該 app 並顯示 Session 的資料夾路徑。
- 「目前這個」不做任何動作。

**實作第一步：4 個實測**（結果和設計衝突時先停下來問使用者）
1. 權限提示出現時，Desktop Session 的 session 紀錄會不會變成 waiting，waitingFor 的值是什麼。
2. 純終端機開的 CLI Session 會不會寫 session 紀錄。
3. Desktop 的 deep link 能不能指定到某個 Session。
4. Desktop app 和 iTerm2 內建的 `cc-status` 本身會不會在權限提示時發通知（避免和本 mod 重複）。

## Testing Decisions

- **只有一個 seam：整個 mod。** 用 Claude Code 官方的 plugin 測試工具（`claude plugin test` 加上它的 testing kit），讓測試扮演 engine，把 mod 當黑箱測。
- 測試的手段：回應 mod 的讀檔請求來假造 session 紀錄、狀態回報和 pid 存活結果；觸發 hook 事件（權限請求、回合結束、回合失敗、送出 prompt 等）；快轉模擬時鐘讓 polling 執行；在 `desktop` 介面掛載 Pane 並按下某一列；在 `terminal` 介面輸入 `/sessions`，確認只回提示；模擬兩個 Desktop Session 先後輸入 `/sessions`，確認接管。
- 只驗證外部可觀察的行為：Pane 上的等你計數、通知有沒有發出、發了幾次、Pane 上的列和排序和摘要和「目前這個」標示、寫出去的狀態回報內容、跳轉時送出的 AppleScript 或 deep link。
- 不為「彙整」或「狀態回報」另外切內部 seam，避免綁住內部結構。
- 退路：如果官方測試工具實際上不能用，才把「彙整」切成純函式另外測。
- 重點情境：通知只在轉進需要你處理時發一次、使用者中斷算閒置、文字提問算閒置、殘留的狀態回報不會讓已結束的 Session 出現、核准之後舊的核准請求摘要不再顯示、沒有狀態回報的 Session 仍顯示基本狀態、排序規則、監看視窗被接管後原本的會關閉、監看視窗所在的 Session 結束後不會自動移走、CLI 輸入 `/sessions` 只有提示。
- Prior art：repo 目前沒有任何程式碼或測試。參考 plugin-authoring skill 附帶的範例（pane、band、tool-call）和 testing kit 的型別定義。

## Out of Scope

- 雲端 Session（claude.ai/code）。
- 列出 Subagent，或顯示 Subagent 數量。
- 在清單上直接核准權限或回答問題。
- 用問號或模型判斷文字提問，自動歸為待回答。
- 獨立的 menu bar app、Dock 或選單列角標。
- 已結束 Session 的歷史紀錄。
- macOS 以外的平台；iTerm、Terminal.app、VS Code 以外的終端機（tmux、Warp、Ghostty 等）。
- 透過 marketplace 分享和安裝。
- VS Code 整合終端機的精準分頁定位。
- 在 CLI 終端機介面顯示清單或等你計數。
- 同時開多個監看視窗。
- 監看視窗所在的 Session 結束時，自動移到另一個 Session。
- 替沒有載入 mod 的 Session 代發通知。這類 Session 轉進需要你處理時，清單和等你計數會反映，但不會發通知；這只發生在安裝 mod 之後的過渡期（經狀態模型原型確認後決定）。

## Further Notes

- 術語以 `GLOSSARY.md` 為準；相關決策見 ADR-0001（做成 mod 而不是 menu bar app）、ADR-0002（Session 自我回報狀態，不從對話紀錄推斷）、ADR-0003（畫面只出現在單一的 Desktop 監看視窗）。
- 使用者的設定裡已經把幾乎所有 hook 接到 iTerm2 內建的 `cc-status`，可以用來對照狀態判定是否正確。
- mod 沙盒的限制：沒有檔案監聽，只能 polling；每次讀寫上限 4 MiB；hook 只看得到自己所在的 Session。

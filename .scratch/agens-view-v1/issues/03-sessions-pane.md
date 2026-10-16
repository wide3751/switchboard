# 03: 監看視窗的完整清單與唯一性

**What to build:** **監看視窗** 的 Pane 在等你計數底下，列出所有存活的本機 Session（CLI 和 Desktop 在同一份清單，不含雲端、不列 Subagent）。每一列顯示：狀態、**Session 標題**、專案資料夾、在這個狀態待了多久、來源小圖示，正在看的這個 Session 標示為「目前這個」。同一時間只會有一個監看視窗：在另一個 Desktop Session 輸入 `/sessions`，監看視窗就移過去，原本的自動關閉。這一張的狀態只用 session 紀錄的基本狀態（工作中、閒置、需要你處理）。

**Blocked by:** 01

**Status:** in-progress（部分完成）

- [x] 排序：需要你處理 → 工作中 → 閒置；同一種狀態內依最後活動時間由新到舊
- [x] 閒置很久的 Session 照樣列出；**已結束**（pid 已死或紀錄消失）的 Session 在下一次更新時就從清單移除
- [ ] **Session 標題**：優先用 session 紀錄的名稱，其次第一句 prompt，再其次資料夾名稱
- [x] 顯示「在這個狀態待了多久」
- [ ] 來源小圖示能分辨 Desktop 和 CLI（取得到終端機種類時再細分）
- [x] 監看視窗所在的 Session 標示為「目前這個」
- [x] Pane 打開時清單會隨 polling 自動更新
- [ ] 在 Desktop Session B 輸入 `/sessions` 時，原本在 Desktop Session A 的監看視窗在幾秒內自動關閉並停止 polling，只剩 B 的
- [x] 監看視窗所在的 Session 結束後，不會自動在別的 Session 打開監看視窗
- [ ] 測試涵蓋：接管、擁有者 pid 已死時視為沒有監看視窗

## Comments

**2026-10-16 進度（agent）**

在處理 01 時，依使用者的要求一路做進了這張的大部分（程式在 `agens-view/`，plugin 名稱 `switchboard`，指令 `/switchboard:on`）：

- 已完成：清單依需要你處理 → 工作中 → 閒置分區排序；已結束的 Session（pid 不存活）不列出；顯示在這個狀態待了多久；標示「目前」；polling 自動更新；監看視窗所在的 Session 結束後不會自動移走（沒有接管邏輯，自然成立）。
- 超出原範圍、使用者追加的：卡片樣式（UI／UX Agent 設計的方案 B）、三組狀態各自的欄位設定與密度、點標題用 Desktop deep link 跳轉、展開明細、頁首摘要與 rate limit。
- 部分完成：
  - Session 標題：用 session 紀錄的名稱，沒有時用資料夾名稱；「第一句 prompt」這一層還沒做。
  - 來源：以文字標籤顯示（Desktop／CLI 或 entrypoint 原始值），還沒有小圖示，也還分不出終端機種類（要等 02 第 2 題）。
- 未完成：同一時間只有一個監看視窗的接管邏輯（標記、原本的自動關閉），以及對應的測試。

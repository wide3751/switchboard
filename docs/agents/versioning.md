# 版本號

版本號只有一個地方：`agens-view/.claude-plugin/plugin.json` 的 `version`。已安裝的 plugin 以它當快取的依據，版本號沒變，使用者 `claude plugin update` 也拿不到新的程式碼。

## 什麼時候調

**每個 PR 合併進 main 時調一次**，放在 PR 的最後一個 commit（例如 `chore: 版本 0.8.0`）。

- ticket、整合分支、PR 裡的其他 commit 都**不**調。一個 PR 不管包含幾張 ticket，只調一次。
- PR 已經調過、之後又因為 review 修正加了 commit：不再調，除非修正讓 PR 從 patch 變成 minor（見下面），那就把同一個版本號改掉，不是再加一格。
- 只改 `README*.md`、`docs/`、`.scratch/`、`agens-view/tests/` 的 PR **不調**：使用者安裝到的內容沒變。
- 直接 commit 到 main（不經 PR）時同樣適用：會影響安裝內容才調。

## 調哪一位數（1.0.0 之前）

上一版到這個 PR 之間，只要有一項屬於 minor，就跳 minor；否則跳 patch。一次只跳一格。

| 跳 | 什麼時候 | 例子 |
|---|---|---|
| patch：0.7.0 → 0.7.1 | 只有 bug 修正、效能、內部重構，使用者看到的行為照舊 | 遮罩漏網、race、逾時 |
| minor：0.7.0 → 0.8.0 | 使用者看得到的新功能、介面或行為改變、新設定、回報格式改變 | 新欄位、排序規則、按鈕帶計數 |

1.0.0 由使用者決定，agent 不自己跳 major。

## 開發時怎麼看到改動

不要為了在本機看到改動而調版本號。用 `--plugin-dir` 直接載入資料夾，互動式 Session 會監看它、改了就熱重載：

```bash
claude --plugin-dir ./agens-view
```

自動化測試照舊用 `claude plugin test agens-view` 和 `claude plugin validate agens-view`。

## Ticket 的驗收清單

ticket 不要再寫「plugin.json 版本號調高」這一項。版本號是 PR 的事，由合併前的最後一個 commit 處理。

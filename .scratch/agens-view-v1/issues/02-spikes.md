# 02: 4 項實測

**What to build:** 一份實測報告，回答 spec 中設計所依賴、但尚未驗證的 4 個事實，並寫在這個檔案的 `## Answer` 底下。如果任何結果和 spec 的設計衝突，停下來問使用者，不要自行改設計。

1. 權限提示出現時，Desktop Session 的 session 紀錄會不會變成 waiting，waitingFor 的值是什麼；選項卡（待回答）時又是什麼。
2. 純終端機（iTerm、Terminal.app、VS Code 整合終端機）開的 CLI Session 會不會寫 session 紀錄，entrypoint 是什麼值；能不能從中取得 tty 或終端機種類。
3. Claude Desktop 的 `claude://` deep link 能不能帶使用者到指定的 Session；如果可以，格式是什麼。
4. Desktop app 和 iTerm2 內建的 `cc-status` 在權限提示時本身會不會發通知（評估是否會和本 mod 的通知重複）。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] 4 個問題都有答案，並附上觀察方式（怎麼重現）
- [ ] 每個答案都註明對 spec 的影響：符合、需要調整，或推翻
- [ ] 若有衝突，已經向使用者提出並得到決定

## Answer

**1. 權限提示時 Desktop Session 的 session 紀錄（部分回答，2026-10-16）**

- 觀察方式：在 switchboard 的 Pane 暫時顯示每份 session 紀錄的 status 與欄位名稱；開一個 Desktop Session 讓它執行需要核准的 Bash 指令，停在權限提示時截圖。
- 結果：status 變成 `waiting`，並出現 `waitingFor` 欄位（沒有 waiting 時這個欄位不存在）。`waitingFor` 的值、選項卡（待回答）時的值都還沒看到。
- 對 spec 的影響：符合，等你計數只靠 session 紀錄就能反映權限提示。

**3. Desktop 的 deep link 能不能指定 Session（2026-10-16）**

- 觀察方式：session 紀錄裡 Desktop 託管的 Session 有 `hostSessionId`；Desktop 自己的 Session 連結格式是 `claude://claude.ai/epitaxy/local_<id>`。switchboard 點卡片標題時執行 `open claude://claude.ai/epitaxy/<hostSessionId>`（沒有 `local_` 前綴時補上），使用者實測能切到對應的 Session。
- 對 spec 的影響：符合，Desktop 的跳轉可以精準到指定 Session（ticket 07 的 Desktop 部分可直接採用）。

第 2、4 題尚未處理。

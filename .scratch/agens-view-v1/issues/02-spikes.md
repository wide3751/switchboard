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

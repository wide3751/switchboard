# 02 — 每小時一次、所有 Session 共用

**What to build:** 不管同時開幾個 **Session**，**檢查更新** 每小時最多連一次 GitHub。檢查狀態（上次檢查時間、上次看到的公布版本）存在 `$.store`，所有 Session 共用。Session 啟動後約一分鐘才做第一次判斷：store 裡的結果還不到一小時就直接用，不連網；到期才連網並更新 store。只開幾秒就關的 Session 不發請求。之後每個 Session 用自己的 `$.clock.every` 定期判斷，同樣看 store 決定要不要連網。不搭監看視窗輪詢或輕量掃描那兩個計時器。連網失敗時不覆蓋 store 裡上次成功看到的版本。規格見 `.scratch/update-check/spec.md`。

**Blocked by:** 01

**Status:** resolved

- [x] 啟動後一分鐘內不連網；一分鐘後才做第一次判斷
- [x] 第一個 Session 檢查後，一小時內啟動的第二個 Session 不連網，但照樣顯示 store 裡的新版提示
- [x] 過了一小時，下一次判斷才再連網
- [x] 一個 Session 長時間開著，每小時會再檢查一次，新版出現後提示會跟著出現
- [x] 連網失敗不清掉 store 裡上次看到的版本，也不會讓下一個 Session 立刻重試（失敗也算一次檢查）
- [x] 監看視窗的輪詢和輕量掃描次數不因這個功能改變

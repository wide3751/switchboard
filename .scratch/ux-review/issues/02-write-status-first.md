# 02 — 狀態欄位先寫，分支和 PR 之後再補

**What to build:** `turn.complete` 把 turnError、question、lastReply 和 `await readBranch`（多次 git，各 5 秒逾時）、`await readPullRequest`（`gh pr view`，8 秒逾時，要連網）寫在同一個物件裡，全部 await 完才 writeReport（`register.tsx:687-701`）。這段時間 Claude Code 的紀錄已經是 idle，所以 **出錯中止** 和結尾提問會先被排進閒置，幾秒後才跳上去。`session.start` 也一樣，而且排在 autoOpenBoard 之前（`register.tsx:591-608`）。

改成分兩次寫：第一次立刻寫狀態相關欄位（turnError、question、lastReply、`approval: null`、`turnStartedAt: null`），再補 tasks、branch、connectors、pr、usage。`session.start` 先寫最小的回報、先自動打開監看視窗，其餘之後補。

**Status:** resolved

- [x] turn.complete 的狀態欄位不等 git、gh
- [x] session.start 的自動打開不等 git、gh
- [x] 第二次寫入不會蓋掉第一次之後又有變化的狀態欄位（例如使用者馬上送出下一句）
- [ ] 實測：在大 repo 裡，回合結尾是否因為 git、gh 而變慢；有的話在 Comments 記下數字

## Comments

- 2026-10-16：實作完成。`turn.complete` 先寫 turnStartedAt、activity、approval、question、lastReply、turnError，接著 autoOpenBoard，最後才補 tasks、branch、connectors、pr、用量；`session.start` 先寫 model、terminal，打開（或接著 polling）監看視窗之後才補。第二次寫入只帶 git、gh、用量相關的欄位，所以使用者在這之間送出下一句（turn.start）或出現核准請求時，新的狀態不會被蓋掉。另外 `writeReport` 改成先取時間再合併，合併時不隔著 await，避免兩次同時進行的寫入用舊內容互相蓋掉。測試：`agens-view/tests/ux-02-write-status-first.test.ts`（假世界新增選用的 `slowCommands`，讓 git、gh 卡住不回應）。
- 「實測大 repo」沒做：這次在雲端容器裡實作，沒有 macOS 上的 Claude Code／Desktop 和大 repo 可以實測回合結尾的延遲，留給真機實測時補數字。

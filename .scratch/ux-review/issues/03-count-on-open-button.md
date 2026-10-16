# 03 — 打開按鈕顯示等你計數

**What to build:** 依 ADR-0006，監看視窗沒打開時，輸入框上方的按鈕顯示 **等你計數**，例如 `▦ 打開監看視窗 · ▲2`；沒有 Session 在等時只顯示按鈕本身。沒開監看視窗的 Session 每 15 秒做一次輕量掃描：只讀 Session 紀錄、狀態回報，跑一次 `ps`，不跑 git、gh。打開監看視窗後改用原本的 3 秒掃描並停止輕量掃描，關掉後恢復。

**Blocked by:** 01（掃描失敗的處理方式要一致）

**Status:** ready-for-agent

- [ ] Desktop 和 CLI 的打開按鈕都帶等你計數
- [ ] 輕量掃描每 15 秒一次，不跑 git、gh
- [ ] 打開監看視窗後輕量掃描停止，關掉後恢復
- [ ] 輕量掃描失敗時按鈕不顯示計數，不能顯示 0
- [ ] 五種語言的按鈕文字、README 說明更新
- [ ] plugin.json 版本號調高；`claude plugin test` 與 `claude plugin validate` 通過

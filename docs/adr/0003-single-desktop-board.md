# 畫面只出現在單一的 Desktop 監看視窗

> 部分被 [0004](0004-cli-board.md) 取代：CLI Session 也可以打開監看視窗。
> 通知的部分被 [0005](0005-no-own-needs-you-alert.md) 取代：switchboard 不自己發需要你處理通知，監看視窗沒開時要靠 Claude Code、Desktop 本身的通知。
> 掃描的部分被 [0006](0006-count-on-open-button.md) 修訂：沒開監看視窗的 Session 也會每 15 秒輕量掃描，讓打開按鈕顯示等你計數。
> 「以 Desktop 為主」已不成立：Desktop 和終端機對等支援，兩者都不是必要條件（見 CONTEXT.md）。

mod 仍然全域載入到每一個 Session，但只有一個 Desktop Session 會顯示畫面，這個 Session 稱為 **監看視窗**，清單和等你計數都只出現在這裡。在任何一個 Desktop Session 輸入 `/sessions`，監看視窗就移到那裡，原本的自動關閉；監看視窗所在的 Session 被關閉或封存時，監看視窗就消失，不會自動移到別的 Session。CLI Session 和其他 Desktop Session 看不到 mod 的任何畫面，但照樣寫出狀態回報、照樣發出需要你處理通知。這是使用者明確要求的：「只允許開一個視窗」，而且以 Desktop 為主。它取代了 [0001](0001-mod-not-menu-bar-app.md) 裡「每個 Session 的狀態列都顯示等你計數」的做法。

## Considered Options

- **每個 Session 的狀態列都顯示等你計數**（0001 的原始做法）：在哪裡都看得到，但畫面重複，也不符合使用者「只要一個視窗」的要求。
- **第二個 `/sessions` 被拒絕**，而不是接管：如果監看視窗被藏在別的桌面，使用者會被擋住，還得先去找它。
- **固定一個專用的監看 Session**：要多開、多維護一個 Session。
- **監看視窗所在的 Session 關掉時，自動移到另一個 Session**：清單會出現在使用者沒預期的地方，而且要另外定一套「移到哪一個」的規則。

## Consequences

- 需要一個跨 Session 的「目前誰是監看視窗」標記。每個 mod 都要能發現自己被接管，然後關掉自己的 Pane。
- 只有監看視窗所在的 Session 會 polling 所有 Session 的資料，其他 Session 只負責寫自己的狀態回報。
- 沒有開著監看視窗時，使用者只能靠需要你處理通知得知有 Session 在等。
- 在 CLI Session 輸入 `/sessions` 不會打開清單，只會提示要到 Desktop 開。

## 修訂（2026-10-16）

使用者希望在 Desktop 切換 Session 時監看視窗一直留在右側。Pane 屬於開啟它的 Session，切換 Session 就看不到，所以改為：

- 新增設定「所有 Desktop Session 都顯示」（預設開啟，存在 mod 的全域設定）。開啟時，每個 Desktop Session 啟動與每個回合結束時都會自動打開監看視窗；關閉時回到只在輸入 `/switchboard:open` 的 Session 顯示。
- 使用者在某個 Session 手動關掉監看視窗後，那個 Session 不再自動打開，直到再次輸入 `/switchboard:open`。
- CLI Session 仍然不顯示任何畫面。
- 代價：每個開著監看視窗的 Session 都會各自每 3 秒掃描一次。原本的「接管」設計（ticket 03）在這個設定開啟時不需要。

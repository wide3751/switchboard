# 做成 Claude Code mod，而不是獨立的 menu bar app

> 部分被 [0003](0003-single-desktop-board.md) 取代：畫面不再出現在每個 Session 的狀態列，改成只在單一的 Desktop 監看視窗顯示。「做成 mod」和「全域載入」仍然有效。

清單和等你計數以 Claude Code mod 的形式提供，全域載入到每一個 Session：每個 Session 的狀態列顯示等你計數，`/sessions` 打開 Pane。我們不做獨立的 macOS menu bar app。代價是至少要開著一個 Session 才看得到清單，也沒有 Dock 或選單列的角標。換來的是不用另外安裝、維護一個常駐程式，而且使用者本來就一直開著 Session，等你計數放在狀態列，效果就等於角標。

## Considered Options

- **獨立的 menu bar app**：不管有沒有開 Session 都看得到，角標也最自然。但它就不是 Claude Code mod 了，還要另外處理打包、常駐和權限。
- **專用的「監控 Session」**：只在一個 Session 裡掛清單，其他 Session 不載入 mod。但這樣其他 Session 沒辦法發出自己的狀態回報，也收不到通知（見 [0002](0002-self-reported-status.md)）。

## Consequences

- mod 的 hook 只看得到自己所在的 Session，所以清單只能靠讀檔案拿到其他 Session 的狀態，而且只能用 polling（沙盒沒有檔案監聽）。這也是狀態延遲定在「幾秒內」的原因。
- 每個 Session 都載入了 mod，通知如果由所有 mod 一起監看、各自發出，就會重複。所以通知改成由轉進「需要你處理」的那個 Session 自己發。

# switchboard 不自己發需要你處理通知

> 取代 [0001](0001-mod-not-menu-bar-app.md)、[0002](0002-self-reported-status.md)、[0003](0003-single-desktop-board.md) 裡「需要你處理通知由各 Session 自己發」的部分。

switchboard 不發 macOS 通知。Session 轉進需要你處理時的提醒，交給 Claude Code 與 Desktop app 本身的通知；switchboard 只負責清單和等你計數。原本的設計是由轉進需要你處理的那個 Session 自己發一次通知（ticket 05），但一直沒有實作，而 Claude Code 與 Desktop app 本身就會在權限提示、提問時通知，switchboard 再發一次只會重複，讓使用者學會忽略通知。

## Considered Options

- **switchboard 自己用 osascript 發通知**：延遲幾秒、仍在需要你處理才發，可以吃掉「人就在那個 Session」的雜訊。但會和 Claude Code、Desktop 的通知重複；點通知也只會打開「工序指令編寫程式」，要能跳轉得引進 terminal-notifier 這類新依賴。
- **保留承諾、之後再做**：文件和實際行為不一致，後續的設計（例如 CLI 預設不自動打開）會建立在不存在的前提上。

## Consequences

- 監看視窗沒開時，switchboard 本身不提供任何「有 Session 在等你」的訊號。這個缺口要靠 Claude Code、Desktop 的通知，或另外的設計補上（例如在輸入框上方的按鈕顯示等你計數）。
- 沒有開啟 Claude Code 通知的使用者（例如終端機沒設定通知），只有看著監看視窗時才會知道。README 應該告訴使用者怎麼打開 Claude Code 自己的通知。
- ticket 05 不做；spike 02 第 4 題（Desktop、cc-status 會不會通知）不再影響 switchboard 的設計。

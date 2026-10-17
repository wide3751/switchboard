# Session 自我回報狀態，不從對話紀錄推斷

> 通知的部分被 [0005](0005-no-own-needs-you-alert.md) 取代：switchboard 不自己發需要你處理通知。
> 回報路徑更正：狀態回報實際放在 `~/.claude/switchboard/reports/<sessionId>.json`（設了 `CLAUDE_CONFIG_DIR` 時是那個資料夾底下的 `switchboard/reports/`），不是下文寫的 `~/.claude/agens-view/…`。

每個 Session 的 mod 利用自己的 hook 事件（`PermissionRequest`、`Stop`、`StopFailure` 等），把自身的詳細狀態寫成一份狀態回報，放進共用資料夾（`~/.claude/agens-view/<sessionId>.json`）。清單把這些狀態回報和 Claude Code 自己的 `~/.claude/sessions/<pid>.json` 合併使用，不去讀其他 Session 的 `.jsonl` 對話紀錄來推斷狀態。原因有三個：hook 的欄位是官方介面，`.jsonl` 則是內部格式，隨時可能改；mod 一次最多只能讀 4 MiB，長一點的對話紀錄讀不完；這樣也和「通知由各 Session 自己發」維持同一個模式，每個 Session 只負責自己。

## Consequences

- 沒有載入 mod 的 Session（例如安裝 mod 之前就開著的）沒有狀態回報，清單上只會顯示 `sessions/*.json` 提供的基本狀態，不會有出錯中止、核准請求摘要或最後訊息摘要。
- 狀態回報可能殘留或過時。Session 存不存在只看 `sessions/*.json` 和 pid 是否還活著；兩個來源的狀態不一致時，以時間較新的為準；狀態回報中的細節，只在它的狀態和最終判定一致時才顯示。

# 12 — 多國語言與 metadata 清理

**What to build:**

- 刪掉沒用到的 key：header.waiting、status.none、status.spent、chips、expand、collapse、lines、unknown、toast.jumping（header.longestWait 由 06 用上）。
- 寫死的字串翻譯或統一：`Context`（`register.tsx:1083`）、`ctx`（1016）、`Bash`／`Agent`（1127）、`Remote`（991）與 `Remote Control`（1074）兩個名字、英韓介面出現的 `「…」`（968）與全形 `？`（921）、notPlaced 夾帶引擎原始 reason（718）。
- 英文 `turns` 的單複數（`i18n.ts:140`）。
- 用語：zh-TW 同一概念三種說法（「需要你處理」「待處理」「等你」）統一；zh 面板裡的區塊標題「設定／设置」改成「套用到」；en 的 kinds.waiting 'Waiting' 違反 `GLOSSARY.md` 的避免用語，改成 'Needs you'；ja 的閒置「待機中」與「対応待ち」易混，請母語者確認。
- `unknown` 狀態只有 ◌ 沒有文字（`board.ts:310/351`），補上標籤。
- marketplace.json 的「本機 marketplace」、plugin.json 的「單一監看視窗」已過時，改成英文為主的描述，補 homepage、repository、license。
- ADR-0002 寫的回報路徑 `~/.claude/agens-view/…` 是錯的，實際是 `~/.claude/switchboard/reports/`，加修訂註記。

**Status:** ready-for-agent

- [ ] 沒有未使用的 key，也沒有寫死的使用者可見字串
- [ ] metadata 與 ADR-0002 更正

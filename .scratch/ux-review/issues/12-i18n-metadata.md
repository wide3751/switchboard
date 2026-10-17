# 12 — 多國語言與 metadata 清理

**What to build:**

- 刪掉沒用到的 key：header.waiting、status.none、status.spent、chips、expand、collapse、lines、unknown、toast.jumping（header.longestWait 由 06 用上）。
- 寫死的字串翻譯或統一：`Context`（`register.tsx:1083`）、`ctx`（1016）、`Bash`／`Agent`（1127）、`Remote`（991）與 `Remote Control`（1074）兩個名字、英韓介面出現的 `「…」`（968）與全形 `？`（921）、notPlaced 夾帶引擎原始 reason（718）。
- 英文 `turns` 的單複數（`i18n.ts:140`）。
- 用語：zh-TW 同一概念三種說法（「需要你處理」「待處理」「等你」）統一；zh 面板裡的區塊標題「設定／设置」改成「套用到」；en 的 kinds.waiting 'Waiting' 違反 `GLOSSARY.md` 的避免用語，改成 'Needs you'；ja 的閒置「待機中」與「対応待ち」易混，請母語者確認。
- `unknown` 狀態只有 ◌ 沒有文字（`board.ts:310/351`），補上標籤。
- marketplace.json 的「本機 marketplace」、plugin.json 的「單一監看視窗」已過時，改成英文為主的描述，補 homepage、repository、license。
- ADR-0002 寫的回報路徑 `~/.claude/agens-view/…` 是錯的，實際是 `~/.claude/switchboard/reports/`，加修訂註記。

**Status:** resolved

- [x] 沒有未使用的 key，也沒有寫死的使用者可見字串
- [x] metadata 與 ADR-0002 更正
- [ ] ja 的閒置「待機中」與「対応待ち」請母語者確認（建議用字見 Comments）

## Comments

**實作紀錄（ticket 12）**

- 刪掉的 key：`header.waiting`、`status.none`、`status.spent`、`chips`、`expand`、`collapse`、`lines`、`createPr`（06 的 `goCreatePr` 已取代）、`toast.jumping`。刪之前在整個 `agens-view/`（含測試）grep 過都沒人用。
- `unknown` 沒刪，改拿來當狀態不明卡片的標籤（`◌ Unknown`／`◌ 未知`…），五種語言本來就有譯文，比另開一個 key 省事。
- 寫死字串的去向：
  - 中繼資料帶的 `ctx` 與展開明細的 `Context` 都改用欄位名稱 `fields.context`（en `Context`、ja `コンテキスト`、ko `컨텍스트`；簡繁中維持 `Context`，和 Session、Worktree 一樣保留英文）。
  - 背景任務清單的 `Bash`／`Agent` 改成 `taskKinds`；`Agent` 是 GLOSSARY 避免的用語，改成 Subagent（ja `サブエージェント`、ko `서브에이전트`、中文 `Subagent`）。
  - 環境的 `Remote`（中繼資料帶）與 `Remote Control`（展開明細）統一成 `environment.remote` = `Remote Control`；`Worktree` 也一併移進 `environment.worktree`。
  - 問題前的問號與最後回覆的引號改成 `asked`／`quoted`：en、ko 用 `? ` 與 `“…”`，ja、中文維持 `？ ` 與 `「…」`。
  - `command.notPlaced` 不再帶引擎的原始 reason（英文、內部用語），改成固定的說明；原始 reason 用 `$.ui.log(…, { to: 'debug' })` 寫進 debug log，排查時還看得到。
- 用語統一：zh-TW 的「待處理」「等你」都改成 GLOSSARY 的「需要你處理」（分組名稱、卡片標籤、狀態列細分、全部處理完時的「✓ 沒有 Session 需要你處理」）；zh-CN 有同樣的問題，一起改成「需要你处理」。檢視面板選分組的列標題：zh-TW「套用到」，zh-CN 用比較自然的「应用到」。
- metadata：plugin.json、marketplace.json 的描述改成英文，補上 homepage、repository（github.com/wide3751/switchboard）與 license（MIT，依 repo 的 LICENSE）；marketplace 的 plugin 項目也補了這三個欄位。版本號沒動。
- ADR-0002 開頭加上回報路徑的更正註記。

**ja 的建議用字（未改，請母語者確認）**

現在的 ja 裡，閒置是「待機中」（`groups.idle`、`header.idle`），需要你處理的計數是「n 件が対応待ち」（`status.needYou`），頁首的最長等待是「最長待機」（`header.longestWait`）。「待機」「待ち」都帶「等」的意思，一眼分不出「做完在等下一個指令」和「卡住等你處理」，正好是 GLOSSARY 要避免的混淆。建議：

- 閒置：`待機中` → `アイドル`（`groups.idle: 'アイドル'`、`header.idle: n => \`アイドル ${n}\``）。
- 需要你處理的計數：`${n} 件が対応待ち` → `対応が必要 ${n} 件`，和分組名稱「対応が必要」、全部處理完時的「対応が必要な項目はありません」一致。
- 最長等待：`最長待機 ${age}` → `最長待ち時間 ${age}`，不和閒置共用「待機」。

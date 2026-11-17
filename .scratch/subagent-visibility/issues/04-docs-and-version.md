# 04 — 文件與版本號

**What to build:** README 與使用說明五種語言補上子代理在卡片上怎麼看：前景、背景、失敗、等待中的標示與「等待子代理」。確認 `GLOSSARY.md` 與實作一致。合併進 main 時把 `agens-view/.claude-plugin/plugin.json` 的 `version` 跳一次 minor（只在合併時調，ticket 和分支上不調，見 `docs/agents/versioning.md`）。規格見 `.scratch/subagent-visibility/spec.md`。

**Blocked by:** 02、03

**Status:** resolved

- [x] README 五種語言說明子卡片的標示與「等待子代理」
- [x] `docs/guide/usage.*` 五種語言同步
- [x] `GLOSSARY.md` 與實作用詞一致
- [ ] 合併時 `plugin.json` 跳 minor（合併時再調，分支上不調）

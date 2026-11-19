# 04 — 文件與版本號

**What to build:** README 與使用說明五種語言補上子代理在卡片上怎麼看：前景、背景、失敗、等待中的標示與「等待子代理」。確認 `GLOSSARY.md` 與實作一致。PR 的最後一個 commit 把 `agens-view/.claude-plugin/plugin.json` 的 `version` 跳一次 minor（各 ticket 自己不調；review 之後補的修正也不再調，見 `docs/agents/versioning.md`）。規格見 `.scratch/subagent-visibility/spec.md`。

**Blocked by:** 02、03

**Status:** resolved

- [x] README 五種語言說明子卡片的標示與「等待子代理」
- [x] `docs/guide/usage.*` 五種語言同步
- [x] `GLOSSARY.md` 與實作用詞一致
- [x] `plugin.json` 跳 minor：0.13.0 → 0.14.0，在 PR #23 的 `chore: 版本 0.14.0`（`4c10b51`）

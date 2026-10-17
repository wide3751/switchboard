# Agens View

## Agent skills

### Issue tracker

Issues 以本機 markdown 檔存放在 `.scratch/<feature>/`。See `docs/agents/issue-tracker.md`.

### Triage labels

使用預設的五個 triage 標籤（needs-triage、needs-info、ready-for-agent、ready-for-human、wontfix）。See `docs/agents/triage-labels.md`.

### Domain docs

Single-context：根目錄一份 `GLOSSARY.md` 加 `docs/adr/`。See `docs/agents/domain.md`.

## 版本號

每個 PR 合併進 main 時調一次 `agens-view/.claude-plugin/plugin.json` 的 `version`：只有修正跳 patch，其他跳 minor。ticket 和分支上不調，只改文件或測試的 PR 也不調。See `docs/agents/versioning.md`.

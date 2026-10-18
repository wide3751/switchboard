English | [繁體中文](privacy.zh-TW.md) | [简体中文](privacy.zh-CN.md) | [日本語](privacy.ja.md) | [한국어](privacy.ko.md)

# Privacy and data

[← Back to README](../../README.md)

switchboard runs entirely on your Mac and sends nothing to any service of its own.

- **Written locally**: each session's status report, as a plain-text JSON file at `<Claude config dir>/switchboard/reports/<sessionId>.json`, with the first ~40 characters of the first prompt (used as the title), the model, branch, todo progress, current activity, approval preview, question, error, a short excerpt of the last reply, background tasks, rate limits, connectors, the pull request, the terminal it runs in (`TERM_PROGRAM`), context usage, cost, turn count and timestamps. A report whose `sessionId` isn't in any session record and that hasn't been updated for a minute is removed the next time any session scans, even if you never open the Board. If no session records can be found at all, nothing is removed
- **Masking is best effort**: before writing, fragments that look like secrets in commands, approval previews, questions, the first prompt, the last-reply excerpt and error messages (such as `Bearer …`, `token=…`, `--token …`, `API_KEY=…`, `sk-…`, `ghp_…`) are replaced with `•••`. This can't catch everything, and the rest of each command is still stored in plain text
- **Read locally**: Claude Code's own `<Claude config dir>/sessions/*.json` records and these reports. Other sessions' `.jsonl` transcripts are never read
- **Commands it runs**: when scanning, `ps` (which sessions are alive; also every 15 seconds while the Board is closed, for the count on the open button) and `rm` (removing leftover reports); in each session's own folder, when it starts and after each turn, `git` (branch and changes) and `gh pr view` (the pull request, which contacts GitHub with your own `gh` login); also `uname -s` (checking the operating system on `/switchboard:open`), `defaults read -g AppleLanguages` (UI language, only when `LC_ALL` and `LANG` don't settle it), `open` (jumping to a Desktop session, and opening pull request pages and the author link), `osascript` (switching to the session's tab in iTerm or Terminal.app). Time limits: `ps` and `git` 5 seconds, `gh` 8 seconds, `osascript` 10 seconds, `defaults` and `uname` 3 seconds

## How it works

Every session loads the mod, which has two jobs:

1. **Reporter**: listens to its own session's events (`session.start`, `turn.start`, `tool.call`, `turn.complete`, …) and writes its status report. When the session starts and after each turn, it also runs `git` and `gh` in its own folder for the branch, changes and pull request.
2. **Board**: a session that shows the Board merges the reports with Claude Code's session records every 3 seconds, drops sessions whose process is gone, and draws the list; it never runs `git` or `gh` itself. A session without the Board open does the same merge every 15 seconds, only to count the sessions that need you for the button above the prompt.

Whether a session exists is decided only by Claude Code's records and whether its process is alive, so a stale report can never keep an ended session on the list. When the two sources disagree, a fixed order decides: if the record says Working or Needs You, the record wins; otherwise a turn error in the report makes the session Errored, and a question in the report while the record says Idle makes it Needs You; in every other case the record wins.

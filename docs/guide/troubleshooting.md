English | [繁體中文](troubleshooting.zh-TW.md) | [简体中文](troubleshooting.zh-CN.md) | [日本語](troubleshooting.ja.md) | [한국어](troubleshooting.ko.md)

# Troubleshooting

[← Back to README](../../README.md)

| Symptom | What to do |
|---|---|
| `/switchboard:open` answers that the hooks did not load | 1. Check that your Claude Code version supports mods, and update it if not. 2. Restart this session: sessions open before you installed don't load it. 3. If it still fails, start `claude --debug` and look for `hooks module switchboard` errors in the debug log |
| The command says the Board can't be shown here | You ran it in the VS Code extension's graphical UI; type it in the Desktop Code tab or in Claude Code in a terminal instead |
| The header shows `⚠ Can’t see session status right now` and says no session records were found, not even for this session | Your Claude Code version is too old to write session records, or `CLAUDE_CONFIG_DIR` points somewhere other than the folder Claude Code actually uses |
| The header shows `⚠ Can’t see session status right now`, then `switchboard could not read its state:` and some red text | The red text is the raw error. The Board retries every 3 seconds, so a passing error clears by itself; if it keeps showing, start `claude --debug` and look for `hooks module switchboard` errors in the debug log |
| The header shows `⚠ Can’t see session status right now` and says a folder can't be read | Check that the folder exists and that you can read it; if you set `CLAUDE_CONFIG_DIR`, check that it points to the folder Claude Code actually uses |
| A row says `switchboard not loaded, basic status only` | That session was opened before you installed; restart it |
| No PR shown | Install `gh` and run `gh auth login`; the session's folder must be a GitHub repository |
| Clicking a CLI session only shows a path | Only iTerm and Terminal.app can jump; switch to other terminals yourself. If iTerm or Terminal.app doesn't jump either, follow the note to System Settings › Privacy & Security › Automation and allow controlling them, or restart that session (sessions started before 0.6.0 did not record their terminal) |
| **Open the board automatically in › CLI sessions** is checked, but the Board doesn't appear in a terminal | The terminal is too narrow for a pane that opens by itself (under 144 columns). Click **▦ Open board** above the prompt or run `/switchboard:open`, or widen the terminal |
| Code changes have no effect | Installed copies are cached by the `version` in `plugin.json`. While developing, start `claude --plugin-dir ./agens-view` from the project folder instead; it hot-reloads as you edit. If an installed copy doesn't get a new release, run `claude plugin marketplace update switchboard` and `claude plugin update switchboard@switchboard`, then restart |

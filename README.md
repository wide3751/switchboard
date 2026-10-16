<p align="center">
  <img src="assets/logo.svg" width="480" alt="switchboard">
</p>

English | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

# switchboard: a session board for Claude Code (a Claude Code mod)

A **Claude Code plugin**, built on **Claude Code mods**, that lists every local Claude Code session in one **Board** pane in Claude Desktop, so you can see at a glance which sessions are working, which are idle, and which are **blocked on you**. Sessions in the Desktop Code tab and sessions in iTerm, Terminal.app or the VS Code terminal all show up in the same list.

The way a switchboard operator sees which lines are lit, switchboard has every session report its own state and puts the ones waiting on you at the top:

| State | Meaning | Example |
|---|---|---|
| **Needs You** | Nothing moves until you look | A permission prompt for `npm install`, a multiple-choice question, a turn stopped by an API error |
| **Working** | Claude is running a turn | Thinking, calling tools, running subagents |
| **Idle** | The turn is over and nothing is blocked | Finished and waiting for your next prompt; a turn you interrupted yourself |
| **Ended** | The session was closed or its process exited | Removed from the list at once |

**Why does a plain-text question count as Idle?** Needs You only reacts to explicit signals (permission prompts, choice cards, errors), so when it lights up, something really is waiting on you. A question Claude asks in plain text is Idle, and the last-reply preview on its row lets you spot it.

## Quick start

```bash
claude plugin marketplace add wide3751/switchboard
claude plugin install switchboard@switchboard
```

Restart Claude Desktop, then in the Code tab:

1. Type `/switchboard:on`
2. The Board opens on the right, with a line such as `▲ 2 sessions need you` at the top

From then on the Board opens in every Desktop session by default. See [Install](#install) and [Usage](#usage) for details.

## Install with an AI agent

Paste this to Claude Code or any other coding agent:

> Install switchboard by following https://github.com/wide3751/switchboard/blob/main/README.md

## Requirements

- macOS
- The [Claude Desktop](https://claude.ai/download) app with the Code tab; the Board only opens there
- Claude Code with mods support (developed and tested on **v2.1.299**; type `/status` in the Code tab to check)
- Optional: `git` for branch and change details, and [`gh`](https://cli.github.com/) signed in for pull request details

## Install

1. Add the marketplace and install. There are two ways; **GitHub is recommended**:

   **Option A: from GitHub (recommended)** — no need to download the project:

```bash
claude plugin marketplace add wide3751/switchboard
claude plugin install switchboard@switchboard
```

   To update to a new version later, update the marketplace, then the plugin, and restart Claude Desktop (running `install` again on an installed plugin does not upgrade it):

```bash
claude plugin marketplace update switchboard
claude plugin update switchboard@switchboard
```

   **Option B: from a local folder** — for when you have cloned the project and want to install your own changes:

```bash
git clone https://github.com/wide3751/switchboard.git ~/Projects/switchboard
claude plugin marketplace add ~/Projects/switchboard
claude plugin install switchboard@switchboard
```

2. Restart Claude Desktop, then type `/switchboard:on` in the Code tab and check that the Board opens.

Sessions that were already open before you installed do not load the mod. They still appear on the Board, but with basic status only; restart them to get full details.

## Usage

| Command | Description |
|---|---|
| `/switchboard:on` | Open the Board in this Desktop session. In a CLI session it only prints a hint that the Board opens in Desktop |

**On the Board:**

- **Header**: how many sessions need you and how long the longest one has waited. The same count appears in the pane title, for example `Switchboard · 2`
- **Account usage**: on a subscription, 5-hour and weekly rate-limit usage with their reset times; on API billing, the total spent across sessions
- **Sections**: Needs You → Working → Idle; within a section, most recent activity first. Idle sessions stay on the list however long they sit, and the Idle section can be collapsed
- **Click a title** to jump to that session in Claude Desktop. Needs You rows also have **Go handle it →**
- **Expand ▾** on a row shows the rest of its details
- **View** opens the settings below

If you close the Board in a session, it no longer opens there by itself until you run `/switchboard:on` again.

**Settings** (the **View** panel; stored globally and shared by all sessions):

| Name | Default | Values |
|---|---|---|
| Show in every Desktop session | on | on: the Board opens whenever a Desktop session starts or finishes a turn, so it stays in view as you switch; off: only in sessions where you ran `/switchboard:on` |
| Language | Auto | Auto (follows the macOS language), EN, 日本語, 한국어, 简中, 繁中 |
| Billing | Auto | Auto, Subscription (shows rate limits), API (shows cost) |
| Section | Working | Which section the density and fields below apply to: Needs You, Working or Idle |
| Density | per section | Compact, Standard, Detailed, or Custom when you pick fields yourself |

**Fields** each row can show:

| Field | Shows |
|---|---|
| Time | How long the session has been in its current state |
| Location | Project folder |
| Branch | git branch, ahead/behind, uncommitted files |
| Changes | Lines added and removed against the base branch, like Desktop's Changes |
| PR | The branch's pull request; for a Desktop session with unpushed work and no PR, **Create PR ↗** jumps to it |
| Progress | Todo progress and the current item |
| Activity | The tool call in progress |
| Background tasks | Running subagents and background shell commands |
| Context | Context window usage |
| Connectors | Connected MCP connectors, and ones that need auth |
| Last reply | A short excerpt of Claude's latest reply |
| Model | The model; shown anyway when an active session uses a different model from the rest |
| Usage | Turns, plus cost on API billing |
| Environment | Worktree or Remote |
| Source | The terminal a CLI session runs in |
| Full path | The full working directory |

On a Needs You row the approval preview (the command it wants to run), the question with its options, or the error that stopped the turn always shows.

### Examples

Three sessions are running: one is stuck on a permission prompt, one is working, one is done. The Board header shows:

```
▲ 1 session needs you
Longest wait 3m · click a title to go there
```

Its row shows the command it wants to run, for example `$ npm install jsonwebtoken`, with **Go handle it →** next to it.

Once nothing is waiting:

```
✓ Nothing needs you
```

## Limitations

- **macOS and Claude Desktop only**: CLI sessions appear on the list and report their state, but show no UI of their own.
- **No jumping to CLI sessions yet**: clicking one shows the folder it runs in.
- **Updates are polled**: every 3 seconds, so a change shows up within a few seconds rather than instantly. Each session that shows the Board scans on its own.
- **Sessions without the mod show basic status only**: no Errored state, approval preview or last reply, for example sessions that were open before you installed.
- **Local sessions only**: subagents and cloud sessions are not listed.

## Troubleshooting

| Symptom | What to do |
|---|---|
| `/switchboard:on` answers that the hooks did not load | Look for `hooks module switchboard` errors with `claude --debug` or in the debug log |
| The command says the Board only opens in Claude Desktop | You ran it in a CLI session; type it in the Desktop Code tab instead |
| A row says `switchboard not loaded, basic status only` | That session was opened before you installed; restart it |
| No PR shown | Install `gh` and run `gh auth login`; the session's folder must be a GitHub repository |
| Clicking a CLI session only shows a path | Expected for now; switch to that terminal yourself |
| Code changes have no effect | Installed copies are cached by the `version` in `plugin.json`. Bump the version, run `claude plugin update switchboard@switchboard` and restart |

## Privacy and data

switchboard runs entirely on your Mac and sends nothing to any service of its own.

- **Written locally**: each session's status report at `<Claude config dir>/switchboard/reports/<sessionId>.json`, with the model, branch, todo progress, current activity, approval preview, question, error, a short excerpt of the last reply, background tasks, rate limits, connectors and the pull request. Reports from sessions that no longer exist are removed
- **Read locally**: Claude Code's own `~/.claude/sessions/*.json` records and these reports. Other sessions' `.jsonl` transcripts are never read
- **Commands it runs**: `git` (branch and changes), `gh pr view` (the pull request, which contacts GitHub with your own `gh` login), `ps` (which sessions are alive), `defaults read -g AppleLanguages` (UI language), `open` (jumping to a session)

## How it works

Every session loads the mod, which has two jobs:

1. **Reporter**: listens to its own session's events (`session.start`, `turn.start`, `tool.call`, `turn.complete`, …) and writes its status report.
2. **Board**: only in sessions that show the Board. Every 3 seconds it merges the reports with Claude Code's session records, drops sessions whose process is gone, and draws the list.

Whether a session exists is decided only by Claude Code's records and whether its process is alive, so a stale report can never keep an ended session on the list. When the two sources disagree, the newer one wins.

## Contributing

Issues and pull requests are welcome. Before changing behavior, read [CONTEXT.md](CONTEXT.md) for the terminology and the decisions in [docs/adr/](docs/adr/) (both in Chinese). When you add or change UI text, update all five languages in [agens-view/hooks/i18n.ts](agens-view/hooks/i18n.ts).

## Docs

- [CONTEXT.md](CONTEXT.md): terminology (Session, Needs You, Board, Status Report…)
- [docs/adr/](docs/adr/): architecture decisions

## License

[MIT](LICENSE)

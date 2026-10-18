---
name: verify-switchboard
description: Drive the real switchboard mod (agens-view/) inside live `claude` terminal sessions under tmux, and capture screen and status-report evidence. Use to prove a change to the Board, the open button above the prompt, Needs You detection or status reports works in a real Claude Code session, beyond `claude plugin test`.
---

# Verify switchboard

switchboard is a Claude Code mod. Users see it in two places: the **▦ open button** above the prompt, and the **Board** pane that `/switchboard:open` opens. Both appear in the Claude Desktop Code tab and in a `claude` terminal session. This skill drives the terminal surface. It starts real `claude` processes in tmux. Each one loads `agens-view/` from this checkout with `--plugin-dir`, which overrides any installed copy and hot-reloads when files change.

Unit tests (`claude plugin test agens-view`) run against a fake world. This skill is the proof against the real engine, the real `~/.claude/sessions` records and real status reports.

The Desktop surface, jumping to iTerm or Terminal.app tabs, and mouse clicks are out of scope. tmux is not a terminal that jump supports, so cards here never show **Go handle it →**. Use the keyboard path instead.

## Before you start

- Requires `tmux` (`brew install tmux`), `claude` on PATH and logged in, and `python3`.
- Every instance runs on your real `~/.claude`, so the Board lists **every live session on this Mac**, not only the ones this skill starts. Assert on this run's own cards. Their titles start with the run's folder name, `sbv-<run id>`, for example `sbv-r1018-210342-3fa2-…`. Never assert on totals.
- While a run is live, its sessions also show up on the user's other Boards, including Desktop. Keep runs short and always stop them.
- Instances use `--model haiku` and `--permission-mode default`. A prompt that runs a shell command therefore stops at an approval prompt, which is the cheapest real Needs You state. Each prompt costs one small Haiku turn.
- The Board's language follows the macOS language unless Settings overrides it. Match glyphs (`▲ ◉ ○ ▦ ✓`) and command text, not words. Where words are unavoidable, accept both, for example `'設定 ▸|Settings ▸'`.

## Helper

All steps go through `.claude/skills/verify-switchboard/sbv`, run from the repo root. Below, `sbv` means that path:

```bash
SBV=.claude/skills/verify-switchboard/sbv
```

| Command | What it does |
|---|---|
| `$SBV launch` | New run: a scratch git repo under `$TMPDIR/sbv-<run>.*` and `.verify/runs/<run>/`. Prints the run id. |
| `$SBV start <name> [cols] [rows]` | Starts `claude` in tmux session `sbv-<run>-<name>` (default 160×50) with a fixed `--session-id` and a debug log. It answers the folder-trust prompt for the scratch folder and returns once the ▦ button renders. |
| `$SBV doctor [name…]` | Read-only health check. See Doctor. |
| `$SBV type <name> <text>` | Types literal text into the prompt, then presses Enter. Refuses while that instance shows a permission prompt, because the Enter would approve it. |
| `$SBV keys <name> <key>…` | Sends tmux keys one at a time, such as `C-x Tab`, `Enter`, `Escape`. |
| `$SBV wait <name> <regex> [secs]` | Waits until the screen matches an extended regex (default 60 s). On timeout it prints the screen and fails. |
| `$SBV gone <name> <regex> [secs]` | Waits until the screen no longer matches. |
| `$SBV snap <name> <label>` | Saves the visible screen to `evidence/<label>.txt` and prints it. |
| `$SBV report <name> [label]` | Prints this instance's status report, `~/.claude/switchboard/reports/<session id>.json`. With a label, it also copies the report into evidence. |
| `$SBV resize <name> <cols> <rows>` | Resizes the tmux window, for the narrow-terminal checks. |
| `$SBV stop` | Teardown. See Cleanup. |

Every command except `launch` needs `SBV_RUN` set to the id `launch` printed. There is no shared "current run", because other agents may drive their own runs in this checkout at the same time. Shell state does not persist between tool calls, so start each call with `export SBV_RUN=<run id>`.

## Launch

```bash
$SBV launch               # prints the run id, for example r1018-210342-3fa2
export SBV_RUN=<run id>
$SBV start board          # the session whose Board you read
$SBV start waiter         # a second session to put into a state, when the feature needs one
```

The instance is ready when `start` prints `ready:`. That means the mod has rendered its ▦ button above the prompt, so the hooks module is live, not merely that the process started. A fresh scratch folder needs no seed data. The only state these sessions need is their own session record and status report, and Claude Code and the mod write both on startup.

## Doctor

Run `$SBV doctor` right after `start`, and again whenever a screen looks wrong. For each instance it checks five things. The tmux session exists. Its pane process is `claude`. The debug log says switchboard came from `--plugin-dir` (`overrides installed version`) and its hooks module loaded. The session has a record in `~/.claude/sessions`. Its status report exists. It ends with `doctor: OK` or `doctor: PROBLEMS FOUND`. It also prints the repo HEAD and dirty-path count at launch, and the `plugin.json` version, so evidence can be tied to a build.

If doctor reports the module did not load, read `.verify/runs/<run>/<name>.debug.log` and search for `hooks module switchboard`.

## Drive

Read `features/README.md`, then the feature file you are proving. Each file lists the exact `sbv` commands and the screen or report state that proves each step. Conventions:

- Open the Board with `$SBV type board '/switchboard:open'` and wait for `'設定 ▸|Settings ▸'`.
- The Board pane renders at the right of the terminal. Its rows share lines with the transcript, so grep for the card text rather than slicing columns.
- Keyboard: `C-x Tab` moves focus from the prompt into the mod (the open button when the Board is closed, the Board when open). `Enter` presses. `Escape` returns to the prompt. `C-x x` closes the Board only while the Board has focus.
- Status reports refresh within a few seconds. The Board rescans every 3 s. While the Board is closed, the button count rescans every 15 s, so wait up to 40 s for it.

## Evidence

Evidence lives in `.verify/runs/<run>/evidence/`, which is gitignored and survives `stop`. A proof needs:

- A screen capture (`snap`) of the action and one of the resulting state. The final screen alone is not enough.
- The side effect alongside the screen. Use `report <name> <label>` to capture the status report that drove the card. Check files in the scratch repo when the feature writes or must not write them.
- The real user path: the slash command, the keyboard, a real approval prompt. Never write report files or session records by hand to fake a state.

The run folder also keeps each instance's debug log, `repo-head` and `repo-dirty`. Screens and reports contain the titles and last replies of the user's other live sessions. Keep evidence local and never commit or paste it publicly.

## Cleanup

```bash
$SBV stop
```

`stop` kills only this run's tmux sessions (`sbv-<run>-*`). It deletes only this run's status reports and session records, matched by the session IDs it assigned. It deletes the scratch repo and its `~/.claude/projects/<slug>` transcript folder. It never touches other sessions or kills by process name. Evidence and debug logs stay in `.verify/runs/<run>/`. After a failed attempt, run `stop` before retrying. Never stop a run you did not launch: other agents' runs live in the same `.verify/runs/` and tmux server.

To delete old evidence, remove `.verify/runs/<run>/` yourself when it is no longer needed.

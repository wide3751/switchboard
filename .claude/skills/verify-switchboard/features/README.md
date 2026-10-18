# switchboard verification map

This folder is the maintained source for verifying switchboard's user-facing behavior in a terminal `claude` session. Read this index before driving, then use the matching feature file as the recipe.

## Baseline preconditions

- A run exists (`$SBV launch`) and every instance the recipe names was started with `$SBV start <name>` and printed `ready:`.
- `$SBV doctor` ends with `doctor: OK`.
- The Board of each instance starts closed. `start` leaves it closed, because the CLI auto-open setting is off by default.
- Never drive a `claude` session this run did not start.

## Driving conventions

- `$SBV` is `.claude/skills/verify-switchboard/sbv`, run from the repo root.
- Identify this run's cards by the `sbv-<run id>` title prefix. Other live sessions on the Mac also appear, so never assert on totals or on the absence of other cards.
- Match glyphs and command text. Accept both languages where a word is unavoidable.
- Wait for a screen state with `$SBV wait`, never a fixed sleep.

## Proof and skip reporting

- Snap the screen after the action and after the resulting state. Name each snap `<feature id>-<step>`.
- For anything driven by session state, also save the status report with `$SBV report <name> <label>`.
- Report an unreachable step with the command you ran and the screen `wait` printed on timeout.
- Do not report a skipped entry point, such as a mouse click, as verified through a different one.

## Feature entry contract

Each feature file has an H1 title and one paragraph on the user-visible behavior, then four H2 sections in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with sbv` (starting with `Preconditions:`), and `Gotchas`.

## Features

- [Open and close the Board](./open-board.md) covers the slash command, the keyboard path to the open button, and closing.
- [Needs You card](./needs-you.md) covers a real approval prompt in one session appearing at the top of another session's Board, and leaving it once answered.
- [Count on the open button](./open-button-count.md) covers the Needs You count on the ▦ button while the Board is closed.

Not mapped yet: Settings (global and shared by every session, so a recipe must restore each value), expanding a card with `▸`, the Idle section collapse, the narrow-terminal rule (auto-open needs at least 144 columns), jumping to iTerm or Terminal.app tabs, and the Desktop surface.

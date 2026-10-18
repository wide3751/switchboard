# Open and close the Board

The Board is a pane on the right of the terminal that lists every live local session, grouped into Needs You, Working and Idle under a header. A user opens it with `/switchboard:open` or the ▦ button above the prompt, and closes it from the keyboard.

## Sub-features

- `open-command` opens the Board with `/switchboard:open` and confirms in the transcript.
- `open-button` opens the Board by focusing and pressing the ▦ button.
- `own-card` lists the current session's own card.
- `close-key` closes the Board with `ctrl+x x` while the Board has focus, and the ▦ button returns.

## How to get to it (user POV)

- Type `/switchboard:open` in the prompt and press Enter.
- Press `ctrl+x tab` to focus the ▦ button above the prompt, then Enter.
- With the Board focused, press `ctrl+x x` to close it.

## Driving it with sbv

Preconditions:

- Instance `board` is ready, and doctor is OK.

- **Command entry.** Run `$SBV type board '/switchboard:open'`, then `$SBV wait board '設定 ▸|Settings ▸' 15`. The transcript shows `switchboard:` followed by an opened confirmation, and the Board header shows `✓` or `▲ <n>` with `Settings ▸` at its right.
- **Own card.** Run `$SBV snap board open-board-command`. The Board lists a card whose title starts with `sbv-<run id>` and is marked `目前`/`current`.
- **Close.** Run `$SBV keys board C-x Tab`, then `$SBV keys board C-x x`, then `$SBV wait board '\[ .*▦' 10`. The pane is gone and the button above the prompt reads `[ ▦ … ]`. Snap it as `open-board-closed`.
- **Button entry.** Run `$SBV keys board C-x Tab Enter`, then `$SBV wait board '設定 ▸|Settings ▸' 15`. The Board opens again without any text typed into the prompt. Snap it as `open-board-button`.

## Gotchas

- `ctrl+x x` does nothing while focus is in the prompt. Press `C-x Tab` first. After `Escape`, focus is back in the prompt.
- The ▦ button is hidden while Claude Code shows a permission prompt in that same session.
- `/switchboard:open` answered by the model with text about hooks not loading means the hooks module failed. Run doctor.

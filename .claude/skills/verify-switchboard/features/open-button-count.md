# Count on the open button

While the Board is closed, the ▦ button above the prompt carries the number of sessions waiting on the user, for example `[ ▲1 need you · ▦ Open ]`. One press opens the Board.

## Sub-features

- `count-shown` changes the button to `▲<n> … · ▦ …` once any session needs the user.
- `count-cleared` returns the button to `[ ▦ … ]` once nothing on the Mac needs the user.

## How to get to it (user POV)

- Keep the Board closed in one session while another session waits on an approval. Look at the button above the prompt.

## Driving it with sbv

Preconditions:

- Instances `board` and `waiter` are ready, doctor is OK, and `board` has its Board closed.

- **Baseline.** Run `$SBV snap board count-baseline`. Note the button text. If it already shows `▲`, another session on the Mac is waiting, so record its n and expect n+1 below.
- **Make it wait.** Run `$SBV type waiter 'Use the Bash tool to run exactly this command: touch sbv-proof.txt'`, then `$SBV wait waiter 'Do you want to proceed' 90`.
- **Count shown.** Run `$SBV wait board '▲ ?[0-9]+.*▦' 40`, then `$SBV snap board count-shown`. The button reads `[ ▲<n> … · ▦ … ]` with n one higher than the baseline.
- **Count cleared.** Run `$SBV keys waiter Escape`, then wait up to 40 s for the count to drop back to the baseline. Snap it as `count-cleared`.

## Gotchas

- Without the Board open, the count rescans every 15 s. Use waits of at least 40 s.
- The count covers every session on the Mac, so `count-cleared` only returns to `[ ▦ … ]` when the baseline had none.

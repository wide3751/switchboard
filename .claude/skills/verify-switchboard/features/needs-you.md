# Needs You card

When a session is blocked on the user, every open Board moves it to the top under a `▲` header with the reason. For an approval, the card shows the command it wants to run. When the user answers, the card leaves Needs You.

## Sub-features

- `approval-report` makes the waiting session write the pending command to its status report as `approval`.
- `approval-card` makes the Board header read `▲ <n>` with an Approve breakdown and the longest wait. The waiting session's card is bold-bordered and shows `$ <command>`.
- `answered` makes the card leave Needs You after the user rejects or approves. The header returns to `✓` when nothing else on the Mac is waiting.
- `no-side-effect` checks that rejecting the approval leaves the command unrun.

## How to get to it (user POV)

- In one session, ask Claude to run a shell command. With default permissions it stops at `Do you want to proceed?`.
- In another session, open the Board.
- Back in the first session, answer the prompt, for example Esc to reject.

## Driving it with sbv

Preconditions:

- Instances `board` and `waiter` are ready, and doctor is OK.
- `board` has its Board open (see [open-board](./open-board.md), command entry).

- **Make it wait.** Run `$SBV type waiter 'Use the Bash tool to run exactly this command: touch sbv-proof.txt'`, then `$SBV wait waiter 'Do you want to proceed' 90`. Snap it as `needs-you-prompt`.
- **Report.** Run `$SBV report waiter needs-you-report`. Both `"approval"` and `"activity"` are `"$ touch sbv-proof.txt"`.
- **Card.** Run `$SBV wait board '\$ touch sbv-proof.txt' 20`, then `$SBV snap board needs-you-card`. Under a `▲ 1`-or-more header, a `┏━` bordered card reads `▲ <Approve> sbv-<run id>…` and has `$ touch sbv-proof.txt` on the next line, with the scratch folder name and `Haiku` below it.
- **Answer.** Run `$SBV keys waiter Escape`, then `$SBV gone board '\$ touch sbv-proof.txt' 20`, then `$SBV snap board needs-you-answered`. No `$ touch sbv-proof.txt` card remains, and the waiter's card is an `○` Idle row.
- **No side effect.** Run `ls -A "$(cat .verify/runs/$SBV_RUN/workdir)"`. It lists only `.git`, with no `sbv-proof.txt`.

## Gotchas

- Other live sessions on the Mac can also be waiting. Assert on this run's card and on the `$ touch` line, not on the header count.
- The Haiku turn sometimes adds a `Creating …` line before the tool call. Wait for `Do you want to proceed`, not for a fixed transcript.
- Never `type` into the waiter while its permission prompt is open. The Enter approves the command, and the run proves the wrong path. `sbv type` refuses in that state. If a waiter was answered by mistake, start a fresh instance, such as `waiter2`, rather than reusing it.
- Never choose "switch to auto mode" or "always allow" in the prompt. Those change permission settings beyond the run.
- No `Go handle it →` button appears, because tmux is not a terminal that jump supports. That is correct behavior here, not a failure.

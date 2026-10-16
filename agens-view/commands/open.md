---
description: 打開監看視窗，查看所有本機 Session 的狀態 · Open the session board
---

This command is answered directly by the switchboard mod's hooks. If you (the model) are reading this text, the switchboard hooks module did not load.

Reply to the user in the language they are using in this conversation (not necessarily the language of this file). Tell them the switchboard hooks did not load, then list these three steps:

1. Check that this Claude Code version supports mods (plugins with a hooks module); update Claude Code if it does not.
2. Restart this session: sessions that were already open before switchboard was installed do not load it.
3. If it still does not work, start `claude --debug` and look for errors about `hooks module switchboard` in the debug log.

Do nothing else.

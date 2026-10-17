<p align="center">
  <img src="assets/logo.svg" width="440" alt="switchboard">
</p>

[English](README.md) | [繁體中文](README.zh-TW.md) | 简体中文 | [日本語](README.ja.md) | [한국어](README.ko.md)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Y8H028VWRF)

# switchboard：Claude Code 的 Session 监控窗口（Claude Code mod）

一个 **Claude Code plugin**，基于 **Claude Code mods** 构建，把所有本地 Claude Code Session 列在一个 **监控窗口** Pane 中，让你一眼看清哪些 Session 在工作、哪些空闲、哪些**在等你**。Desktop Code 标签页里的 Session，和 iTerm、Terminal.app、VS Code 终端里的 Session，都列在同一份列表中。Desktop 和终端同等支持，只用其中一种也能完整使用。

<p align="center">
  <img src="assets/board/board.zh-CN.png" alt="switchboard 监控窗口：两个需要你处理、两个工作中、一个空闲（示意图）" width="412">
</p>

<p align="center"><sub>示意图：两个需要你处理（一个待批准、一个待回答）、两个工作中、一个空闲。</sub></p>

就像总机接线员能看到哪几条线亮着灯，switchboard 让每个 Session 自己报告状态，再把在等你的排在最上面：

| 状态 | 含义 | 例子 |
|---|---|---|
| **需要你处理** | 你不去看，事情就不会推进 | 停在 `npm install` 的权限提示、用选项卡提问、Desktop 回合结尾的提问框、回合因 API 错误停止 |
| **工作中** | Claude 正在执行回合 | 思考、调用工具、运行 Subagent |
| **空闲** | 回合已结束，没有被卡住 | 完成后在等下一条指令；你自己中断的回合 |
| **已结束** | Session 已关闭或进程已不存在 | 立即从列表中移除 |

**为什么用文字提问算空闲？** 需要你处理只响应明确的信号（权限提示、选项卡、Desktop 回合结尾的提问框、错误），所以它亮起时，一定是真的在等你。Claude 用普通文字提问时算空闲，你可以从那一行的最后回复摘要中发现。

## 快速开始

```bash
claude plugin marketplace add wide3751/switchboard
claude plugin install switchboard@switchboard
```

接下来按你使用 Claude Code 的地方，走其中一条（两条都走也可以）：

**Desktop**：重启 Claude Desktop，打开 Code 标签页里的任意一个 Session。监控窗口会自动出现在右侧，顶部显示类似 `▲ 2 个需要你处理` 的一行；之后每个 Desktop Session 都会自动打开它。没有出现的话，输入 `/switchboard:open`。

**终端**：重启 `claude`。输入框上方会出现 **▦ 打开监控窗口** 按钮，有 Session 在等你时带上等你计数，例如 **▦ 打开监控窗口 · ▲2**。点击按钮或输入 `/switchboard:open`，监控窗口就出现在终端里。想让它一直显示，在监控窗口右上角的 **设置 ▸** 开启「在所有 CLI Session 显示」；终端至少要 144 列宽才会自动打开（见[限制](#限制)）。

<p align="center">
  <img src="assets/board/terminal.zh-CN.png" alt="终端里的 switchboard 监控窗口：嵌在 Claude Code 输入框上方（示意图）" width="560">
</p>

<p align="center"><sub>示意图：80 列的终端里，监控窗口嵌在输入框上方。标题前的 <code>❯</code> 是终端里的 Session，<code>◧</code> 是 Desktop，<code>✎</code> 是 VS Code。</sub></p>

列表上只有你自己这个 Session 时，监控窗口会提示「再开其他 Session（Desktop 或终端）就会出现在这里；安装前就开着的要重开」。详见[安装](#安装)与[使用方法](#使用方法)。

## 交给 AI 代理安装

把这段粘贴给 Claude Code 或其他 coding agent：

> Install switchboard by following https://github.com/wide3751/switchboard/blob/main/README.md

## 系统要求

- macOS
- Claude Code，以下其中一种（两种都用也可以）：
  - [Claude Desktop](https://claude.ai/download) app 的 Code 标签页
  - 终端里的 `claude`（iTerm、Terminal.app、VS Code 集成终端等）
- 支持 mods 的 Claude Code 版本：在 **v2.1.299** 上开发与测试；可用的最低版本尚未确认。Desktop 在 Code 标签页输入 `/status` 查看版本，终端运行 `claude --version`。Desktop 自带的 Claude Code 版本可能和终端的不同，两边要分别查看
- 可选：`git`（分支与变更信息）、已登录的 [`gh`](https://cli.github.com/)（Pull Request 信息）

## 安装

1. 添加 marketplace 并安装。有两种方式，**推荐用 GitHub**：

   **方式 A：从 GitHub（推荐）**，无需下载项目：

```bash
claude plugin marketplace add wide3751/switchboard
claude plugin install switchboard@switchboard
```

   之后要更新到新版本，先更新 marketplace，再更新 plugin，然后重启 Claude Desktop 或 `claude`（对已安装的 plugin 再运行一次 `install` 不会升级）：

```bash
claude plugin marketplace update switchboard
claude plugin update switchboard@switchboard
```

   **方式 B：从本地文件夹**，适合已经 clone 项目、想安装自己修改的版本：

```bash
git clone https://github.com/wide3751/switchboard.git ~/Projects/switchboard
claude plugin marketplace add ~/Projects/switchboard
claude plugin install switchboard@switchboard
```

2. 重启 Claude Desktop 或 `claude`，输入 `/switchboard:open`，确认监控窗口已打开。

安装前就已打开的 Session 不会加载 mod。它们仍会出现在监控窗口中，但只有基本状态；重启这些 Session 才能看到完整详情。

## 卸载与停用

**暂时停用**（保留安装，之后可以再启用）：

```bash
claude plugin disable switchboard@switchboard
```

要再启用时运行 `claude plugin enable switchboard@switchboard`。

**完全移除**：

```bash
claude plugin uninstall switchboard@switchboard
claude plugin marketplace remove switchboard
rm -rf ~/.claude/switchboard
```

- `marketplace remove` 会顺便卸载这个 marketplace 的 plugin，所以只运行它也可以；运行过 `uninstall` 再运行它也没问题
- `~/.claude/switchboard/` 存放各 Session 的状态报告，plugin 移除后不会自动删除。设置了 `CLAUDE_CONFIG_DIR` 的话，改为删除 `$CLAUDE_CONFIG_DIR/switchboard`
- 停用或移除后，重启 Claude Desktop 和开着的 `claude` 才会生效

## 使用方法

| 命令 | 说明 |
|---|---|
| `/switchboard:open` | 在当前 Session 打开监控窗口，Desktop Session 和 CLI Session 都可以 |

**监控窗口上有什么：**

- **顶部**：有几个 Session 在等你，以及等得最久的已经等了多久；至少有一个能跳转时会写「最长等待 3m · 点击标题前往」。Pane 标题也会带上这个数字，例如 `Switchboard · 2`
- **分区**：需要你处理 → 工作中 → 空闲。需要你处理按进入的时间由旧到新，等最久的在最上面（顶部的「最长」就是第一张卡片），新进来的加在底部；工作中按 Session 开始的时间排，批准来回不会改变位置；空闲按最后活动时间由新到旧。空闲再久也不会自动消失，空闲区可以折叠
- **账户用量**：订阅制显示 5 小时与每周的 rate limit 使用率和重置时间；API 计费显示所有 Session 的总花费。平时放在列表最后，不挤掉需要你处理的卡片；5 小时或每周用量达到 95% 时才移到顶部状态栏下面
- **标题**：Desktop 的 Session 用它自己的标题，用 `/rename` 改过名的 CLI Session 用那个名称；其他 CLI Session 用第一句 prompt 的前约 40 字，还没发送 prompt 时用项目文件夹名称（worktree 用 repo 名称）。标题相同的几行会补上分支名，分不出来时按 Session 开始的先后补 `#2`、`#3`。标题前一格的符号表示 Session 在哪里：`◧` Claude Desktop、`❯` 终端（iTerm、Terminal.app 等）、`✎` VS Code 集成终端。你所在的 Session 标示「当前」，监控窗口太窄时改成 `✦`
- **点击标题** 即可跳转到那个 Session：Desktop Session 切到 Claude Desktop 中对应的 Session；iTerm、Terminal.app 里的 CLI Session 切到对应的标签页。这些 Session 需要你处理时另有 **前往处理 →**
- 每一行的 **展开 ▾** 会显示其余详情
- **设置 ▸** 打开下面的设置

监控窗口关闭时，Desktop Session 和 CLI Session 的输入框上方都会有 **▦ 打开监控窗口** 按钮，点一下即可打开，无需输入命令。有 Session 在等你时，按钮会带上等你计数，例如 **▦ 打开监控窗口 · ▲2**（最多晚约 15 秒）；没有 Session 在等你、或暂时看不到 Session 状态时，只显示按钮本身。只用终端时，这是监控窗口关闭时唯一的信号。

在某个 Session 中手动关闭监控窗口后，该 Session 不会再自动打开，直到重启 Session、再次输入 `/switchboard:open` 或点击这个按钮。开着自动打开时关闭，会弹出一条提示说明这一点；要所有 Session 都不再自动打开，到 **设置 ▸** 取消「在所有 Desktop Session 显示」或「在所有 CLI Session 显示」。

### 在终端里

在 CLI Session（iTerm、Terminal.app、VS Code 集成终端）输入 `/switchboard:open`，监控窗口就出现在那个终端里，内容和 Desktop 一样，按终端宽度截断。终端全屏且至少 110 列宽时停靠在对话旁边，否则嵌在输入框上方。

终端不报告鼠标点击时，用键盘操作（以下是 Claude Code 的默认快捷键）：

| 按键 | 操作 |
|---|---|
| `ctrl+x tab` | 从输入框移进监控窗口（监控窗口关闭时，移到输入框上方的 **▦ 打开监控窗口** 按钮） |
| `tab`／`shift+tab` | 在监控窗口里的按钮和标题之间移动 |
| `enter` | 按下当前的按钮或标题 |
| `↑`／`↓` | 滚动监控窗口 |
| `esc` | 回到输入框，监控窗口保留 |
| `ctrl+x x` | 关闭监控窗口（也可以点击边框右上角的 ✕） |

**支持的终端：**

| `claude` 在哪里运行 | 列在列表中 | 打开监控窗口 | 点击标题跳转 | 实测 |
|---|---|---|---|---|
| Claude Desktop 的 Code 标签页 | ✓ | ✓ | ✓ 切到那个 Session | ✓ |
| iTerm | ✓ | ✓ | ✓ 切到对应的标签页 | ✓ |
| Terminal.app | ✓ | ✓ | ✓ 切到对应的标签页 | ✓ |
| VS Code 集成终端 | ✓ | ✓ | 显示文件夹 | 尚未 |
| 其他终端（Warp、Ghostty 等）与 tmux | ✓ | ✓ | 显示文件夹 | 部分（tmux：列在列表中、打开监控窗口） |
| VS Code 扩展（图形界面） | — | ✕ | — | 尚未 |

任何终端里的 Session 都会列在列表中并报告状态，因为这只依赖 Claude Code 本身。跳转需要终端允许其他 app 切换它的标签页，所以目前只支持 iTerm 和 Terminal.app。在 tmux 里运行的 Session 算作 tmux，而不是外层的终端，所以也只会显示文件夹。iTerm 和 Terminal.app 的每一项都实际测过，包括跳转。tmux 只测了列在列表中和打开监控窗口。VS Code 集成终端、Warp、Ghostty 和 VS Code 扩展尚未测试，表格里写的是预期行为。

**跳转到 iTerm、Terminal.app：** 第一次跳转时，macOS 会询问是否允许 Claude Desktop（或运行 Claude Code 的终端）控制 iTerm 或 Terminal，请点允许。拒绝过的话，到「系统设置 › 隐私与安全性 › 自动化」开启，switchboard 这时也会显示指向这里的提示。跳转不过去时会显示原因和 Session 所在的文件夹：

- VS Code、Warp、Ghostty 等不支持的终端：「VS Code 里的 Session 还不能直接跳转，它在 …」
- 0.6.0 之前打开的 CLI Session（没有记下终端）：「重新打开这个 Session 后才能跳转」
- 终端 10 秒内没有响应：放弃跳转，显示「无法切换到…」

### 有 Session 在等你时通知你

switchboard 自己不发通知（[ADR-0005](docs/adr/0005-no-own-needs-you-alert.md)）。权限提示、提问时的提醒交给 Claude Code 和 Claude Desktop 本身的通知：

- **终端**：在 `claude` 里输入 `/config`，设置通知方式（因版本不同显示为 **Notifications** 或 **Local notifications**）。默认的 `auto` 在 iTerm、kitty、Ghostty 会发桌面通知，在 Terminal.app 是响铃；VS Code、Warp、tmux 等其他终端用 `auto` 不会有任何通知，可以改成 `terminal_bell`。另外到「系统设置 › 通知」允许你的终端 app 发通知
- **Claude Desktop**：到「系统设置 › 通知」允许 Claude 发通知

**设置**（**设置 ▸** 面板；全局保存，所有 Session 共享。在一个 Session 改了设置，其他开着的监控窗口下次刷新时，约 3 秒内就跟着变）：

| 名称 | 默认 | 可选值 |
|---|---|---|
| 在所有 Desktop Session 显示 | 开启 | 开启：Desktop Session 启动或回合结束时自动打开监控窗口，切换 Session 时它一直都在；关闭：只在输入过 `/switchboard:open` 的 Session 显示 |
| 在所有 CLI Session 显示 | 关闭 | 开启：CLI Session（在终端运行的 `claude`）启动或回合结束时自动打开监控窗口；关闭：只在输入过 `/switchboard:open` 的 Session 显示。和 Desktop 那一项分开设置 |
| 语言 | 自动 | 自动、EN、日本語、한국어、简中、繁中。自动时依次看环境变量 `LC_ALL`、`LANG`，都没有（或是 `C`、`POSIX`）时才看 macOS 的语言偏好，最后是英文。所以终端里通常跟随 `LANG`，Desktop 通常跟随 macOS 语言 |
| 计费 | 自动 | 自动、订阅制（显示 rate limit）、API（显示花费） |
| 应用到 | 工作中 | 下面的密度和字段应用到哪一区：需要你处理、工作中、空闲 |
| 密度 | 各区不同 | 精简、标准、详细；自己挑选字段时显示为自定义 |

每一行可以显示的 **字段**：

| 字段 | 显示内容 |
|---|---|
| 时间 | 在当前状态停留了多久 |
| 位置 | 项目文件夹 |
| 分支 | git 分支、ahead/behind、未 commit 的文件数 |
| 变更行数 | 相对基准分支的新增／删除行数，与 Desktop 的 Changes 一致 |
| PR | 该分支的 Pull Request；有未推送的变更又没有 PR 时，**前往创建 PR →** 会跳到那个 Session（Desktop 和 iTerm、Terminal.app 的 Session） |
| 进度 | 待办列表的完成度与当前项目 |
| 当前操作 | 正在进行的工具调用 |
| 后台任务 | 运行中的 Subagent 与后台 shell 命令 |
| Context | context window 使用率 |
| 连接器 | 已连接的 MCP 连接器，以及需要验证的 |
| 最后回复 | Claude 最近一条回复的简短摘录 |
| 模型 | 使用的模型；进行中的 Session 用了与其他不同的模型时一定显示 |
| 用量 | 回合数，API 计费时加上花费 |
| 环境 | Worktree 或 Remote Control |
| 来源 | CLI Session 所在终端的名称（标题前的符号一律显示） |
| 完整路径 | 完整的工作目录 |

需要你处理的行一定会显示批准请求摘要（想执行的命令）、问题和选项，或导致回合停止的错误。

### 示例

开着三个 Desktop Session：一个卡在权限提示、一个在工作、一个已完成。监控窗口顶部显示：

```
▲ 1 个需要你处理
批准 1 · 最长等待 3m · 点击标题前往
```

那一行会显示它想执行的命令，例如 `$ npm install jsonwebtoken`，旁边有 **前往处理 →**。

没有在等你的时候：

```
✓ 没有 Session 需要你处理
工作中 1 · 空闲 2
```

## 限制

- **仅支持 macOS**：监控窗口可以在 Claude Desktop 和终端里的 Claude Code 打开；VS Code 扩展的图形界面不支持。在 Linux 等其他系统上 `/switchboard:open` 照样会打开，但会说明点击卡片跳转不能用；Windows 没有 `ps`，看不到 Session 状态。
- **CLI Session 只能跳转到 iTerm 和 Terminal.app**：其他终端（VS Code、Warp、Ghostty 等）点击后只会显示它所在的文件夹。
- **终端太窄时不会自动打开**：开启「在所有 CLI Session 显示」后，Claude Code 只在终端至少 144 列宽（在这里打开过的话 110 列）时才画出自动打开的 Pane。在那之前输入框上方会一直有 **▦ 打开监控窗口** 按钮；点击按钮或输入 `/switchboard:open`，不管多窄都会打开。把终端拉宽，等待中的监控窗口也会自己出现。
- **通过轮询更新**：监控窗口每 3 秒一次，状态变化会在几秒内反映，而非实时。每个显示监控窗口的 Session 都会各自扫描。没开监控窗口的 Session 每 15 秒做一次轻量扫描（只读 Session 记录和状态报告、运行一次 `ps`，不运行 `git`、`gh`），让打开按钮带上等你计数；所以按钮上的数字和监控窗口的数字短时间内可能不一致。
- **未加载 mod 的 Session 只有基本状态**：没有出错中止、批准请求摘要和最后回复，例如安装前就已打开的 Session。
- **只列出本地 Session**：不列出 Subagent 和云端 Session。

## 故障排除

| 症状 | 处理方式 |
|---|---|
| `/switchboard:open` 回复 hooks 没有加载 | 1. 确认 Claude Code 版本支持 mods，不支持就更新。2. 重启这个 Session：安装前就开着的 Session 不会加载。3. 仍然不行，用 `claude --debug` 启动，在 debug log 查看 `hooks module switchboard` 的错误信息 |
| 命令回复这里无法显示监控窗口 | 你在 VS Code 扩展的图形界面输入了命令；改到 Desktop 的 Code 标签页，或终端里的 Claude Code 输入 |
| 顶部显示 `⚠ 目前看不到 Session 状态`，下面说找不到任何 Session 记录，连当前这个都没有 | Claude Code 版本太旧、还不写 Session 记录，或 `CLAUDE_CONFIG_DIR` 指向了 Claude Code 实际使用的以外的文件夹 |
| 顶部显示 `⚠ 目前看不到 Session 状态`，下面说无法读取某个文件夹 | 确认那个文件夹存在、你有读取权限；设置了 `CLAUDE_CONFIG_DIR` 的话，确认它指向 Claude Code 实际使用的文件夹 |
| 某一行显示 `未加载 switchboard，仅基本状态` | 该 Session 在安装前就已打开；重启它 |
| 没有显示 PR | 安装 `gh` 并运行 `gh auth login`；Session 的文件夹必须是 GitHub repository |
| 点击 CLI Session 只显示路径 | 只有 iTerm、Terminal.app 能跳转；其他终端请自己切换过去。iTerm、Terminal.app 也跳转不过去时，按提示到「系统设置 › 隐私与安全性 › 自动化」允许控制它们，或重新启动那个 Session（0.6.0 之前打开的 Session 没有记下终端） |
| 开启了「在所有 CLI Session 显示」，终端里却没有监控窗口 | 终端太窄（不到 144 列），自动打开的 Pane 不会画出来。点击输入框上方的 **▦ 打开监控窗口**、输入 `/switchboard:open`，或把终端拉宽 |
| 修改代码后没有效果 | 已安装的副本按 `plugin.json` 的 `version` 缓存。提高版本号，运行 `claude plugin update switchboard@switchboard` 后重启 |

## 隐私与数据

switchboard 完全在你的 Mac 上运行，不会把数据发送到任何它自己的服务。

- **写在本地**：每个 Session 的状态报告，以明文 JSON 存放在 `<Claude 配置目录>/switchboard/reports/<sessionId>.json`，内容包括第一句 prompt 的前约 40 字（当作标题）、模型、分支、待办进度、当前操作、批准请求摘要、问题、错误、最后回复的简短摘录、后台任务、rate limit、连接器和 Pull Request。Session 结束至少一分钟后，下次有任何 Session 扫描时，它的报告就会被删除；从没打开过监控窗口也一样。一条 session 记录都找不到时不删除
- **遮罩只是尽力而为**：写入前，命令、批准请求摘要、问题、第一句 prompt、最后回复的摘录和错误信息里疑似机密的片段（例如 `Bearer …`、`token=…`、`--token …`、`API_KEY=…`、`sk-…`、`ghp_…`）会换成 `•••`。不保证能全部抓到，命令的其余部分仍以明文存放
- **在本地读取**：Claude Code 自身的 `~/.claude/sessions/*.json` 记录和这些状态报告。不会读取其他 Session 的 `.jsonl` 对话记录
- **会执行的命令**：`git`（分支与变更）、`gh pr view`（Pull Request，会用你自己的 `gh` 登录连接 GitHub）、`ps`（哪些 Session 还存活；监控窗口关闭时也每 15 秒运行一次，给打开按钮的计数）、`defaults read -g AppleLanguages`（界面语言）、`open`（跳转到 Session）、`osascript`（切到 iTerm、Terminal.app 对应的标签页）

## 工作原理

每个 Session 都会加载 mod，它有两项职责：

1. **报告者**：监听所在 Session 的事件（`session.start`、`turn.start`、`tool.call`、`turn.complete` 等），写出状态报告。
2. **监控窗口**：显示监控窗口的 Session 每 3 秒将状态报告与 Claude Code 的 Session 记录合并，排除进程已不存在的 Session，再绘制列表。没开监控窗口的 Session 改为每 15 秒做一次同样的合并，只算等你计数给输入框上方的按钮用，不运行 `git`、`gh`。

Session 是否存在，只看 Claude Code 自身的记录和进程是否存活，所以残留的状态报告不会让已结束的 Session 继续出现在列表中。两个来源不一致时，以较新的为准。

## 参与贡献

欢迎提交 Issue 和 Pull Request。修改行为之前，请先阅读 [GLOSSARY.md](GLOSSARY.md) 中的术语和 [docs/adr/](docs/adr/) 中的决策（均为繁体中文）。新增或修改界面文字时，请同步更新 [agens-view/hooks/i18n.ts](agens-view/hooks/i18n.ts) 的五种语言。

## 文档

- [GLOSSARY.md](GLOSSARY.md)：术语（Session、需要你处理、监控窗口、状态报告…）
- [docs/adr/](docs/adr/)：架构决策

## 许可证

[MIT](LICENSE)

<p align="center">
  <img src="assets/logo.svg" width="440" alt="switchboard">
</p>

[English](README.md) | [繁體中文](README.zh-TW.md) | 简体中文 | [日本語](README.ja.md) | [한국어](README.ko.md)

# switchboard：Claude Code 的 Session 监控窗口（Claude Code mod）

一个 **Claude Code plugin**，基于 **Claude Code mods** 构建，把所有本地 Claude Code Session 列在 Claude Desktop 的一个 **监控窗口** Pane 中，让你一眼看清哪些 Session 在工作、哪些空闲、哪些**在等你**。Desktop Code 标签页里的 Session，和 iTerm、Terminal.app、VS Code 终端里的 Session，都列在同一份列表中。

<p align="center">
  <img src="assets/board/board.zh-CN.png" alt="switchboard 监控窗口：两个需要你处理、两个工作中、一个空闲（示意图）" width="412">
</p>

<p align="center"><sub>示意图：两个需要你处理（一个待批准、一个待回答）、两个工作中、一个空闲。</sub></p>

就像总机接线员能看到哪几条线亮着灯，switchboard 让每个 Session 自己报告状态，再把在等你的排在最上面：

| 状态 | 含义 | 例子 |
|---|---|---|
| **需要你处理** | 你不去看，事情就不会推进 | 停在 `npm install` 的权限提示、用选项卡提问、回合因 API 错误停止 |
| **工作中** | Claude 正在执行回合 | 思考、调用工具、运行 Subagent |
| **空闲** | 回合已结束，没有被卡住 | 完成后在等下一条指令；你自己中断的回合 |
| **已结束** | Session 已关闭或进程已不存在 | 立即从列表中移除 |

**为什么用文字提问算空闲？** 需要你处理只响应明确的信号（权限提示、选项卡、错误），所以它亮起时，一定是真的在等你。Claude 用普通文字提问时算空闲，你可以从那一行的最后回复摘要中发现。

## 快速开始

```bash
claude plugin marketplace add wide3751/switchboard
claude plugin install switchboard@switchboard
```

重启 Claude Desktop，然后在 Code 标签页：

1. 输入 `/switchboard:on`
2. 监控窗口会出现在右侧，顶部显示类似 `▲ 2 个需要你处理` 的一行

之后每个 Desktop Session 默认都会自动打开监控窗口。详见[安装](#安装)与[使用方法](#使用方法)。

## 交给 AI 代理安装

把这段粘贴给 Claude Code 或其他 coding agent：

> Install switchboard by following https://github.com/wide3751/switchboard/blob/main/README.md

## 系统要求

- macOS
- 带有 Code 标签页的 [Claude Desktop](https://claude.ai/download) app；监控窗口只会在这里打开
- 支持 mods 的 Claude Code（在 **v2.1.299** 上开发与测试；在 Code 标签页输入 `/status` 查看版本）
- 可选：`git`（分支与变更信息）、已登录的 [`gh`](https://cli.github.com/)（Pull Request 信息）

## 安装

1. 添加 marketplace 并安装。有两种方式，**推荐用 GitHub**：

   **方式 A：从 GitHub（推荐）**，无需下载项目：

```bash
claude plugin marketplace add wide3751/switchboard
claude plugin install switchboard@switchboard
```

   之后要更新到新版本，先更新 marketplace，再更新 plugin，然后重启 Claude Desktop（对已安装的 plugin 再运行一次 `install` 不会升级）：

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

2. 重启 Claude Desktop，在 Code 标签页输入 `/switchboard:on`，确认监控窗口已打开。

安装前就已打开的 Session 不会加载 mod。它们仍会出现在监控窗口中，但只有基本状态；重启这些 Session 才能看到完整详情。

## 使用方法

| 命令 | 说明 |
|---|---|
| `/switchboard:on` | 在当前 Desktop Session 打开监控窗口。在 CLI Session 中只会提示到 Desktop 打开 |

**监控窗口上有什么：**

- **顶部**：有几个 Session 在等你，以及等得最久的已经等了多久。Pane 标题也会带上这个数字，例如 `Switchboard · 2`
- **账户用量**：订阅制显示 5 小时与每周的 rate limit 使用率和重置时间；API 计费显示所有 Session 的总花费
- **分区**：需要你处理 → 工作中 → 空闲；同一区内按最后活动时间由新到旧。空闲再久也不会自动消失，空闲区可以折叠
- **点击标题** 即可跳转到 Claude Desktop 中对应的 Session。需要你处理的行另有 **前往处理 →**
- 每一行的 **展开 ▾** 会显示其余详情
- **视图** 打开下面的设置

在某个 Session 中关闭监控窗口后，该 Session 不会再自动打开，直到再次输入 `/switchboard:on`。

**设置**（**视图** 面板；全局保存，所有 Session 共享）：

| 名称 | 默认 | 可选值 |
|---|---|---|
| 在所有 Desktop Session 显示 | 开启 | 开启：Desktop Session 启动或回合结束时自动打开监控窗口，切换 Session 时它一直都在；关闭：只在输入过 `/switchboard:on` 的 Session 显示 |
| 语言 | 自动 | 自动（跟随 macOS 语言）、EN、日本語、한국어、简中、繁中 |
| 计费 | 自动 | 自动、订阅制（显示 rate limit）、API（显示花费） |
| 设置 | 工作中 | 下面的密度和字段应用到哪一区：需要你处理、工作中、空闲 |
| 密度 | 各区不同 | 精简、标准、详细；自己挑选字段时显示为自定义 |

每一行可以显示的 **字段**：

| 字段 | 显示内容 |
|---|---|
| 时间 | 在当前状态停留了多久 |
| 位置 | 项目文件夹 |
| 分支 | git 分支、ahead/behind、未 commit 的文件数 |
| 变更行数 | 相对基准分支的新增／删除行数，与 Desktop 的 Changes 一致 |
| PR | 该分支的 Pull Request；Desktop Session 有未推送的变更又没有 PR 时，**创建 PR ↗** 会跳转过去 |
| 进度 | 待办列表的完成度与当前项目 |
| 当前操作 | 正在进行的工具调用 |
| 后台任务 | 运行中的 Subagent 与后台 shell 命令 |
| Context | context window 使用率 |
| 连接器 | 已连接的 MCP 连接器，以及需要验证的 |
| 最后回复 | Claude 最近一条回复的简短摘录 |
| 模型 | 使用的模型；进行中的 Session 用了与其他不同的模型时一定显示 |
| 用量 | 回合数，API 计费时加上花费 |
| 环境 | Worktree 或 Remote |
| 来源 | CLI Session 所在的终端 |
| 完整路径 | 完整的工作目录 |

需要你处理的行一定会显示批准请求摘要（想执行的命令）、问题和选项，或导致回合停止的错误。

### 示例

开着三个 Session：一个卡在权限提示、一个在工作、一个已完成。监控窗口顶部显示：

```
▲ 1 个需要你处理
批准 1 · 最长 3m
```

那一行会显示它想执行的命令，例如 `$ npm install jsonwebtoken`，旁边有 **前往处理 →**。

没有在等你的时候：

```
✓ 没有待处理项目
工作中 1 · 空闲 2
```

## 限制

- **仅支持 macOS 与 Claude Desktop**：CLI Session 会出现在列表中并报告状态，但自身不显示任何界面。
- **目前还不能跳转到 CLI Session**：点击后会显示它所在的文件夹。
- **通过轮询更新**：每 3 秒一次，状态变化会在几秒内反映，而非实时。每个显示监控窗口的 Session 都会各自扫描。
- **未加载 mod 的 Session 只有基本状态**：没有出错中止、批准请求摘要和最后回复，例如安装前就已打开的 Session。
- **只列出本地 Session**：不列出 Subagent 和云端 Session。

## 故障排除

| 症状 | 处理方式 |
|---|---|
| `/switchboard:on` 回复 hooks 没有加载 | 用 `claude --debug` 或 debug log 查看 `hooks module switchboard` 的错误信息 |
| 命令回复监控窗口只能在 Claude Desktop 打开 | 你在 CLI Session 中输入了命令；改到 Desktop 的 Code 标签页输入 |
| 某一行显示 `未加载 switchboard，仅基本状态` | 该 Session 在安装前就已打开；重启它 |
| 没有显示 PR | 安装 `gh` 并运行 `gh auth login`；Session 的文件夹必须是 GitHub repository |
| 点击 CLI Session 只显示路径 | 目前的预期行为；请自己切换到那个终端 |
| 修改代码后没有效果 | 已安装的副本按 `plugin.json` 的 `version` 缓存。提高版本号，运行 `claude plugin update switchboard@switchboard` 后重启 |

## 隐私与数据

switchboard 完全在你的 Mac 上运行，不会把数据发送到任何它自己的服务。

- **写在本地**：每个 Session 的状态报告，位于 `<Claude 配置目录>/switchboard/reports/<sessionId>.json`，内容包括模型、分支、待办进度、当前操作、批准请求摘要、问题、错误、最后回复的简短摘录、后台任务、rate limit、连接器和 Pull Request。已不存在的 Session 的报告会被删除
- **在本地读取**：Claude Code 自身的 `~/.claude/sessions/*.json` 记录和这些状态报告。不会读取其他 Session 的 `.jsonl` 对话记录
- **会执行的命令**：`git`（分支与变更）、`gh pr view`（Pull Request，会用你自己的 `gh` 登录连接 GitHub）、`ps`（哪些 Session 还存活）、`defaults read -g AppleLanguages`（界面语言）、`open`（跳转到 Session）

## 工作原理

每个 Session 都会加载 mod，它有两项职责：

1. **报告者**：监听所在 Session 的事件（`session.start`、`turn.start`、`tool.call`、`turn.complete` 等），写出状态报告。
2. **监控窗口**：只在显示监控窗口的 Session 中运行。每 3 秒将状态报告与 Claude Code 的 Session 记录合并，排除进程已不存在的 Session，再绘制列表。

Session 是否存在，只看 Claude Code 自身的记录和进程是否存活，所以残留的状态报告不会让已结束的 Session 继续出现在列表中。两个来源不一致时，以较新的为准。

## 参与贡献

欢迎提交 Issue 和 Pull Request。修改行为之前，请先阅读 [CONTEXT.md](CONTEXT.md) 中的术语和 [docs/adr/](docs/adr/) 中的决策（均为繁体中文）。新增或修改界面文字时，请同步更新 [agens-view/hooks/i18n.ts](agens-view/hooks/i18n.ts) 的五种语言。

## 文档

- [CONTEXT.md](CONTEXT.md)：术语（Session、需要你处理、监控窗口、状态报告…）
- [docs/adr/](docs/adr/)：架构决策

## 许可证

[MIT](LICENSE)

[English](privacy.md) | [繁體中文](privacy.zh-TW.md) | 简体中文 | [日本語](privacy.ja.md) | [한국어](privacy.ko.md)

# 隐私与数据

[← 返回 README](../../README.zh-CN.md)

switchboard 完全在你的电脑上运行，不会把数据发送到任何它自己的服务。

- **写在本地**：每个 Session 的状态报告，以明文 JSON 存放在 `<Claude 配置目录>/switchboard/reports/<sessionId>.json`，内容包括第一句 prompt 的前约 40 字（当作标题）、模型、分支、待办进度、当前操作、批准请求摘要、问题、错误、最后回复的简短摘录、后台任务、rate limit、连接器、Pull Request、所在的终端（`TERM_PROGRAM`）、Context 用量、花费、回合数和时间戳。`sessionId` 不在任何 session 记录里、而且超过一分钟没有更新的报告，下次有任何 Session 扫描时就会被删除；从没打开过监控窗口也一样。一条 session 记录都找不到时不删除
- **遮罩只是尽力而为**：写入前，命令、批准请求摘要、问题、第一句 prompt、最后回复的摘录和错误信息里疑似机密的片段（例如 `Bearer …`、`token=…`、`--token …`、`API_KEY=…`、`sk-…`、`ghp_…`）会换成 `•••`。不保证能全部抓到，命令的其余部分仍以明文存放
- **在本地读取**：Claude Code 自身的 `<Claude 配置目录>/sessions/*.json` 记录和这些状态报告。不会读取其他 Session 的 `.jsonl` 对话记录
- **会执行的命令**：扫描时运行 `ps`（Windows 上是 `tasklist`；哪些 Session 还存活；监控窗口关闭时也每 15 秒运行一次，给打开按钮的计数）和 `rm`（删除残留的报告）；每个 Session 启动时和每个回合结束后，在自己的文件夹里运行 `git`（分支与变更）和 `gh pr view`（Pull Request，会用你自己的 `gh` 登录连接 GitHub）；另外还有 `uname -s`（`/switchboard:open` 时判断操作系统）、`defaults read -g AppleLanguages`（界面语言，只在 `LC_ALL`、`LANG` 判断不出语言时才运行）、`open`（跳转到 Desktop Session，以及打开 Pull Request 页面和作者链接）、`osascript`（切到 iTerm、Terminal.app 对应的标签页）。在 Windows 上改用 `cmd /c del` 代替 `rm`、`rundll32 url.dll,FileProtocolHandler` 代替 `open`。超时：`ps`、`tasklist` 和 `git` 5 秒、`gh` 8 秒、`osascript` 10 秒、`defaults` 和 `uname` 3 秒

## 工作原理

每个 Session 都会加载 mod，它有两项职责：

1. **报告者**：监听所在 Session 的事件（`session.start`、`turn.start`、`tool.call`、`turn.complete` 等），写出状态报告。Session 启动时和每个回合结束后，也会在自己的文件夹里运行 `git`、`gh`，获取分支、变更和 Pull Request。
2. **监控窗口**：显示监控窗口的 Session 每 3 秒将状态报告与 Claude Code 的 Session 记录合并，排除进程已不存在的 Session，再绘制列表，自己不运行 `git`、`gh`。没开监控窗口的 Session 改为每 15 秒做一次同样的合并，只算等你计数给输入框上方的按钮用。

Session 是否存在，只看 Claude Code 自身的记录和进程是否存活，所以残留的状态报告不会让已结束的 Session 继续出现在列表中。两个来源不一致时，按固定的顺序判断：记录是工作中或待处理时用记录；否则报告里有回合错误就算出错中止，报告里有问题而记录是空闲时算待处理；其余都用记录。

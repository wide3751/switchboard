[English](troubleshooting.md) | [繁體中文](troubleshooting.zh-TW.md) | 简体中文 | [日本語](troubleshooting.ja.md) | [한국어](troubleshooting.ko.md)

# 故障排除

[← 返回 README](../../README.zh-CN.md)

| 症状 | 处理方式 |
|---|---|
| `/switchboard:open` 回复 hooks 没有加载 | 1. 确认 Claude Code 版本支持 mods，不支持就更新。2. 重启这个 Session：安装前就开着的 Session 不会加载。3. 仍然不行，用 `claude --debug` 启动，在 debug log 查看 `hooks module switchboard` 的错误信息 |
| 命令回复这里无法显示监控窗口 | 你在 VS Code 扩展的图形界面输入了命令；改到 Desktop 的 Code 标签页，或终端里的 Claude Code 输入 |
| 顶部显示 `⚠ 目前看不到 Session 状态`，下面说找不到任何 Session 记录，连当前这个都没有 | Claude Code 版本太旧、还不写 Session 记录，或 `CLAUDE_CONFIG_DIR` 指向了 Claude Code 实际使用的以外的文件夹 |
| 顶部显示 `⚠ 目前看不到 Session 状态`，下面是 `switchboard 读取状态失败：` 加上一段红字 | 红字是原始的错误信息。监控窗口每 3 秒自动重试，暂时的错误会自己消失；一直出现的话，用 `claude --debug` 启动，在 debug log 查看 `hooks module switchboard` 的错误信息 |
| 顶部显示 `⚠ 目前看不到 Session 状态`，下面说无法读取某个文件夹 | 确认那个文件夹存在、你有读取权限；设置了 `CLAUDE_CONFIG_DIR` 的话，确认它指向 Claude Code 实际使用的文件夹 |
| 某一行显示 `未加载 switchboard，仅基本状态` | 该 Session 在安装前就已打开；重启它 |
| 没有显示 PR | 安装 `gh` 并运行 `gh auth login`；Session 的文件夹必须是 GitHub repository |
| 点击 CLI Session 只显示路径 | 只有 iTerm、Terminal.app 能跳转；其他终端请自己切换过去。iTerm、Terminal.app 也跳转不过去时，按提示到「系统设置 › 隐私与安全性 › 自动化」允许控制它们，或重新启动那个 Session（0.6.0 之前打开的 Session 没有记下终端） |
| 勾选了「自动打开监控窗口 › CLI Session」，终端里却没有监控窗口 | 终端太窄（不到 144 列），自动打开的 Pane 不会画出来。点击输入框上方的 **▦ 打开监控窗口**、输入 `/switchboard:open`，或把终端拉宽 |
| 修改代码后没有效果 | 已安装的副本按 `plugin.json` 的 `version` 缓存。开发时改在项目文件夹运行 `claude --plugin-dir ./agens-view`，改了就会热重载。已安装的副本拿不到新版时，运行 `claude plugin marketplace update switchboard` 和 `claude plugin update switchboard@switchboard` 后重启 |

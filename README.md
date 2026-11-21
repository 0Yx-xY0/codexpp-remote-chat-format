# Codex++ 远程聊天排版补丁

为 [Codex++](https://github.com/BigPizzaV3/CodexPlusPlus) **v2.8.0** 的远程控制网页提供源码补丁。保留手机上的「聊天」样式，让助手回复复用 Codex 样式已有的 Markdown 渲染器。用户输入仍按纯文本显示。能识别的来源标记显示为「来源请在电脑端查看」，不把引用 ID 猜成链接。

这不是独立远程控制客户端，也不是 OpenAI 或 Codex++ 官方发布。不修改后端、登录验证、配对、权限、网络或内置拓展设置。不包含安装程序、替换版可执行文件或任何本机运行数据。

## 使用源码补丁

上游基线：[v2.8.0 / f6fa88b](https://github.com/BigPizzaV3/CodexPlusPlus/commit/f6fa88b2318a4518297614b9c9b3833d05ac2ef0)。在干净的源码目录中执行（替换 `<patch-repo>` 为此仓库的实际路径）：

```sh
git -c core.autocrlf=false clone --branch v2.8.0 --depth 1 https://github.com/BigPizzaV3/CodexPlusPlus.git
cd CodexPlusPlus
git -c core.autocrlf=false apply --check "<patch-repo>/remote-chat-format.patch"
git -c core.autocrlf=false apply "<patch-repo>/remote-chat-format.patch"
```

只有检查通过才应用。此操作只修改 checkout 内的 `crates/codex-plus-core/assets/remote-control/index.html`。如需部署，请遵循上游该版本的构建流程。本仓库不提供覆盖现有安装文件的脚本。若只撤回这一补丁，可在没有冲突的源码 checkout 运行 `git -c core.autocrlf=false apply -R --check` 后再用 `git -c core.autocrlf=false apply -R`，两条命令均需传入补丁路径。

## 离线测试

使用 Python 3、Playwright 和本机已安装的 Chrome，在应用补丁后的 CodexPlusPlus 源码目录运行：

```sh
python -m pip install playwright
python "<patch-repo>/verify.py" crates/codex-plus-core/assets/remote-control/index.html
```

测试用合成对话替换启动流程，拦截网络请求，不读取真实对话或登录信息。覆盖 360/390/430 px 手机视口、明暗主题、标题、列表、引用块、加粗、链接、长代码、流式更新和输入草稿保留。验证的是 Chrome 手机仿真，不是实体手机或 Tailscale 端到端测试。

## 范围与限制

- 继承上游轻量 Markdown 渲染器的能力，不承诺完整 CommonMark 或表格支持。
- 来源提示只是占位文案；手机端不会生成真正的来源链接。针对测试所覆盖的标记格式，不保证兼容任意新格式。
- 仅在所列基线验证过，不保证新版本兼容。这不是登录弹窗修复。

## 许可

上游页面及其修改依据 GNU AGPL v3 发布，保留上游版权与许可。见 [LICENSE](LICENSE)。

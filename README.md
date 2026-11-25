# Codex++ 远程聊天排版补丁

为 [Codex++](https://github.com/BigPizzaV3/CodexPlusPlus) **v2.8.0** 的远程控制网页提供源码补丁。只改动嵌入的网页，不修改后端，也不要求更改登录、配对、网络、权限或内置扩展设置。不是 Codex++ 或 OpenAI 的官方发布，不提供可执行文件或安装程序。

## 聊天页改动

- 首页直接列出不同会话。按会话 ID 去重，保留同名但不同 ID 的会话；标题优先使用已有会话名称，其次用消息摘要，而不是存储路径。
- 手机端使用 LINE 风格浅灰底、左右收发气泡、独立时间与连续消息分组。命令和文件改动的过程默认折叠，可点击展开。
- 单勾表示消息已出现在会话记录里，双勾表示检测到后续助手回复，**不是服务端已读回执**。
- 手机端输入框默认不聚焦。附件加号在左侧，发送使用键盘的发送键或回车；实体键盘的 Shift+Enter 可换行。底部保留模式（Agent）、权限与模型三项，不显示上下文用量。
- 助手回复继续共用 Codex Markdown 渲染器，并支持常见数学公式和符号。长代码与宽公式在各自区域滚动，用户输入仍按纯文本展示。来源标记提示在电脑端查看，不把引用 ID 猜成链接。

## 应用补丁

基线是 [v2.8.0（f6fa88b）](https://github.com/BigPizzaV3/CodexPlusPlus/commit/f6fa88b2318a4518297614b9c9b3833d05ac2ef0)。在干净的源码目录中运行，把 <code>&lt;patch-repo&gt;</code> 换成此补丁仓库的实际路径：

```sh
git -c core.autocrlf=false clone --branch v2.8.0 --depth 1 https://github.com/BigPizzaV3/CodexPlusPlus.git
cd CodexPlusPlus
git -c core.autocrlf=false apply --check "<patch-repo>/remote-chat-format.patch"
git -c core.autocrlf=false apply "<patch-repo>/remote-chat-format.patch"
```

补丁是**相对上游的完整补丁**，不叠加在本项目的旧版补丁上。只修改 <code>crates/codex-plus-core/assets/remote-control/index.html</code>。要部署，请按上游该版本的构建流程重新构建。若只撤回此补丁，先用 <code>git -c core.autocrlf=false apply -R --check</code>，检查通过后再用 <code>git -c core.autocrlf=false apply -R</code>；两条命令均传入补丁路径。

## 离线浏览器测试

在此补丁仓库使用 Node.js 20 或更高版本、npm 和本机已安装的 Chrome：

```sh
npm ci
npm test -- "<CodexPlusPlus>/crates/codex-plus-core/assets/remote-control/index.html"
```

测试在 Chrome 里用合成数据覆盖会话去重、标题、消息、输入栏、公式与窄屏溢出。可选的 Markdown / 流式更新回归使用 Python Playwright：<code>python -m pip install playwright</code> 后，运行 <code>python verify.py "&lt;已应用补丁的 index.html&gt;"</code>。测试不会读取真实对话、凭据或配对信息，也不连正在运行的服务。它们不替代实体手机或 Tailscale 端到端测试。

## 范围与许可

只验证了指定的源码基线和 Chrome；不保证其他 Codex++ 版本、浏览器或全部 LaTeX 命令兼容。不支持的公式保留为文本。变更记录见 [CHANGELOG.md](CHANGELOG.md)。上游页面及其修改按 GNU AGPL v3 发布，保留上游版权与许可，见 [LICENSE](LICENSE)。

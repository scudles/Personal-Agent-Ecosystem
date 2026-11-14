# native-pull-001 canary（候选，未安装）

仅包含一条固定虚构问题（2 + 3）和两个 MCP 工具：

- `get_fictional_probe({})`：重复只读返回相同消息、run/message/nonce/hash，不读取会话或任意文件。
- `submit_fictional_reply({runId,messageId,nonce,messageHash,reply})`：严格字段校验；只写本源码目录固定的 `fictional-result.sqlite`。相同提交返回原收据，冲突拒绝，不覆盖原结果。SQLite 事务提交提供持久化；进程中断后可重复相同请求。

没有 resources、prompts、server instructions、人物设定、shell、任意路径、网络监听、账号登录或原会话访问。nonce/hash 是公开关联字段，不是认证凭证。收据始终标为 `LOCAL_MCP_UNAUTHENTICATED_CLIENT`、`originalConversationAuthenticated:false`；即使将来有客户端调用，也不能仅据此断言来自指定原 ChatGPT 对话。

## 本机测试

要求 Node >= 22.13（使用内建 `node:sqlite`）；本次实际运行版本记录在 `test-report.json`。依赖通过 npm `--ignore-scripts --no-audit --no-fund` 安装，只在本目录，版本由 `package-lock.json` 锁定。没有执行依赖生命周期脚本。

```powershell
& 'D:\TriReviewBridge\runtime\node.exe' --test 'D:\TriReviewBridge\tools\native-pull-001\test.mjs'
```

测试使用官方 SDK Client + StdioClientTransport，启动短寿命独立虚构实例，结果写入 `test-runs/fixture-*/`，不写根目录正式 canary DB；结束关闭子进程。覆盖初始化、tools/list、get/重复get、正确提交、幂等/键序变化、冲突、错误run/message/nonce/hash、未知path、缺失/类型/长度校验、重启持久化和 SQLite 完整性。没有启动网络或后台服务。`test-report.json` 只证明本机协议测试，原 ChatGPT 调用和定时唤醒均未验证。

## 候选插件清单与下一边界

`plugin.json` 与 `mcp.json` 是未安装的 portable Agent Plugins 候选，stdio 的 `${PLUGIN_ROOT}` 按官方格式；`node` 需由未来批准的执行环境提供。没有改 marketplace、全局配置、主后端、现有 DB 或任何会话。没有安装/注册插件或启动隧道。仅凭候选清单与本机 SDK 成功，不能声称已在 ChatGPT 注册、能加入指定旧对话、能定时唤醒或收到真实调用。真实隧道/连接的账号登录、平台接入与独立证据留待后续授权和用户操作。

本 fixture 是单次 run：正式结果若已存在，后续相同请求幂等，换回复冲突；不要通过工具传路径、改run或清库重发。

官方来源（2026-11-13 核对）：

- https://developers.openai.com/plugins/build/mcp-server.md
- https://developers.openai.com/plugins/build/plugins.md
- https://developers.openai.com/plugins/deploy/desktop-only.md

没有执行插件安装/平台兼容性验收；manifest 只经过本地结构核对。

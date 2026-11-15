# Phase 0 首轮只读盘点报告

日期：2026-11-07。范围：用户提供图片中的六项。方法：只读查询 Windows 系统、进程、安装包元数据、源码/随包文档、目录结构和官方文档。**未安装软件，未改配置，未启动或停止服务，未向现有 Agent 发送探测请求，未读取会话正文或秘密。**

## 结论一览

| 检查项 | 结论 | 证据边界 |
| --- | --- | --- |
| 1. Windows 版本及运行环境 | **已验证**：Windows 11 专业版、64 位、版本 10.0.26200 / Build 26200；PowerShell 7.6.5，x64 | `Win32_OperatingSystem` 和当前 PowerShell 运行时快照 |
| 2. Hermes 桌面应用本地通信接口 | **静态存在**：ACP、TUI Gateway JSON-RPC（stdio/WebSocket）、OpenAI 兼容 HTTP API；当前桌面实例的具体可用端点、认证和权限**待确认** | 本机 `D:\HermesAgent\Source\website\docs\developer-guide\programmatic-integration.md`；[官方集成文档](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/programmatic-integration.md) |
| 3. DSH 插件及外部调用接口 | **静态存在**：插件管理、MCP 客户端、ACP、SDK JSON-RPC 和 Desktop Client–Host API 组件；当前实例哪些接口对外开放**待确认** | 已安装 `app.asar` 的包名/随包说明；[官方 MCP 文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/mcp.md)、[官方 SDK 服务说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/sdk/server/README.md) |
| 4. 后台运行能力 | **当前运行已验证**：两个桌面应用均有主进程和子进程；关闭窗口、用户注销或重启后能否保持运行**待确认** | 本机进程树快照；未执行关窗或重启测试 |
| 5. 任务状态及日志获取方式 | **静态候选已发现**：Hermes Gateway 方法、状态/日志文件；DSH Session API 与会话持久化文件。Observer 的安全只读采集方式**待确认** | 本机源码/安装包文档和目录结构；未读取会话内容 |
| 6. 可直接复用的 MCP 接口 | **MCP 客户端能力已确认存在**于两端；将某一方作为另一方可调用的 MCP Server，或用现有 MCP 直接完成双向委派，**未验证** | [Hermes MCP 文档](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/mcp.md)、[DSH MCP 文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/mcp.md)；本机组件清单 |

## 本机证据与具体限制

### 1. Windows 与版本

- `Get-CimInstance Win32_OperatingSystem` 返回 Microsoft Windows 11 专业版、64 位、Version `10.0.26200`、Build `26200`。
- Hermes 主进程来自 `D:\HermesAgent\Source\apps\desktop\release\win-unpacked\Hermes.exe`；数据根为 `D:\HermesAgent\Data`。该桌面程序文件元数据是占位版本 `0.0.0`。本地源码 `git describe --tags --always --dirty` 为 `v0.22.7-dirty`，说明源码标签是 v0.22.7 且工作树已有未提交改动；这**不能证明当前运行 Backend 的确切版本**。用户提供的 Hermes/Backend v0.22.7 仍待运行实例核验。
- DSH 程序位于 `%LOCALAPPDATA%\Programs\DeepSeek Harness\DeepSeek Harness.exe`；文件版本与 `resources\app.asar` 内 `package.json` 均为 `0.2.1-rc.3`。这是 RC 候选版，不按稳定版处理。

### 2. Hermes 通信

- 本机源码集成文档明确列出 ACP、TUI Gateway JSON-RPC 和 OpenAI 兼容 HTTP API；Gateway 方法目录含 `session.status`、`session.list`、`session.history`、`session.usage`、`delegation.status` 等。
- 桌面 README 说明本地后端使用 TUI Gateway JSON-RPC/WebSocket。源代码有 API Server 与 MCP Client 实现。
- 这些是**源码/文档证据**。未对当前实例做协议握手，未验证端点、认证、可调用方法或是否允许第三方只读访问。观察到的本地监听端口也不能直接等同于公开 API。

### 3. DSH 接口与插件

- 已安装 `app.asar` 的 `package.json` 标记桌面版 `0.2.1-rc.3`；随包包含 `@deepseek-ai/dsh-plugin-manager`、`dsh-mcp-client`、`dsh-acp`、`dsh-sdk-jsonrpc-server`、`dsh-api-gateway` 等包。`%USERPROFILE%\.dsh\profiles\desktop` 存在配置与插件目录。
- 随包说明将 SDK JSON-RPC 服务描述为 **stdio** 服务，ACP 为独立启动 profile；Desktop API Gateway 主要是 Client–Host 通信。**包存在不等于当前桌面进程已启用对外服务**，也不等于可直接连接其内部端口。
- 官方文档说明 MCP Server 可通过 `dsh-mcp-client` 配置为工具。当前桌面 profile 的具体 MCP Server 配置和外部调用授权尚待确认；未更改任何插件或 profile。

### 4. 后台能力

- 查询时 Hermes 与 DSH 的 Electron 主进程、子进程均存在；Hermes 下有 Python 子进程，DSH 下有 Node Host 子进程。本机监听快照显示相关进程仅在 `127.0.0.1` 上监听若干端口；端口是临时运行状态，不能作为稳定接口地址。
- 按名称查询未发现 Hermes/DSH Windows 服务或计划任务。这个结果仅表示本次查询没有匹配项，不保证不存在其他启动机制。
- 关闭窗口后是否驻留托盘、注销后是否持续、开机自启以及无 UI 独立运行能力仍**待确认**。本次没有做会影响当前运行状态的测试。

### 5. 状态与日志

- Hermes 数据根存在 `state.db`、`kanban.db`、`cron\executions.db`、`state\gateway.heartbeat`；日志目录 `D:\HermesAgent\Data\logs` 下有 `agent.log`、`desktop.log`、`gateway.log`、`errors.log` 等。源码文档列出 Gateway 的会话与委派状态方法。**未读取数据库或日志正文**，因此字段、隐私范围和只读并发安全性待确认。
- DSH 会话目录为 `%USERPROFILE%\.dsh\sessions`，抽样目录内存在 `session.v4.jsonl.zstd`；随包文档说明其 Session 持久化为追加日志。桌面日志目录 `%APPDATA%\@deepseek-ai\dsh-desktop\logs` 存在，但检查时无文件。会话文件可能含私人对话与工具结果；Observer 不能未经授权直接抓取全文。
- 任务状态与资源消耗的可靠读取仍需确认官方只读接口、权限范围、事件语义和脱敏策略。

### 6. MCP 可复用性

- Hermes 和 DSH 都具备**作为 MCP 客户端连接工具服务器**的静态能力。
- Hermes 源码另有 `hermes_tools_mcp_server.py`，注释表明它面向特定 Codex 运行时提供 Hermes 工具；**不能据此认定它已提供完整 Hermes Agent 的通用委派接口**。
- 目前未发现经验证的“双向 Agent 委派即插即用 MCP 接口”。优先评估现有 ACP/JSON-RPC/SDK 与 MCP 的适配成本，再决定 Agent Bridge 具体实现；Bridge 仍为**规划中**。

## 后续只读验证清单

1. 从 Hermes 应用界面或官方只读状态面核验当前运行 Backend 版本与 Gateway 连接信息。
2. 核对 DSH `0.2.1-rc.3` 对 ACP、SDK stdio 与 MCP Client 的实际启动/profile 条件；区分 Desktop 内部 API 和第三方 API。
3. 明确用户授权的数据范围后，选取不会读取私人会话正文的任务状态接口，验证认证与只读行为。
4. 单独设计关闭窗口/重启持久性的验证方案，避免中断现有任务。
5. 在接口和权限明确前，不安装插件、不修改配置、不启动 Bridge 或 Observer 服务。

Phase 0 **未完成**；本报告只确认静态能力与当前运行快照，不宣称 Hermes/DSH 已经互联。

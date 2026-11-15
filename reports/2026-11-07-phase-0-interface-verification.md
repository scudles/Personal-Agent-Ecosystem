# Phase 0 第二轮只读接口核验

日期：2026-11-07。范围：Hermes v0.22.7 与 DSH v0.2.1-rc.3 当前桌面实例的通信边界。所有端口和 PID 仅是盘点时快照，不能作为稳定配置。本次只读检查公开源码、随安装包文档、程序文件、进程树和 OS 监听元数据；没有发起 HTTP/WebSocket/ACP/SDK 请求，没有启动服务或测试任务，没有关窗、退出、重启，也没有读取凭据或私人会话正文。

## A. 已实际验证

1. **运行实例与版本证据。** 两个桌面主进程仍在运行。DSH 程序文件版本为 `0.2.1-rc.3`，随包模块版本相同。Hermes 桌面 EXE 的文件版本是占位 `0.0.0`；源码标签为 `v0.22.7-dirty`。这不足以证明当前运行 Hermes Backend 的准确版本。
2. **本机监听快照。** Hermes 路径下的 Python 进程 PID `180288` 在 `127.0.0.1:54960` 与 `127.0.0.1:57596` 监听。DSH Host 子进程 PID `192076` 在 `127.0.0.1:55947`、`:57443`、`:57444`、`:57445` 监听；其另一个 Node 子进程 PID `180952` 在 `127.0.0.1:18787` 监听。另有 DSH 子 Electron 监听 `127.0.0.1:53485`。仅凭端口归属无法识别协议、路由或权限。上述相关进程**未监听** Hermes HTTP API 文档的默认端口 `8642`。
3. **已安装组件。** Hermes 源码含 Gateway、ACP、HTTP API 和特定 Codex 运行时的 `hermes_tools_mcp_server.py`。DSH `app.asar` 中含 Desktop Host、Client Connection、API Gateway、插件管理器、MCP Client、ACP 与 SDK profile/stdio 服务；一方包清单中未见命名为通用 MCP Server 的包。包存在不代表当前进程已对外启用。
4. **DSH 生命周期的已安装代码。** `app.asar` 的 `lib/main.js` 中普通主窗口 `close` 事件会阻止关闭并调用隐藏窗口逻辑；退出流程调用后端关闭逻辑。这是已安装代码的静态检查，**不是**实际关窗/退出测试。
5. **持久运行注册的有限检查。** 按 Hermes/Nous/DeepSeek/DSH 名称查询 Windows 服务、计划任务及 Run 启动项，没有匹配项；不能排除其他命名或启动方式。

## B. 仅有文档依据

1. **Hermes Gateway JSON-RPC。** 本机 `D:\HermesAgent\Source\apps\desktop\src\AGENTS.md` 与 [官方桌面说明](https://github.com/NousResearch/hermes-agent/blob/main/apps/desktop/README.md)描述 Desktop 使用 `hermes gateway ensure --json` 发现本地 Gateway，并通过 JSON-RPC/WebSocket 接入。私有控制票据是一次性、短期的本机认证边界；[Gateway 内部说明](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/gateway-internals.md)还区分本机 HTTP 票据、WebSocket 票据和普通静态/OAuth 认证。**没有**读取或使用任何票据。
2. **Hermes ACP。** [程序化集成文档](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/programmatic-integration.md)定义 `hermes acp` 为 stdio JSON-RPC viewer，可驱动 Gateway；它不是从端口快照识别出来的独立常驻网络监听。
3. **Hermes HTTP API。** [API Server 文档](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/api-server.md)要求显式启用及 API 认证，示例默认地址为 `127.0.0.1:8642`；[集成文档](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/programmatic-integration.md)列出 `/v1/runs/{id}` 等状态路径。未读取当前开关或密钥，也未请求端点；不能由默认端口未监听推出 API 全面关闭。
4. **DSH ACP 与 SDK。** v0.2.1-rc.3 已安装 `dsh-acp`、`dsh-acp-app`、`dsh-sdk-app` 和 `dsh-sdk-jsonrpc-server` 随包说明：ACP 与 SDK 都通过**独立 profile 启动的 stdio 服务**运行。它们用于新建或恢复会话，未见直接附着当前 Desktop Host 的承诺。参考[官方 ACP 说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/acp/acp/README.md)和[SDK 服务说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/sdk/server/README.md)。
5. **DSH Desktop API 与认证。** v0.2.1-rc.3 随包 `dsh-client-connection` 说明 Desktop 页面经自有 Client–Host carrier/IPC 通信，Web carrier 的 RPC 和流都要求已认证 Peer；仅知道环回 origin 不授予访问。API Gateway 对非 owner Peer 还有按资源与动作的权限检查。文档中的连接机制不能被解释为可复用当前 Desktop 的凭据。参考[官方桌面说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.md)。
6. **插件与 MCP。** Hermes 和 DSH 都有 MCP Client 能力；DSH `dsh-mcp-client` 随包说明写明默认无 MCP Server 连接。Hermes 的 `hermes_tools_mcp_server.py` 明确是向 Codex 运行时暴露**工具子集**，其注释排除需要当前 AIAgent 上下文的委派、记忆等工具，因此不是完整 Hermes Agent 委派 Server。DSH 插件管理器是运行时组合/管理入口，不等于当前 Desktop 对外开放任意插件调用。参考 [Hermes MCP 文档](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/mcp.md)及 [DSH MCP 文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/mcp.md)。
7. **候选状态接口。** Hermes Gateway 文档列出 `session.status`、`session.list`、`delegation.status` 等；DSH 随包 `dsh-api-session-controller` 说明 Session 列表可从持久化头和投影缓存读取，`dsh-api-job-controller` 提供 `job.list`。这些接口可能暴露会话标题、路径、作业内容或其他私人信息；没有授权与字段审查前，不能称为安全只读接口。
8. **关窗与退出设计。** Hermes 本机桌面契约称关窗断开 viewer，只有显式 Gateway 生命周期命令停止 owner；DSH v0.2.1-rc.3 已安装代码及[官方桌面说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.md)称 Windows 普通关窗隐藏到托盘并保持 Host/任务运行，显式退出关闭 Host，运行中任务可能被中断。重启后自动恢复和开机自启没有本机证据。

## C. 尚未验证

- Hermes PID `180288` 两个环回端口中的哪一个承载 Gateway JSON-RPC、HTTP 或其他协议，以及实际握手、认证、只读权限。
- Hermes 当前是否有 ACP viewer；HTTP API 是否以其他端口启用；当前运行 Backend 的准确版本。
- DSH Host 端口的具体路由；是否存在受支持的外部只读 Peer、独立凭据及最小权限配置；当前插件的实际加载状态。
- 当前桌面实例是否作为**完整 Agent MCP Server**开放、可调用方法和权限；仅 MCP Client 或工具子集不足以得出该结论。
- 不泄露私人会话正文、标题或路径的任务状态字段；只读查询是否会触发 Session 恢复、迁移或其他写入。
- 两应用在本机实际关闭窗口、显式退出、注销和重启后的行为；没有执行这些操作。

## D. 不支持或无法确认

- **DSH ACP/SDK 直接连接当前 Desktop Host：无法确认且未发现受支持入口。** 已安装说明对应独立 stdio profile；启动它们会创建额外进程，本次禁止。
- **现成通用 MCP 双向 Agent 接口：无法确认。** 两边 MCP Client 与 Hermes 的 Codex 工具子集 Server 不能证明当前桌面实例可作为完整 Agent MCP Server。DSH 一方包清单未见通用 MCP Server 包，但不能排除第三方插件。
- **通过端口直接调用现有 Agent：不成立。** 端口快照不证明协议、认证或权限；不得绕过 Hermes 私有票据或 DSH Desktop 认证边界。
- **退出/重启后的实际持续运行能力：无法确认。** 现有文档描述的关窗行为不等于经过本机操作验证，更不能推断系统重启后自动恢复。

## Agent Bridge 最小可行接入方案（规划中）

1. **第一步：验证接入资格。** 后续仅在用户明确允许非破坏性接口请求时，核验 Hermes Gateway 的官方只读连接方法，以及 DSH Desktop Host 是否提供受支持、可单独授权的外部 Peer。不得借用桌面进程的私有票据、抓取现有 Cookie 或读取现有凭据。
2. **MVP 数据范围。** Bridge 先只同步 Agent 在线状态、任务 ID、来源、执行者、粗粒度状态、完成/失败标志与时间戳；不读取会话正文、工具参数/结果、私人记忆或未脱敏标题/路径。数据字段必须先经接口契约和权限审查。
3. **MVP 通信。** Hermes 优先使用受支持的 Gateway JSON-RPC 只读/任务接口；DSH 仅在 Desktop Host 提供受支持且最小权限的外部接入时使用其 API。Bridge 自身设计为本机环回、独立身份和事件日志；消息提交、委派与重试在只读状态验证通过后再分阶段开启。
4. **DSH 接入决策闸门。** 若 DSH Desktop Host 不提供合适的外部权限边界，**不要**尝试其内部端口或把 ACP/SDK profile 误当当前桌面会话。可另行评估官方 ACP/SDK 独立运行时处理新任务，但它不能自动代表当前 Desktop Host 的实时任务状态；这一替代方案需单独决策。
5. **授权与失败处理。** 付费、外发、删除、权限扩大、系统安全变更和不可逆操作仍停在用户授权点。接口不可用、权限不足或身份不明时失败关闭并记录原因，不自动升级权限。

此方案是**条件性设计，未实现**。Phase 0 仍未完成；下一步必须先解决 DSH 当前实例的受支持访问边界和双方状态字段的隐私边界。

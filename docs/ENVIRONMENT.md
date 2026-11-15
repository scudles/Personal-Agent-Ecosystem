# 环境盘点

基准日期：2026-11-07。本页区分「用户提供、待本机核验」「待确认」「已验证」。已完成三轮只读盘点，详见[首轮报告](reports/2026-11-07-phase-0-read-only-inventory.md)、[第二轮接口核验](reports/2026-11-07-phase-0-interface-verification.md)和[第三轮独立进程研究](reports/2026-11-07-phase-0-independent-agent-processes.md)。不得在本页记录 API Key、密码、令牌或其他秘密。

| 项目 | 当前记录 | 证据状态 | 后续核验 |
| --- | --- | --- | --- |
| 操作系统 | Windows 11 专业版、64 位、10.0.26200（Build 26200） | **已验证**：本机 `Win32_OperatingSystem` | 后续系统升级后复核 |
| Hermes 应用 | 用户提供 v0.22.7；桌面程序在 `D:\HermesAgent\Source\apps\desktop\release\win-unpacked\Hermes.exe` | 运行路径已验证；程序文件元数据为占位 `0.0.0`，应用显示版本**待确认** | 只读查看应用内版本 |
| Hermes Backend | 用户提供 v0.22.7；本地源码 `git describe` 为 `v0.22.7-dirty` | 源码标签已验证；运行 Backend 的确切版本**待确认**，工作树有未提交改动 | 只读查看运行实例版本 |
| DeepSeek Harness | V0.2.1-rc.3；Windows 桌面应用；RC 候选版 | **已验证**：程序文件版本与安装包 `app.asar` 元数据均为 `0.2.1-rc.3`；非正式稳定版 | 升级后复核 |
| 部署关系 | 两个桌面应用当前运行在同一台本地电脑 | **已验证**：本机进程和安装路径，2026-11-07 快照 | 持续在线能力另行验证 |
| Hermes 本地通信/API | 源码文档列出 ACP、TUI Gateway JSON-RPC/WebSocket、OpenAI 兼容 HTTP API | **静态已验证**；当前桌面实例可访问的具体端点与认证**待确认** | 后续经授权做非破坏性连接验证 |
| DSH 本地通信/API | 安装包包含 Desktop Client–Host API、ACP、SDK JSON-RPC 组件 | **静态已验证**；当前实例对外开放程度**待确认** | 核对当前 RC 的启动配置和官方契约 |
| Hermes/DSH 插件和扩展接口 | Hermes 源码有 MCP 客户端和 Desktop 插件接口；DSH 安装包有插件管理器和 MCP 客户端 | **静态已验证**；具体可用能力、已启用插件及跨 Agent 接入方式**待确认** | 检查官方契约与授权范围 |
| 后台运行能力 | 两个桌面应用在盘点时均有进程和子进程 | **当前运行已验证**；关闭窗口、注销、重启后能否继续运行**待确认** | 后续单独设计非破坏性验证 |
| 任务状态读取方式 | Hermes TUI Gateway 文档列出 `session.status` 等方法；DSH 有 Session API 与持久化组件 | **静态已验证**；当前实例的只读获取方式**待确认** | 核对接口权限与事件语义 |
| 实际日志位置 | Hermes：`D:\HermesAgent\Data\logs`；DSH：`%USERPROFILE%\.dsh\sessions`（会话文件）及 `%APPDATA%\@deepseek-ai\dsh-desktop\logs`（桌面日志目录，盘点时无文件） | 路径**已验证**；Observer 可安全读取的格式与范围**待确认** | 设计只读、脱敏采集 |
| 配置文件位置 | Hermes：`D:\HermesAgent\Data\config.yaml`；DSH：`%USERPROFILE%\.dsh\profiles\desktop` 及 `%APPDATA%\@deepseek-ai\dsh-desktop\desktop` | 路径**已验证**；未修改 | 后续只读盘点时保护秘密 |
| 手机监控 | 用户明确希望支持 | 需求已记录；功能**规划中** | Phase 5 验证访问与认证方案 |

## 第二轮核验摘要（2026-11-07）

分类：**A 已实际验证**（本机文件、进程或监听元数据）；**B 仅有文档依据**（含已安装版本的代码/随包文档，未做协议握手）；**C 尚未验证**；**D 不支持或无法确认**。同一项目可有不同层级的证据，见[详细报告](reports/2026-11-07-phase-0-interface-verification.md)。

| 接口或行为 | 结论 |
| --- | --- |
| Hermes Gateway | **A**：相关 Python 进程在 `127.0.0.1` 监听端口；**B**：本地桌面按源码经 `gateway ensure` 接入 JSON-RPC/WebSocket，并使用私有一次性票据；**C**：当前端口的协议、实际认证与第三方只读权限未握手验证。 |
| Hermes ACP | **B**：文档定义 `hermes acp` 为 stdio 客户端入口；**C**：当前是否有 ACP viewer 及能否接入现有 Gateway 未验证；无可由端口快照直接证实的 ACP 网络监听。 |
| Hermes HTTP API | **B**：OpenAI 兼容 API 需显式启用，文档默认 `127.0.0.1:8642` 并要求认证；**A**：相关进程未在默认 8642 端口监听；**C**：是否在其他端口启用未验证。 |
| DSH Desktop Host | **A**：Host 子进程在本机环回地址监听；**B**：已安装文档描述经认证的 Client–Host API/IPC；**C**：端口具体路由、外部客户端资格与权限未验证。 |
| DSH ACP/SDK | **B**：随包文档规定独立 `acp`/`sdk` profile 通过 stdio 启动；**D**：未发现其直接附着当前 Desktop Host 的受支持入口；本次未启动这些 profile。 |
| DSH 插件接口 | **A**：已安装插件管理器组件及 profile 插件目录；**B**：插件加载于 DSH 组合运行时；**C**：当前已加载插件和外部接入权限未验证。 |
| 双方作为 MCP Server | **A**：Hermes 源码有特定 Codex 运行时的工具子集 MCP Server；DSH 已安装一方包清单未见通用 MCP Server 包；**D**：没有证据表明任一当前桌面实例已作为通用 Agent MCP Server 开放。 |
| 安全任务状态 | **B**：Hermes 有会话/委派状态方法，DSH 有会话列表及作业列表投影；**C**：认证、最小权限与是否泄露标题/路径等私人信息未验证，因此不能称为已安全可读。 |
| 关窗、退出、重启 | **B**：Hermes 代码文档称关窗仅断开 viewer；DSH 已安装代码显示关窗隐藏窗口、退出关闭 Host；**C**：本机实际操作、注销/重启后表现未验证。 |

上述监听端口为一次性进程快照，不能作为固定端点。没有读取现有认证材料、私人会话正文，也没有请求任何接口。

## 第三轮独立进程研究摘要（2026-11-07）

证据术语：**已验证**＝本机安装文件、目录或源码的静态事实；**文档支持**＝官方/随包契约；**推测**＝据已知契约推导、未实测；**待验证**＝需启动、连接或配置检查才能确认。详细出处和限制见[第三轮报告](reports/2026-11-07-phase-0-independent-agent-processes.md)。

| 问题 | 当前结论 |
| --- | --- |
| Hermes 独立 Agent | **文档支持**多 profile、headless Gateway 与程序化会话；但 v0.22.7 默认多 profile 共用一个 Gateway。若要求独立 OS 进程，需要单独的 Hermes home/明确进程边界；本机**待验证**。 |
| Hermes 配置复用 | **文档支持**克隆模型配置、Skills、插件等；`--clone` 也复制 `.env` 与部分私人记忆。按项目权限原则，未来应从新 home 选择性迁入获授权的配置，不能直接复制当前私人记忆或秘密；效果**待验证**。 |
| DSH ACP/SDK 完整任务 | **已验证**已安装 `0.2.1-rc.3` 的 ACP/SDK 与 `dsh-base` 组件；**文档支持**完整 Agent 循环。ACP 有按提示词完成/取消；SDK 有事件和 `session/wait`，但无按提示词结果/取消。未启动实例，实际执行**待验证**。 |
| DSH 插件与 Workflow | **已验证**随包 `dsh-base` 组合含 Workflow 引擎和工具；插件市场是可选 bundle。独立 profile 的插件、全局 patch 与凭据边界由 `DSH_HOME` 决定；是否具备桌面已装插件及其兼容性**待验证**。 |
| 任务提交、状态、结果 | Hermes Gateway 与 DSH ACP 均有**文档支持**的提交/进度/完成路径；SDK 的提交回执不是最终结果。跨进程丢 ACK、重启恢复与幂等需 Bridge 设计并**待验证**。 |
| Bridge 生命周期 | **推测**可以管理自己启动的独立子进程；不得接管或停止现有桌面应用及其 Gateway。Windows 后台持久化、优雅关闭与崩溃恢复**待验证**。 |

本轮没有创建新 profile、启动 Agent、检查凭据值或读取私人会话正文。

## Phase 0.5 POC-001 实测（2026-11-07）

详见[POC-001 报告](reports/POC-001.md)。PoC 使用 `poc/POC-001/` 下分别独立的 Hermes 与 DSH home。Desktop 原实例未被修改或停止。

| 项目 | 实测结果 |
| --- | --- |
| Hermes CLI | `--version` 输出 `v0.22.7`；独立 `gateway run` PID `199316`、API 候选端口 `127.0.0.1:52395`，35 秒无健康响应，退出码 `1`。隔离环境下 `gateway --help` 报 `ModuleNotFoundError: No module named 'ruamel'`；Gateway 启动 **FAIL**，任务功能 **BLOCKED**。 |
| Hermes 启动器副作用 | 在新 PoC home 自动生成运行时下载/安装暂存目录和更新标记；属于未预期行为，已停止继续尝试。未修改原 Hermes home；网络请求情况未核验。 |
| DSH 版本边界 | Desktop 自带 CLI 是 `0.2.1-rc.3`，PATH 上另有 npm CLI `0.2.1-rc.5`。本实验启动的是 Desktop 包内版本。 |
| DSH ACP | 独立 `DSH_HOME` 下 PID `187884` 通过 stdio ACP `initialize`，协议版本 1，关闭 stdin 后退出码 `0`；启动和握手 **PASS**，任务执行 **NOT TESTED**。ACP 无 TCP 端口。 |
| Bridge 与任务 | 仅有一次性启动/握手脚本；常驻 Bridge、任务 ID、双向委派、状态/结果、失败/超时/取消均 **NOT TESTED**。 |
| 清理 | 两个新建 PID 均已退出，原有 Desktop 进程仍在；PoC 文件保留供审查。 |

用户随后授权在隔离 PoC 目录处理 Hermes 依赖。[POC-001 补充记录](reports/POC-001.md#补充记录用户授权后的-hermes-隔离依赖处理)显示：原深路径 home 已生成含 `ruamel.yaml` 的独立依赖 generation，但启动器后续发生源码更新复制错误；短路径 `D:\PAE-POC001\hermes\hermes\home` 的重试进入 Python 依赖安装，因远端关闭连接而在 480 秒内未完成。新增 PoC PID `175704`、`181744`、`182108`、`187844` 均已退出。Hermes Gateway 仍 **FAIL/BLOCKED**；尚无身份或任务接口实测。

短 D: 路径随后使用自身 uv 缓存做离线复核：一次显示 Python 依赖安装完成，但随后的 60 秒终态检查仍无健康响应。新增 PID `158888`、`192708`、`181768` 均已退出；`environments` 和 `source-completion-pending` 等只证明准备有进展。当前仍不能判定独立 Gateway 可用。详见[POC-001 离线复核](reports/POC-001.md#离线缓存复核与最终状态)。

## 接管复核（2026-11-07 21:00–21:40，只读）

执行者：Hermes。未修改配置、未启动 Agent/Gateway 进程、未发送任务、模型调用 0 次。详见[接管报告](reports/2026-11-07-takeover-report.md)与[第一轮技术验证报告](reports/2026-11-07-technical-validation-round1.md)。

| 项目 | 实测结果 | 级别 |
| --- | --- | --- |
| 运行中的 Hermes Backend | `python -m hermes_cli.main gateway run`，PID 180288，`HERMES_HOME=D:\HermesAgent\Data`（`gateway.pid` 记录 `kind: hermes-gateway`） | A 已验证 |
| Hermes Gateway 状态 | `hermes gateway status` → `Gateway is running (PID: 180288)`，手动运行而非系统服务 | A 已验证 |
| 运行 home 的运行时 | `Data\installs\83877ba9c77f9088\environments\5bc19e6f…\venv`：248 个包，含 `ruamel.yaml 0.18.16`、editable `hermes_agent`、`agent_client_protocol 0.9.0`、`acp` | A 已验证 |
| Hermes ACP 可用性 | `hermes acp --check` → `Hermes ACP check OK`，退出码 0；`acp.PROTOCOL_VERSION = 1` | A 已验证 |
| `source-completion-pending` 语义 | 由 `hermes_cli/venv_sync.py:arm_completion()` 写入 `installs/<key>/source-completion-pending`，表示「源码更新尾段未完成」；启动时按退避重试（2 次后 15 分钟，6 次后停止自启）。它是安装义务标记，**不是 Gateway 错误码** | A 已验证（源码） |
| PoC home 的依赖状态 | `D:\PAE-POC001` 短路径 home 的 PM 回执为 `kind: sync, outcome: ok, exit_code: 0, venv_rebuild.ok: true`；其 venv 已有 `ruamel 0.18.16` 与 editable `hermes_agent` | A 已验证 |
| PoC home 无配置文件 | 两个 PoC home 均**没有** `config.yaml` → API Server 从未启用，`/health` 不可能应答 | A 已验证 |
| DSH ACP 版本与定位 | `@deepseek-ai/dsh-acp@0.2.1-rc.3`，随包 README 自述「automation-only ACP server，通过 JSON-RPC stdio 驱动 agent」，标准 ACP v1 | A 已验证（随包文档） |
| DSH ACP 默认模型 | 由随包 `@deepseek-ai/dsh-acp-app/cordis.patch.yml` 注入：`provider: deepseek-official`、`model: deepseek-v4-flash` | A 已验证 |
| DSH ACP 配置字段 | 仅 `provider`、`model`、`sessionListPageSize`；**无 `max_tokens` 类单次生成长度上限** | A 已验证（随包文档） |
| DSH ACP 支持的方法 | `initialize`、`authenticate`、`session/new|list|resume|close|set_config_option|prompt|cancel`、`session/update`、`session/request_permission`；**明确不支持 `session/load`**、delete、fork、附加目录、SSE、mode、plan、terminal、客户端 fs、elicitation | A 已验证（随包文档） |
| DSH 凭据位置 | `~/.dsh/.env`（键名 `DEEPSEEK_API_KEY`）、`~/.dsh/.credentials.yaml`（记录型，键名 `version/records/kind/payload/secret`）；只读取了键名，未读取值 | A 已验证（路径与键名） |
| PoC 遗留体积 | `poc/POC-001` ≈ 956 MB（其中 `hermes/home/tools` 945 MB）、`D:\PAE-POC001` ≈ 2.2 GB（tools ≈ 1.6 GB、installs ≈ 0.6 GB、cache ≈ 14 MB） | A 已验证 |

**未验证**：Hermes ACP 与 DSH ACP 的实际字节级互通（需启动 `hermes acp` 进程，未获授权）；专用 profile 的记忆隔离实测；两侧凭据在隔离 home 下的行为。

## Phase 1 双端握手实测（2026-11-07 22:20–22:45）

执行者：Hermes。新建 profile `bridge` 与 `poc/PHASE1/`。**全程 0 次模型调用**（6 份 transcript 中 `session/prompt` 出现 0 次；Hermes 会话行 `api_call_count=0 / estimated_cost_usd=None`）。详见[Phase 1 报告](reports/2026-11-07-phase1-acp-handshake.md)。

| 项目 | 实测结果 | 级别 |
| --- | --- | --- |
| 专用 profile `bridge` | `D:\HermesAgent\Data\profiles\bridge`；`memories/`、`sessions/` 皆空；`state.db` 初建时 sessions=0/messages=0；无 `auth.json`；`.env` 仅 3 行注释、无键 | A 已验证 |
| profile 的 model 块 | `config.yaml` 由 `_seed_model_config` 从活动 profile 复制（`opencode-go / deepseek-v4.1-flash` + aliases），**不是空白**，属设计行为 | A 已验证 |
| profile 的技能 | `--no-skills` 仍播种 essentials：仅 `hermes-agent` 一个技能 + `.no-bundled-skills` 标记 | A 已验证 |
| profile 的凭据 | 运行日志 `agent.credential_pool: no available entries (all exhausted or empty)` → 发 prompt 会 fail closed | A 已验证 |
| Hermes ACP 握手 | protocolVersion 1；authMethods `['hermes-setup']`；capabilities `loadSession/promptCapabilities/sessionCapabilities`；启动 6–9 s | A 已验证 |
| DSH ACP 握手 | protocolVersion 1；authMethods `[]`；启动 2–4 s；`configOptions` 公布 `deepseek-official/deepseek-v4-flash` 与 `reasoning_effort`（默认 high，可选 off/low/high/max） | A 已验证 |
| `session/new` 计费 | 无模型调用：Hermes `message_count=0 / tool_call_count=0 / input_tokens=0 / output_tokens=0 / api_call_count=0`；DSH 会话事件日志 408 字节、`titleInput.count=0` | A 已验证 |
| `session/close` | 双端 OK；Hermes 由底层 router 处理（adapter 源码无显式 close 方法）；进程退出码 0 | A 已验证 |
| 跨进程恢复 | Hermes `session/load` OK；DSH `session/list`（1 条）+ `session/resume` OK | A 已验证 |
| Hermes `session/list` | 返回 0 条——源码 `acp_adapter/catalog.py:catalog_sessions` 过滤 `message_count<=0`；空会话不进列表 | A 已验证（源码） |
| 生命周期对称性 | Hermes ACP 退出后 Gateway 仍在（PID 180288 未变）→ viewer ≠ 常驻 Agent | A 已验证 |
| 进程卫生 | 6 次子进程全部退出，无残留 `--profile acp` / `-p bridge` 进程；未触发 `taskkill` | A 已验证 |

## 盘点记录格式

新增事实时记录：检查日期、检查者、来源（应用界面/官方文档/只读检查）、确切版本或路径、证据摘要、结论。未核验前保留「待确认」；禁止从候选技术推断已有接口。

## 秘密信息边界

只记录接口是否存在、文档来源和必要的非敏感路径。不要粘贴 API Key、密码、访问令牌、完整凭据文件内容或私人记忆内容。

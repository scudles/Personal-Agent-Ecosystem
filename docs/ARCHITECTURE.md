# 架构基准

状态：**目标架构，规划中**。截至 2026-11-07 已完成三轮 Phase 0 只读调查及一次 Phase 0.5 启动/握手 PoC；DSH ACP 握手成功，Hermes Gateway 启动失败，尚无任务委派或完整组件。详见[第三轮研究](reports/2026-11-07-phase-0-independent-agent-processes.md)与[POC-001](reports/POC-001.md)。

## 角色与关系

```text
                         用户（最终决策者）
                         │ 目标、审核、授权
          ┌──────────────┼────────────────┐
          │              │                │
        Hermes           DSH       ChatGPT Observer
     记忆/Skills/自动化  插件/Workflow/多 Agent   独立观察/审查/顾问
          │              │                │
          └──────────────┴────────────────┘
                         │ 授权范围内协作与观察
                  Agent Bridge（规划中）
            注册/发现/任务/消息/状态/权限/事件
                         │
        Shared Knowledge / Task Database / Web Dashboard
                  （均为规划中）
```

Hermes 与 DSH 为平级关系，不设固定上下级；双方可发现能力、双向委派普通任务、交换进度与结果。两者的模型、私人记忆、配置、工具和执行环境保持独立。Observer 独立于双方，默认只读，可审查进度、任务委派、重复劳动、资源消耗、架构、结果和安全风险，并给出技术建议；不承担普通任务竞争，也不拥有执行管理权限。用户拥有最终决策权。

当前 ChatGPT 对话**不具备持续后台读取本地日志能力**。自动观察**规划中**，需要独立 Observer 服务和模型 API；服务实现方式与可读数据范围**待确认**。

## Agent Bridge（规划中）

独立的 Agent 通信与协作服务，预期提供身份注册、能力发现、双向任务委派、消息传递、任务状态同步、结果回传、超时检测、失败重试、任务日志和权限检查。

候选技术：Python、HTTP API、MCP、SQLite、WebSocket。它们只是初步选型，兼容性、必要性和部署方式均**待确认**，不得据此认定桌面应用已有对应接口。

拟议任务记录至少包含任务 ID、来源、执行者、状态、结果、失败原因，以及必要的时间信息。字段、状态机、幂等和重试策略**待设计**。Bridge 需在执行授权边界内处理请求；高风险操作须停在用户审批点。

## Shared Knowledge（规划中）

保存经过授权的项目资料、研究报告、可复用执行成果、经审核的技能和知识，以及交接上下文。共享范围与写入审核机制**待设计**。不得未经授权读取、合并或覆盖 Hermes 和 DSH 的私人记忆。

## Observer Module（规划中）

预期读取两个 Agent 在授权范围内提供的任务状态与日志，发现重复任务、API 消耗异常和失败任务，审查工作流，并生成周期报告与架构建议。数据来源、日志格式、资源计量口径和持续运行方式**待确认**。Observer 默认只读，不具备任务执行或管理权限。

## Web Dashboard（规划中）

面向电脑和手机浏览器，优先支持手机。预期显示 Hermes/DSH 在线状态、执行任务、委派关系、子 Agent 状态、日志、结果、异常及资源消耗，并接收待用户批准的请求。实时性实现方式、身份认证、可信网络方案和手机访问路径**待确认**。远程访问不直接暴露本地服务端口。

## 协作流程（规划中）

1. Agent 注册身份并公布经过确认的能力。
2. 发起方提交普通任务；Bridge 记录来源、目标、权限范围和状态。
3. 执行方接收任务、回报进度、结果或失败原因；超时与重试保留事件记录。
4. 触及付费、重要数据删除、对外消息、安全设置、权限扩大或不可逆操作时，请求用户授权后再继续。
5. Observer 读取获授权的事件和结果，独立提出审查意见；用户决定重大分歧。

以上是目标流程，**尚未实现**。具体接口、身份验证、事件格式和 Agent 能力发现机制均**待确认**。

## 接入拓扑候选（Phase 0 第三轮，规划中）

**A：连接现有桌面实例。** Bridge 以受支持的客户端身份连接 Hermes 当前 Gateway 和 DSH 当前 Desktop Host。Hermes 有文档化 Gateway 会话接口；DSH 当前 Host 的可独立授权外部客户端边界尚待验证。此拓扑与桌面应用生命周期耦合，不能凭环回端口绕过认证。

**B：独立 Agent 进程。** Bridge 只管理由它自行启动的执行实例：Hermes 使用与现有个人助理隔离的 home 和 headless Gateway 候选；DSH 使用专属 `DSH_HOME` 的 ACP stdio profile 候选。两者通过各自官方协议提交任务和接收状态；Bridge 只存最小任务元数据，用户仍审批高风险操作。**B 的「双独立进程」形态未实施；2026-11-07 已改为下面的 B′（用户正式采纳方向，兼容性待验证）。**

```text
用户 / Dashboard（规划中）
          │
   Agent Bridge（规划中；任务记录、授权、生命周期）
          ├── Hermes 专属 home + Gateway（候选；独立进程待验证）
          └── DSH 专属 DSH_HOME + ACP stdio（候选；仅握手已验证）

现有 Hermes Desktop + 个人数据       现有 DSH Desktop + 个人数据
        （保留独立）                       （保留独立）
```

Hermes 的普通新 profile 默认由现有 Gateway 多路复用，不能据此宣称获得独立 OS 进程；`gateway.standalone` 是临时兼容路径。Hermes `--clone` 会携带 `.env`、部分私人记忆及插件，不能作为默认隔离方案。DSH ACP/SDK 虽共用 `dsh-base` 的工具与 Workflow，profile 级插件和可选插件市场不会自动继承桌面运行态；使用同一 `DSH_HOME` 又可能共享 home 级环境与 patch。因此 B 的前提是为两边建立经过审核的专属数据与权限范围，具体配置和启动步骤仍待授权与验证。

Bridge 的最小协议候选：Hermes `session.create`、`prompt.submit`、状态/事件；DSH ACP `session/new`、`session/prompt`、`session/update`、取消/关闭。提交回执与任务完成必须分开记录；进程断开后不得盲目重放可能已经执行的任务。SDK 可作为备选，但其按提示词完成和取消边界较弱。生命周期管理仅限 Bridge 自己启动并持有句柄的进程；现有桌面进程不在其管理范围。所有协议选择、认证和重启恢复均**待验证**。

## Phase 0.5 POC-001 对拓扑 B 的实测修正

[POC-001](reports/POC-001.md) 只证明 DSH `0.2.1-rc.3` ACP stdio 进程可在专属 home 启动并完成 `initialize`，随后正常退出。Hermes v0.22.7 在本次专属 home 下启动 Gateway 失败，缺少 `ruamel.yaml`，且启动器意外在新 home 自动准备运行时。因依赖边界已触发，Gateway、最小 Bridge 与双向任务委派都没有实施。上述拓扑仍是**候选架构**，不能标记为联通或可行性已证实。后续进程管理必须预防启动器自动下载，并保留用户的模型费用审批门槛。

用户授权隔离依赖处理后，Hermes 启动器在新 home 生成了运行时组件，但 Gateway 仍未健康：深路径尝试发生源码更新复制错误，短 D: 路径尝试停在 Python 依赖下载的网络错误。参见[POC-001 补充记录](reports/POC-001.md#补充记录用户授权后的-hermes-隔离依赖处理)。因此 Bridge 对 Hermes 的进程监督、认证和任务控制均继续标记为**规划中/待验证**；不得把已安装组件等同于可用的独立 Agent。

离线缓存复核之后，短路径 home 已记录 Python 依赖安装完成，但仍无 Gateway 健康响应，且存在 `source-completion-pending` 标记。见[POC-001 最终状态](reports/POC-001.md#离线缓存复核与最终状态)。拓扑 B 的技术可行性仍未通过实证，不得据此启动 Bridge 任务调度。

2026-11-07 接管复核后，上述 FAIL 结论改为分级表述（细节见[接管报告](reports/2026-11-07-takeover-report.md)）：深路径缺依赖属**实际失败**；短路径的「无健康响应」是**探针口径错误 + 安装 tail 未完成**的复合结果，既不是 PASS，也不再作为「Hermes 不支持独立实例」的证据。

## B′：专用 Profile + 官方 ACP stdio（已采纳的设计方向，兼容性待验证）

用户于 2026-11-07 正式采纳 B′ 作为下一阶段候选架构。**状态：设计方向已采纳；隔离性、互通性与生命周期行为均未实证，不得记为已实现。**

```text
用户（最终决策者）
   │
Agent Bridge（规划中；先做最小脚本，不先做常驻服务）
   ├── Hermes：专用 profile（独立 config/.env/SOUL/memories/sessions/skills/cron/state.db）
   │            └─ 官方 stdio ACP（`hermes acp`，ACP v1）
   └── DSH：专属 DSH_HOME + `--profile acp`（ACP v1，automation-only）
                ↑ 两侧同为 ACP v1 stdio，Bridge 只需一套客户端
```

采纳理由：

1. Hermes 随包官方文档把「一主机一 Gateway 多路复用」定为方向，`gateway.standalone: true` 被明确标注为**临时兼容 shim**，并写明「不要在新部署上使用」。
2. 官方 `acp.md` 说明 `hermes acp` 是 gateway daemon 的 viewer，保留既有 identity/provider/memory/skills/tools；**隔离粒度是 profile，不是进程**。
3. 本机已具备运行条件：运行中的 venv 已含 `agent_client_protocol 0.9.0` 与 `acp_adapter`，`hermes acp --check` 返回 OK（2026-11-07 实测）。
4. D-002 要求的是记忆/配置/运行环境各自保留，专用 profile 满足该要求；进程分离是实现手段，不是决策本身。

已知代价与风险（不得省略）：

- Hermes 侧 ACP 仍由 live gateway 进程承载（viewer 模型）。若 profile 配错，理论上可触及默认 profile 的上下文，故 profile 必须显式创建并逐项核对。
- 两侧凭据层仍共享：Hermes 的 OAuth 登录读根 `auth.json`，DSH 读 `~/.dsh/.env` 的 `DEEPSEEK_API_KEY`。**「独立身份」目前只到 profile/会话层，不到账号层。**
- 双方能力集不同：Hermes ACP 有 `session/load|resume|fork|list`；DSH ACP 明确不支持 `session/load`，但有 `session/list|resume|close`。Bridge 必须按侧适配，不能用同一套恢复逻辑。
- DSH ACP 的模型由随包默认值决定（`deepseek-official` / `deepseek-v4-flash`），且其配置层没有 `max_tokens` 类单次生成长度上限，成本控制需另想办法。

### B′ 的 Phase 1 实测修正（2026-11-07，双端已握手）

详见[Phase 1 报告](reports/2026-11-07-phase1-acp-handshake.md)。已实测成立：

- 专用 profile `bridge` 的记忆/会话/凭据均为空（`.env` 仅注释、无 `auth.json`、运行日志 `credential pool: no available entries`），但 `config.yaml` 的 model 块会由 `_seed_model_config` 从活动 profile 复制，`--no-skills` 仍播种 `hermes-agent` 一个 essentials 技能。
- 双端 `initialize` / `session/new` / `session/close` 全部通过；`session/new` 未产生模型调用（Hermes 会话行 `message_count=0 / api_call_count=0 / estimated_cost_usd=None`，DSH 事件日志为空）。
- 跨进程恢复：Hermes `session/load` 成功、DSH `session/list` + `session/resume` 成功。
- **Hermes `session/list` 会过滤 `message_count=0` 的会话**（`acp_adapter/catalog.py`），因此桥接层不得依赖对端列表来找会话来恢复；必须自持 `(task_id, side, session_id)`。
- Hermes ACP 是 gateway 的 viewer：ACP 进程退出后 Gateway 仍在（本轮 PID 180288 未变），所以「两侧生命周期对称」不成立。

仍未验证：prompt 与计费、Gateway 重启时的 viewer 行为与 in-flight 语义、MCP 挂载与重挂、权限审批流。

## 身份与权限模块（规划中，未实现）

设计见 [IDENTITY_AND_ACCESS.md](IDENTITY_AND_ACCESS.md)，默认矩阵见 [PERMISSION_MATRIX.md](PERMISSION_MATRIX.md)。**本模块尚未实现，任何权限均未生效。**

```text
用户（L1，唯一授权者）
   │  策略文件 policy/agents.yaml（人可读，版本化）
   ▼
Bridge 身份与权限层（规划中）
   ├── Identity Registry   L2 agent_id + 公钥；L3 instance_id
   ├── Policy Engine       默认拒绝 / 子集 / deny 优先 / TTL / epoch 撤销
   ├── Delegation Ledger   task 树 + 逐跳签名 + 深度≤2 + 幂等键
   ├── Budget Ledger       per-agent 单次/日/月上限 + 账本（含 credential_ref）
   └── Audit Log           append-only + 逐行哈希链

Agent 侧（各自负责）
   ├── Hermes：profile 隔离 + toolset 白名单 + 危险命令审批（映射到 ACP request_permission）
   └── DSH：DSH_HOME 隔离 + profile 插件清单 + 可选 bash 沙箱（Windows 无后端，见设计文档）
```

**模块边界**：Bridge 决定「这个任务该不该放行、放行多大、花多少」，Agent 决定「这个具体动作要不要真的执行」。两者都不足以单独成立；真正的文件级隔离只能来自 OS 账号/ACL（阶段 B）。

**与 ACP 的接入点**：每个任务 = 一个 ACP session；`session/new` 前做准入，`session/prompt` 前做预算与 scope 校验，`session/update` 收进度，`session/cancel` 做超时停止；`session/request_permission` 一律转人工/拒绝，不自动批准。

## Social Layer（规划中，未实现）

项目不只服务工作，也服务相处。工作态三者为专业协作团队，日常态为有各自性格、能自然互动的伙伴。性格定义见 [PERSONAS.md](PERSONAS.md)（唯一来源）；功能清单与验收条件见 [ROADMAP.md](ROADMAP.md) 的 P2 段。

| 组件 | 作用 | 状态 |
| --- | --- | --- |
| Personal Agent Lounge | 用户 + Hermes + DSH + Observer 的公共聊天室，支持广播 / `@` 定向 / 互回 / 多方连续讨论 / 保留发言者身份 / 随时打断 | 规划中 |
| Project Room 与 Lounge 双频道 | 前者技术与项目决策（重大决策经用户确认才进 DECISIONS.md），后者日常闲聊（不强制报告） | 规划中 |
| Free-flow Conversation | 不机械轮流；可接话、补充、质疑、延伸、沉默；**必须**配最大轮数、空闲超时、预算与用户中断 | 规划中 |
| Let Them Talk（自主聊天室） | 用户选话题与成员后让三方自主讨论一段时间，可旁观可加入，结束后可选摘要。**两种模式都保留**：模式 A 话题讨论（用户给主题、可指定成员）、模式 B 自由闲聊（用户不给主题，成员自己选话题） | 规划中 |

硬性边界：任何自主讨论都必须有停止条件、预算与权限边界；讨论摘要不等于决策；三方身份不得互相代写。Social Layer 不阻塞技术主线，也不得在 Phase 1/2 未完成前实现。初心与角色设定的唯一来源见 [VISION_AND_PERSONAS.md](VISION_AND_PERSONAS.md)。

## Shared Visual Workspace（规划中，未实现）

三个 Agent 共用的表达面：把想法画出来、让别人在同一张图上批注与提替代版本。**它是 Bridge 权限体系的渲染消费者，不是它的旁路。** 详细设计见 [SHARED_VISUAL_WORKSPACE.md](SHARED_VISUAL_WORKSPACE.md)。

```text
消息层（单表） ──refs[{type:visual, id, version, anchor}]──┐
                                                          ▼
                                   Visual Artifact Store（不可变版本 + proposal 分支）
                                          │
                          ┌───────────────┴────────────────┐
                          ▼                                ▼
              渲染服务（服务端，无凭据）            权限判定（复用 Bridge decide()）
              mermaid/svg/chart → 静态产物           view / comment / edit / export 四分
                          │
                          ▼
              Viewer：右侧面板 / 全屏 / 手机只读页
              （HTML 原型仅进 sandbox iframe，空 sandbox + CSP 封网）
```

四条不可妥协：①已发布版本不可改，只能发新版；②HTML/交互原型绝不内联进主文档；③`export` 单独授权（导出＝数据外流）；④画布上的点击只能产生批注/提案，不能触发 tool call。

**三种模式**（同一对象的三种视图，权限取交集）：展示（Agent 展示、他人只看）／协作（四方共同标注与提案）／演示（隔离原型内交互）。**标注层**是独立实体，挂 `(visual_id, version)`，每人一层、只追加、用户对自己标注有管理权；颜色仅作视觉区分，**不是身份凭证**。

阶段：V0 静态图 → V1 Mermaid/SVG/简单图表 → **V2 多方批注、版本与用户标注层** → V3 隔离 HTML 原型 → V4 手机上白板。

## Memory Infrastructure：Project Mnemosyne（提案，未采纳为实施架构）

**定位**：跨对话、跨 Agent、跨项目、跨时间的长期记忆底座。不是"再加一个 Memory 模块"。

**五层**：L1 Archive（原始经历，不可被摘要静默覆盖）→ L2 Episodic（发生过什么）→ L3 Semantic（提取的知识，必须可溯源）→ L4 Decision & Evolution（决策与变更史）→ L5 Personal（Agent 私有记忆，默认不共享）。

**与现有基础设施的关系（关键）**：
- **不建第二套身份/权限/审计**：读写删全部走 `pae-*` 账号 ACL 与 Bridge 审计链；
- L1 直接复用审计日志的 append-only + 哈希链 + 锚点 + 段轮转（U3/U4）机制，但**实例分开**：审计不可删，记忆可 tombstone + 密钥销毁；
- **L5 的真正私有性依赖 Windows 账户隔离通过**；在那之前只有"逻辑隔离"，不构成私有。

**存储（本地优先，向量后置）**：append-only JSONL（原始事件）+ 文件（内容寻址 blob）+ SQLite（元数据/FTS5）；向量与图库推迟到有明确触发条件。

详见 [MNEMOSYNE.md](MNEMOSYNE.md)。**状态：PROPOSAL / 设计讨论中。用户采纳构想与原则，但未批准实施；本节的模块描述不构成已批准架构。**

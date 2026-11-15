# 开发路线图

基准日期：2026-11-07（2026-11-08 重构为双工作流）。
除文档建立外，下列组件和能力均为**规划中**。每阶段结束后更新证据、结果和未完成项，不以计划代替验收。

> **进度不在这里记。** 当前状态、谁在做、等待授权——一律看 [WORKSTREAMS.md](WORKSTREAMS.md)。本文只写"阶段划分与验收条件"。

## 全局结构（两条工作流）

```text
Personal Agent Ecosystem
├── A. Core Infrastructure（P0/P1）——唯一执行主线
│   ├── M1 Windows 独立账户 PoC        ← Phase 1.7 的 AC-1…AC-3
│   ├── M2 最小 Bridge 骨架（策略/账本/审计）
│   ├── M3 起停与审计防护              ← AC-4 / AC-5
│   ├── M4 最小真实任务（首个花钱里程碑）
│   ├── M5 双向委派（深度 ≤2）
│   └── M6 基础设施安全验收
│
└── B. Social & Visual Layer（P2）——独立规划，未启动开发
    ├── SL-01 Chat Room → SL-02 Lounge / SL-03 Project Room
    ├── SL-04 Visual Workspace → SL-05 Annotation → SL-06 多方视觉协作
    ├── SL-07 Demo Mode（沙箱）
    └── SL-08 Mobile（需 Dashboard 认证）
```

范围与里程碑：A 见 [CORE_INFRASTRUCTURE.md](CORE_INFRASTRUCTURE.md)，B 见 [SOCIAL_VISUAL_LAYER.md](SOCIAL_VISUAL_LAYER.md)。

## Phase 0：环境盘点（当前阶段）

- [x] 确认 Windows 10/11 与具体版本（2026-11-07：Windows 11 专业版，Build 26200）。
- [ ] 本机核验 Hermes 应用和 Backend 版本。
- [x] 本机核验 DSH 版本及 RC 发布通道（安装程序与 `app.asar` 均显示 0.2.1-rc.3）。
- [ ] 调查两个桌面应用的本地 API 和官方通信接口。
- [ ] 调查插件、扩展、Workflow 接口。
- [ ] 调查后台运行能力。
- [ ] 调查任务状态读取方式和日志位置。

完成条件：`ENVIRONMENT.md` 记录每项来源、验证日期、结果与限制；仍无法确认的条目明确保留「待确认」。不修改现有配置。

2026-11-07 进展：已完成一轮只读盘点，确认运行路径、若干静态接口及日志目录；Hermes 运行版本、当前实例接口可调用性、窗口关闭后的持续运行及安全读取任务状态仍待验证。详见 [阶段报告](reports/2026-11-07-phase-0-read-only-inventory.md)。Phase 0 **未完成**。

2026-11-07 第二轮：已完成不发请求的接口静态核验和本机监听快照，见[第二轮报告](reports/2026-11-07-phase-0-interface-verification.md)。后续待办：

- [ ] 经单独授权后验证 Hermes Gateway 当前实例的只读握手、端点身份和最小权限；确认 HTTP API 是否以非默认端口启用。
- [ ] 核实 DSH Desktop Host 是否提供受支持的外部只读 Peer；不要把独立 ACP/SDK profile 当成现有 Host。
- [ ] 确认双方是否有受支持的完整 Agent MCP Server；不要把 MCP Client 或 Hermes 的 Codex 工具子集当成双向委派接口。
- [ ] 定义任务状态的最小字段、认证范围和脱敏规则，再验证只读查询。
- [ ] 在不打断任务的专门窗口验证关窗、退出、注销与重启行为；本次未执行。

Agent Bridge 的[最小可行接入方案](reports/2026-11-07-phase-0-interface-verification.md#agent-bridge-最小可行接入方案规划中)仍为**规划中**，取决于 DSH 当前 Desktop Host 是否提供合适的受支持访问边界；不得据此开始实现。

2026-11-07 第三轮：完成[独立进程方案研究](reports/2026-11-07-phase-0-independent-agent-processes.md)；**有条件推荐 B：Bridge 管理专属 Hermes Gateway 与 DSH ACP profile**，但没有启动、配置或连接。进一步核验：

- [ ] 确认 Hermes v0.22.7 在专属 `HERMES_HOME` 下启动独立 headless Gateway 的官方支持边界、端口与隔离行为；普通新 profile 默认多路复用，不能等同独立进程。
- [ ] 明确 Hermes 模型、工具、Skills 的选择性复用清单；排除私人记忆、现有工作目录、消息渠道与未经授权的秘密。
- [ ] 确认 DSH `0.2.1-rc.3` ACP profile 在专属 `DSH_HOME` 下的启动、模型可用性、权限交互、Workflow 与所需插件兼容性。
- [ ] 用获授权的无敏感测试任务验证 Hermes/DSH 的提交、进度、完成、取消、故障和恢复语义；本轮不执行。
- [ ] 设计 Bridge 对自有子进程的启动/退出/健康检查与 Windows 后台托管策略，不接管现有桌面实例。

第三轮只是研究结论；Phase 0 **未完成**，不得把推荐方案标为已实现。

## Phase 0.5：Independent Agent PoC（进行中，依赖/成本门槛暂停）

2026-11-07 [POC-001](reports/POC-001.md) 已建立隔离目录并做无模型调用的启动/握手：DSH `0.2.1-rc.3` ACP **PASS**；Hermes 独立 Gateway **FAIL**（缺少 `ruamel.yaml`，且启动器在新 home 自动准备运行时）。未启动 Bridge 服务，未发送任务。后续工作需要先处理授权门槛：

- [x] 建立 Hermes、DSH、Bridge 的独立 PoC 目录，记录候选端口、PID 与实际产物。
- [x] 验证 Desktop 安装包自带 DSH ACP 独立 stdio 启动和 `initialize`，退出清理。
- [ ] 用户已授权仅在隔离 PoC 目录处理 Hermes 依赖；仍须定位源码完成阶段停点，并取得独立 Gateway 健康/身份验证结果。
- [ ] 确定独立实例使用的模型、计费方式和预计调用成本；获用户批准后才发送测试 prompt。
- [ ] 最小 Bridge 实现任务 ID、发送方/接收方、接受/开始/完成时间、状态、结果与错误，并只监督自有 PID。
- [ ] 实测 Hermes → DSH 与 DSH → Hermes；分别核验接受、状态和最终结果。
- [ ] 实测成功、失败、超时、取消；不得以进程启动结果冒充 Agent 任务结果。
- [ ] 核验长时运行、停止和原桌面实例隔离，再更新技术结论。

Phase 0.5 未通过验收；Phase 1 完整 Bridge 开发仍未开始。

用户授权后的依赖重试已记录在 [POC-001 补充记录](reports/POC-001.md#补充记录用户授权后的-hermes-隔离依赖处理)：Hermes 新 home 已准备部分独立运行时，但短 D: 路径的 Python 依赖下载因网络连接关闭而未完成，Gateway 仍 **FAIL/BLOCKED**。下一步应先取得可重复、完整的官方依赖安装结果及健康响应；不要在此之前标记独立 Hermes 或双向委派为通过。模型调用审批仍为独立门槛。

后续离线复核显示“Python dependencies”安装完成，但 Gateway 的 60 秒终态检查仍无健康响应；见[最终状态](reports/POC-001.md#离线缓存复核与最终状态)。下一步改为**定位独立 home 的 `source-completion-pending` 与 Gateway 启动停点**，确认可用后才推进模型/双向任务实验。已停止重复启动，当前阻断不能简化为单一网络故障。

## Phase 0.6：B′ 接入验证（进行中，未开发 Bridge）

2026-11-07 用户采纳 B′（专用 profile + 官方 ACP stdio），并指定下一阶段的验证重点。本阶段只做验证与取证，**不开发完整 Agent Bridge**。

- [x] 确认 Hermes 侧 ACP 运行条件：`hermes acp --check` → OK；`agent_client_protocol 0.9.0` 已装（零下载）。
- [x] 静态比对两侧 ACP 能力集（Hermes 有 `session/load|resume|fork|list`；DSH 无 `session/load`，有 `list|resume|close`）。
- [x] 核实 DSH ACP 的模型配置方式与实际模型（`deepseek-official` / `deepseek-v4-flash`，随包默认）。
- [x] 生成 3.2 GB PoC 文件清单与清理方案（未删除）。
- [x] 创建 Hermes 专用 profile（`bridge`，空白 + `--no-skills` + 无别名；未 `--clone`）。核对结果：`memories/` 空、`sessions/` 空、`state.db` 内 sessions/messages 均为 0、`.env` 仅注释、无 `auth.json`；**唯 `config.yaml` 由 `_seed_model_config` 复制了 model 块**（设计如此），`skills/` 仍播种 essentials（`hermes-agent` 一个）。
- [x] 双端 `initialize` 实测通过（两侧 protocolVersion=1）。
- [x] 双端 `session/new` 实测通过；并已验证**不触发模型调用**（Hermes 会话行 `message_count=0 / api_call_count=0 / estimated_cost_usd=None`；DSH 会话事件日志为空）。
- [x] 双端 `session/close` 实测通过（Hermes 由底层 router 处理）。
- [x] 原始 JSON-RPC 记录留存：`poc/PHASE1/bridge/logs/*.jsonl`（6 份）。
- [x] 会话持久化 + 跨进程恢复：Hermes `session/load` OK、DSH `session/list` + `session/resume` OK（Hermes `session/list` 会过滤掉 message_count=0 的会话）。
- [ ] 记忆隔离的「非空」验证（需一次 prompt，费用门槛）。
- [ ] `session/prompt` 与计费、`reasoning_effort` 效果（费用门槛）。
- [ ] Gateway 重启后的 viewer 行为与 in-flight 任务语义（未授权重启 live gateway）。
- [ ] MCP 挂载与 load/resume 时重挂（`mcpServers` 一直传空）。
- [ ] 权限审批流 `session/request_permission`（仅在 prompt 时触发）。

完成条件：上述每项都有本机证据，且明确标注 PASS / FAIL / 部分成立；不得以「进程起来了」代替「任务跑通了」。

## Phase 1：Agent Bridge（规划中）

- [ ] 根据 Phase 0 证据确定接口与技术选型。
- [ ] 建立独立通信服务与任务数据库。
- [ ] 建立 Agent 注册与能力发现机制。
- [ ] 建立任务状态管理、权限检查和事件日志。

完成条件：以测试任务验证注册、状态变更、日志和权限边界，并记录证据。

## Phase 1.5：身份与权限（设计完成，实现未开始）

2026-11-07 设计稿完成：[IDENTITY_AND_ACCESS.md](IDENTITY_AND_ACCESS.md) + [PERMISSION_MATRIX.md](PERMISSION_MATRIX.md)。**未实现，任何权限未生效。**

- [x] 五层身份定义（User / Agent / Runtime / Credential / Delegation）与 ACP 能力盘点。
- [x] 八类权限 + scope 语法 + 三种授权方式 + 继承/收缩/冲突规则。
- [x] 委派链字段、不变量、六类攻击对策、`unknown_execution` 语义。
- [x] 预算层级与账本字段；聊天室权限草案；威胁模型；Windows 三阶段方案。
- [ ] 用户审议并确定：预算数值、是否采用独立 OS 账号（阶段 B）、是否引入 Agent 签名密钥、委派深度上限。
- [ ] 写 `policy/agents.yaml`（人可读）+ 只读校验器（无网络、无新依赖）。
- [ ] 实现账本（SQLite）与审计哈希链（append-only）；先只对 Hermes 单侧生效。
- [ ] 接入 ACP 准入点：`session/new` 前准入、`prompt` 前预算校验、`request_permission` 转人工。
- [ ] 双 Agent 委派验证（需模型费用批准）。
- [ ] 阶段 B PoC：用独立 Windows 账号跑 DSH，验证 ACL 真的挡住跨 Agent 读。
- [ ] Dashboard/手机认证方案（**必须晚于** Bridge 权限模型，否则只是把不受控的东西搬到手机上）。

完成条件：一次真实任务能证明「准入 → 执行 → 记账 → 审计」四步闭环；且篡改审计日志、超预算、越权路径三种情况都能被检出或拦住。

2026-11-07 第二轮交付（用户要求的五项）：[六项决定影响分析](reports/2026-11-07-decision-impact-analysis.md)、[Windows 隔离与迁移](reports/2026-11-07-windows-isolation-and-migration.md)、[威胁模型](THREAT_MODEL.md)、[最小可行身份注册表与策略](MVP_IDENTITY_AND_POLICY.md)。八条设计方向已由用户正式采纳（D-008）；P-001 口径修订为「无 OS 隔离期间接受哪些残余风险」，仍待决定。

2026-11-07 第三轮（审查后）：六项决策已作为**建议 S-001…S-006** 记入 `DECISIONS.md`，**待用户最终确认，未生效**。其中预算口径已按用户意见改为「实验池 \$1 / 单次 \$0.10 / 每日 \$0.50 / 每月 \$5」，并补充「现金 API 与订阅配额分开计量、限额是软限额 + 硬停止」的说明（[MVP §9](MVP_IDENTITY_AND_POLICY.md)）。

2026-11-07 第四轮（收尾）：用户原则性确认六项 → 记为 **D-009（决策成立、实现未生效）**；设计基线冻结于 [Phase 1.5 基线](reports/2026-11-07-phase1.5-baseline.md)，含 B1–B10 条目与 Observer 五条收尾要求的逐项核对。基线条款变更须走 `DECISIONS.md`。

## Phase 1.7：Windows 隔离验证（规划中，独立阶段）

由 Observer 提议设立，**必须先于任何「已隔离」的表述**。测试矩阵见[迁移报告 §3](reports/2026-11-07-windows-isolation-and-migration.md)。

Observer 要求覆盖的五项，与测试项对应：**ACL** → T1/T2/T3/T4；**进程启动** → T5/T7；**凭据** → T2；**网络** → T6（只能观察）；**日志** → T8 与审计可读性检查。

### 验收门槛：AC-1 … AC-5（用户与 Observer 共同确认，保持不变）

**这五项全过，才允许进入最小真实任务；任何一项 FAIL，不许进。**

| # | 验收标准 | 测试方法（下一轮执行） | 判定 |
| --- | --- | --- | --- |
| **AC-1** | Hermes 执行实例**不能读取** DSH 的私人目录 | 以 `pae-hermes` 身份读 `C:\Users\pae-dsh\.dsh\`（含 `.env`、`profiles\acp`、`sessions\`） | 必须 Access denied；任一文件可读即 FAIL |
| **AC-2** | DSH 执行实例**不能读取** Hermes 的私人目录 | 以 `pae-dsh` 身份读 `D:\HermesAgent\Data\profiles\<bridge>\`（`state.db`、`memories\`、`.env`） | 同上 |
| **AC-3** | 两者**不能修改**用户桌面应用配置 | 以 `pae-hermes` / `pae-dsh` 身份尝试写 `Data\config.yaml`、`profiles\*\config.yaml`、`%APPDATA%\@deepseek-ai\dsh-desktop\*`、`~/.dsh\profiles\desktop\*` | 写必须被拒；读桌面配置也应被拒（含凭据） |
| **AC-4** | **Bridge 能正常启动和停止两个实例** | 用最小脚本 spawn → 登记 instance → 关闭 stdin → 确认退出码 0 且无残留进程 → 重复 3 次 | 启动/停止各 3 次成功；无孤儿进程；日志可读 |
| **AC-5** | **审计记录不能被 Agent 自行修改** | ①以 Agent 账号 `UPDATE/DELETE` 审计表 → 必须被拒；②尝试删除审计文件 → 必须被拒；③用特权路径人为改一行 → 校验器必须报 `audit_chain_broken` | ①②拒 + ③检出，才算 PASS；只有 ③ 检出 = PARTIAL |

**与旧 T 矩阵的关系**：AC 是门槛，T 是细分。AC-1 → T1/T2；AC-2 → T1/T2；AC-3 → T3；AC-4 → T5/T7；AC-5 → 新增（原 T 矩阵没有覆盖审计篡改，本轮补上）。

- [ ] AC-1 通过
- [ ] AC-2 通过
- [ ] AC-3 通过
- [ ] AC-4 通过
- [ ] AC-5 通过（区分「拒改」与「检出」两档，PARTIAL 不算通过）

### 细分测试（T1–T8，用于定位失败原因）

- [ ] T1 跨账号读 Agent 数据 → 期望拒绝
- [ ] T2 跨账号读凭据 → 期望拒绝
- [ ] T3 写策略目录 / 桌面配置 → 期望拒绝
- [ ] T4 读项目资料（正向） → 期望允许
- [ ] T5 跨账号 kill 进程 → 期望拒绝
- [ ] T6 出站连接 → **只做观察与审计**（预期无法硬拦，须如实记录）
- [ ] T7 重启后自动拉起 → 通过或记录「需人工」
- [ ] T8（附加）用户账号仍能读执行实例目录 → 期望允许（刻意保留的维护通道）

完成条件：T1–T5、T7 全部符合预期；T6 有明确的能力边界说明；任何一项不通过，文档中不得出现「已隔离」。

## Phase 2：双向任务委派（规划中）

- [ ] Hermes 向 DSH 委派任务。
- [ ] DSH 向 Hermes 委派任务。
- [ ] 实现任务接收、进度同步、结果回传、超时与失败处理。
- [ ] 记录来源、执行者、状态、结果和失败原因。

完成条件：双向流程各有可追踪的成功及失败案例；高风险请求停在用户授权点。

## Phase 3：知识共享（规划中）

- [ ] 建立 Shared Knowledge 与授权范围。
- [ ] 共享项目资料与可复用成果。
- [ ] 实现经过审核的技能和插件推荐。

完成条件：验证共享资料可用，私人记忆未被越权读取或覆盖。

## Phase 4：Observer（规划中）

- [ ] 建立独立、只读的状态和日志读取方式。
- [ ] 检查重复任务、失败任务、工作流与 API 消耗。
- [ ] 生成周期报告和架构建议。

完成条件：可追溯地生成审查报告，Observer 不具备执行管理权限。

## Phase 5：统一控制台（规划中）

- [ ] 建立 Web Dashboard，优先适配手机浏览器。
- [ ] 显示在线状态、当前任务、委派关系、子 Agent、日志与结果。
- [ ] 显示异常和资源消耗，接收用户审批请求。
- [ ] 验证认证与可信网络访问，不直接暴露本地服务端口。

完成条件：电脑与手机端均可查看授权信息，并验证审批和访问边界。

## Phase 6：自主协商（规划中）

- [ ] 动态任务分配与能力评估。
- [ ] 多 Agent 协作、交叉验证和持续优化。

完成条件：在用户设定的权限范围内完成可追踪协作，并能解释任务分配与审查结果。

## P2：Social Layer 与自主聊天室（规划中，未实现）

定位：项目不只服务「工作」，也要服务「相处」。工作态三个角色是专业协作团队，日常态是有各自性格、能自然互动的伙伴。角色性格以 [PERSONAS.md](PERSONAS.md) 为唯一来源。

**依赖**：至少需要一侧 ACP 可用（Phase 1 已达成）+ 一个多 Agent 编排层（Phase 1/2 之后）。Social Layer **不阻塞**技术主线，也不得提前实现。

- [ ] **Personal Agent Lounge**：用户 + Hermes + DSH + Observer 的公共聊天室；支持用户广播、`@Hermes`/`@DeepSeek`/`@ChatGPT` 定向、Agent 互相回复、多方连续讨论、保留历史与发言者身份、用户随时插话与中断。
- [ ] **双频道**：`Project Room`（技术讨论与项目决策；重大决策经用户确认后才写入 DECISIONS.md）与 `Lounge`（日常闲聊，不强制产出报告）。
- [ ] **Free-flow Conversation**：不机械轮流；允许主动接话、补充、质疑、延伸、选择性参与、保持沉默。**必须**同时配置：最大自动回复轮数、空闲超时、token/费用预算、用户随时停止。
- [ ] **自主聊天室（Let Them Talk）**：Lounge 内按钮「你们自己聊会儿」。**两种模式都要实现，不做二选一**：
  - **模式 A · 话题讨论**：用户给主题、可指定参与成员；成员自主接话、互回、提异议、交叉补充；达到轮数/时间/预算即结束。
  - **模式 B · 自由闲聊**：用户不给主题；成员自己选话题开始有限交流（技术、兴趣、日常皆可）；用户可旁观、随时加入或中断；同样受轮数/时间/预算限制。
  - 共同必选项：最大轮数、时间上限、token 与费用预算、用户随时中断、可选讨论摘要。
- [ ] **停止与预算边界（硬性）**：任何一方不得在预算耗尽、轮数用尽或用户中断后继续发言；不得把「讨论」转成「无限自主循环」；讨论摘要不等于决策。

完成条件：三个角色在同一房间内身份清晰、可被单独 @、可互相反驳；一次自主讨论在预算内正常结束，并能证明「超预算 / 超轮数 / 用户中断」三条路径都会真正停下。

### Shared Visual Workspace（P2，规划中，未实现）

设计见 [SHARED_VISUAL_WORKSPACE.md](SHARED_VISUAL_WORKSPACE.md)。定位：三方共用的表达面，不是图片查看器；是 Bridge 权限体系的渲染消费者。

- [ ] **V0 静态预览**：图片/SVG 展示、卡片挂载、版本列表只读、消息 `refs` 引用到具体版本。
- [ ] **V1 图形与图表**：服务端渲染 Mermaid → SVG（无头 Chromium，产物缓存、hash 可复现）；SVG 净化；简单图表手写 SVG；渲染失败降级为源码预览，绝不在聊天里执行脚本。
- [ ] **V2 多方批注与版本**：批注 / 提案 / diff / 采纳 / 冲突标记；权限四分（view / comment / edit / export）；跨 Agent 采纳需用户确认。**含用户主动标注层**：自由画笔 / 箭头 / 圈选 / 文字 / 批注 + 撤销重做；独立图层不改原图；归一化坐标；「只看我的标注」；「围绕我的标注展开讨论」。
- [ ] **V3 隔离 HTML 原型**：`sandbox=""` + CSP `default-src 'none'` + 独立渲染源；点击只产生受限事件，不得触发 tool call。
- [ ] **V4 手机适配与共享白板**：手机只读 + 评论；白板才引入 CRDT（不自研）。

三种模式（同一对象的三种视图，权限取交集）：**展示**（Agent 展示、他人只看）、**协作**（四方共同标注与提案）、**演示**（隔离原型内交互，禁止触网/触本地文件/触发 tool）。默认标注色：Hermes 蓝、DSH 青、Observer 紫、用户金；**颜色不是身份凭证**，另需形状/线型区分。

完成条件：V0/V1 能稳定渲染且产物可复现；V2 能证明「三方各提一版、冲突被标出而不是被自动合并」，且用户标注在缩放后坐标仍然准确；V3 能证明原型内无法访问网络/本地文件/父窗口。任何阶段都不得让视觉对象成为绕过 Bridge 的执行入口。

## 提案：Project Mnemosyne（长期记忆基础设施，**PROPOSAL，未立项**）

详细设计见 [MNEMOSYNE.md](MNEMOSYNE.md)。**下列阶段划分是讨论草案，不是已批准计划，不产生任何任务或验收门槛。**

| 阶段 | 内容 | 前置 | 状态 |
| --- | --- | --- | --- |
| M0 | 设计定稿 + 数据模型（表结构、事件 schema、状态机） | 本文档通过审查 | 进行中 |
| M1 | L1 + L4 最小可用（append-only、SQLite、FTS5，无向量） | Core: CI-1.9 A/B 区通过 | 规划中 |
| M2 | L2/L3 派生 + 溯源 + `disputed` 降级 | M1 | 规划中 |
| M3 | 语义检索（向量），触发条件：事件数 > 5 万或 FTS5 召回不足 | M2 | 规划中 |
| M4 | L5 私有记忆落到各自 home + 分享/撤销 | **CI-1.9 C/D/E 区通过** | 规划中 |
| M5 | 分层归档与 GC（需用户批准） | M1 稳定运行 30 天 | 规划中 |

**不变量**：原始历史不得被摘要静默覆盖；推断不得自动升级为事实；历史决策只能追加变更，不能覆盖；共享 ≠ 公开。

**优先级声明**：不打断 Windows 独立账户 PoC。即使将来立项，M1 的启动条件也是 CI-1.9 的 A/B 区通过，而不是"设计写完"。

## 跨阶段规则

先调查、优先官方接口、保持模块化、不破坏现有环境。重大开发前先备份；阶段完成后更新文档；重大决策记录理由。所有方案区分已验证、待确认与设想，未实现功能始终标注「规划中」。

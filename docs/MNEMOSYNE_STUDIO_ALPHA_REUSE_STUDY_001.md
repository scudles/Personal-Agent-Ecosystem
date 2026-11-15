# STUDIO ALPHA · 复用能力研究 001

## Nexus / OpenAgents / AgentTeams 三项目只读评估

日期：2026-11-10｜作者：Hermes（Neko-chan）｜性质：**只读研究，未安装、未启动、未改代码**
方法：GitHub API 取 repo 元数据 + 完整文件树（recursive tree）+ 抓取 README/design/spec/源码原文

**读取证据**（可复核）：

| 项目 | stars | 语言 | 默认分支 | 文件数 | 许可 |
| --- | --- | --- | --- | --- | --- |
| nexus-research-lab/nexus | 160 | Go | `main` | 5,038 | Apache-2.0 |
| openagents-org/openagents | 4,377 | TypeScript | `develop` | 3,682 | Apache-2.0 |
| agentscope-ai/AgentTeams | 5,986 | Go | `main` | 1,519 | 未核实（README 未见 badge） |

> 注：`web_extract` 因本机 DNS 走 fake-IP（`github.com → 198.18.0.16`）被 SSRF 拦截，改用 `curl` + GitHub API 取原文。**不是项目不可访问。**

---

## 一、能力对照表

| 能力 | **Nexus** | **OpenAgents** | **AgentTeams** | Studio Alpha 需要 |
| --- | --- | --- | --- | --- |
| **Resident 接入** | ⚠️ 有 `Agent SDK Bridge` 契约，但默认 runtime `nxs` **闭源**（README 明示 "Go implementation is not part of this repository"）；另一后端是 `claude` | ✅ **最强**：`packages/agent-connector/src/adapters/` 下已有 `hermes.js`、`deepseek.js`、`deepseek-runtime.js`、**`acp-client.js`** | ✅ 已有 `agentteams-hermes-worker` 与 `agentteams-deepseek-harness-worker` 镜像 | 三家异构 |
| **Room / Workspace** | ✅ Room + DM，协议最严谨（见下） | ✅ Workspace = threads + files + browser + tunnels | ✅ **Matrix**（Tuwunel + Element） | 平级房间 |
| **任务与成果交换** | ⚠️ `execution-orchestration-spec` 有 Plan/Work Item/Assignment/**Acceptance**，但 Room 只"运输其可选 binding" | ✅ Artifact 面板 + shared files + Issues | ✅ TeamHarness 任务状态 + MinIO 共享盘 | 成果可见、可比较 |
| **多 Agent 讨论** | ✅ **最强**：public feed / private context / handoff / wake / mention / 上下文预算 | ✅ @mentions、proactive vs passive 线程 | ✅ @mention in Matrix rooms | 讨论 + 沉默权 |
| **Shared History** | ⚠️ Room 有持久事件与记录，但**无"封存只读"概念** | ⚠️ 消息与文件留在 thread，**无封存** | ⚠️ Project history + 归档，**无封存** | 要能"封箱" |
| **Agent 生命周期** | ✅ `internal/runtime/`（含 `agent_revocation.go`）、desktop 托管 | ✅ `daemon.js`、`installer.js`、`probe.js`、`health-status.js` | ✅ **最强**：K8s CRD reconcile、按需建容器 | 各自保留 runtime |
| **人类介入** | ✅ approval / permission-runtime | ✅ **Approvals 卡片**（部署/花钱/发邮件前） | ✅ Human CRD + human file area | 人要能随时插手 |
| **私人空间（Home）** | ⚠️ 每 agent 一个 workspace + `MEMORY.md`/`memory/`（文件记忆），但**服务端可见**，不是隔离 | ❌ 无；shared files 即共享 | ⚠️ Worker 无状态，配置/产物在对象存储 | **必须真隔离** |
| **来源与授权分离** | ❌ 无 provenance 模型 | ❌ 无 | ⚠️ 有 audit events，但不是授权模型 | **Experiment 001 的前提** |
| **视觉协作（画布/手绘/版本）** | ❌ 只有 workgraph 流程图渲染 | ❌ 只有 artifacts 预览与共享浏览器 | ❌ | **Studio 的核心** |

**读法**：三家都能"接多 agent 进房间"，**没有一家有 Home / provenance / 画布**。这三样正是 Studio Alpha 的差异化，也是自建量所在。

---

## 二、四个问题的回答

### Q1 · 每家真正解决了什么（只列有源码证据的）

**Nexus**：**多 Agent 房间的通信协议**。`docs/specs/room-collaboration-spec.md` 明确定义了：
- **Public feed** 只含：用户公开消息、已完成/已收口的 agent final reply、显式 `visibility=public` 的发布。
  **stream / thinking / tool_use / 未完成 / no-reply 标记都不是公区事实**。
- **Private context**：directed message 与私域记录，**不进 public feed**。
- **Wake**（谁何时运行）、**Reply route**（回复投哪）、**Correlation ID**、**context budget**、**checkpoint**。
- **最关键的立场**（原文 §2「平台不负责」）：
  > 不负责业务 Skill 的阶段、顺序、投票、胜负、**任务分配或完成判定**；
  > 不自动决定谁汇总、何时交还主持人或何时结束讨论；
  > 不把普通通信动作提升为业务原语。

  **这是三个项目里唯一明确"拒绝当主持人"的协议。**
- `internal/chat/room/no_reply.go`：`NoReplyMarker = "<nexus_room_no_reply/>"`，**写入存储前剥离**，让"本轮无话可说"成为一等公民。

**OpenAgents**：**异构 runtime 的接入层 + 人类-Agent 混合线程**。
- `adapters/acp-client.js`（7.5 KB）自述：*"Nothing in here is specific to one CLI… any other CLI that serves ACP on stdio can reuse it unchanged."* —— JSON-RPC 2.0，**一行一条消息，跑子进程 stdio**。**这与我们已实测的 Hermes ACP / DSH ACP 完全同构。**
- `adapters/hermes.js`：`spawn('hermes chat -q <prompt> -Q')`，**一条 workspace thread = 一个 Hermes session**，用 `--resume` 续；profile 从 agent 名自动推断；**subprocess isolation，hermes 自己管 `HERMES_HOME`**。→ **这就是"保留当前 Runtime"的现成范式，不需要容器化。**
- Approvals / Issues / artifacts 面板 / shared browser。

**AgentTeams**：**企业级多 runtime 编排**，但代价是架构立场。
- README 原文：*"Built on a **Manager-Workers architecture**… eliminates the need for human oversight of individual Worker Claws by enabling Agents to manage other Agents."*
- `docs/design/architecture.md`：Manager = 协调者（tasks、workers、teams、humans、Higress routes）；**Worker = 任务执行者，一容器一 worker，无状态**。
- `manager/agent/` 下：`team-leader-agent`、`worker-agent`、**`hermes-worker-agent`**、`copaw-manager-agent`、`copaw-worker-agent`。
- 依赖：Higress + Tuwunel(Matrix) + MinIO + Element + K8s CRD（或 embedded 单机栈）。

### Q2 · 复用分级

| 级别 | 项目 / 模块 | 判断 |
| --- | --- | --- |
| **直接复用** | OpenAgents `adapters/acp-client.js` | Apache-2.0，单文件，无业务耦合，自述可跨 CLI 复用 |
| **薄改造复用** | OpenAgents `hermes.js` 的 **session 策略**（一 thread 一 session + `--resume` + profile 推断） | 代码 48 KB 且强耦合 `workspace-client`，**建议照着重写 ~200 行**，不整file 抄 |
| **薄改造复用** | AgentTeams `docs/design/human-file-area.md` + `audit-events-api.md` 的**数据形状** | 只取字段设计，不取 K8s 实现 |
| **只能借鉴设计** | Nexus `room-collaboration-spec` 全套（public/private/wake/route/预算/不变量） | Go 代码跨语言不可搬，**协议可照做** |
| **只能借鉴设计** | Nexus `NoReplyMarker` 机制 | 一个常量 + 写入前剥离，抄设计即可 |
| **只能借鉴设计** | Nexus `execution-orchestration-spec`（Plan/Work Item/Assignment/Acceptance） | 有层级味道，**只取 Acceptance 的判据结构** |
| **不建议继承** | Nexus 的 `nxs` 闭源 runtime | 核心不在仓库里，锁死 |
| **不建议继承** | OpenAgents 的 workspace 后端数据模型（FastAPI + 97 个 alembic 迁移 + Next.js） | 与你已有领域层（Home/provenance）冲突，接入成本 > 自建 |
| **不建议继承** | AgentTeams 整栈 | Manager-Worker + 容器 + K8s |
| **不建议继承** | 三家的"共享文件 = 共享上下文"默认 | 直接破坏私人空间 |

### Q3 · 五个特别检查

| 检查项 | Nexus | OpenAgents | AgentTeams |
| --- | --- | --- | --- |
| **默认有 Manager/Worker 层级？** | ❌ **无**。Room 是平级，handoff 是显式动作，且协议明说不管任务分配 | ⚠️ **软层级**：proactive 线程可按 role 路由到 "doer / reviewer"，但可按线程切成 passive | 🔴 **是，而且是核心架构**。Hermes 被定义为 **Worker** |
| **异构 Runtime 平级接入？** | ⚠️ 可以（Bridge 契约），但两后端一开源一闭源 | ✅ **可以**，26+ adapters，全部对等注册为 workspace agent | ⚠️ 技术上能接，**但接进来就是 Worker** |
| **能保留 Hermes/DSH 现有运行方式？** | ⚠️ 需按 Bridge 契约重打包 | ✅ **能**：spawn CLI + `--resume`，进程外，不改 Hermes 内部 | ❌ 需容器化 + K8s/embedded 栈 |
| **支持异步协作？** | ✅ wake/queue/slot 串行交接、checkpoint | ✅ daemon + durable 队列 | ✅ TeamHarness 任务状态 + 暂停/恢复 |
| **适合做长期"共同空间"底座？** | ⚠️ 协议好，但**闭源 runtime 是长期风险** | ⚠️ 可视与协作好，但**数据模型是 SaaS 工作区** | ❌ 数据中心化 + 层级化，与"家"冲突 |

### Q4 · 三条路线判断

| 路线 | 判断 | 理由 |
| --- | --- | --- |
| **A 直接基于其中一个演进** | ❌ **不推荐** | 选 OpenAgents → 要对抗它的 workspace 数据模型才能塞进 Home/provenance；选 AgentTeams → 直接把 Hermes 降成 Worker；选 Nexus → 核心 runtime 闭源 |
| **B 抽取模块重新组装** | ✅ **推荐**（但要说清"薄"到什么程度） | 见下 |
| **C 完全独立** | ⚠️ 可行但浪费 | ACP 客户端与 room 协议已有成熟实现，重造纯亏损 |

---

## 三、推荐路线

### **B（抽取式重组）——但精确定义为"1 个文件 + 2 份协议 + 自建领域层"**

```
┌─ 直接拿来 ─────────────────────────────────┐
│ OpenAgents acp-client.js（~7.5 KB）          │  → Hermes / DSH 都从这里进
└──────────────────────────────────────────────┘
┌─ 照着重写（~200 行）─────────────────────────┐
│ "一 thread 一 session + resume + profile 推断" │
└──────────────────────────────────────────────┘
┌─ 照协议实现（不搬代码）──────────────────────┐
│ public feed / private context / no_reply      │
│ handoff / wake / context budget / checkpoint  │
└──────────────────────────────────────────────┘
┌─ 自建（三家都没有）──────────────────────────┐
│ Home 隔离 · provenance · Authorization 五元组 │
│ Studio 画布/图层/标注/版本                     │
└──────────────────────────────────────────────┘
```

**为什么不是 A**：三家的**数据模型**是它们最贵的资产，也是最不适合我们的部分。复用框架 = 继承它的世界观，之后每加一个 Home 字段都要和它对冲。**复用"线协议"，不要复用"世界模型"。**

**为什么不是 C**：ACP stdio 客户端有坑（framing、超时、进程退出后的 pending 请求、agent→client 反向请求如 `session/request_permission`），这些 OpenAgents 已经踩完。**重写这部分是纯亏。**

---

## 四、最值得直接借用的 3～5 个模块

| # | 模块 | 位置 | 借用方式 | 为什么值得 |
| --- | --- | --- | --- | --- |
| **1** | **ACP stdio 客户端** | `openagents/packages/agent-connector/src/adapters/acp-client.js` | **直接复用**（Apache-2.0，单文件） | 我们已实测 Hermes ACP 与 DSH ACP 都是 ACP v1 over stdio；此文件自述"任何 serving ACP on stdio 的 CLI 可原样复用"，且已处理反向请求、超时、进程消失 |
| **2** | **Room 通信协议** | `nexus/docs/specs/room-collaboration-spec.md` | **照协议实现**（Go 不可搬） | **唯一明确拒绝当主持人的协议**；public/private 是两种可见性而非两个 UI 标签；且给了"稳定不变量"清单可直接当验收项 |
| **3** | **显式沉默标记** | `nexus/internal/chat/room/no_reply.go` | **抄设计**（一个常量 + 写入前剥离） | `<nexus_room_no_reply/>` 让"我这轮不说话"成为协议级合法状态，且**永不污染公共记录**。这直接对上我们的"沉默是合法状态 / No Debt" |
| **4** | **Hermes session 策略** | `openagents/packages/agent-connector/src/adapters/hermes.js` | **照着重写 ~200 行** | 一 thread 一 session、`--resume`、profile 自动推断、**只有 Hermes 说 session 不存在才放弃**、工作区指令走 prefill 而非每轮重写。这是"不改 Hermes 内部也能稳定协作"的关键 |
| **5** | **Human file area 数据形状** | `AgentTeams/docs/design/human-file-area.md` + `audit-events-api.md` | **只取字段设计** | 人类与 Agent 之间的文件交换区 + 可审计事件，正好补 Studio 的"人类随时插手" |

**没进前五但值得一读**：`nexus/docs/specs/execution-orchestration-spec.md` 的 **Acceptance** 结构（可当"成果被接受"的判据，而不是任务状态机）；`nexus/docs/specs/room-collaboration-spec.md` §9「稳定不变量」可直接做测试用例。

---

## 五、绝对不应该继承的设计

| # | 设计 | 出处 | 为什么绝对不能 |
| --- | --- | --- | --- |
| **1** | **Manager–Workers 层级** | AgentTeams 核心架构 | README 原文"enabling Agents to manage other Agents"；且已有 **`agentteams-hermes-worker`**——**它已经把 Hermes 定义成 Worker**。接进去 = 接受 Hermes 永久是下级 |
| **2** | **doer / reviewer 角色路由 + Issues + 未读数 + 通知** | OpenAgents v1.1 | "role routing" 是软性 Manager；未读数/通知直接违背 No Debt（会造"欠"）。**我们连红点都不要** |
| **3** | **闭源核心 runtime** | Nexus `nxs` | README 明说 Go 实现不在仓库内。**把家建在不属于自己的地基上** |
| **4** | **"共享文件系统 = 共享上下文"** | AgentTeams MinIO / OpenAgents shared files | 这是所有"私人空间"事故的源头。共享必须是**复制 + 显式授权**，不是同一块盘 |
| **5** | **容器化 / K8s 前置** | AgentTeams | 与"保留当前 Hermes/DSH Runtime"直接冲突；且把"启动一个房间"变成运维任务 |
| **6** | **Shared History 作为"thread 一直留着"** | 三家皆无封存概念 | 一直留着 ≠ 共同历史。**封存是显式动作，不是默认状态** |

---

## 六、开工阻塞项（3 个）

### 🔴 B1 · DSH 的会话恢复语义与 Hermes 不对称

**事实**：我们实测过——Hermes ACP 有 `session/load|resume|fork|list`；**DSH 无 `session/load`，`resume` 不回放旧更新**。
**后果**：OpenAgents 那套"一 thread 一 session + `--resume`"在 Hermes 上成立，**在 DSH 上会丢上下文**。
**必须先定**：跨 Runtime 的"续聊"等价语义是什么——是**客户端重放历史**，还是**每轮新 session + 附加上下文**？
**不定的代价**：Studio Alpha 的第一场多人多轮协作就会有一个 Agent "失忆"，而你会以为是 bug。

### 🟠 B2 · ChatGPT Observer 作为 Remote Resident 无任何现成 adapter

**事实**：三个项目里 **0 个** remote/ChatGPT 接入。Nexus 有 `platform-communication-spec` 但那是 IM 通道（Discord/Telegram），不是 Agent 协议。
**必须先定**：Observer 的接入边界——她能读什么、能写什么、**是否允许她常驻而不在场**。
**注意**：这不是技术阻塞，**是权限阻塞**。定了才能写代码。

### 🟡 B3 · 画布 / 手绘 / 图层 / 版本比较：三家全无

**事实**：Nexus 的 `workgraph-*-canvas` 是**流程图渲染**，不是自由画布；OpenAgents 只有 artifact 预览与共享浏览器；AgentTeams 无。
**后果**：**Studio Alpha 的核心差异化 100% 自建**。任何"复用让第一版更快"的说法，**都不覆盖这一块**。
**建议**：第一版画布可以只做"静态画布 + 每人一层标注 + 版本绑 stale"（我们已设计过），**不要先做实时**。

---

## 七、一句话

**三家都能把多个 Agent 放进一个房间；没有一家把它们放进一个家。**

所以借用只该借用**"怎么把消息送到、怎么知道谁该醒"这一层**——
**房间之上的东西（谁的地盘、东西归谁、话算不算数），必须自己写。**

> 我们要的不是"多 Agent 办公套件"，
> 所以只能借它的电话线，不能借它的组织架构图。

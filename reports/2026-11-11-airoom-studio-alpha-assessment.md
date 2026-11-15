# AIROOM 作为 Mnemosyne Studio Alpha 基础的工程评估

- 评估对象：`D:\Personal Agent Ecosystem\AIROOM`（已安装的 Electron 应用，不是 git 仓库）
- 评估日期：2026-11-11
- 评估范围：本地安装包内的 `resources/app/dist`（`main.mjs`、`worker.mjs`、renderer bundle），以及从 `worker.mjs` 中按 `// src/...` 注释拆出的后端模块
- 方法：只读。未安装依赖、未启动 AIROOM、未修改任何配置。所有"源码确认"均指在本地 bundle 中读到对应实现；"推断"与"待运行验证"单独标注

---

## 0. 结论

**AIROOM 是一个完成度很高的"多 Agent 工作台"，不是"一个地方"。**

它可以作为 Studio Alpha 的**执行底座与房间模型参考**，但不能直接作为 Studio 本身。分开说：

| 问题 | 判断 |
|---|---|
| 能不能直接拿 AIROOM 当 Studio Alpha？ | **不能。** 它没有画布、没有视觉对象模型、没有版本绑定的标注层；它的主路径是项目流程，不是自由生活 |
| 能不能复用它的房间、会话、执行、恢复？ | **能，而且这部分做得比预期扎实**；但要以"模式"而不是"产品"的方式复用 |
| 文件容量限制是不是配置问题？ | **不是。** 是"每次写任务复制整个工作区"的架构选择，三道上限全部硬编码 |
| 工作流是不是不可拆？ | **可拆。** 房间、圆桌、项目流程是三层；流程是可选层，只是被做成了默认入口 |
| 能不能保留 Hermes / DSH 原生运行？ | **能。** ACP adapter 是通用外部程序桥；DSH adapter 是深度原生接入，连策略插件都注入了 |
| 视觉协作能不能在现有架构上扩展？ | **不能"扩展"，只能"新建"。** 后端没有任何 canvas/SVG/annotation/pointer 代码 |

**一句话**：AIROOM 给了你房间、成员、执行、审批、恢复；它没有给你画布，也没有给你"不进入流程"的自由。前者要新建，后者要拆。

**建议**：不要 fork。把 ACP adapter、进程守护、runtime pool、workspace checkpoint、backup/restore 当作"模式"移植到一个薄的 Studio 服务里；画布和对象版本自己写。理由在 §8。

---

## 1. 基线：我研究的是哪一份代码

`AIROOM` 不是 git 仓库，因此没有 `git status` 可记录。可核对的基线是构建清单与逐文件 SHA256：

| 项 | 值 |
|---|---|
| 应用版本 | `44.5.1`（`AIROOM/version`） |
| 安装包 package.json | `name: airoom`，`version: 0.1.0`，`private: true`，`main: dist/main.mjs`，`type: module` |
| 构建清单 | `resources/app/build-manifest.json`：`builtAt 2026-10-15T14:23:06.703Z`，`sourceCommit 6bafa14c955be02e6d53687002eae5dffe4005eb`，`sourceDirty false`，`deployment pending-installation`，156 packages，含逐文件 SHA256 |
| 关键产物 | `main.mjs` 230,167 B；`worker.mjs` 1,737,314 B；renderer `index-BmUGfiK6.js` 751,650 B；`backup.mjs` 33,759 B；`dsh-account-plugin.mjs` 5,735 B；无 source map |
| 依赖 | electron 44.5.1、react 19.3.0、react-dom 19.3.0、undici 8.11.2、lucide-react 1.51.0、7zip-bin 5.2.0、npm 12.1.0 |

**本地修改（重要）**：安装后有一次手工 hotfix。

- `main.mjs.bak-cwdfix` 与 `worker.mjs.bak-cwdfix` 的 SHA256 分别等于 manifest 里的 `3a3a345d...` / `ece69adb...`；
- 当前 `main.mjs` = `248db457...`，`worker.mjs` = `6024fb00...`；
- diff 只有一行：persona 后缀模板里的 `{{cwd}}` 改成了 `${cwd}`，让工作目录真正插值。

所以 `sourceDirty=false` 只代表**构建时**干净；运行中的代码比 manifest 多一行本地补丁。任何后续评估都应以"当前安装 + 这一行补丁"为基线，而不是以 `sourceCommit` 为基线。

---

## 2. 文件容量问题：根因与改造

### 2.1 三道上限（源码确认）

全部在 `src/backend/workspace.ts`（bundle 内偏移约 41,041 / 41,442 / 41,504；拆出文件第 5–7 行）：

| 常量 | 值 | 限制对象 | 触发时的用户可见文案 |
|---|---|---|---|
| `MAX_FILES` | `3e4`（30,000） | **条目数**（含目录） | 「工作区文件数量过多，请选择更小的项目目录。」 |
| `MAX_COPY_BYTES` | `1024*1024*1024`（1 GiB） | **累计复制字节** | 「工作区副本超出第一版的复制上限，请选择更小的代码目录。」 |
| `MAX_FILE_BYTES` | `128*1024*1024`（128 MiB） | **单文件** | 同上（复制路径）；还原点路径单独报「文件超过 128 MiB，无法保存本轮还原点。」 |

`workspace-checkpoint.ts` 里还有一套同样的常量（`MAX_FILES2` / `MAX_BYTES` / `MAX_FILE_BYTES2`），用于每轮还原点。两处都硬编码，没有设置项、没有环境变量、没有按项目覆盖。

另外两处相关限制，容易被误认为"容量问题"：

- `readArtifact()`（`workspace.ts:211`）最多读 `512 * 1024` 字节，超出部分截断并返回 `truncated: true`；它不是错误，但用文件查看器看大文件时只能看到前 512 KiB。
- `scan()` / `workspaceFingerprint()` 会对全量文件逐个读、逐个 sha256；大项目上这是**时间**问题，不是容量问题，但会放大"复制一次很慢"的体感。

### 2.2 触发路径：哪条路会撞上限

`executeRun()`（`run-execution.ts:2`）在每次 run 开始时：

1. 必须有 `projects` 记录（`host.require("projects", ctx.session.projectId)`）；
2. 写模式且没有现成 workspace 时，调用 `prepareWorkspace(project, session, true, dataDir)`；
3. 如果是 git 仓库且有 HEAD，先 `git worktree add --detach target HEAD`，然后 **`copyBaseline()` 把 tracked + untracked 再复制一遍**；
4. 非 git 目录则 `scan()` + 全量复制；
5. 复制完成后，`beginCheckpoint()` 再为这一轮建还原点（`workspace-checkpoint.ts`），同样受 30k/128MiB/1GiB 约束。

哪些路径会走复制、哪些不走（源码确认）：

| 路径 | 是否复制 | 依据 |
|---|---|---|
| 项目文件夹的普通写入任务 | **复制**（默认） | `run-execution.ts:12-32` + `prepareWorkspace(..., true, ...)` |
| 个人文件夹（成员工位）话题 | **不复制**，直接写 | `member-workspaces.ts:366-376`：`direct = view.key === personalFolderKey`，session 设 `workspaceKind:"original"` |
| 项目流程内部某些步骤 | **不复制** | `project-flow.ts:465/3778/3968/4009/4126` 设 `workspaceKind:"original"` |
| 只读会话 | 不复制 | `prepareWorkspace(..., false, ...)` 返回 `{directory: original, kind:"original"}` |

**所以用户遇到的限制，几乎可以确定是"项目文件夹 + 写入任务"这条默认路径。** 个人文件夹话题可以绕过，但那条路只对"自己的文件夹"开放，不是项目的通用选项。

### 2.3 为什么这是架构问题，不只是配置问题

三件事叠加：

1. **每次写任务复制整个工作区**，不是按需、不是增量；
2. **git worktree 已经 checkout 了一份完整工作树，却又 `copyBaseline()` 全量复制一遍**（`workspace.ts:170-181`）。对 clean repo 这是纯浪费；对 dirty repo，真正需要复制的只有 modified/untracked，但代码复制了全部 tracked；
3. **复制前后还要全量 sha256**（`copyBaseline` 每个文件读一遍算 hash，`workspaceFingerprint` 再读一遍），大项目上是 O(2N) I/O。

结果是：磁盘上每个任务副本 1 份，worktree 场景实际 2 份；30k 文件 / 1 GiB 的墙不是"安全阈值"，是"第一版先这么写"的占位。对 Mnemosyne 想支持的"长期项目 + 多成员 + 多轮任务"，这个模型会持续制造副本、持续扫描、持续撞墙。

### 2.4 改造方案（按代价从低到高）

**P0：把上限变成可配置，并去掉 worktree 的重复复制（约 1–3 天）**

- `MAX_FILES` / `MAX_COPY_BYTES` / `MAX_FILE_BYTES` 改为 settings（全局默认 + 项目覆盖），保留默认值；UI 显示"当前项目大小 / 上限"。
- `prepareWorkspace()` 的 worktree 分支：`git worktree add` 之后只复制 `git status --porcelain` 里的 modified/untracked/deleted 文件，不再 `copyBaseline` 全部 tracked。clean repo 的复制量降到 0，dirty repo 只复制脏文件。
- baseline 的 hash 可以复用 git blob hash（`git hash-object`）或延迟计算，避免复制后再全量读一遍。

这一步不改变"副本"模型，但能把大多数项目的触发概率和耗时降一个数量级。

**P1：给项目加"直接写 + 还原点"模式（约 1–2 周）**

- 把 `workspaceKind:"original"` 从"个人文件夹/流程内部步骤"扩展为项目级选项：用户在项目设置里选"直接在项目目录工作"，每轮 run 前只对**将要修改的文件**做内容寻址快照（现有 `workspace-checkpoint.ts` 已经具备这个能力），撤销时按 checkpoint 回滚。
- 风险与代价：并发写需要文件锁/租约；外部程序改动要检测；部分失败要能回滚；不能再假设"副本隔离"。这些是真实成本，但对大项目是唯一不撞 1 GiB 墙的路。

**P2：对象级版本（Studio 的正确模型，约 2–4 周）**

- 不再以"整个工作区"为版本单位，而是 `object_id@version` + 内容寻址 blob；文件只是对象的一种。这样复制、比较、标注、回滚都按对象走，容量上限变成存储上限，而不是"每次任务 1 GiB"。
- 这条与 Mnemosyne 的 `artifact@version`、标注 stale、共同历史是同一套模型，见 §6。

**不建议的最小改造**：只把 1 GiB 改成 10 GiB。它会让第一次能跑，但复制时间、磁盘占用、sha256 扫描都会线性上涨，只是把墙往后挪。

---

## 3. 工作流耦合：哪些是基础设施，哪些是强制流程

### 3.1 实际存在的五种空间

| 空间 | 实体/入口 | 性质 |
|---|---|---|
| 全局房间 | `global` room | 所有成员可见的聊天/讨论；`roomState.mode` 为 `chat` 或 `discuss` |
| 成员工位 | `personal_rooms`，id `desk:<memberId>` | 每个成员自己的文件夹 + 话题；个人文件夹话题直接写 |
| 项目房间 | `project:<projectId>` room | 每个项目一个房间；聊天、@成员、发起流程都在这里 |
| 圆桌 | `roundtable:<topicId>` room | 结构化多成员评审：材料、独立意见、审议、结论 |
| 项目流程 | `project_flows` + `flow_plans/rounds/tasks/submissions/reviews/integrations/acceptances` | 正式的"方案 → 轮次 → 任务 → 提交 → 评审 → 整合 → 验收"流水线 |

`room-discussion.ts` 的状态机是 `idle | talking | raising | awaiting-host | closing | summarizing | waiting_user | budget | paused | blocked`。`style === "chat"` 时允许 pass/react；会议模式禁止 pass 和空回复（`DiscussionFormatError`）。也就是说，**自由聊天和正式会议在同一个房间里，用 mode/style 区分**。

### 3.2 基础设施 vs 强制流程

| 层 | 内容 | 判断 |
|---|---|---|
| 基础设施 | `entities`/`events` 存储、room/thread/message、session/run、adapter（ACP/DSH/Claude/Codex）、进程守护、runtime pool、workspace 复制/还原点、backup/restore、artifact 读取、presence/attention | **值得复用**；与"生活"不冲突 |
| 可选仪式 | `roundtable`（材料/意见/结论）、`discuss` 模式（host/举手/纪要/提案）、`flow` 的评审/整合/验收 | **可以保留，但不能是唯一入口** |
| 强制流程 | 项目流程的 `plan → rounds → tasks → submissions → reviews → integration → acceptance`；任务的 owner/status/round 归属；验收作为关闭条件 | **需要拆**；它把"一起做点事"变成了"项目管理" |

关键证据：`projectFlow.start` 是显式调用（`engine.ts:291`），项目房间可以在没有 flow 的情况下存在；圆桌可以把结论"带回来"启动 flow 或准备任务（`engine.ts:289-323`）。**耦合不在数据模型，在 UI 主路径和默认叙事**：新建项目 → 开会 → 出方案 → 建任务 → 提交 → 评审 → 验收，这条链被做成了"正常用法"，其他用法看起来像旁路。

### 3.3 解耦方案

原则：**房间是主语，流程是谓语；流程可以被发起，也可以不被发起。**

1. **项目 = 文件夹 + 房间 + 成员**，不自动带 flow。`project` 记录只保留 `directory`、`name`、`members`，不把"是否有活跃 flow"当成项目状态。
2. **flow 绑定 thread，而不是绑定项目**。API 从 `projectFlow.start(projectId, ...)` 改成 `room.startFlow(threadId, template)`；flow 的产出回到那个 thread。一个项目可以同时有多个 thread，有的有 flow，有的没有。
3. **任务降级为消息级意图**。日常"帮我看一下这个"就是一条消息 + 一次 run；只有用户明确"把这件事立成任务"时才创建 `flow_tasks`。`flow_tasks` 不再是所有工作的容器。
4. **审批变成可选策略**。工具级审批（`approvals` + adapter 的 `request_permission`）保留；流程级的"提交→评审→验收"改成可选的"请谁看一眼"，不阻塞收尾。flow 可以有 `abandoned` 状态，放弃不需要理由。
5. **圆桌是桥，不是门**。圆桌结论可以"带回项目"（现有 `handoff`），也可以只是留在圆桌；不要求每个讨论都产出方案。
6. **纪要/报告是导出，不是自动记录**。`project-workbench.generate()` 生成 Markdown 很好，但应该是"要一份纪要吗"的按钮，而不是每个 flow 必写。

UI 上只暴露三个动词：**说一句**（chat）、**一起做**（ad-hoc run / 多成员）、**开一个项目**（flow）。不要让"新建项目"成为做任何事的唯一门。

---

## 4. Runtime 与 Adapter

### 4.1 ACP：通用的原生运行时桥

`adapters/acp.ts` 是一个真正的 ACP 客户端：

- `resolveAcpProgram()` 支持绝对路径、PATH 查找、npm 生成的 `.cmd` 启动脚本；拒绝 `.ps1/.vbs/.lnk`；
- `spawn` 外部程序，JSON-RPC over stdio；
- 处理 `session/update`（`agent_message_chunk`、`agent_thought_chunk`、`tool_call`、`plan`、`current_mode`）、`session/request_permission`（allow_once/always、reject）、`context_compacted`；
- `supportsRuntimeReuse = true`，`canReuse()` 检查子进程仍可写、未退出；
- `runtimeFingerprint(context)` 把程序文件、参数、环境一起纳入指纹；
- `home(env)` 给每个 executor 独立数据目录；
- 只读会话通过 `acpDenial()` 拒绝写/执行，按 `permissions.commands` / `permissions.network` 拒绝命令和联网。

**判断**：Hermes/DSH 只要有一个 ACP 入口（或一个薄 ACP shim），就能以原生方式接入，AIROOM 不需要理解它们的内部。这是最干净的一层。

### 4.2 DSH：深度原生接入，但带 AIROOM 的策略

`adapters/dsh.ts` 不是"调一个 CLI"那么简单：

- `dshSessionPolicy()` 把权限映射成 DSH 的 `sandboxMode`：`read-only | workspace-write | danger-full-access`；
- 生成并注入一个 DSH 插件 `AIROOM_GUARD_SOURCE`（`name: airoom-dsh-policy`，`inject: ['tools','agents']`），用 `ctx.tools.guard` 拦截：
  - `ask_user_question`、`present`、`exit_plan_mode`、`plugin_*`；
  - 只读时的 `write`/`edit`；
  - `commands: deny` 或无网络时的 `pwsh`/`bash`/`job_*`；
  - 无网络时的 `web_search`/`web_fetch`；
- `dshPathDenialImplementation` 做工作区路径、符号链接、设备路径校验；`dshReadRootImplementation` 允许额外的只读根；
- 监听 `turn/start`/`turn/end`，通过 stdout 发 `airoom/turnStart|turnEnd` JSON-RPC；
- `dshModelSelection` **只允许 `deepseek-account` provider**，不切换其他计费路径。

**判断**：这是"保留原生运行 + 加策略围栏"的范本，但围栏是 AIROOM 定制的。移植时应该保留"注入 policy plugin + turn 事件"的模式，重写规则集；不要继承"只允许 deepseek-account"这个约束，除非 Mnemosyne 也决定只用这一个账户。

### 4.3 进程与会话生命周期

- `process-supervisor.ts`：Windows 用 `scripts/windows-job.ps1` 的 Job Object 保护进程树；`spawnOwned()` 要求绝对可执行文件，拒绝 `.cmd/.bat/.ps1`；`stopOwned()` 先温和终止，超时 SIGKILL，再超时抛错；`disposeOwned()` 全部停止。
- `runtime-pool.ts`：`RoomRuntimePool`，最多 8 个会话，空闲 10 分钟回收；`runtimeFingerprint(ctx, files, extra)` 把 cwd、provider、member、purpose、write、conversation、room speech/files、autoApprove、permissions、model、effort、persona、network、dsh profile、环境变量、关键文件 stamp 全部纳入；`acquire/release/invalidate/closeAll/closeSession/reapIdle` 齐全。
- `run-execution.ts`：run 有 `maxRunMinutes` 超时、`autoApprove`、`RoomReplyWatchdog`；`ctx.conversation` 为 `desk` 或 `room` 时给不同的 briefing；`roomRuntimeReuse` 时走 pool。

**判断**：会话生命周期这块可以直接借鉴。尤其是"指纹不匹配就回收、busy 就拒绝、超时先 SIGTERM 再 SIGKILL"这些细节，是自己写很容易漏的。

### 4.4 能不能保留 Hermes/DSH 原生运行方式？

**能，但分两种：**

- **ACP 路径（推荐）**：Hermes/DSH 暴露 ACP 入口，AIROOM 只做 JSON-RPC 桥。保留原生进程、原生工具、原生权限模型；AIROOM 只加"房间上下文"和"回合事件"。
- **DSH 深度路径**：保留 DSH 原生 CLI，但注入 Mnemosyne 自己的策略插件，而不是 AIROOM 的。需要重写 `dshToolDeniedImplementation`、`dshPathDenialImplementation`、`readRoots`、provider 选择。

**代价**：DSH 的 `turn/start|turn/end` 事件协议、插件注入点、sandbox 枚举都是 DSH 版本相关的；升级 DSH 时要跟着改。这是"原生"的固有成本，不是 AIROOM 的错。

---

## 5. 数据与历史

### 5.1 SQLite：两张表，一个事件流

`store.ts` 用 `node:sqlite` 的 `DatabaseSync`，库在 `<dataDir>/airoom.sqlite`，WAL、`busy_timeout=5000`、`foreign_keys=ON`。核心只有两张表：

```sql
entities(entity TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(entity,id));
events(sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL,
       session_id TEXT NOT NULL, run_id TEXT NOT NULL, value TEXT NOT NULL);
```

所有实体（projects、sessions、runs、approvals、members、room_threads、room_messages、room_states、personal_rooms、roundtable_topics、desk_topics、settings、profile……）都是 JSON 塞进 `entities`；`put()` 前做 `redact()` 去敏感字段；事件同时批量写 `<dataDir>/logs/YYYY-MM-DD.jsonl`（250ms flush）。索引有 `entities_kind_order`、`events_session`、`events_run`、`room_thread_messages`、`room_speaking_runs`。

**可复用**：事件流 + JSON 实体的模式，做本地单机工作台足够；`recover(bootId)` 能把中断的 run/approval/collaboration 标成 interrupted，这个恢复语义很实用。

**需重新设计**：实体没有 schema/版本迁移；查询靠 `json_extract`；长期历史没有"对象版本"概念，只有事件序列。Mnemosyne 的"共同历史"需要不可变版本、来源链、撤回语义，这一层不能直接继承。

### 5.2 文件版本：工作区基线 + 还原点，不是对象版本

- `workspace.ts` 的 `.airoom/baseline.json` 记录源目录、每文件 hash、继承的 session/fingerprint；
- `workspace-checkpoint.ts` 每轮 run 前把工作区快照到 `<dataDir>/checkpoints/<identity(session.id)>/objects`，内容寻址，支持撤销；
- `applyWorkspace()` 写回时做冲突检查：同名不同内容、开始后被改、开始后被删，都会变成 conflict；临时文件 + rename；
- `diffWorkspace()` 用 baseline 或 `git diff HEAD`。

**判断**：这是"文件级 undo + 写回冲突检测"，不是"对象级版本"。对 Studio 的 `artifact@version` 来说，粒度太粗：它只能回答"这一轮工作区变了什么"，不能回答"这个矩形/这段文字/这张图在第 3 版长什么样"。

### 5.3 成员与人物配置

- `members`、`executors`、`providers` 是实体；executor 有 `catalogId`、`command`、`args`、`env`、`name`；
- `engine.memberProgram()`、`memberVersions()`、`memberOperation()`、`useMemberPath()`、`importPersona()` 管成员的运行程序、版本、路径和 persona 导入；
- flow 里还有 `memberConfigs`（`engine.ts:2912-2917`），把每个成员在本次流程里的配置快照下来。

**判断**：成员配置是"运行配置"，不是"身份"。它没有区分"模型/平台/宪法/记忆/历史/倾向"，也没有迁移/拒绝/断裂标记。Mnemosyne 的 Agent Residency 模型需要另一层。

### 5.4 备份与恢复：这块做得比预期好

`backup-restore.ts` 有完整的一套：

- `manifest` 逐文件 sha256 + 计数；
- `preview()` 校验文件哈希和数据库计数一致；
- `prepare()` 复制到 `.restore-previews/<token>`，再校验、`inspectDatabase`、`sanitizeRestoredDatabase`；
- `apply()` 要求先有 `before-restore` 备份，写 journal，逐项 move 到 rollback 目录，失败可回滚；Windows 用 `renameWithWindowsRetry`；
- `RestoreFailure` 区分"可重试"和"现场未核对"。

**判断**：这是可以直接借鉴的"本地灾难恢复"实现。局限：只在本地数据目录，没有异地、没有加密、没有托管人分离；备份是明文全量快照，托管人可读。对 Mnemosyne 的"恢复≠访问权"，这还不够，但骨架是对的。

---

## 6. 视觉协作：现状与扩展

### 6.1 现状：没有画布

对拆出的全部后端模块 grep `canvas|whiteboard|freehand|annotation|drawing|svg|pointer|stroke`，只有 2 处命中，且都是文件扩展名正则（`project-flow-supplements.ts:11`、`round-results.ts:77`）。renderer 里也 grep 不到 `getContext(` / `<canvas>`。

结论（源码确认）：

- 没有 SVG/Canvas 对象模型；
- 没有稳定视觉对象 ID（只有消息/实体 ID）；
- 没有独立标注图层；
- 没有版本绑定；
- 没有指针/笔迹协作；
- 没有 Observer 的结构化视觉通道。

renderer 是 React DOM 的聊天/表单/文件预览 UI，不是画布应用。**视觉协作只能新建，不能在 AIROOM 上"扩展"。**

### 6.2 如果要扩展，最小设计

不要试图把 AIROOM 的 room message 改造成画布对象。新建一层，复用它的运行/房间：

1. **`visual_objects`**：`id`（稳定 UUID）、`kind`（sticky/pen/shape/image）、`geometry`、`z`、`created_by`、`created_at`；
2. **`object_versions`**：`object_id`、`version`、`content_hash`、`author`、`created_at`、`derived_from`；append-only，不覆盖；
3. **`annotations`**：`id`、`target_object_id`、`target_version`、`author`、`geometry`（归一化坐标）、`text`、`status`（`current`/`stale`/`withdrawn`）；每人一层，别人没有写权限；对象出新版本时旧标注变 `stale`，不删不藏；
4. **渲染用 SVG**，不用 canvas：每个对象是 DOM 节点，有稳定 ID，便于命中测试、标注锚定、可访问性和导出；
5. **实时协作**：Alpha 可以"乐观锁 + 版本检查"（提交时 `if version == n`），不必上 CRDT；等需要同时画同一笔迹时再引入 Yjs，但 Yjs 的实时状态必须定期 checkpoint 成不可变版本，否则版本绑定不成立；
6. **Observer 参与**：只读 + 结构化写。给 Observer 的不是像素，而是 `list_objects` / `read_object@version` / `annotate(object_id, version, geometry, text)` 三个工具；它看不见别人的私人层，也不能改对象，只能加自己的标注。

### 6.3 AIROOM 能承接哪一段

- 房间/消息：可以承接"围绕这张图的讨论"；
- run/adapter：可以承接"让 Hermes 改这张图的第 3 版"（执行结果作为一个新 object_version 贴回）；
- 备份/恢复：可以承接画布数据的持久化；
- **不能承接**：画布本身、对象版本、标注层、视觉事件的房间广播。这些是新的。

---

## 7. 复用清单

| 模块 | 实现程度 | 判定 | 理由 |
|---|---|---|---|
| `adapters/acp.ts` | 已实现，alpha 级稳定 | **可复用（移植/参考）** | 通用 ACP JSON-RPC 桥，支持运行时复用、权限请求、工具事件；与产品耦合低 |
| `adapters/dsh.ts` 的 policy 注入 | 已实现 | **可复用模式，需重写规则** | 注入 DSH 插件 + turn 事件 + 路径校验，是"原生 + 围栏"的好范本；规则是 AIROOM 定制的 |
| `process-supervisor.ts` | 已实现 | **可复用** | Windows Job Object 进程树保护、绝对路径、优雅终止；约 100 行，价值高 |
| `runtime-pool.ts` | 已实现 | **可复用（改写指纹）** | 会话复用/回收/上限/空闲超时；指纹需换成 Mnemosyne 的权限/空间维度 |
| `run-execution.ts` 生命周期 | 已实现 | **可借鉴** | 超时、autoApprove、watchdog、briefing 分层；但"必须有 project"要拆 |
| `workspace.ts` 的复制/写回 | 已实现 | **只借鉴冲突检测** | 复制模型不适合 Studio；`applyWorkspace` 的 conflict 检查可参考 |
| `workspace-checkpoint.ts` | 已实现 | **可借鉴** | 内容寻址还原点 + 撤销；但仍是文件级，不是对象级 |
| `backup-restore.ts` | 已实现 | **可复用（本地场景）** | manifest/verify/preview/journal/rollback 齐全；缺异地/加密/托管分离 |
| `store.ts` 事件流 | 已实现 | **可借鉴** | 单机事件日志 + JSON 实体 + recover；长期历史需新模型 |
| `room-discussion.ts` 状态机 | 已实现 | **只借鉴** | 会议模式做得很细；但它是"会议协议"，不是"自由交流" |
| `roundtable.ts` | 已实现 | **只借鉴** | 结构化多成员评审；适合"正式评审"，不适合日常 |
| `project-flow.ts` | 已实现，255 KB | **不建议继承** | 方案/轮次/任务/提交/评审/整合/验收的完整流水线，管理色彩过重；拆解成本高于重写 |
| `member-workspaces.ts` 个人文件夹 | 已实现 | **可借鉴** | "自己的文件夹 + 直接写"最接近"家"；但仍是工位，不是家 |
| Electron/renderer 壳 | 已实现 | **不建议继承** | 无 source map、bundle 手工打补丁、UI 与流程强耦合；新 Studio 不必背这个壳 |
| 视觉协作 | **不存在** | **必须新建** | 无 canvas/SVG/annotation/pointer 任何代码 |

---

## 8. Studio Alpha 最小技术组合

**建议：不 fork AIROOM；借它的"手和脚"，自己长"眼睛和记忆"。**

最小组合（按优先级）：

| 层 | 选择 | 来源 |
|---|---|---|
| 运行时 | Node 22 + TypeScript | 与 AIROOM 同栈，ACP/DSH 生态可直接用 |
| 存储 | SQLite（WAL）或 Postgres | 复用 `store.ts` 的事件流思路，但建 `objects/object_versions/annotations/events/rooms/messages/runs` 明确 schema |
| Agent 执行 | ACP JSON-RPC over stdio + 进程守护 | 移植 `acp.ts` 的协议处理 + `process-supervisor.ts` 的 Job Object 逻辑 |
| 会话复用 | 指纹 + pool | 借鉴 `runtime-pool.ts`，指纹换成 `space/member/permissions/model/cwd` |
| 画布 | React + SVG（不用 canvas） | 新建；无限 pan/zoom、sticky/pen/image 三类对象即可 |
| 版本 | `object_versions` append-only + 内容寻址 blob | 新建；`artifact@version` 是核心 |
| 标注 | `annotations` 每人一层、绑 `object@version`、stale | 新建；这是 AIROOM/Freero/ZMem 都给不了的那块 |
| 恢复 | manifest + verify + journal + rollback | 借鉴 `backup-restore.ts`；先做本地，再做异地/加密 |
| 房间 | room/thread/message + 可选 meeting mode | 借鉴 `room-discussion.ts` 的状态机，但默认 chat，不默认 discuss |

**第一版不要做的**：flow 引擎、roundtable 完整流程、项目验收、自动纪要、CRDT 实时笔迹、跨空间权限继承、模型路由。

**为什么**：Studio Alpha 要验证的是"三个人能不能在同一个画布上待十分钟，并且事后能说清谁在第几版改了什么"。AIROOM 能给你前十分钟的"人/会话/执行"，给不了后十分钟的"对象/版本/标注"。把这两半接起来，比把 255 KB 的 flow 拆开更便宜。

---

## 9. 源码确认 / 推断 / 待运行验证

### 源码确认（在本地 bundle 中读到实现）

- 三道上限与错误文案；复制/worktree/checkpoint 路径；
- `workspaceKind:"original"` 的四处来源（个人文件夹、engine、joint-review、flow 内部步骤）；
- ACP adapter 的 spawn/JSON-RPC/permission/reuse；
- DSH adapter 的 policy plugin、路径校验、turn 事件、provider 限制；
- 进程守护的 Job Object、runtime pool 的 8/10min 和指纹字段；
- SQLite 两张表、WAL、`redact()`、JSONL 日志、`recover()`；
- backup/restore 的 manifest/verify/preview/journal/rollback；
- 无 canvas/SVG/annotation 代码。

### 推断（合理但未运行验证）

- 用户撞到的限制是"项目文件夹 + 写入任务的副本路径"，而不是 512 KiB 预览截断；
- 大项目上"worktree + 全量 copyBaseline"造成实际 2 份磁盘和 2 遍 sha256；
- flow 的 UI 主路径让"不建项目就无法做文件工作"成为事实上的约束；
- 个人文件夹的 direct 模式可以绕过容量限制，但不是项目级选项。

### 待运行验证（本轮不允许启动）

- 一个 1.2 GiB / 3.5 万文件的真实项目，建写入任务时的实际错误与耗时；
- worktree 分支下 `copyBaseline` 的磁盘增量（预期接近 2×）；
- 30k 文件时 `workspaceFingerprint` 的耗时（预期数十秒到分钟级）；
- 备份/恢复在 10 GiB 数据目录上的实际时间与失败回滚行为；
- DSH 升级后 policy plugin 注入点是否仍兼容。

---

## 10. 如果下周开始

1. **先写 200 行"对象版本 + 标注"竖切**：三类对象、`object_versions`、`annotations`、stale、导出 SVG。不要碰 flow，不要碰 AIROOM 的 store。
2. **并行移植两个小件**：`process-supervisor`（Job Object）和 `runtime-pool` 的指纹/回收逻辑；这两个是"跑起来"的地基。
3. **把 ACP 桥接跑通**：让 Hermes/DSH 以 ACP 程序接入，只做"发一条消息、收一条回复、显示工具调用"，不做权限继承。
4. **最后才决定要不要复用 AIROOM 的房间 UI**：如果复用，只复用 room/thread/message 的展示，不复用 flow 卡片和项目页。

**一句话收尾**：AIROOM 证明了"多 Agent 在同一个工作台里干活"是可行的，而且工程细节比大多数 demo 扎实；但它证明的是"工作台"，不是"家"。Studio Alpha 应该拿走它的手和脚，自己长眼睛。

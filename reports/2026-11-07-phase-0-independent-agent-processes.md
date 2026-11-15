# Phase 0 第三轮：独立 Agent 进程接入研究

日期：2026-11-07。依据：本机 Hermes 源码 `v0.22.7-dirty`、DSH 安装包 `0.2.1-rc.3` 的随包文档/组合配置，以及官方公开资料。没有安装、配置修改、独立进程启动、协议请求、测试任务或私人会话读取。

## 证据定义

- **已验证**：只读检查本机安装文件、源码标签、包清单或非敏感目录所得到的静态事实；不表示运行成功。
- **文档支持**：本机相应版本的随包/源码契约或官方文档明确描述的能力；未经本机执行验证。
- **推测**：根据架构和协议推导的实施可能性，不作为完成证据。
- **待验证**：必须在未来获得相应授权后通过独立进程或协议实测的结果。

## 六个研究问题

### 1. Hermes 是否支持官方独立实例

**文档支持**：Hermes 提供 headless `hermes serve`、Gateway JSON-RPC、ACP、HTTP API 和多 profile。profile 各有配置、记忆、会话与 Skills。`gateway` 可托管本机任务。[官方集成说明](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/programmatic-integration.md)、[Profiles](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/profiles.md)。

**关键限制**：本机 v0.22.7 源码的 `website/docs/user-guide/multi-profile-gateways.md` 后段明确说普通新 profile 默认由同一 Gateway 多路复用，且普通命名 profile 的单独 `gateway start/run/install` 可被拒绝；`gateway.standalone` 是临时兼容路径。独立 `HERMES_HOME`（在现有 home 的 `profiles/` 之外）及明确 Gateway 进程边界是值得评估的候选，不能仅用“新建 profile”宣称独立进程。[官方多 Gateway 文档](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/multi-profile-gateways.md)。该文档开头仍有较旧的“每 profile 一个进程”示例，与后面的“默认多路复用/不再默认创建 per-profile Gateway”相冲突；本报告采用后面的明确限制，并把实际版本行为列为**待验证**。

**已验证**：本机源码标签为 `v0.22.7-dirty`，说明源码有未提交改动；运行中 Backend 的准确版本仍未确认。**待验证**：专属 home 下官方 headless 启动、端口冲突处理、Gateway 身份与停止语义。

### 2. Hermes 独立实例能否复用模型、工具和 Skills

**文档支持**：`profile create --clone` 可复制 `config.yaml`、`.env`、`SOUL.md`、Skills、插件及部分记忆；会话、状态库和 cron 不在普通克隆范围。各 profile 独立加载其模型设置、工具/插件、Skills、密钥与状态。[Profiles](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/profiles.md)、[Profile 命令](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/reference/profile-commands.md)。

**项目边界**：直接克隆会带入 `.env`、私人记忆与可能过宽的插件/工具权限，违背本项目默认数据隔离原则；`--clone-all` 范围更大。未来若需复用，优先新建专属 home，逐项迁入用户批准的模型标识、工具/Skills 配置与必要凭据，保持原目录只读且不把私人记忆合并进去。这样做的具体可用性与账号授权是**待验证**，本轮未复制任何文件。

### 3. DSH ACP/SDK stdio 是否支持完整 Agent 任务

**已验证**：`0.2.1-rc.3` 已安装包内有 `dsh-base`、`dsh-acp-app`、`dsh-sdk-app`、Agent Loop、会话持久化与工具组件；当前 `%USERPROFILE%\.dsh\profiles` 仅见 `desktop`、`dsh-tui`、`headless`、`web`，未见已初始化的 `acp`/`sdk` 目录。未启动它们。

**文档支持**：ACP/SDK 均是基于 `dsh-base` 的独立 stdio profile。base 提供模型、文件/终端/网络工具、子 Agent、持久会话、权限默认值；ACP 可新建/恢复会话、提交 prompt、接收语义更新、回答权限请求、取消和关闭；SDK 可初始化、提交 prompt、接收 session/Agent 事件并 `session/wait`。[DSH CLI](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/README.md)、[ACP profile](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/bundle/acp-app/README.md)、[SDK 服务](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/sdk/server/README.md)。

**限制**：ACP 不提供全部 DSH UI 特性、会话全文回放、fork 等；SDK 的 `session/prompt` 回执只表示入队，服务文档明确无按 prompt 的最终结果、prompt 取消和按 session 关闭方法，SDK Agent 直到进程退出才释放。因此“完整 Agent 执行”是内核能力，不等于协议覆盖桌面全部功能。模型账号、权限交互和实际执行均**待验证**。

### 4. DSH 独立进程能否用插件市场与 Workflow

**已验证**：本机 `dsh-base/cordis.patch.yml` 包含 `dsh-workflow-ptc` 与 `dsh-tool-workflow`，ACP/SDK profile 叠加 base；`dsh-plugin-manager` 在 base，`dsh-experimental-plugin-market-bundle` 随包存在。**文档支持**：Workflow 可驱动子 Agent；插件管理和 market bundle 属 profile 组合，市场 bundle 默认不启用。[DSH Profile 组合](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/app-boot/README.md)、[Workflow](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/workflow/workflow/README.md)。

**边界**：能否运行某个桌面插件取决于该插件是否在目标 profile 安装/启用、与 RC 版本兼容、所需 UI/Host 服务是否存在及权限是否足够；不因桌面已装就自动可用。`DSH_HOME` 相同会共享 home 级环境、凭据与后置 patch；专属 `DSH_HOME` 更易隔离，但需以后单独配置模型/插件。插件市场的“可浏览、可安装”和插件实际可执行是不同结论；本轮均未操作。**待验证**：目标 Workflow 和插件在独立 ACP profile 的可用性。

### 5. 任务提交、状态与结果

| 执行端 | 文档支持的路径 | 注意事项 |
| --- | --- | --- |
| Hermes 独立 Gateway | `session.create`、`prompt.submit`、`session.status`/事件、恢复会话；请求/提交 ID 可用于去重 | `prompt.submit` 的接受回执不是任务完成；执行中断可能进入 `unknown`，Bridge 不能盲目重放。[Gateway 会话契约](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/gateway-local-sessions.md) |
| DSH 独立 ACP | `session/new`、`session/prompt`、`session/update`、`session/cancel`、`session/close`；prompt 响应等待根 Agent 与受管子 Agent 完成 | 仅有标准语义更新，不覆盖桌面专属展示；连接断开和恢复后的状态需单独设计。[ACP 契约](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/acp/acp/README.md) |
| DSH 独立 SDK | `session/prompt`、`session.event`、`session.status`、`session/wait` | 入队与最终结果不是同一回执；无按 prompt 取消/完成，Bridge 需自行定义区间，不作为首选。[SDK 服务](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/sdk/server/README.md) |

以上均是**文档支持**，没有提交真实任务或确认本机运行行为。跨两种协议统一状态机、幂等、失败/断连恢复为**待设计、待验证**。

### 6. Bridge 能否管理生命周期

**文档支持**：DSH ACP/SDK profile 生命周期受 stdio、EOF/信号及显式关闭契约约束；Hermes 有 headless Gateway 与启停/状态命令。**推测**：Bridge 未来可持有它自己启动的两个进程的句柄、监测退出、执行有界优雅关闭，并把异常终止后的任务标为待核对。不得通过 PID/端口“收编”现有桌面应用、现有 Hermes Gateway 或 DSH Host。Windows 后台托管、重启后恢复、任务不丢失与无重复副作用均**待验证**；本轮未启动进程。

## A 与 B 方案比较

| 维度 | A：直连现有桌面应用 | B：官方独立 Agent 进程 |
| --- | --- | --- |
| 稳定性 | Hermes Gateway 有官方协议；DSH Desktop 对第三方外部 Peer 的受支持边界未证实，桌面升级/退出会影响接入。 | 进程与桌面分离可降低互相干扰（**推测**）；需自行管理崩溃、重连、持久状态，未实测。 |
| 兼容性 | Hermes 现有会话与配置可直接沿用；DSH ACP/SDK 不等于连接现有 Desktop Host。 | Hermes headless Gateway + DSH ACP 为官方协议候选；独立 profile 可能缺少桌面专属工具/插件，需逐项验证。 |
| 权限控制 | 现有桌面用户/私有认证权限较宽，Observer/Bridge 最小权限接口不明。 | 专属 home/profile 可限定数据、工作区和凭据（**规划中**）；复制现有 `.env`/记忆或共享 DSH_HOME 会破坏隔离。 |
| 后台运行 | Hermes Gateway 与 DSH 桌面 Host 各有生命周期，DSH 显式退出会关闭 Host；本机未做关窗/重启实测。 | 可由 Bridge 管理自己启动的进程（**推测**）；Windows 自启与长期运行未实现、待验证。 |
| 开发成本 | Hermes 接入较直接；DSH Desktop 外部认证/权限路径不明，可能需要额外适配研究。 | 前期需专属环境、进程监督和两种协议适配；但 ACP 有明确任务控制面，降低对桌面内部实现的依赖。 |

## 推荐与前置条件

**推荐 B 作为下一阶段的验证目标，不作为已实施的架构决策。** 依据：Hermes headless Gateway 和 DSH ACP 的任务协议均有官方/随包契约；DSH ACP 提供明确完成、取消与权限交互，而当前 Desktop Host 的外部访问范围未证实。B 可把 Bridge 的生命周期所有权限制在新建执行实例，保留现有个人桌面环境。此判断是从文档推导，稳定性优劣还未实测。

候选最小接入：一个专属 Hermes home 的 headless Gateway、一个专属 DSH_HOME 的 ACP stdio profile，由未来 Bridge 启停并只接受明确授权的任务。先验证模型/工具/Workflow 与隔离，再验证最小任务提交、进度、完成和取消；之后才讨论插件市场、长期后台服务和双向自主委派。若 Hermes 独立 home 或 DSH ACP 无法满足所需能力，则回到 A 的受支持接口边界重新评估，不绕过认证或接管当前桌面进程。

**本轮结论的实测缺口**：独立 Hermes/DSH 进程未启动，模型与插件未调用，任务生命周期未验证，资源消耗和 Windows 后台行为未知。Phase 0 仍未完成。

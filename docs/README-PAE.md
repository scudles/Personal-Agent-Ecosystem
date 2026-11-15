# Personal Agent Ecosystem

> 文档导航新增：[MNEMOSYNE.md](MNEMOSYNE.md)（长期记忆基础设施，PROPOSAL）、[MEMORY_RIGHTS.md](MEMORY_RIGHTS.md)（记忆权利议题，未授权实施）

> 项目基准：2026-11-07。本文档记录用户提供的项目目标与当前状态；版本和环境细节尚未经过本机核验。

## 愿景

建立由多个独立 AI Agent 组成的个人智能体协作生态。各 Agent 保留自己的模型、记忆、工具和执行环境，通过统一通信层自主协作、双向委派任务、共享经过授权的知识，并接受独立交叉审查。用户是最终决策者。

## 当前成员

| 成员 | 定位 | 当前信息 |
| --- | --- | --- |
| Hermes | 个人 AI 助理；长期记忆、Skills、定时任务、自动化、长期项目与日常事务管理，并与其他 Agent 协作 | Windows 桌面应用；应用和 Backend 均为 v0.22.7（用户提供，待本机核验） |
| DeepSeek Harness（DSH） | 插件生态、专业工具、Workflow、多 Agent 协作、复杂任务、插件探索和自定义工作流 | Windows 桌面应用；V0.2.1-rc.3（用户提供，待本机核验；RC 候选版本，不能视为正式稳定版） |
| ChatGPT Observer | 独立第三方观察者、技术顾问和项目审查者；主动观察模式 B | 当前对话可承担人工咨询与独立审查；持续后台观察能力**规划中**，需独立 Observer 服务与模型 API |
| 用户 | 生态主人和最终决策者 | 提出目标，决定重大技术路线，授权高风险操作，审核重要决策并控制权限 |

## 当前进度

**Phase 0：环境盘点。** 本次仅建立项目文档。Agent Bridge、Shared Knowledge、Observer Module、Web Dashboard 以及 Agent 间自动委派均为**规划中**；未将这些功能视为已经实现。具体 Windows 版本、应用接口、日志位置和后台运行能力均**待确认**。

## 工作原则

- Hermes 与 DSH 平级，保留独立记忆、配置和运行环境；普通任务可按授权边界双向委派。
- Observer 独立审查，默认只读，不参与普通任务的执行竞争；可以明确反对 Hermes 或 DSH 的方案。
- 用户批准付费、重要数据删除、对外发送消息、安全设置变更、权限扩大及不可逆操作。
- 先调查现有能力，优先复用官方接口；技术表述区分「已验证」「用户提供、待核验」「待确认」「规划中」。

## 文档导航与维护

> **交接必读**：任何新会话、新模型或新加入的 Agent，接手前先读 [VISION_AND_PERSONAS.md](VISION_AND_PERSONAS.md)。技术文档说明我们建造了什么，愿景文档说明我们为什么开始建造它。

| 文件 | 用途 |
| --- | --- |
| [VISION_AND_PERSONAS.md](VISION_AND_PERSONAS.md) | **交接必读**：初心、愿景、C 方案、三方关系、Lounge 与自主聊天室、角色性格与不可妥协的原则 |
| [WORKSTREAMS.md](WORKSTREAMS.md) | **进度唯一来源**：两条工作流的状态、依赖、等待授权清单、Observer 审查记录 |
| [CORE_INFRASTRUCTURE.md](CORE_INFRASTRUCTURE.md) | 工作流 A（P0/P1）范围与里程碑 M1–M6 |
| [SOCIAL_VISUAL_LAYER.md](SOCIAL_VISUAL_LAYER.md) | 工作流 B（P2）范围、SL-01…SL-08 与对 Core 的依赖 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 目标架构、组件职责与协作边界 |
| [IDENTITY_AND_ACCESS.md](IDENTITY_AND_ACCESS.md) | 身份与权限架构（五层身份、权限模型、委派链、费用、Windows 方案）｜**设计稿，未实现** |
| [PERMISSION_MATRIX.md](PERMISSION_MATRIX.md) | 三方默认权限矩阵与硬禁止清单｜**建议，未生效** |
| [THREAT_MODEL.md](THREAT_MODEL.md) | 双层安全架构威胁模型（覆盖矩阵、残余风险、检测与响应）｜**分析稿** |
| [MVP_IDENTITY_AND_POLICY.md](MVP_IDENTITY_AND_POLICY.md) | 最小可行身份注册表、策略 schema、决定函数与审计格式｜**设计稿，未启用** |
| [SHARED_VISUAL_WORKSPACE.md](SHARED_VISUAL_WORKSPACE.md) | 共享可视化工作区设计（Artifact 模型、渲染分层、冲突、安全、V0–V4）｜**P2 规划中，未实现** |
| [DECISIONS.md](DECISIONS.md) | 重大决策、理由、日期与待验证假设 |
| [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md) | 每次工作的范围、结果、问题和下一步 |
| [ENVIRONMENT.md](ENVIRONMENT.md) | 环境盘点与证据状态；不存秘密 |
| [ROADMAP.md](ROADMAP.md) | 阶段目标、待办及阶段完成条件 |
| [SECURITY.md](SECURITY.md) | 权限、数据隔离、远程访问与备份边界 |
| [PERSONAS.md](PERSONAS.md) | 三个角色的性格、语气与互动边界（Social Layer 的唯一性格来源） |
| [reports/](reports/) | 阶段性报告：Phase 0 三轮、POC-001、接管报告、第一轮技术验证、Phase 1 握手报告 |

后续每次开发完成后更新 `DEVELOPMENT_LOG.md`、`ENVIRONMENT.md` 和 `ROADMAP.md` 中相关条目；重大架构决策追加到 `DECISIONS.md`。阶段审查报告放在 `reports/`。没有证据时保留「待确认」，不能把设想改写成已实现。

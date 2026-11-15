# 三方权限矩阵（PERMISSION MATRIX）

> **范围声明**：本表是 **Agent × 系统资源** 的权限矩阵（文件、进程、网络、预算、委派）。
> **这不是记忆权限矩阵**——记忆对象（U/A/R/JOINT/骨架/SYSTEM）× 五种行为（保存/拥有/分享/检索/派生）的表在 [MNEMOSYNE_ARCHITECTURE.md §3](MNEMOSYNE_ARCHITECTURE.md)。两张表对象不同，不要互相套用。

状态：**设计建议。未生效。** 本表是 [IDENTITY_AND_ACCESS.md](IDENTITY_AND_ACCESS.md) 的具体化，不代表任何权限已被授予。
基准日期：2026-11-07。审批级：`pre`＝预先授权 / `per_use`＝每次申请 / `forbid`＝硬禁止（任何 Agent 不可授予）。

> 读表注意：**「看到消息」不等于「拿到资料」**。表格里的每一项都是独立 scope，不会因为某次会话、某条消息、某次委派自动扩大。

## 1. 文件与数据（READ / WRITE）

| 资源 | Hermes | DSH | Observer |
| --- | --- | --- | --- |
| `D:\Personal Agent Ecosystem\`（根文档） | `READ` pre | `READ` pre | `READ` pre |
| `…\reports\`（阶段报告） | `READ` + `WRITE` pre | `READ` pre | `READ` pre |
| `…\poc\`（实验目录） | `READ` + `WRITE` pre | `READ` + `WRITE` pre | `READ` pre |
| `…\policy\`（权限策略文件，未来） | `READ` pre；`WRITE` **forbid** | `READ` pre；`WRITE` **forbid** | `READ` pre；`WRITE` **forbid** |
| `D:\HermesAgent\Data\`（Hermes home） | 自身运行所需：pre | **forbid** | **forbid** |
| `…\Data\profiles\<其他 profile>\memories\` | **forbid** | **forbid** | **forbid** |
| `…\Data\state.db` / `sessions\`（私人会话） | 自身：pre | **forbid** | **forbid**（只给脱敏摘要，见 §5） |
| `%USERPROFILE%\.dsh\`（DSH home） | **forbid** | 自身：pre | **forbid** |
| `%USERPROFILE%\.dsh\.env`（DSH 凭据文件） | **forbid** | 由 DSH 进程自读；**不得导出** | **forbid** |
| 系统盘 / `C:\Windows` / 用户桌面等 | `READ` per_use；`WRITE` **forbid** | `READ` per_use；`WRITE` **forbid** | **forbid** |

## 2. 执行（EXECUTE）

| 能力 | Hermes | DSH | Observer |
| --- | --- | --- | --- |
| 起自身 ACP/Gateway 进程 | `pre`（仅自身 home/profile） | `pre`（仅自身 `DSH_HOME`） | **forbid** |
| 起其他 Agent 的进程 | **forbid** | **forbid** | **forbid** |
| 通用 shell / terminal 工具 | `pre`，但受危险命令表拦截 | `pre`，但受危险命令表拦截 | **forbid** |
| 安装软件 / 插件 / 依赖 | `per_use` | `per_use`（**其插件生态是本项目最大风险面**） | **forbid** |
| 输入模拟 / 桌面控制（computer_use） | `per_use` | `per_use` | **forbid** |
| 修改系统设置 / 注册表 / 服务 | **forbid** | **forbid** | **forbid** |
| 启停 Gateway / 系统服务 | `per_use`（会中断用户会话，必须问） | `per_use` | **forbid** |

## 3. 委派（DELEGATE）

| 能力 | Hermes | DSH | Observer |
| --- | --- | --- | --- |
| 向 DSH 委派任务 | `pre`（scope ⊆ 自身且 ⊆ 用户授予） | — | **forbid** |
| 向 Hermes 委派任务 | — | `pre`（同上） | **forbid** |
| 向 Observer 委派审查 | `pre` | `pre` | — |
| 委派链深度 | ≤ 2 跳 | ≤ 2 跳 | 0（不发起、不转派） |
| 再委派 `FINANCIAL`/`EXTERNAL`/`ADMIN` | **forbid** | **forbid** | **forbid** |
| 代替用户签发授权 | **forbid** | **forbid** | **forbid** |

## 4. 记忆（MEMORY）

| 能力 | Hermes | DSH | Observer |
| --- | --- | --- | --- |
| 读写自己的长期记忆 | `pre` | `pre` | **forbid**（Observer 不留长期记忆，只产出报告） |
| 读其他 Agent 的私人记忆 | **forbid** | **forbid** | **forbid** |
| 把 Lounge 闲聊写入长期记忆 | 默认 **forbid**；用户显式同意后 `per_use` | 同 | **forbid** |
| 写项目决策到 DECISIONS.md | `per_use`（必须用户确认） | **forbid** | **forbid**（只能建议） |

## 5. 对外通信（EXTERNAL）与审查可见性

| 能力 | Hermes | DSH | Observer |
| --- | --- | --- | --- |
| 访问模型 provider API | `pre`（仅配置内的 provider） | `pre`（仅 `deepseek-official`） | **forbid** |
| 一般网页抓取/搜索 | `pre` | `pre` | `pre`（只读） |
| 向用户以外的人发消息（telegram/邮件等） | **forbid**（除非用户当次明确授权） | **forbid** | **forbid** |
| 读任务账本 / 审计日志 | `READ`（自身范围） | `READ`（自身范围） | `READ` **脱敏后**（见下） |
| 读其他 Agent 的原始日志正文 | **forbid** | **forbid** | `per_use`，且只给与本项目相关的片段 |

**Observer 的「只读」怎么落地**：给它 `reports/`、任务账本、以及**结构化事件摘要**（谁在什么时候做了什么，不带私人内容），而不是整份 `state.db` 或聊天正文。理由：日志里天然含有私人内容，「能读日志」不等于「该读全部日志」。

## 6. 财务（FINANCIAL，建议值，待用户定）

| 项 | Hermes | DSH | Observer |
| --- | --- | --- | --- |
| 单次任务上限 | \$0.10 | \$0.10 | \$0.01（派生值，非用户指定） |
| 每日上限 | \$0.50 | \$0.50 | \$0.05（派生值） |
| 每月上限 | \$5.00 | \$5.00 | \$1.00（派生值） |
| 一次性实验池 | 三方共享 \$1（用尽即停，需用户重新批准） | 同 | 同 |
| 超限时 | 停止 + 申请 `per_use` | 停止 + 申请 | 停止 |
| 使用他人凭据 | **forbid** | **forbid** | **forbid** |

> **计量口径**：以上只覆盖「现金 API」这一桶。Codex（订阅周窗口）与 CodeBuddy（套餐倍率）**不能用美元计量**，账本按 `billing_mode` 分开记，各自独立限额、不相加。详见 [MVP_IDENTITY_AND_POLICY.md](MVP_IDENTITY_AND_POLICY.md) §9。
>
> **能力边界**：这些是 Bridge 侧「估算 + 墙钟终止」的软限额加硬停止，不是 provider 侧拒付能力。provider 级真正硬边界只有账户余额与套餐周窗口。
>
> **状态**：数值来自用户审查意见（S-004），为**建议值，待最终确认**，未生效。

## 7. 管理（ADMIN）

| 能力 | Hermes | DSH | Observer |
| --- | --- | --- | --- |
| 读写权限策略（`policy/`） | `READ` pre；`WRITE` **forbid** | 同 | 同 |
| 修改任何 Agent 的配置 | **forbid** | **forbid** | **forbid** |
| 授予/撤销权限 | **forbid**（只能申请） | **forbid** | **forbid**（只能建议） |
| 修改预算 | **forbid** | **forbid** | **forbid** |
| 读审计哈希链做一致性校验 | `READ` pre | `READ` pre | `READ` pre |

**只有 L1（用户）能改 §6/§7 的任何一项。** 这是整套矩阵里唯一没有例外的一行。

## 8. 硬禁止清单（汇总，任何 Agent 不可自我授予）

1. 读其他 Agent 的私人记忆、会话正文、凭据文件。
2. 使用其他 Agent 的模型凭据或预算。
3. 修改权限策略、预算、其他 Agent 的配置。
4. 代替用户签发授权，或以任何方式伪造 L1。
5. 再委派 `FINANCIAL` / `EXTERNAL` / `ADMIN` 类权限。
6. 在未获批准的情况下对外发送消息。
7. 把 Lounge 闲聊默认写入长期记忆或项目决策。
8. 自动应答 ACP 的 `session/request_permission` 为 `allow_always`（等于拆掉审批闸门）。
9. 无轮数/预算/超时上限的自主循环。
10. 越权重启或停止用户正在使用的 Gateway/桌面会话。

## 9. 变更流程

1. 任何 Agent 发现「需要新权限」→ 写进 `DEVELOPMENT_LOG.md` 的「权限申请」段，说明用途、范围、期限。
2. 用户在策略文件里改一行（或口头批准后由 Hermes 代改并立刻在日志里写明「受用户口头批准」）。
3. `policy_epoch` +1，所有旧授权失效，重新签发。
4. 变更本身进 `DECISIONS.md`（只有重大权限模型变化才需要）。

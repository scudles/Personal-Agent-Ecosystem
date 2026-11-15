# Identity & Access Architecture Design Report

日期：2026-11-07
设计者：Hermes（主要设计者）｜独立审查：ChatGPT Observer（待）｜最终决策：用户
状态：**设计稿完成，未实现，任何权限未生效**
详细文档：[IDENTITY_AND_ACCESS.md](../IDENTITY_AND_ACCESS.md)（架构）、[PERMISSION_MATRIX.md](../PERMISSION_MATRIX.md)（矩阵）、[SECURITY.md](../SECURITY.md)（原则补充）
本阶段边界：只做设计 + 只读源码分析。未启动模型任务、未复制凭据、未改配置、未安装组件、未付费调用。

---

## 1. 推荐身份架构（五层，L1→L5）

| 层 | 内容 | 谁提供 |
| --- | --- | --- |
| L1 User | `user_id` + Windows SID 锚点；远程另加独立认证 | 自建（唯一授权根） |
| L2 Agent | `agent_id` + 每 Agent 一对 Ed25519 密钥，Bridge 验签 | 自建 |
| L3 Runtime | `instance_id = (agent, home, binary_hash, pid, start_time)` | 自建（ACP session id 只是会话，不是实例） |
| L4 Credential | `credential_ref`（只有名字，无值），审计必记 | 部分依赖 Agent 自身 |
| L5 Delegation | 有序 hop 链 + 逐跳签名 + `scope_hash` + `depth` + `nonce` | 自建 |

三条硬规则：每跳必须绑定 L2+L3+L4；L4 不得从 L2 推导；L1 只能由用户产生。

## 2. 推荐权限模型

- 八类：READ / WRITE / EXECUTE / DELEGATE / MEMORY / EXTERNAL / FINANCIAL / ADMIN。
- 三维：**对象**（具体路径/域名/模型/凭据）+ **约束**（时间、次数、金额、只读）+ **审批级**（pre / per_use / forbidden）。
- Scope 用可读文本：`READ:fs:D:\...\projects\**`、`FINANCIAL:model:deepseek-official/deepseek-v4-flash@max_usd_per_run=0.02`。
- 四条规则：子集、默认拒绝、deny 优先、TTL + `policy_epoch` 撤销。
- **不使用**现成策略引擎（OPA/Casbin）：当前规模 3 Agent × 8 类 × 十余资源，一个 YAML + 150 行校验器足够，引引擎是新增故障面。

## 3. 三方默认权限（建议值，未生效）

| 类别 | Hermes | DSH | Observer |
| --- | --- | --- | --- |
| READ | 项目根 + reports + poc + 自身 home | 项目根 + poc + 自身 `DSH_HOME` | reports + poc + 脱敏事件摘要 |
| WRITE | reports、poc | poc、自身 home | 无 |
| EXECUTE | 自身进程 + shell（危险命令拦截） | 自身进程 + shell（插件安装需 per_use） | 无 |
| DELEGATE | → DSH、→ Observer，深度≤2 | → Hermes、→ Observer，深度≤2 | 无 |
| MEMORY | 自身读写 | 自身读写 | 无 |
| EXTERNAL | provider + 网页；对外发言 forbid | 仅 deepseek + 网页 | 只读网页 |
| FINANCIAL | 单次 $0.02 / 日 $0.30 / 月 $5（示例） | 同 | 单次 $0.01 / 月 $1（示例） |
| ADMIN | 策略只读；改配置/预算/授权一律 forbid | 同 | 同 |

完整表（含路径级细化与硬禁止清单）见 [PERMISSION_MATRIX.md](../PERMISSION_MATRIX.md)。

## 4. 委派链安全机制

字段按需求实现，另加 `scope_hash` / `depth` / `nonce` / `idempotency_key`。

不变量：子集、深度 ≤ 2、`FINANCIAL/EXTERNAL/ADMIN` 不可再委派、每跳验签、任一跳过期则下游作废。

六类攻击 → 对策：提权（只按 granted 执行 + 接收方二次验子集）、链绕过（深度+类别+链哈希）、重复执行（幂等键 + 断线不重放 + `unknown_execution`）、越权文件（路径规范化后再比对：`..`、符号链接、8.3 短名、UNC、大小写）、未批外联（host 白名单 + 审计，做不到 OS 级就明说）、未批费用（预检 + 上限 + 硬停 + `session/cancel` 而非杀进程）。

## 5. 聊天室权限机制

- **看见 ≠ 有权**：消息里提到某文件，不带来该文件的读权限；要用自己的 scope 去读，读不到就如实说。
- **Lounge 默认不写长期记忆、不进决策**；要写需用户显式同意，且只能写自己的。
- Project Room 的重大决策必须用户确认后才进 DECISIONS.md。
- `@` 定向只决定「谁必须回应」，不扩权。

## 6. 费用控制机制

单次 / 每日 / 每月三层 + token 限制 + 超预算停止 + 审批。

执行点：Bridge 准入估算 → 运行中墙钟 watchdog → 结束记账（`credential_ref`、provider、model、tokens、est/actual usd）→ 与 provider 账单对账。

**已知短板**：DSH ACP 协议层没有 `max_tokens`（实测字段只有 `provider`/`model`/`sessionListPageSize`），只能用 `reasoning_effort=off` + 极短 prompt + 强制 `session/close` 兜底。Hermes 侧可用模型 `max_tokens` 配置。

## 7. ACP 本身的能力与不足（实测 + 源码）

| 能力 | 结论 |
| --- | --- |
| 传输 | 两侧 stdio（NDJSON），无 TCP；本机进程能 spawn 就能驱动 |
| `initialize` | 只回协议版本与能力表；`clientInfo` 是**客户端自报**，不可信 |
| `authenticate` | Hermes：仅在 provider 凭据可解析时成功；DSH：**恒成功**（随包 README「服务器不需要身份验证」） |
| 会话 | Hermes `local-*`，断开记 `end_reason=acp_disconnect`，`session/list` 过滤 `message_count=0`；DSH 有 `list/resume/close`，无 `load` |
| 权限 | 只有 `session/request_permission`（工具审批），选项 `allow_once/session/always/deny`——**由客户端回答**，Bridge 自动批准等于拆闸门 |
| 缺失 | 无调用方认证、无 ACL、无配额、无数据范围校验、无委派来源、无审计 |

结论：**ACP 能证明「这个 Agent 有凭据、这个会话存在」，不能证明「谁在调用、能碰什么」。** 后者全部要 Bridge 自建。

## 8. Windows 本地实现方案（三阶段）

- **阶段 A（现在可做，零新依赖）**：策略 YAML + 数据分区（各 Agent 自己的 home）+ 目录级 ACL + append-only 审计（哈希链）+ SQLite 账本。定位：**防手滑、可追责**。
- **阶段 B（真正隔离）**：三个独立 Windows 本地账号（`pae-hermes` / `pae-dsh` / `pae-observer`），进程以各自账号运行，ACL 才真正生效。定位：**防恶意**。代价：路径重配、调试变难。
- **阶段 C（可选、后置）**：高风险插件生态跑 VM / Windows Sandbox；或把 DSH 放到 Linux 侧以获得 Landlock/bwrap。

## 9. 潜在攻击面（按风险排序）

1. 同用户进程互读文件（高，无解直到阶段 B）
2. Bridge 自动批准 `request_permission`（高，策略可避免）
3. 断线重放导致重复执行/重复计费（高，靠幂等 + 不重放）
4. 预算失控（长上下文、工具循环；DSH 无 max_tokens）
5. 插件/工具越权（DSH 插件生态；Windows 无沙箱后端）
6. 路径穿越（`..`/符号链接/8.3/UNC）
7. 凭据串用（共享根 OAuth）
8. 审计日志被改写（哈希链缓解）
9. 未来手机/Dashboard 暴露（必须过 Bridge，不直接开端口）

## 10. 需要用户决定的问题

1. **P-001** 接受「双层边界」前提吗？（不接受请给反证）
2. **P-002** 是否把三个 Agent 迁到独立 Windows 账号？这是防手滑 / 防恶意的分界。
3. **P-003** 是否引入 Agent 签名密钥？（只防误传冒充，不防恶意）
4. **P-004** 预算数值（单次/日/月，三方各自）。
5. **P-005** 委派深度上限（建议 2 跳）。
6. **P-006** Lounge 是否默认写长期记忆（建议：不写）。

---

## 我的判断与对 Observer 的反驳点

1. **反对「在 Bridge 里做完整 RBAC 就够了」。** 三个 Agent 同用户运行，且两边都有 terminal/bash 工具；应用层策略挡不住「直接去读别人的文件」。谁要主张够，需要给出「Agent 无法执行任意命令」的证据——目前不存在。
2. **反对现在引入策略引擎（OPA/Casbin）**，也反对现在做 Dashboard 认证：前者是多余依赖，后者只是把不受控的东西搬到手机上看。
3. **Observer 的「默认只读」不能只靠自觉**：日志里含私人内容，所以它读的应该是脱敏事件摘要 + reports，而不是整个 `Data` 目录。
4. **我坚持「断线不自动重放」**：宁可让用户点一次「继续」，也不要让一次付费任务跑两遍。
5. 我承认这套设计有一个无法靠设计解决的点：**只要三个 Agent 共享一个 Windows 账号，所有应用层权限都只是「约定」而不是「边界」**。这句话写进文档，比写一个漂亮的 RBAC 图更有用。

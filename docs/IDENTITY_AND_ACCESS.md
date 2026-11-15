# 身份与权限架构（IDENTITY & ACCESS）

状态：**设计稿。未实现，任何权限均未生效。** 本文件描述「应该怎样」，不是「已经怎样」。
基准日期：2026-11-07。设计者：Hermes。独立审查：ChatGPT Observer（待）。最终决策：用户。
相关：[VISION_AND_PERSONAS.md](VISION_AND_PERSONAS.md)（初心）、[ARCHITECTURE.md](ARCHITECTURE.md)（模块位置）、[PERMISSION_MATRIX.md](PERMISSION_MATRIX.md)（默认矩阵）、[SECURITY.md](SECURITY.md)（安全原则）、[ROADMAP.md](ROADMAP.md)（阶段）。

---

## 0. 三条前置结论（先看这个，不同意就不用往下看）

这三条是我的判断，也是整个设计的地基。说服我，或者推翻它，后面的设计都会跟着变。

**结论一：Bridge 不是安全边界，它只是「准入 + 审计」边界。**
三个 Agent 目前都以同一个 Windows 用户（`Administrator`）运行。它们各自的 `terminal` / `bash` 工具继承的是**同一个用户令牌**。也就是说：只要 DSH 愿意，它可以直接 `type` 读 Hermes 的 `state.db`，不管 Bridge 的权限表怎么写。所以在当前运行方式下，任何「在 Bridge 里实现 RBAC 就等于隔离」的说法都是安全剧场。

**结论二：ACP 不提供身份认证，它只检查「本 Agent 有没有凭据」。**
实测：Hermes `initialize` 回 `authMethods: ['hermes-setup']`，`authenticate` 只在「provider 可解析出凭据」时返回成功；DSH 的 `authenticate` **恒成功**，随包 README 原文「服务器不需要身份验证」。两侧都是 stdio，**任何能 spawn 该二进制并往 stdin 写 JSON 的进程都能驱动它们**。这不是缺陷，是设计定位：ACP 是「宿主驱动 agent」的协议，不是「互相鉴权」的协议。

**结论三：Windows 上没有现成的 per-process 文件沙箱可用。**
- DSH 提供 `dsh-bash-sandbox`（read-only / workspace-write / danger-full-access），但它的后端是 bwrap / Landlock / Seatbelt —— **全是 Linux/macOS**；Windows 无后端，按文档会 `SANDBOX_UNAVAILABLE` 或退回无隔离执行。而且它自己声明：**只约束文件影响，不限制网络**。
- Hermes 侧没有等效的沙箱执行器；ACP 的权限桥只把「危险命令审批」映射成 `session/request_permission`，审批是**客户端**回答的——也就是说 Bridge 如果自动答 `allow_always`，等于把闸门焊死。

**由此得到唯一合理的架构方向**：
> 权限必须**双层实施**：Bridge 做准入与审计（防误操作、防越预算、留证据）；Agent 自己做工具级策略（防具体动作越界）；**真正的隔离靠 OS 账号/ACL**。三层缺一层，就只剩「文档里的安全」。

---

## 1. 五层身份

| 层 | 作用 | 载体 | 验证方式 | 生命周期 | 谁能提供 | ACP 现状 |
| --- | --- | --- | --- | --- | --- | --- |
| **L1 User Identity** | 唯一授权者；所有授权链的根 | `user_id`（本地稳定 UUID）+ Windows SID 作为 OS 锚点 | 本地：Windows 登录会话；远程（未来 Dashboard/手机）：独立认证（WebAuthn 或一次性设备配对码） | 长期；换机则重新登记 | 必须自建 | 无 |
| **L2 Agent Identity** | 区分 hermes / dsh / observer 三个主体 | `agent_id` + 每个 Agent 一把独立 HMAC-SHA256 密钥（建议值；密钥文件不存进 Bridge，只存引用与指纹） | Bridge 以 HMAC + `nonce` + 时间戳校验任务信封 | 长期；密钥可轮换，旧密钥保留验证历史 | 必须自建 | 仅 `initialize` 的 `clientInfo`/`agentCapabilities`，**不可信**（客户端自报） |
| **L3 Runtime Identity** | 区分「同一个 Agent 的不同实例」：哪台机、哪个 home、哪个进程 | `instance_id = (agent_id, home_path, binary_hash, pid, start_time)` | Bridge 启动时采集并登记；任务结果必须带 instance_id | 进程级；退出即失效 | 必须自建 | session id（Hermes `local-*` / DSH UUID）只能当**会话**标识，不是实例身份 |
| **L4 Credential Identity** | 这次调用用的是谁的模型/服务凭据 | `credential_ref`（**只存名字，不存值**），如 `hermes.root_oauth`、`dsh.deepseek_api_key` | 凭据由各自 Agent 进程读取；Bridge 只校验「该 Agent 是否被允许使用该 ref」 | 跟随凭据本身的轮换/过期 | 部分：Agent 自己管理 | Hermes profile 无 key 时 **fail closed**（已实测 `credential pool: no available entries`）；DSH 走 `~/.dsh/.env` |
| **L5 Delegation Identity** | 一条任务是谁发起、经过谁、被授予了什么 | `delegation_chain`：有序 hop 列表，每跳含 `sender/receiver/granted_scopes/expires_at/signature` | 逐跳验签 + 逐跳验「子集」 | 单任务；默认随任务结束作废 | 必须自建 | 无任何支持；ACP 的 session 不携带委派来源 |

**层间关系（三条硬规则）**

1. L5 的每一跳都必须绑定 L2（谁）+ L3（哪个实例）+ L4（用哪份凭据）。三者缺一，这条委派记录就不合法。
2. L4 **不得**从 L2 推导。同一个 Agent 可以有多份凭据；同一份凭据也可能被多个 Agent 使用（例如共享 OAuth）。审计必须能回答「这是 hermes 用 root_oauth 花的钱」，而不是「hermes 花的钱」。
3. L1 只能由用户本人产生，**任何 Agent 都不得代替用户签发授权**。这条是整套体系的单点根基，违反一次就全废。

---

## 2. 统一权限模型

### 2.1 八个类别 + 三个维度

| 类别 | 含义 | 资源选择器示例 | 典型约束 |
| --- | --- | --- | --- |
| `READ` | 读文件/数据 | `fs:D:\Personal Agent Ecosystem\**` | 只读期内；不可写 |
| `WRITE` | 写文件/改数据 | `fs:…\reports\**` | 路径前缀 + 后缀白名单 |
| `EXECUTE` | 起进程/跑工具 | `proc:hermes.exe`、`tool:terminal` | 可执行文件哈希；参数禁用表 |
| `DELEGATE` | 把任务交给别人 | `agent:dsh` | 只能委派自己已持有的 scope 子集 |
| `MEMORY` | 读写记忆 | `mem:own`、`mem:other` | other 默认 hard-deny |
| `EXTERNAL` | 对外通信 | `http:api.deepseek.com`、`msg:telegram` | host 白名单；内容审核 |
| `FINANCIAL` | 花钱 | `model:deepseek-official/deepseek-v4-flash`、`budget:usd` | 单次上限 + 日/月池 |
| `ADMIN` | 改策略/权限/配置 | `policy:*`、`config:agent:*` | 仅用户；任何 Agent 默认 hard-deny |

**三个维度**（只看类别会漏掉一半风险）：

- **对象（resource）**：具体到「哪个目录、哪个域名、哪个模型、哪份凭据」。
- **约束（constraint）**：时间窗、次数、金额、token、只读/可写、是否需二次审批。
- **审批级（approval class）**：`pre`（预先授权）、`per_use`（每次申请）、`forbidden`（硬禁止）。

### 2.2 Scope 语法（建议）

```
<CATEGORY>:<kind>:<selector>[@<constraint>[,<constraint>…]]
```

例子：

```
READ:fs:D:\Personal Agent Ecosystem\projects\**
WRITE:fs:D:\Personal Agent Ecosystem\reports\**
EXECUTE:tool:terminal@args_forbid=["rm -rf","format","shutdown"]
DELEGATE:agent:dsh@max_depth=1
MEMORY:mem:own@write
EXTERNAL:http:api.deepseek.com@methods=["POST"],rate=30/1h
FINANCIAL:model:deepseek-official/deepseek-v4-flash@max_usd_per_run=0.02,daily_usd=0.20
ADMIN:policy:read
```

为什么用文本而不是直接上 JSON Schema：**可审计、可 diff、可放进文档和 git**。内部仍然解析成结构化对象，但对外表示必须是人能读的。

### 2.3 三种授权方式

| 方式 | 谁给 | 适用 | 失效条件 |
| --- | --- | --- | --- |
| **pre（预先授权）** | 用户在策略文件里写 | 日常读项目、写 reports、跑只读命令 | TTL 到期 / 被撤销 / 预算耗尽 |
| **per_use（单次授权）** | 用户当场批准（或批准的代答人） | 写共享资料、对外发言、超预算调用、安装组件 | 一次一用；任务结束即废 |
| **forbidden（硬禁止）** | 架构层面写死，**不可被任何 Agent 授予** | 读其他 Agent 的私人记忆、改策略、用别人的凭据、跨 Agent 提权、无上限自主循环 | 只能由用户显式改写策略文件并留痕 |

**硬禁止清单（建议写进 SECURITY.md）**：见 [PERMISSION_MATRIX.md](PERMISSION_MATRIX.md) §4。

### 2.4 继承、收缩、冲突（四条规则）

1. **子集规则**：`effective = requested ∩ granted_parent`。子任务只能更小，永远不能更大。
2. **默认拒绝**：没写进策略的一律视为 deny；不靠「没禁止就是允许」。
3. **deny 优先**：任何一层出现 deny，整条链 deny；不允许「父 allow 覆盖子 deny」。
4. **到期即失效 + 撤销靠 epoch**：所有 token 带 `expires_at`；撤销通过把 `policy_epoch` 加一实现——Bridge 只需比较 epoch，所有旧授权瞬间失效，不需要逐个回收。

---

## 3. 任务委派链

### 3.1 记录字段

| 字段 | 说明 |
| --- | --- |
| `task_id` | 全局唯一（UUIDv7，含时间序） |
| `parent_task_id` | 父任务；根任务为 null |
| `sender_agent` / `receiver_agent` | L2 身份 |
| `sender_instance` / `receiver_instance` | L3 实例 |
| `requested_permissions` | 请求的 scope 列表 |
| `granted_permissions` | **实际批准**的 scope（必须 ⊆ 父链） |
| `credential_identity` | L4 `credential_ref`（不含值） |
| `authorization_id` | 对应哪次用户授权（pre 策略版本 / per_use 批准单号） |
| `delegation_chain` | 有序 hop 数组，含每跳签名与 `scope_hash` |
| `idempotency_key` | `(task_id, attempt)`，用于去重 |
| `status` | `proposed → accepted → started → completed / failed / cancelled / unknown_execution` |
| `created_at` / `expires_at` | 时间与 TTL |
| `result_ref` / `error` | 结果指针与失败原因 |

**额外三条（我加的）**：`scope_hash`（整条链的规范化哈希，便于比对）、`depth`（当前层级）、`nonce`（防重放）。

### 3.2 不变量（违反任何一条，整条委派作废）

1. 子集：每一跳的 `granted ⊆ 上一跳 granted`。
2. **深度上限 2**（用户 → Hermes → DSH 已是两跳；再往下必须回到用户）。
3. `FINANCIAL` / `EXTERNAL` / `ADMIN` **不可被再委派**（只能由发起方自己用，或每次回用户）。
4. 每跳必须签名；无签名视为伪造。
5. 链上任何一条过期，下游全部作废。
6. **每跳带 `nonce` + `issued_at`；Bridge 维护 5 分钟时间窗 + nonce 去重表**（窗口外或重复即拒）。这条针对重放，不针对伪造——伪造由 HMAC 挡，重放必须靠 nonce/时间。

**HMAC 的边界（必须写在实现注释里）**：HMAC 只证明「这条消息出自持有该密钥的进程」。它**不**证明「这个操作本身是安全的」——被提示注入的 Agent 一样能签出合法消息。签名解决「是谁」，不解决「该不该」；「该不该」由策略层管。

### 3.3 六类攻击与对策

| 攻击 | 怎么发生 | 对策 |
| --- | --- | --- |
| **权限提升** | 子任务请求超集，指望接收方只看 requested 不看 granted | 只按 `granted` 执行；granted 由发送方计算并签名；接收方二次校验子集 |
| **委派链绕过** | A 让 B 让 C 做 A 自己没权限的事 | 深度上限 + 不可再委派类别 + 链哈希在每跳重算并比对 |
| **重复执行** | 断线重试，任务被跑两次（尤其花钱的） | `idempotency_key` + 结果表；**断线后默认不重放**；状态不明时进入 `unknown_execution`，由用户裁决 |
| **越权文件访问** | 任务说「读项目资料」，实际去读别的目录 | 路径规范化后做前缀匹配（防 `..`、符号链接、短名/8.3、UNC、大小写）；Bridge 只做准入，真正拦截靠 Agent 工具策略 / OS ACL |
| **未批准的外部通信** | 为了让任务跑通，顺手 curl 一个外部 API | `EXTERNAL` 白名单 host + 方法；Bridge 记录实际 egress（能观察到的部分）；做不到 OS 级阻断就**明说做不到** |
| **未批准的模型费用** | 免费试一下，结果跑了长上下文 | 预检估算 + 单次上限 + 日/月池 + 硬停；DSH 侧用 `reasoning_effort=off` 与短 prompt 兜底（它没有 `max_tokens` 开关） |

**`unknown_execution` 这个状态不是我发明的**：Hermes 的 ACP viewer 里已有同名语义（断线后 turn 结果未知时提示「resume 检查，不要重发」）。B′ 落地时应当直接沿用这个语义，而不是另造一个。

---

## 4. 费用与资源权限

| 层级 | 作用 | 执行点 |
| --- | --- | --- |
| 单次任务上限 | 防一次跑飞 | Bridge 预检 + 运行中 watchdog（墙钟 + token 估算） |
| 每日预算 | 防一天内累计失控 | 账本按日聚合；超限拒绝新任务 |
| 每月预算 | 防月底才发现 | 同上，按自然月 |
| Token 上限 | 细粒度控制 | Hermes：模型 `max_tokens` 配置；DSH：**协议层没有**，只能靠 `reasoning_effort` + 短 prompt + 强制 `session/close` |
| 超预算停止 | 已在跑的任务怎么办 | 先发 `session/cancel`（不是杀进程），记录取消原因；杀进程是最后手段 |
| 用户审批 | 超阈值时必须问 | 阈值内自动，阈值外 `per_use`；审批单带「预估金额 + 上限」 |

**账本字段（最小）**：`ledger_id, agent_id, credential_ref, provider, model, task_id, input_tokens, output_tokens, est_usd, actual_usd(nullable), cost_source(provider_bill|estimate), recorded_at`。

**铁律**：一个 Agent 不得使用另一个 Agent 的模型凭据或预算。共享凭据（如根 OAuth）必须在账本里显式标注 `shared:true`，否则统计会失真。

---

## 5. 聊天室权限（Social Layer，P2）

| 场景 | 消息可见性 | 资料访问 | 记忆写入 |
| --- | --- | --- | --- |
| Project Room | 三方 + 用户 | **看消息 ≠ 拿资料**：涉及的文件仍需各自 scope | 决策需用户确认后才进 DECISIONS.md；过程不自动写长期记忆 |
| Lounge | 三方 + 用户 | 同上；不得因为读到一句话就去翻私人目录 | **默认不写长期记忆**；要写必须用户显式同意，且只能写自己的 |
| `@` 定向 | 全体可见，仅被 @ 者必须回应 | 不随 @ 扩权 | 不写 |
| Free-flow / 自主讨论（A/B 两模式） | 全体可见 | 不随参与扩权 | 结束摘要供人看，不等于记忆 |

两条容易搞错、必须写死的：

1. **看见 ≠ 有权。** Agent 看到一条消息里提到某文件，不代表它获得该文件的读权限；它要用自己的 scope 去读，读不到就如实说「我没有权限」。
2. **闲聊默认不落长期记忆。** 否则 Lounge 会慢慢变成第二个记忆库，污染所有后续会话。

---

## 6. Windows 本地实现方案（三阶段，成本递增）

### 阶段 A（现在就能做，零新依赖）
- 策略文件：`policy/agents.yaml`（人可读），Bridge 解析成内存策略。
- 数据分区：每个 Agent 一个 home（Hermes 已有 profile，DSH 已有 `DSH_HOME`）；项目目录按子目录划分（`projects/` 只读、`reports/` 可写、`shared/` 只读）。
- **ACL 兜底**：对**数据目录**用 `icacls` 给不同 OS 账号授权（阶段 B 前只对本用户生效，防不住同用户 Agent，但能防误删与他人）。
- 审计：append-only JSONL + 每行 `prev_hash`（哈希链），防事后静默改账。
- 费用账本：SQLite（与 Bridge 同库）。

### 阶段 B（真正的隔离，需要用户批准 + 运维成本）
- 为每个 Agent 建**独立 Windows 本地账号**（`pae-hermes`、`pae-dsh`、`pae-observer`），各自 `%USERPROFILE%` 与 home，各自凭据。
- Agent 进程以对应账号运行（计划任务 / `runas` / 服务），Bridge 作为编排者在用户会话里读日志与账本。
- 这时 ACL 才有意义：`icacls <dir> /grant pae-dsh:(OI)(CI)R`，Hermes 的 `state.db` 对 `pae-dsh` 直接拒绝。
- 代价：路径要重配、dashboard 访问要过 Bridge、调试变麻烦；`hermes acp` 需要以目标账号能读到的 home 运行。

### 阶段 C（高风险组件的沙箱，可选、后置）
- DSH 插件生态是最不可控的一环：可考虑 Windows Sandbox / 容器/ VM，或在 Linux 侧跑 DSH 取得 Landlock/bwrap 能力。
- 前提：阶段 B 的证据表明「应用层策略不足」。不要现在就上，成本高且会拖慢主线。

**判断**：阶段 A 是「防手滑 + 可追责」，阶段 B 才是「防恶意」。本项目当前威胁模型里，对手主要是**误操作和跑偏的自动化**，不是人类攻击者——所以先做 A，把 B 作为「一旦接入不可信插件就跑」的开关，而不是一开始就上。

---

## 7. 威胁模型（攻击面清单）

| 攻击面 | 现实风险 | 现有缓解 | 缺口 |
| --- | --- | --- | --- |
| 同用户进程互读文件 | **高** | 无 | 需阶段 B（独立账号/ACL） |
| Bridge 自动答 `session/request_permission` | **高**（等于拆掉所有审批） | Hermes 提供 allow_once/session/always/deny 四档 | Bridge 必须默认 `deny` 或转人工，**禁止** `allow_always` |
| Agent 自报身份（`clientInfo`） | 中 | 无 | 用 L2 签名信封，不信自报 |
| 凭据串用 | 中 | profile/DSH_HOME 隔离 | 共享根 OAuth 仍存在；需账本标注 |
| 断线重放导致重复执行/重复计费 | **高** | Hermes 有 `unknown_execution` 语义 | Bridge 必须实现幂等 + 不自动重放 |
| 路径穿越（`..`、符号链接、8.3 短名、UNC） | 中 | 无 | 统一路径规范化后再比对；拒绝 UNC 与短名形式 |
| 插件/工具越权（DSH 插件生态） | **高** | `dsh-bash-sandbox`（但 Windows 无后端） | 阶段 C，或限制可装插件清单 |
| 对外通信未批准 | 中 | 无 | host 白名单 + 审计；OS 级阻断需防火墙/账号策略 |
| 预算失控（长上下文/工具循环） | **高** | 单次上限（拟）、`reasoning_effort` | DSH 无 `max_tokens`；靠 watchdog + cancel |
| 审计日志被改写 | 中 | 无 | 哈希链 + 只写不删 |
| 手机/Dashboard 暴露 | 高（未来） | 无 | 不直接暴露端口；Bridge 唯一入口 + 独立认证 |

---

## 8. 与 Observer 可能的分歧（我主动标出可反驳点）

1. **我反对「在 Bridge 里做完整 RBAC 就够了」。** 同用户进程可以绕过任何应用层策略。若 Observer 认为应用层足够，需要给出「Agent 无法执行任意命令」的证据——目前两边都**有** terminal/bash 工具，证据不存在。
2. **我不建议现在就引入策略引擎（OPA/Casbin 之类）。** 现在的策略规模是「3 个 Agent × 8 类 × 十来个资源」，一个 YAML + 150 行校验器足够；引引擎会带来新依赖、新版本面、新故障点，违背「不为了技术而技术」。
3. **我不建议先做 Dashboard 认证。** 没有 Bridge 的权限模型，Dashboard 只是把「不受控的东西」搬到手机上看。
4. **我认为委派深度 2 是上限而不是起点。** 每次加一跳都会让「谁批准的」变模糊。
5. 我保留一个不同意见：**Observer 的「默认只读」不能只靠自觉**。它读的日志里可能含私人内容，所以「只读」也要有 scope，而不是「能读整个 `D:\HermesAgent\Data`」。

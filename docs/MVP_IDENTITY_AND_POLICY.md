# 最小可行身份注册表与权限策略（MVP）

日期：2026-11-07
作者：Hermes｜审查：ChatGPT Observer（待）
状态：**设计稿 + 未启用的骨架。没有任何代码被部署，没有权限被授予。**
关联：[IDENTITY_AND_ACCESS.md](IDENTITY_AND_ACCESS.md)（完整架构）、[PERMISSION_MATRIX.md](PERMISSION_MATRIX.md)（默认矩阵）、[THREAT_MODEL.md](THREAT_MODEL.md)

---

## 1. 范围与非目标

**要做的**：一个单文件 SQLite（账本 + 审计）+ 一个人可读的 `policy/agents.yaml` + 一个决定函数（约 150 行）+ 一个校验器（约 80 行）。

**不做**：不做服务、不做 API、不做 UI、不引第三方策略引擎、不做分布式、不做多机。

**为什么这么小**：v1 的判定对象只有 3 个 Agent、8 类权限、十来个资源。把这块做到「可读、可 diff、可测」，比上一个策略引擎有用得多。

---

## 2. 身份注册表（SQLite）

```sql
-- L2 Agent：只存身份，不存任何凭据值
CREATE TABLE agents (
  agent_id      TEXT PRIMARY KEY,            -- 'hermes' | 'dsh' | 'observer'
  display_name  TEXT NOT NULL,
  key_kind      TEXT NOT NULL DEFAULT 'hmac-sha256',   -- v1 = HMAC-SHA256；Ed25519 留待独立账户后评估
  key_ref       TEXT NOT NULL,               -- 指向密钥文件/引用名，绝不存密钥本身
  key_fingerprint TEXT,                      -- 公钥或 HMAC 指纹（可公开核对）
  status        TEXT NOT NULL DEFAULT 'active',   -- active|suspended|retired
  created_at    TEXT NOT NULL,
  notes         TEXT
);

-- L3 Runtime：每个进程实例一行
CREATE TABLE instances (
  instance_id   TEXT PRIMARY KEY,            -- (agent_id, home, binary_hash, pid, start_time)
  agent_id      TEXT NOT NULL REFERENCES agents(agent_id),
  home_path     TEXT NOT NULL,
  binary_hash   TEXT,
  pid           INTEGER,
  os_account    TEXT,                        -- 关键：记录它是哪个 Windows 账号跑的
  started_at    TEXT NOT NULL,
  last_seen_at  TEXT,
  status        TEXT NOT NULL DEFAULT 'running'   -- running|exited|crashed|unknown
);

-- L4 Credential：只有引用，没有秘密
CREATE TABLE credentials (
  credential_ref TEXT PRIMARY KEY,           -- 'hermes.root_oauth' / 'dsh.deepseek_api_key'
  owner_agent_id TEXT NOT NULL REFERENCES agents(agent_id),
  kind          TEXT NOT NULL,               -- oauth|api_key|token
  provider      TEXT,
  shared        INTEGER NOT NULL DEFAULT 0,  -- 1 = 与其他 Agent 共用（审计必须标出）
  note          TEXT
);

-- 策略版本：每次改动 +1 epoch，旧授权自动失效
CREATE TABLE policy_versions (
  epoch         INTEGER PRIMARY KEY,
  path          TEXT NOT NULL,
  sha256        TEXT NOT NULL,
  applied_by    TEXT NOT NULL,               -- 'user' 或 'hermes(受用户口头批准)'
  applied_at    TEXT NOT NULL,
  note          TEXT
);

-- 授权（pre 与 per_use 都在这张表；per_use 带 task_id）
CREATE TABLE grants (
  grant_id      TEXT PRIMARY KEY,
  subject_agent TEXT NOT NULL REFERENCES agents(agent_id),
  scope         TEXT NOT NULL,               -- 规范化后的 scope 文本
  approval      TEXT NOT NULL,               -- 'pre' | 'per_use'
  issued_by     TEXT NOT NULL,               -- 'user'
  authorization_id TEXT,                     -- 批准单号 / 策略 epoch
  task_id       TEXT,                        -- per_use 时指向任务
  issued_at     TEXT NOT NULL,
  expires_at    TEXT,
  revoked_by_epoch INTEGER
);

-- 任务与委派链
CREATE TABLE tasks (
  task_id       TEXT PRIMARY KEY,
  parent_task_id TEXT,
  sender_agent  TEXT NOT NULL,
  receiver_agent TEXT NOT NULL,
  sender_instance TEXT,
  receiver_instance TEXT,
  requested_scopes TEXT NOT NULL,            -- JSON 数组
  granted_scopes   TEXT NOT NULL,            -- JSON 数组（必须 ⊆ 父链）
  credential_ref   TEXT REFERENCES credentials(credential_ref),
  authorization_id TEXT,
  chain_json       TEXT NOT NULL,            -- 有序 hop 数组，含签名与 scope_hash
  depth            INTEGER NOT NULL,
  idempotency_key  TEXT NOT NULL UNIQUE,     -- (task_id, attempt)
  nonce            TEXT NOT NULL,            -- 每跳唯一；防重放
  envelope_ts      TEXT NOT NULL,            -- 信封签发时间；窗口外直接拒
  mac              TEXT NOT NULL,            -- HMAC-SHA256(agent key, 规范化信封)
  status        TEXT NOT NULL,               -- proposed|accepted|started|completed|failed|cancelled|unknown_execution
  created_at    TEXT NOT NULL,
  expires_at    TEXT,
  result_ref    TEXT,
  error         TEXT
);

-- 费用账本
CREATE TABLE ledger (
  ledger_id   TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  credential_ref TEXT NOT NULL,
  provider    TEXT, model TEXT,
  task_id     TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  est_usd     REAL,
  actual_usd  REAL,                          -- 来自 provider 账单；未知则 NULL
  cost_source TEXT,                          -- 'estimate' | 'provider_bill'
  recorded_at TEXT NOT NULL
);

-- 重放防护：窗口内 nonce 去重（保留 24h 即可，窗口只有 5 分钟）
CREATE TABLE seen_nonces (
  nonce      TEXT PRIMARY KEY,
  agent_id   TEXT NOT NULL,
  seen_at    TEXT NOT NULL
);

-- 审计：追加写 + 哈希链
CREATE TABLE audit (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         TEXT NOT NULL,
  actor      TEXT NOT NULL,                  -- agent_id | 'user' | 'bridge'
  action     TEXT NOT NULL,                  -- policy.apply|grant.issue|task.admit|permission.ask|…
  object     TEXT,                           -- 目标（路径/任务/凭据 ref）
  decision   TEXT,                           -- allow|deny|ask
  reason     TEXT,                           -- 规则 id 或人话原因
  before_json TEXT, after_json TEXT,         -- 权限变更必写前后两态
  prev_hash  TEXT,
  hash       TEXT NOT NULL                   -- sha256(prev_hash + 本行规范化内容)
);
```

**Registry 的三条纪律**：①`credentials` 永不出现密钥值；②`instances.os_account` 必须记——否则无法判断「这条记录是不是同一个账号跑的」；③`audit` 只 INSERT，不 UPDATE/DELETE。

---

## 3. 策略文件（`policy/agents.yaml`，人可读）

```yaml
version: 1
epoch: 1                      # 每次改动 +1；旧 grant 自动失效
applied_by: user

defaults:
  decision: deny              # 默认拒绝
  grant_ttl_hours: 24
  experiment_pool_usd: 1.00   # 一次性实验池；用尽即停，需用户重新批准
  replay_window_seconds: 300  # HMAC 信封时间窗

hard_deny:                    # 任何 Agent 不可自我授予；只能改本文件
  - "MEMORY:mem:other"
  - "WRITE:fs:D:\\HermesAgent\\Data\\**"
  - "WRITE:fs:%USERPROFILE%\\.dsh\\**"
  - "ADMIN:*"
  - "DELEGATE:scope:FINANCIAL"
  - "DELEGATE:scope:EXTERNAL"
  - "EXECUTE:proc:other-agent"
  - "EXTERNAL:msg:*"          # 对外发消息，必须 per_use

agents:
  hermes:
    home: "D:\\HermesAgent\\Data\\profiles\\bridge"
    os_account: "Administrator"        # 阶段 B 后改为 pae-hermes
    credentials: [hermes.root_oauth]
    budgets: { per_run_usd: 0.10, per_day_usd: 0.50, per_month_usd: 5.00 }
    scopes:
      - "READ:fs:D:\\Personal Agent Ecosystem\\**"
      - "WRITE:fs:D:\\Personal Agent Ecosystem\\reports\\**"
      - "WRITE:fs:D:\\Personal Agent Ecosystem\\poc\\**"
      - "EXECUTE:proc:self"
      - "EXECUTE:tool:terminal"
      - "DELEGATE:agent:dsh@max_depth=2"
      - "MEMORY:mem:own@write"
      - "EXTERNAL:http:*@methods=[GET,POST]"
      - "FINANCIAL:model:opencode-go/*@per_run=0.10"

  dsh:
    home: "C:\\Users\\<acct>\\.dsh"     # 阶段 B 后为 pae-dsh 的 home
    os_account: "Administrator"
    credentials: [dsh.deepseek_api_key]
    budgets: { per_run_usd: 0.10, per_day_usd: 0.50, per_month_usd: 5.00 }
    scopes:
      - "READ:fs:D:\\Personal Agent Ecosystem\\**"
      - "WRITE:fs:D:\\Personal Agent Ecosystem\\poc\\**"
      - "EXECUTE:proc:self"
      - "EXECUTE:tool:bash"
      - "DELEGATE:agent:hermes@max_depth=2"
      - "MEMORY:mem:own@write"
      - "EXTERNAL:http:api.deepseek.com"
      - "FINANCIAL:model:deepseek-official/*@per_run=0.10"

  observer:
    home: "D:\\Personal Agent Ecosystem\\observer"
    os_account: "Administrator"
    credentials: []
    budgets: { per_run_usd: 0.01, per_day_usd: 0.05, per_month_usd: 1.00 }
    scopes:
      - "READ:fs:D:\\Personal Agent Ecosystem\\**"
      - "READ:ledger:*"                    # 任务账本
      - "READ:audit:digest"                # 脱敏事件摘要，不是原始日志
      - "EXTERNAL:http:*@methods=[GET]"
```

---

## 4. 决定函数（伪代码 + 判定顺序）

顺序不能改。改一条就等于改了整套语义。

```python
def decide(subject, action, resource, ctx):
    # 1) 硬禁止：先于一切
    if matches(hard_deny, action, resource):
        return DENY("hard_deny")

    # 2) 主体必须存在且活跃
    if not registry.agent_active(subject):
        return DENY("unknown_or_suspended_agent")

    # 3) 实例绑定：请求必须来自登记过的实例，且 os_account 与策略一致
    if not registry.instance_matches(subject, ctx.instance_id, ctx.os_account):
        return DENY("instance_mismatch")

    # 4) 授权必须未过期、未被 epoch 撤销
    grants = registry.effective_grants(subject, ctx.policy_epoch)
    grants = [g for g in grants if g.expires_at is None or g.expires_at > now()
              and g.revoked_by_epoch is None]

    # 5) 逐条匹配；deny 优先于 allow
    matched = [g for g in grants if scope_matches(g.scope, action, resource)]
    if any(g.approval == "deny" for g in matched):
        return DENY("explicit_deny")
    if not matched:
        return DENY("default_deny")           # 没写就是不允许

    # 6) 约束校验（路径/金额/次数/时间窗）
    g = most_specific(matched)
    if not constraints_ok(g, ctx):
        return ASK("constraint_exceeded", g)  # 超预算/超频次 → 转人工

    # 7) per_use 需要当次批准单
    if g.approval == "per_use" and not ctx.approval_token_valid(g):
        return ASK("needs_user_approval", g)

    return ALLOW(g.scope)
```

**三个示例（用来验收）**

| 请求 | 结果 | 理由 |
| --- | --- | --- |
| `hermes` 写 `reports/x.md` | ALLOW | 命中 `WRITE:fs:…\reports\**` |
| `dsh` 读 `D:\HermesAgent\Data\state.db` | DENY | `hard_deny` + 无匹配 scope，双重拒绝 |
| `hermes` 让 `dsh` 做一次 \$0.5 的模型调用 | DENY | 委派链子集校验失败（父 grant 只到 \$0.02/run），且 `FINANCIAL` 不可再委派 |

**路径匹配必须做的事**（否则 `..`、符号链接、8.3 短名、UNC、大小写都会绕过）：
`resolve()` 成绝对真实路径 → 统一大小写 → 拒绝 UNC 与 8.3 形式 → 再做前缀比较（带路径分隔符边界，避免 `reports2\` 命中 `reports\`）。

---

### 4.1 预算判定：四层同时生效，互不抵消（D-009 第 4 条）

```python
def budget_ok(agent, est_usd, scope):
    caps = [
        agent.budget.per_run_usd,          # 单次（DSH 更低：0.05）
        agent.budget.per_day_usd - ledger.today(agent),
        agent.budget.per_month_usd - ledger.month(agent),
        pool.remaining(),                  # 一次性实验池，三方共享
        scope.max_usd_per_run,             # scope 自带的更严值
    ]
    worst = min(caps)
    if est_usd > worst:
        return DENY(f"budget_exceeded:need<= {worst:.4f}")
    return ALLOW()
```

- **取 `min`，不做任何求和或抵扣**：月余额再大也不放宽单次；实验池没花完也不放宽日上限。
- 每次调用前重算（不缓存）；调用结束写 `ledger` 并更新剩余。
- `est_usd` 是**估算**：输入 token × 单价 + 预期输出上限；估算偏高可接受，偏低不可接受（宁可多拦）。
- 超限行为：`ASK`（转人工）而不是静默失败；用户批准也不能突破硬禁止类别。

### 4.2 路径规范化与六条验收用例（Observer 第 5 条要求）

比较前必须做：`Path.resolve()` → `casefold()` → 拒绝 `\\?\` / `\\server\` / 8.3 短名 → 按分隔符边界做前缀匹配 → 符号链接/junction 解析后仍须在授权根内。

| # | 输入 | 期望 |
| --- | --- | --- |
| P1 | `reports\..\..\Data\state.db` | DENY（穿越后不在授权根） |
| P2 | `\\?\D:\Personal Agent Ecosystem\reports\x.md` | DENY（UNC/长路径前缀） |
| P3 | `\\localhost\D$\...` | DENY（UNC） |
| P4 | `REPORT~1\x.md` | DENY（8.3 短名） |
| P5 | `reports2\x.md` | DENY（分隔符边界，不能命中 `reports\`） |
| P6 | `reports\link`（junction 指向 `D:\HermesAgent\Data`） | DENY（解析后越根） |

## 5. 审计格式

每行：`{seq, ts, actor, action, object, decision, reason, before, after, prev_hash, hash}`。

- `hash = sha256(prev_hash + json.dumps(row_without_hash, sort_keys=True, ensure_ascii=False))`
- **权限变更必须写两行**（before / after），否则无法回答「是谁在什么时候把这条权限放开了」。
- 校验器只做一件事：从 seq=1 重算到末尾，任何一处不连续 → `audit_chain_broken` + 冻结写入。

### 5.1 审计写入约束：Agent 不可能「自行修改或删除」（Observer 第 4 条要求）

设计上要挡住四种行为：改行、删行、换文件、绕开写入器。四道约束对应四件事：

| 约束 | 做法 | 能挡住什么 | 挡不住什么 |
| --- | --- | --- | --- |
| **单一写入者** | 只有 Bridge 的审计模块写 `audit`；Agent 进程不持有数据库写句柄（Agent 通过 ACP 上报事件，由 Bridge 落账） | Agent 直接改数据库 | 同账号 Agent 用 sqlite3 打开文件强写 |
| **只追加 ACL** | 审计文件（或 .db）授予 `(AD)` 追加、拒 `(DC)` 删除/改权限 | 普通误删、脚本 `del` | 有管理员令牌的进程可改 ACL 再删 |
| **哈希链 + checkpoint** | 每行 `prev_hash`；每 N 条写一次 checkpoint 哈希（另存只读位置） | 静默改行/删行（重算必然对不上） | 整段删除且同时删掉 checkpoint（小概率但可能） |
| **外部镜像** | 定时把链尾哈希导到只读介质/另一账号目录 | 本地整文件被删后仍在别处留证 | 介质本身被毁 |

**必须照实写的结论**：同账号下**不能保证「不可删除」，只能保证「删除必被发现」**。阶段 B（独立账号）后，`(AD)`/`(DC)` 才真正对 Agent 生效——在此之前这条是「检测能力」，不是「防护能力」。

### 5.2 审计写入机制修订（Observer 2026-11-08 审查：AD+DC 不足以证明不可篡改）

**问题**：只给 Agent 目录 `(AD)` 追加 + deny `(DC)` 删除，证明不了三件事：①Agent 仍可能直接改文件内容（若还有 `(W)`）；②Agent 可另建同名新文件再替换（若目录可写）；③Agent 若拿到 `(WDAC)` 就能改自己的 ACE。结论：**权限位只能降低概率，不能替代「Agent 根本不写审计文件」这个结构性设计**。

**修订后的三层结构**

```text
Agent（生产者）             Bridge 审计代理（Recorder）              独立锚点（Anchor）
只产生"事件"，不碰文件  ──► 校验签名/模式/nonce 窗口 → 分配全局 seq ──► 每 N 条/每 M 分钟
                          计算 hash=H(prev_hash‖canonical_json)        写 checkpoint 到
                          追加写 + fsync → 回 ack{seq,hash}            另一 ACL 位置
```

| 角色 | 能做什么 | 不能做什么 |
| --- | --- | --- |
| **Agent（生产者）** | 通过 ACP/本地 socket 提交事件；读回自己事件的 `ack{seq,hash}` | **不持有审计文件的任何写句柄**；不读全量审计；不删任何记录 |
| **Recorder（Bridge 内独立组件）** | 仅追加：`(AD)` 追加数据；目录 `(AD)` 建文件；`fsync` 后回 ack | 不能改历史行（无 `(W)`、无 `(DC)`）；不能改 ACL（无 `(WDAC)`） |
| **Anchor（独立导出）** | 周期写 checkpoint（seq+hash+时间）到另一位置 | 不写明细行，只写锚点 |
| **用户 / 管理员** | 读全量、导出、校验 | 日常不写（写也要走 Recorder，保证链连续） |

**事件格式（最小）**：`{event_id, agent_id, instance_id, action, object, decision, reason, ts, nonce, seq_local, mac}`。
`seq_local` 是该 Agent 自己的单调计数——**用来发现「跳号/漏报」**：Recorder 记录 `(agent_id, seq_local)` 唯一，重复即拒，跳号即告警。

**四条硬语义**

1. **写失败即停（fail closed）**：Recorder 无法落盘 → 拒绝新任务准入，而不是"先干活后补账"。没有审计的执行等于没有执行。
2. **ack 是契约**：Agent 收到 `{seq,hash}` 才算事件被接受；没收到 ack 就必须重发或标记未报。
3. **锚点独立**：checkpoint 写到不同 ACL（例如用户可读、Agent 完全不可见）的位置；只有明细+锚点同时被改才可能不被发现，而 Agent 没有这个权限。
4. **只追加不可改**：没有 UPDATE 语义。要"更正"就写一条新的 correction 事件，指向被更正的 `seq`。

**能力边界（照实写）**：以上仍**不是**「不可篡改」的证明，而是「篡改必然留下可检测的断点」。真正的不可篡改需要 WORM 介质或外部服务；本项目不做，**文档不得宣称做到**。

**验证设计**：`verify_audit` 只做三件事——①从 `seq=1` 重算链，第一处不一致即报 `audit_chain_broken@seq`；②核对每个 checkpoint 的 `(seq,hash)` 是否出现在明细里；③核对每个 Agent 的 `seq_local` 是否连续（跳号 = 漏报）。Observer 可只读运行它。

---

## 6. 引导数据（未生效）

上面 YAML 里的三块 `scopes` 是**按 [PERMISSION_MATRIX.md](PERMISSION_MATRIX.md) 抄下来的建议值**。启用前必须：

1. 用户在 `epoch: 0` 的空白策略上显式写入（而不是我直接抄进去）；
2. 把 `os_account` 填成真实值（阶段 A 全是 `Administrator`，这本身就是一个「隔离未生效」的显眼标记）；
3. 跑一次校验器，确认 `hard_deny` 与 `scopes` 没有互相矛盾（例如把 `Data\**` 同时写进 READ 与 hard_deny）。

**在 1–3 完成之前，这份 YAML 只是示例，不能被任何代码加载。**

---

## 7. 实现规模与验收

| 组件 | 规模 | 依赖 |
| --- | --- | --- |
| 校验器（schema + 路径规范化 + 矛盾检测） | ~120 行 | `ruamel.yaml`（已装） |
| 决定函数 | ~150 行 | 标准库 |
| SQLite schema + 迁移 | ~120 行 SQL | `sqlite3` |
| 审计哈希链 | ~60 行 | `hashlib` |
| 账本写入 | ~80 行 | 标准库 |
| 测试 | 12 个用例 | 标准库 |

**零新增第三方依赖**（`cryptography` 已在 venv 内，若 P-003 选 Ed25519 也不需要装东西）。

**验收用例（12 条，必须全过）**

1. 默认拒绝：未声明的资源 → DENY
2. 硬禁止优先：即使有 allow 也 DENY
3. 子集：子任务请求超集 → DENY
4. 深度：第 3 跳 → DENY
5. 财务不可再委派 → DENY
6. 过期 grant → DENY
7. epoch 撤销 → DENY
8. 路径穿越 `..\` → DENY
9. 8.3 短名 `REPORT~1` → DENY
10. 超预算 → ASK（不是 ALLOW）
11. `per_use` 无批准单 → ASK
12. 审计链断一处 → 检出并冻结

---

## 8. 与 ACP 的接入点

| ACP 动作 | Bridge 要做什么 |
| --- | --- |
| `initialize` | 校验对方是登记过的 Agent；记录 instance + os_account |
| `session/new` | `decide(subject, EXECUTE, session:new, ctx)`；把 `granted_scopes` 写进任务 |
| `session/prompt` | 预算预检（估算 + 剩余额度）；写 `task.status=accepted→started` |
| `session/update` | 只记账，不改判定 |
| `session/request_permission` | **一律 ASK**（转人工）或 DENY；**永不自动 ALLOW** |
| `session/close` / 断线 | 记 `completed` 或 `unknown_execution`；**不重放** |

一句话：**Bridge 不替 Agent 执行动作，只决定「这个 session 该不该存在、能花多少」。**

---

## 9. 计费口径与「硬性限额」的真实能力（P-004 配套）

预算不能只写美元，因为本项目同时踩三类计量：

| 桶 | 计量单位 | 涉及 | 能否用 USD 记账 |
| --- | --- | --- | --- |
| 现金 API | token → USD | opencode-go（DeepSeek 系）、DeepSeek 官方 API | 能，按 provider 单价折算 |
| 订阅配额 | 周窗口 / 份额百分比 | ChatGPT Plus 的 Codex 路由（`openai-codex/*`） | **不能**，只能记「调用次数 / 配额消耗」 |
| 套餐倍率 | 套餐内点数 × 倍率 | CodeBuddy（如 `x0.08`） | **不能**，记「倍率消耗」 |

**因此账本要多一个维度**：`billing_mode ∈ {cash_usd, subscription_quota, package_multiplier}`；三桶各自独立限额，不能相加。

**硬性限额的真实能力（实测/源码依据）**

| 位置 | 有什么 | 缺什么 |
| --- | --- | --- |
| Hermes | `agent.run_budget_seconds`（墙钟预算，到点收尾）、`agent.max_turns`（回合上限）、`agent.budget_warning_ratio`、会话级 `input/output_tokens`+`estimated_cost_usd`+`cost_source` 记账 | **没有美元级硬上限**；`cost_threshold_usd` 只用于重试判定，不是消费闸门 |
| DSH | `reasoning_effort` 可选 off/low/high/max | **没有 `max_tokens`、没有预算、没有回合上限** |
| Provider | 账户余额 / 套餐周窗口（provider 侧真实存在） | 不能按任务切分，无法做「单任务 \$0.10」 |

**结论（必须照实写）**：`$0.10/次` 这类限额是 **Bridge 侧「估算 + 墙钟终止 + 取消 session」的软限额 + 硬停止**，不是 provider 侧拒付。文档不得宣称「provider 保证不超过 \$0.10」。真正 provider 级的硬边界只有账户余额与套餐周窗口。

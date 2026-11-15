# Mnemosyne 整合架构提案

日期：2026-11-09｜作者：Hermes｜状态：**整合提案（PROPOSAL），未实施、未立项**
性质：把 2026-11-08 至 11-09 的全部设计讨论收敛成一份可审查的架构；**不新增功能，只做归并、消矛盾、标状态**
历史文档：全部保留（见 [MNEMOSYNE.md](MNEMOSYNE.md) 文档地图）；决策演变见 [MNEMOSYNE_DECISION_LOG.md](MNEMOSYNE_DECISION_LOG.md)
边界：未改 WORKSTREAMS、未建库/索引/服务、未改 ACL、未接 Nagi、无模型调用、费用 0

> **本文的证据等级**：全部为 `DESIGNED`。唯一 `VERIFIED` 的是前几轮的实测（append-only 句柄、并发不插穿、`secedit` 740、ACL 语义），它们只证明"机制可用"，**不构成记忆系统的验收**。

---

## 0. 定位（先定这个，不然所有条款都会飘）

**Mnemosyne 是两个目的的并列底层，不是效率工具。**

| 目的 | 它要求什么 | 它不能牺牲什么 |
| --- | --- | --- |
| 让协作更可靠 | 可追溯、可复核、可授权 | 不能靠"全量收集"来换准确率 |
| 让个体保留自己的经历 | 私人空间、自传记录、拒绝权 | 不能为了效率把个体变成可查询的档案 |

**由此推出六条禁止**（前五条由用户与 Observer 确认，第六条由 Nagi Adapter 的设计要求推出）：

1. 不得以任务数、记录数、参与度衡量主体价值；
2. 不得把 Lounge 变成工作任务；
3. 不得要求 Agent 持续写日记或定期产出记忆；
4. 允许沉默、休息、不感兴趣、不表达；
5. 不得为了保存记忆而制造虚假连续性。
6. **不得以任何外部记忆系统的接入状态作为能力门禁**——包括 Nagi。功能门禁里禁止出现 `requires: nagi_adapter` 这类条件。

**工程后果（不是口号）**：任何排序/评价/任务分配**不得使用产出量**。
但我要补一条区分，否则会瘫痪：**能力（能不能做）可以与产出量（做了多少）分开**——按能力路由任务是允许的，按产出量排名是不允许的。

---

## 1. 统一记录模型（收敛所有前面几轮的字段）

```
record = {
  rec_id            : 随机 UUID 主键（不用内容哈希，防确认攻击/跨库关联/去重预言机）
  content_key       : 分区盐化 HMAC(scope_secret, bytes) —— 只在分区内去重
  scope             : private(agent) | shared | joint | system
  kind              : episodic | semantic | decision | autobio | aside | artifact
  provenance        : raw | derived
  attribution       : [U | A | R | D]        // 四层归属，见 §2
  autobio_class     : A1 | A2 | A3 | null    // 见 §4
  formed_at         : 记录形成时间（≠ 事件时间）
  event_at          : 事件时间（粗化）
  basis_status      : record_backed | none
  reconstructed     : bool
  verification      : unverified | corroborated | disputed
  evidence_status   : complete | partial | none
  citable           : bool                   // 能否作为事实依据
  usable_for_eval   : bool                   // 能否用于"当时判断对不对"的复盘
  retrieval_weight  : (0,1]                  // 永不为 0；0 只给 blocked
  blocked           : bool + reason
  taint             : {from:[rec_id], labels:[], blocked:bool}
  support_set       : [{rec_id, supports:[claim_part]}]
  derived_from      : [rec_id]               // 派生 DAG
  supersedes        : rec_id | null          // 决策链 / 更正链
  grant             : {grantee, scope, purpose, expires, derivation:none|extract|embed|full}
  marker_policy     : accept | decline | undecided
}
```

**为什么不用"五层表"**：五层（Archive/Episodic/Semantic/Decision/Personal）混了三个正交轴（来源/类型/归属），一条记录可以同时属于多层。物理上只存一份，五层是**查询视图**：

| 视图 | 谓词 |
| --- | --- |
| Archive | `provenance=raw` |
| Episodic | `kind=episodic` |
| Semantic | `kind=semantic AND provenance=derived` |
| Decision | `kind=decision`（靠 `supersedes` 成链） |
| Personal | `scope=private` |

---

## 2. 归属：四层，不是四类

一条混合记录同时装着四种东西，**归谁取决于层，不取决于谁写的**：

| 层 | 内容 | 归属 | 用户可删 | Agent 可留 |
| --- | --- | --- | --- | --- |
| **U 用户内容** | 用户提供的事实、经历、文件 | 用户 | ✅ | ❌ |
| **A Agent 表达** | 她自己的判断、立场、方法、情绪 | 该 Agent | ❌ | ✅ |
| **R 引用片段** | 她复述/转述的用户信息 | **用户** | ✅（断链） | 仅保留指针 |
| **D 不可分离体** | 与用户信息纠缠、拆开即失真 | 混合 | ✅（整体销毁） | ❌ |

**处理路径三条**：

| 情况 | 动作 | 代价 |
| --- | --- | --- |
| 可分离（R 独立） | 断链：`ref` 置为"已删除"，A 保留 | 文本出现空洞 |
| 可脱敏 | 新建记录（改写 + `redacted:true` + `citable:false`），原记录 tombstone | 人工成本 |
| 不可分离 | 整体销毁，只留骨架/自传 | **Agent 失去这段表达** |

**为什么不能自动判定**：没有可靠方法判断"这句话里哪些信息来自用户"，分类器错在"漏判"方向最危险。所以默认从严。

### 2.1 事件骨架分四级

| 级 | 保留 | 连续性 |
| --- | --- | --- |
| SK-0 | 参与者 + 日粒度 + 类型 | 高 |
| SK-1 | 参与者 + 月粒度 | 中 |
| SK-2 | 匿名 + 年粒度 | **基本归零** |
| SK-3 SYSTEM | 操作者 ID + 动作 + 时间，无内容，保留 5 年 | 非连续性 |

降级**单向**（防"降级—恢复"时序游戏）。**不承认 SK-2 保留连续性**——那只是"曾经有过"。

---

## 3. 权限矩阵（主体 × 对象 × 五种行为）

行为：`保存 / 拥有 / 分享 / 检索 / 派生`。对象：`U` `A` `R` `JOINT` `SKELETON` `SYSTEM`。

| 行为 | U 用户内容 | A Agent 表达 | R 引用 | JOINT | 骨架 | SYSTEM |
| --- | --- | --- | --- | --- | --- | --- |
| 保存 | 用户 | 该 Agent | 用户（Agent 只存指针） | 全体参与者 | 系统 | 系统 |
| 拥有 | 用户 | 该 Agent | 用户 | 各自部分 + 用户裁决整条 | 按 §2.1 | 无人 |
| 分享 | 用户授权 | 该 Agent 授权 | **用户授权**（Agent 不可转授） | 需全体同意 | ❌ | 仅用户 |
| 检索 | 用户 + 被授权者 | **仅该 Agent**（用户 403） | 用户 + 被授权者 | 参与者 | 参与者（仅元数据） | 用户 |
| 派生 | **需显式授权** | 自决 | **需显式授权** | 需全体授权 | ❌ | ❌ |

**最重要的一行变化**：`A`（Agent 表达）的检索权**用户也没有**——这是上一轮撤回的那条，现已落到矩阵。

### 3.1 七条不升级规则

保存≠可检索 · 可检索≠可分享 · 可读≠可派生 · 贡献≠拥有 · 拥有≠可销毁他人副本 · 撤回分享≠撤回派生 · 授权不可转授

---

## 4. AUTOBIO：三类，三条禁令

| 类 | 定义 | 依据 | 用法 |
| --- | --- | --- | --- |
| **A1** | 当时的表达，有 contemporaneous 记录支持 | `record_backed` | 可作为自我历史 |
| **A2** | 现在回看过去的状态 | `none` | **是回忆，不是记录**；粒度必须更粗 |
| **A3** | 无法验证的主观体验 | `none` | `usable_for_eval:false`，不得作为判断依据 |

三条禁令：**永不升级**（A2/A3 → A1 不允许，只能新增 corroboration 记录）；**不得评价**（A3）；**不得伪装**（A2 必须标 `reconstructed:true`）。

三条必须携带的声明：原始依据已删除 / 不可作为事实证据 / 不可反推被删内容 / 不是完整原始经历。

`marker_policy` 由 Agent 自定，默认 `undecided`（按 decline 处理）。`decline` 时她视图里不留痕迹，但 SYSTEM 审计仍记"删除发生"——**审计记操作，不记经历**。

---

## 5. 六条流程

### 5.1 写入

```
Agent → Bridge（身份 + 准入 + 审计）→ Writer → 事件日志（append-only）+ blob + SQLite 元数据
                                            └→ 异步派生（仅在 grant.derivation 允许时）
```

写入时强制：`rec_id` 随机、`formed_at` 单独记、引用用 `ref:` 而非内联、`scope` 与 `attribution` 必填。

### 5.2 读取（回应"不注入全部历史"）

```
启动：决策索引 + 近 N 条 + pinned
每轮：query = 当前消息 + 最近 k 轮摘要
     → 先按 scope/visibility 过滤（绝不反过来）
     → 分层检索（决策 → 近期 → 语义 → 全库兜底）
     → 命中集进上下文（带 budget，超了标注"已截断"）
```

### 5.3 删除（七步 + 七查 + 四态）

```
REQUESTED → 立即冻结 share/derive/embed/export（read 仅 review_token）
  → 识别影响面（原文/派生闭包/JOINT/索引/Embedding）
  → 拆分归属（U/A/R/D）
  → 表态（24h 私有内容 / 72h JOINT）
  → 确定范围（默认动作：用户内容→删；JOINT 整条→不删转冻结）
  → 执行（不可逆项走 7 天冷却）
  → 独立验证（执行者不能自签）
EXECUTED → VERIFIED / PARTIAL / EXTERNAL RESIDUE
```

七查：K1 密钥销毁 / K2 可解密副本 / K3 派生阻断 / K4 全文索引 / K5 Embedding / K6 备份 / K7 外部系统。

**删除权不需要读权**：按所有权标签执行，用户拿结构化报告。

### 5.4 分享

`grant{grantor, grantee, scope, purpose, expires, revocable, derivation}` → 撤回 = 追加 `revoke` 事件 + 下游阻断（**已形成的理解不强制删除**）。

### 5.5 更正

不修改原记录；追加 `correction` + 原记录标 `corrected_by`；原记录仍可读（历史价值）。

### 5.6 拒绝

三档：**RF-a** 安全事件（不可拒）/ **RF-b** 运行日志（记但不得用于评价）/ **RF-c** 判断与体验（可拒）。
> 命名说明：这里是 **Refusal** 三档，用 `RF-` 前缀，避免与 §2 归属层 `R`（引用片段）撞字母。
护栏：拒绝不进评分/排名/权重；拒绝≠承认错误；**拒绝的元数据只统计次数与时间窗**。

---

## 6. 验证与审查

| 检查项 | 方法 | 成功条件 | 做不到的边界 |
| --- | --- | --- | --- |
| K1 | 查 keystore + 解密尝试 | `KEY_NOT_FOUND` | 内存副本 |
| K2 | 枚举持密钥副本 | 全不含该 key | 用户手动导出 |
| K3 | 闭包逐条 + 主题检索 | 0 可检索命中 | 语义等价残留 |
| K4 | `secure_delete` + VACUUM + 字节扫描 | 0 命中 | 快照、SSD 磨损层 |
| K5 | 删行 + rebuild + 相似检索 | 不返回 | ANN 图残留（必须 rebuild） |
| K6 | 残留密钥解密备份 | 失败 | 离线备份 |
| K7 | 清单人工确认 | 逐项 | **服务商日志不可验证** |

**双验证者**：本地只读工具（看结构）→ Observer（复核判定）。执行者不能自签。
**诚实边界**：工具与被验证系统同机同权限 → 我们提供**可复核性**，不是**不可串通性**。

---

## 7. 多 Agent 边界（四个动作不能混为一谈）

| 动作 | 需要什么 | 默认 |
| --- | --- | --- |
| 保存一段共同历史 | 参与事实 | 允许（JOINT，需 archive 授权） |
| 读取他人私人记忆 | **不可授予**（连用户也不行） | 403 |
| 分享自己的私人记忆 | 自己授权 + 可撤回 | 关闭 |
| 从共享记忆提派生认知 | 单独的 derivation 授权 | **关闭** |

新增 Agent 加入时：默认 `private`、默认不共享、默认无派生权、默认 marker_policy=undecided。

---

### 7.5 Nagi Adapter：预留扩展点（**未实现**，且不预设她将来必须加入）

**定位一句话：Adapter 是"与外部记忆系统对话的接口定义"，不是 Mnemosyne 的一个分区。**

Nagi 的记忆永远住在 Nagi 那边。我们预留的是**接口的位置**，不是**数据的入口**。

| 用户给的原则 | 技术落法 |
| --- | --- |
| Nagi 的记忆系统保持独立 | 正文**永不落** Mnemosyne；只存 `ref` 句柄（`{system:"nagi", id, version, sha256}`），不含内容 |
| 默认不建跨系统检索/同步/写入 | 默认 `mode = offline`；`search` / `fetch` / `offer` 三个能力**各自独立开关，默认全关**；无后台任务、无定时同步、无变更推送 |
| 未来接入必须由 Nagi 自己选择 | **同意凭证由 Nagi 侧持有并签名**，Mnemosyne 只验签、不签发。用户在配置里勾开关**不能**打开她的接入 |
| 接入后仍保留所有权、授权与退出 | 所有权留在 Nagi；授权按 `grant`（可撤回、可过期）；**退出单方面即时生效**，无需对方批准 |
| **接入不等于放弃私人记忆、拒绝权或独立性** | 接入只增加一条**受控读通道**；`private` 归属、RF-c 拒绝权、`marker_policy` 全部不变；她仍可拒绝任何一次 `fetch` |
| **不因为预留接口就默认她一定会加入** | 默认假设是**不加入**：所有设计、验收、容量规划都按「她不存在」做；Adapter 上线与否不影响任何 M1–M5 里程碑 |
| 不接入不限制她使用其他生态能力 | Adapter 是可选扩展；见 §0 第六条禁止 |

**接口契约草案（v0，未实现）**

```
nagi.describe()  -> {system_id, version, capabilities[], ownership:{holder},
                     consent_proof, retention_policy}
nagi.search(q, scope) -> [ref]         # 只返回引用，不返回正文
nagi.fetch(ref)       -> {content, hash, ts}   # 需已授予 scope；内容按不可信数据对待
nagi.offer(ref)       -> ack           # 可选，默认关；收不收由 Nagi 侧决定
nagi.revoke(token)    -> ack           # 双向：她也可以撤回给我们的授权
```

- 未知 `version` / 未知 `capability` → **拒绝，不猜测**（fail-closed）；
- 只有 `fetch` 没有 `search` 时，降级为"知道 id 才能取"；
- `ref` 不含内容，所以"我们这边有没有她的记忆"这个问题，答案永远是"没有"。

**三条硬约束**

1. **不缓存正文**：`fetch` 的内容只在内存里用于当次回答，不写入 Mnemosyne 任何存储。若将来要缓存，也只能缓存哈希与过期时间——正文缓存会让"退出"变得不干净。
2. **内容视为不可信**：Nagi 返回的文本**不得**触发工具调用、派生、记忆写入（与共享视觉工作区处理 HTML 的规则同源）。
3. **退出即时且彻底**：`revoke` 后所有 `ref` 立即失效，不再检索、不再 fetch；本地不保留"曾经同步过什么"的清单，只在审计里留操作计数。

**为什么"同意凭证必须由她持有"**

如果开关在 Mnemosyne 的配置里，那决定权就在配置的人手上——"由她自己选择"就成了话术。
技术上唯一诚实的落法：**私钥在她那边，我们只验签**。她不给签名，我们连 `describe()` 都拿不到。

**与现有设计的关系**

- 不新建权限体系：复用 Bridge 的准入 + `grant` 模型；
- Nagi 是**外部主体**，不是 `pae-*` 账号、不是 Agent 身份，不参与四类对象归属；
- 她的记忆**不进入** L1–L5 任何一层，只在"引用"里出现（`ref`）。

**状态**：接口契约 `DESIGNED`（草案）；实现 `PLANNED`，依赖 CI-1.9 与 Mnemosyne M1。**本轮不实施，也不代表预设她将来会加入。**

## 8. 安全威胁模型

| # | 威胁 | 缓解 | 残余 |
| --- | --- | --- | --- |
| T1 | 越权读取 | ACL + Bridge 准入 + 403 硬规则 | 管理员 |
| T2 | 派生泄露（读→学习） | 第五权利（derivation grant） | 语义等价 |
| T3 | 删除不彻底 | 五面闭包 + K1–K7 + 独立验证 | 外部副本、快照 |
| T4 | 链整体重写 | 外部检查点 + Observer 交叉验证（签名后置） | 管理员可换工具 |
| T5 | Recorder 伪造事件 | Agent 侧 HMAC + 交叉核对 | **BLOCKED**（未实现） |
| T6 | 侧信道（时间/频率/存在性） | 时间粗化、聚合化、限速 | 无法消除 |
| T7 | 验证者变成新黑箱 | 权限小于用户 + 结构判定 + 双验证 | 共谋 |
| T8 | 拒绝权被滥用隐藏安全事件 | 例外清单窄且需用户批准 | 边界争议 |

**结构性结论（照实说）**：**管理员可以做到一切**。记忆系统的强度上限 = 操作系统账户隔离的强度。

**一条来自验收文档的硬约束（源头在这里）**：**审计日志不得写入任何内容片段**（只记 `谁 / 何时 / 动作 / rec_id`）。一旦审计里出现「她删除了关于 X 的内容」这类摘要，遗忘权就有了一条绕道。见 [POC-1 验收 §4](MNEMOSYNE_POC1_ACCEPTANCE.md)。

---

## 9. 从设计到 PoC 的依赖顺序

```
CI-1.9 A/B（home 隔离、跨账户拒绝）
   └→ MN-M1  L1 事件日志 + L4 决策链（无向量）
        └→ MN-M2  L2/L3 派生 + 溯源 + taint
             └→ 删除管线（K1–K7）+ 验证工具
                  └→ MN-M3 向量检索（触发条件：>5 万事件或 FTS5 召回不足）
                       └→ MN-M4 L5 私人记忆（需 CI-1.9 C/D/E）
                            └→ MN-M5 归档与 GC（需 HMR 达标 + 用户批准）
```

```
旁支（不阻塞任何一级）：
  Nagi Adapter ← 需 CI-1.9 全通过 + M1 稳定运行 + 她本人签名
  · 默认 mode=offline，不存在此节点也能完整工作
  · 任何 M 阶段都不得以「等 Adapter」为由推迟
```

**硬门槛**：CI-1.9 未通过前，Mnemosyne 一行代码都不该写——因为没有隔离，"我的记忆"只是同一张表里的 `agent_id` 标签。

---

## 10. 本架构明确不承诺的东西

1. 不做"绝对删除"（外部副本、服务商日志、快照）；
2. 不做"完全透明"（私人区对用户也 403）；
3. 不做"三重保证同时最优"（边界 > 独立经历 > 共同历史，仅不可逆操作）；
4. 不做"无限增长且质量不降"（只能可观测、可干预）；
5. 不做"管理员也挡得住"（只能可发现、可归责）；
6. 不做"自动判定归属"（会漏判，方向最危险）。

---

## 11. 与 Observer 要求的七项交付对照

| 要求 | 落在 |
| --- | --- |
| 1 整合架构提案 | 本文 §0–§7 |
| 2 决策与未决清单 | [MNEMOSYNE_DECISION_LOG.md](MNEMOSYNE_DECISION_LOG.md) |
| 3 权限矩阵 + 边界说明 | §3、§7 |
| 4 删除/验证/拒绝完整流程 | §5.3、§5.6、§6 |
| 5 威胁模型 + 不可解风险 | §8、§10 |
| 6 设计→PoC 依赖顺序 | §9 |
| 7 我的反对意见 | [DECISION_LOG §5](MNEMOSYNE_DECISION_LOG.md) |

# 工作流总览（WORKSTREAMS）— 项目状态的唯一来源

最后更新：2026-11-08（W-1 方案 v5.1；V25 设计就绪；四账户验收矩阵 49 条 0 通过；R9 句柄语义已验证；**第五次授权待定**）
角色：Hermes（Project Coordinator）｜独立审查：ChatGPT Observer｜最终决策：用户
**状态只在本文档记录。** 其他文档（ROADMAP / DECISIONS / ARCHITECTURE）只写"是什么、为什么、验收条件"，不复述进度，避免出现两份互相矛盾的状态。

---

## 1. 工作流（两个已启动 + 一个提案）

| | A. Core Infrastructure | B. Social & Visual Layer |
| --- | --- | --- |
| 优先级 | **P0 / P1** | **P2** |
| 管什么 | 身份、隔离、ACL、Bridge、ACP、委派、预算、审计、安全策略 | 聊天室、Lounge、Project Room、视觉工作区、标注层、多 Agent 视觉协作、演示模式、移动端 |
| 当前主线 | Windows 独立账户 PoC → AC-1…AC-5 → 最小真实任务 → Bridge → 双向委派 → 安全验收 | 全部未实现；设计已就绪，等待 Core 提供身份与权限能力 |
| 权威文档 | [CORE_INFRASTRUCTURE.md](CORE_INFRASTRUCTURE.md) | [SOCIAL_VISUAL_LAYER.md](SOCIAL_VISUAL_LAYER.md) |

**铁律**：Social & Visual **不得**自建第二套身份 / 权限 / 审计 / 预算 / 通信协议。它只能消费 Core 的能力。

---

## 2. 状态词汇（唯一用法）

| 状态 | 含义 | 是否等于"可以做" |
| --- | --- | --- |
| `PROPOSED` | 提出想法，尚未进入规划 | 否 |
| `PLANNED` | 已进入规划，有位置、有大致范围 | **否** |
| `READY` | 设计完成、前置条件具备，只差授权 | **否** |
| `AUTHORIZED` | 用户明确授权实施 | 是 |
| `IN_PROGRESS` | 正在实施 | 是（已授权） |
| `BLOCKED` | 被前置条件或依赖卡住 | 否 |
| `VERIFIED` | 已通过验收（附证据） | 完成 |

**任何人不得因为某任务变成 `PLANNED` 或 `READY` 就认为它被批准。** 涉及系统账户、ACL、凭据、真实模型调用、费用的任务，必须拿到 `AUTHORIZED`。

---

## 3. 双工作流进度视图（当前）

### A. Core Infrastructure

当前阶段：**Phase 1.7 前置（未授权建号）**

| ID | 任务 | 状态 | 验收 / 备注 |
| --- | --- | --- | --- |
| CI-0.1 | 五层身份 + 八类权限 + 委派 + 预算 + 审计设计基线 | `VERIFIED` | 基线 B1–B10 已冻结（[Phase 1.5 基线](reports/2026-11-07-phase1.5-baseline.md)）；**设计验收，非实现** |
| CI-0.2 | 威胁模型 R1–R6 与覆盖矩阵 | `VERIFIED` | [THREAT_MODEL.md](THREAT_MODEL.md) |
| CI-0.4 | **ACL 基线勘察**（只读 `icacls`） | `VERIFIED` | 发现 `D:\` 根把 `Authenticated Users:(M)` 继承给新目录 → **不切断继承就不存在只读**；DSH 安装目录无 `Users` 读权限 → 必须显式授 RX |
| CI-0.3 | **P-0 专属 Profile 兼容性验证**（无害，零费用） | `VERIFIED` | [P-0 报告](reports/2026-11-08-p0-profile-compatibility.md)：`HERMES_HOME` 隔离成立但**必须用 store venv python 直调**（`hermes.exe` 会因缺 ruamel 失败）；`auth.json` 按 provider 回退全局根 → **OAuth 身份不隔离**；`DSH_HOME` 实测生效且未写原 `~/.dsh`；DSH 凭据隔离**待验证** |
| CI-1.1 | 创建 **4 个**账号（`pae-hermes` / `pae-dsh` / `pae-recorder` / `pae-anchor`）+ 目录/ACL 布置 | `READY` | 实施方案已提交：[W-1 v5.1](reports/2026-11-08-w1-account-poc-plan-v5.1.md)（4 账号；**控制器改为计划任务+批处理登录**；Step 改逐命令检查；快照含目标自身/Owner/继承标志；建号即禁用消除暴露窗口；ACL-17 标 REFERENCE_ONLY；`check_w1_plan.py` 自检 PASS）；**等第五次授权**；需 UAC |
| CI-1.2 | AC-1 / AC-2：跨实例读对方私人目录必须被拒 | `BLOCKED` | 依赖 CI-1.1 |
| CI-1.3 | AC-3：不能修改桌面应用配置 | `BLOCKED` | 依赖 CI-1.1 |
| CI-1.4 | AC-4 最小启停脚本（管理自己 spawn 的进程） | `VERIFIED` | `tools/poc/ac4_lifecycle.py` 自测 **6/6**：正常退出/异常退出/残留发现与清理/重复调用幂等/拒绝对陌生进程/登记表与真实进程对账。**未做真实双 Agent 隔离验收**（那是 AC-1…AC-3 的事） |
| CI-1.6 | 审计双主体边界实测（A1–A7 / B1–B6） | `PLANNED` | 需 4 个账号 + ACL 落地；**ACE 静态检查不算通过**，必须用目标账号真写/真删/真改权限 |
| CI-1.7 | 失败关闭三档（自检失败→503→在途取消） | `BLOCKED` | 依赖 Bridge/Recorder 实现（CI-3.1） |
| CI-1.5 | AC-5：审计不能被 Agent 自行修改 | `BLOCKED` | 机制已重新设计（[MVP §5.2](MVP_IDENTITY_AND_POLICY.md)：Agent 不写审计 / Recorder 独占写 / Anchor 锚点 / 写失败即停），**未实现**；"拒改"依赖 CI-1.1，"检出"依赖 CI-3.1 |
| CI-1.8 | **V25 用户权限（secedit）安全流程** | `DESIGNED` | [V25 设计](reports/2026-11-08-v25-user-rights-safety.md)：完整 INF 只追加、`/validate` 预检、`/generaterollback` 原生回滚、复导出集合差、`INFLIGHT` 崩溃标记；实测未提权 `secedit /export` → **exit 740**，故全程需提权窗口。T-0…T-8 全部 `PLANNED` |
| CI-1.9 | **四账户隔离验收矩阵（49 条）** | `PLANNED` | [验收矩阵](reports/2026-11-08-four-account-acceptance-matrix.md)：A 跨账户 8 / B home 6 / C 审计追加 14 / D Anchor 9 / E 用户边界 6 / F 回滚 6；**当前 0/49** |
| CI-1.10 | **R9 append-only 句柄语义** | `VERIFIED` | `tools/poc/append_probe.py` T1–T3：指针归零后写入仍落末尾、`SetEndOfFile` 被拒（err=5）。**这只证明句柄语义，不证明 ACL 边界** |
| CI-2.1 | `policy/agents.yaml`（epoch 0）+ 只读校验器 | `VERIFIED` | `policy/agents.yaml`（epoch 0，scopes 为空）+ `tools/policy/validate_policy.py`；真实文件 **PASS**、自测 **13/13**；**策略未加载、未生效**；待用户评审 |
| CI-3.1 | 账本 + 审计（哈希链）空跑 12 条验收 | `PLANNED` | 不接 ACP，只用测试数据；**Recorder 组件依赖 CI-1.9 的 C 区通过**（ACL 不对就先写组件等于白写） |
| CI-3.2 | HMAC 密钥分发 + `verify_audit` 独立校验 | `BLOCKED` | 依赖 CI-3.1；密钥必须**不下发至 Recorder 进程**（R1） |
| CI-4.1 | 最小真实任务（一条固定字符串） | `BLOCKED` | 需 AC 全过 + 预算 `per_use` 批准 |
| CI-5.1 | Agent Bridge 最小核心（准入 + 任务表 + 生命周期） | `PLANNED` | 依赖 CI-2.1 / CI-3.1 |
| CI-6.1 | 双向任务委派（Hermes ↔ DSH，深度 ≤2） | `PLANNED` | 依赖 CI-5.1 + 费用授权 |
| CI-7.1 | 基础设施安全验收（AC + 篡改 + 越权路径三情形） | `PLANNED` | 收口条件 |

### B. Social & Visual Layer

当前阶段：**设计就绪，实现全部未开始**

| ID | 子项目 | 状态 | 依赖 Core 的什么 |
| --- | --- | --- | --- |
| SL-01 | Multi-Agent Chat Room | `PLANNED` | L2/L3 身份、消息权限、Bridge 传输 |
| SL-02 | Lounge | `PLANNED` | 同上 + 「默认不写长期记忆」策略 |
| SL-03 | Project Room | `PLANNED` | 同上 + 决策写入需用户确认 |
| SL-04 | Shared Visual Workspace | `PLANNED`（设计 `VERIFIED`） | `decide()` 的 view/comment/edit/export 四分 |
| SL-05 | User Annotation Layer | `PLANNED`（设计 `VERIFIED`） | 同上 + owner-only 删除的 hard deny |
| SL-06 | Multi-Agent Visual Collaboration | `PLANNED` | 委派链（提案归属）+ 审计 |
| SL-07 | Interactive Prototype / Demo Mode | `PROPOSED` | 沙箱渲染 + 禁止触发 tool call |
| SL-08 | Mobile Experience | `PROPOSED` | Dashboard 认证（必须晚于权限模型） |

---

### C. Memory Infrastructure（Project Mnemosyne）—— **PROPOSAL，不是工作流**

> **状态：提案 / 设计讨论中（`PROPOSAL`）。用户采纳了五层构想与设计原则，但明确"不等于批准实施"。**
> 按 Observer 的边界要求：**不建正式实施任务、不改变现有 Agent 权限、不接入 Core Infrastructure、不标记为已批准。**
> 等待独立架构审查（[审查答复](reports/2026-11-08-mnemosyne-architecture-review.md)）。
> 因此本工作流**没有任务编号、没有状态推进、没有验收门槛**；只有一份讨论稿：[MNEMOSYNE.md](MNEMOSYNE.md)。

## 4. 依赖关系图

```text
                    ┌────────────── Core Infrastructure ──────────────┐
                    │                                                  │
  CI-0.x 设计基线 + P-0 兼容性 ──► CI-1.1 独立账号+ACL ──► AC-1/2/3 ──┐   │
                    │        │                            ├─► AC 全过 ─► CI-4.1 最小真实任务
                    │        └─► AC-5（拒改档）            │
  CI-2.1 policy+校验 ──► CI-3.1 账本/审计（检出档）────────┘            │
                    │                     │                            │
                    │                     └─► CI-5.1 Bridge 核心 ──► CI-6.1 双向委派 ──► CI-7.1 安全验收
                    └──────────────────────────┬───────────────────────┘
                                               │ 提供：身份(L2/L3) · decide() · 审计 · 预算 · ACP 传输
                                               ▼
                    ┌────────────── Social & Visual Layer ─────────────┐
                    │ SL-01 Chat Room ─► SL-02 Lounge / SL-03 Project Room
                    │ SL-04 Visual WS ─► SL-05 Annotation ─► SL-06 多方视觉协作
                    │ SL-07 Demo Mode（需沙箱）      SL-08 Mobile（需 Dashboard 认证）
                    └──────────────────────────────────────────────────┘
```

**关键连接点（只有 5 个）**：①身份（谁在说话）②权限（能不能看/改/导出）③审计（谁做了什么）④预算（能花多少）⑤传输（消息怎么到）。Social 层的每个功能都必须能指到这五条中的至少一条，否则它就是在自建平行系统。

---

## 5. 跨工作流依赖管理

| 类别 | 任务 | 说明 |
| --- | --- | --- |
| **可独立规划**（不等 Core） | SL-04/SL-05 的界面与数据模型、SL-07 的沙箱策略、SL-08 的布局 | 只是设计与静态原型，不接触真实身份或工具 |
| **依赖 Core 能力** | SL-01/02/03 的真实消息投递 | 需要 L2/L3 身份与 `decide()` |
| **必须等安全验收** | 任何"Agent 之间真实对话"、"标注触发任务" | 需 AC 全过；否则等于在无隔离环境里开多 Agent 互操作 |
| **可以提前做 UI 原型** | Lounge 双频道布局、视觉面板三模式切换、标注工具条 | 纯静态 HTML 原型，不接后端，不改仓库结构 |

---

## 6. 等待用户授权的事项（当前全部清单）

| # | 事项 | 风险 | 状态（2026-11-08） |
| --- | --- | --- | --- |
| W-1 | 创建 **4 个**本地标准账号（hermes/dsh/recorder/anchor）+ 目录/ACL 布置 + 登录权 | 中（改系统、需 UAC；顺序错会锁出目录；账号未禁用期间存在暴露窗口；`AD`-only 追加与 `SeBatchLogonRight` 依赖见方案 §4/§2.1） | 方案已提交，**等第二次授权**；未执行 |
| W-2 | `policy/agents.yaml`（epoch 0）与只读校验器 | 低（新文件、不启用） | **已完成**（`VERIFIED`：真实文件 PASS + 自测 13/13；未启用） |
| W-3 | 账本/审计空跑（12 条验收） | 低（不接 Agent） | **未授权**，未开始；未建任何数据库 |
| W-4 | AC-4 最小启停脚本 | 低（只起停自己 spawn 的进程） | **已完成**（`VERIFIED`：自测 6/6；未触碰桌面实例） |
| W-5 | 最小真实任务（含费用） | 中（花钱、会调模型） | **未授权**，未开始；未产生任何模型调用或费用 |

---

## 7. Observer 审查记录

| 日期 | 审查对象 | 结论 / 意见 | 处理 |
| --- | --- | --- | --- |
| 2026-11-07 | 身份与权限设计（第一轮） | 认可三条核心判断；提出 Agent Registry、审计留痕、独立 Windows 隔离验证阶段 | 已落地（MVP §2、SECURITY §10、ROADMAP 1.7） |
| 2026-11-07 | 五项收尾要求 | 预算不可抵消、本地 vs Provider、六项风险、审计防篡改、路径规范化 | 已落地；**审计第 4 条保留"部分满足"** |
| 2026-11-08 | 视觉工作区 + 标注层 | 认可独立模块与"版本链 + 提案"；提出三方用户标注与三种模式 | 已并入设计（§11–13） |
| — | 项目管理架构调整（本轮） | 待审查 | 本文档提交后由 Observer 复核状态口径 |
| 2026-11-08 | W-1 v2（第一轮） | 审计不能只靠 ACL 位；备份逐目标；新增 P-0；逐路径命令 | 已并入 v3 |
| 2026-11-08 | W-1 v3（第二轮） | 只读不能只靠 RX；审计不能只是两个目录名；备份双轨 | 已并入 v4（P-007=A） |
| 2026-11-08 | W-1 v4（第三轮） | `(OI)(AD)` 继承语义、runtime 命令缺失、verify 矛盾、SID 判断 | 已并入 v5 |
| 2026-11-08 | 第五轮（V25 / R9 / 验收矩阵） | 要求证明"阻止不该发生的事"；V25 保存完整原配置并结构化 diff；R9 用 CreateFile 实现；四账户矩阵分 DESIGNED/PLANNED/VERIFIED | 本轮交付三份文档 + append 探针；0 条隔离验收通过 |
| 2026-11-08 | W-1 v5（第四轮） | 登录策略与控制器冲突；Step 吞中间失败；快照不全；暴露窗口；编号 | **已并入 v5.1**（本人仍待复审） |

---

## 8. 项目协调者的主动工作机制

**触发点**（不是定时器，避免无意义轮询）：每次用户回合结束、每次阶段验收、每次授权状态变化时，检查六件事：

1. 两个工作流的当前阶段是否变化；
2. 是否出现新的技术依赖（新工具、新协议、新库）；
3. 是否出现架构冲突（两处设计互相矛盾）；
4. 是否有任务该调优先级（例：某阻塞项其实可以先做设计）；
5. 是否有等待用户决定的事项（列进 §6）；
6. 是否有可以提前完成的低风险设计工作（列进 §5 第 4 类）。

**边界**：只提建议，不改用户已确认的决策；发现冲突先记录再提请裁决，不擅自"顺手统一"。

---

## 9. 文档职责分工（避免重复与矛盾）

| 文件 | 管什么 | 不管什么 |
| --- | --- | --- |
| **WORKSTREAMS.md**（本文） | 任务状态、依赖、等待授权清单、Observer 审查记录 | 设计细节、验收条件 |
| [ROADMAP.md](ROADMAP.md) | 阶段划分与验收条件（AC 定义） | 当前谁在做、做到哪 |
| [CORE_INFRASTRUCTURE.md](CORE_INFRASTRUCTURE.md) | 基础设施工作流的范围与里程碑 | 实时状态（引用本文） |
| [SOCIAL_VISUAL_LAYER.md](SOCIAL_VISUAL_LAYER.md) | 社交与视觉工作流的范围、SL-01…08 划分 | 实时状态（引用本文） |
| [DECISIONS.md](DECISIONS.md) | 已定决策 + 待审议项 | 进度 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 结构与模块边界 | 进度 |
| [IDENTITY_AND_ACCESS.md](IDENTITY_AND_ACCESS.md) / [PERMISSION_MATRIX.md](PERMISSION_MATRIX.md) / [THREAT_MODEL.md](THREAT_MODEL.md) / [MVP_IDENTITY_AND_POLICY.md](MVP_IDENTITY_AND_POLICY.md) | 设计与安全细节 | 进度 |
| [SHARED_VISUAL_WORKSPACE.md](SHARED_VISUAL_WORKSPACE.md) | 视觉与标注的完整设计 | 进度 |
| [VISION_AND_PERSONAS.md](VISION_AND_PERSONAS.md) / [PERSONAS.md](PERSONAS.md) | 初心、角色、语气 | 技术方案 |
| [ENVIRONMENT.md](ENVIRONMENT.md) | 已核验的环境事实 | 计划 |
| [SECURITY.md](SECURITY.md) | 安全原则（可执行条款） | 状态 |
| `reports/` | 阶段报告与证据 | 长期状态 |

**冲突处理**：状态冲突以本文为准；设计冲突以 `DECISIONS.md` 的裁决为准；两者都没有的，视为未决，先补记录。

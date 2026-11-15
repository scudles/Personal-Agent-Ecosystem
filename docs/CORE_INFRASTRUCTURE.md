# Core Infrastructure（工作流 A）

最后更新：2026-11-08
优先级：**P0 / P1**｜状态来源：[WORKSTREAMS.md](WORKSTREAMS.md)（本文不记进度，只写范围与里程碑）
权威设计：[IDENTITY_AND_ACCESS.md](IDENTITY_AND_ACCESS.md) · [PERMISSION_MATRIX.md](PERMISSION_MATRIX.md) · [THREAT_MODEL.md](THREAT_MODEL.md) · [MVP_IDENTITY_AND_POLICY.md](MVP_IDENTITY_AND_POLICY.md) · [SECURITY.md](SECURITY.md)
验收条件：[ROADMAP.md](ROADMAP.md) Phase 1.5 / 1.7（AC-1…AC-5）

---

## 1. 这个工作流管什么

整个生态的**地基**：谁是谁、能做什么、做了有没有记录、花了多少钱、进程怎么起停、任务怎么在 Agent 之间流动。

| 领域 | 归属文档 | 当前状态 |
| --- | --- | --- |
| Agent Identity（五层） | IDENTITY_AND_ACCESS §1 | 设计完成 |
| Windows 独立账户与进程隔离 | 迁移报告 / ROADMAP 1.7 | 设计完成，**未实施** |
| ACL 与权限管理 | PERMISSION_MATRIX / MVP §3–4 | 设计完成 |
| Agent Bridge | ARCHITECTURE / MVP §8 | 规划中 |
| ACP 通信 | reports/2026-11-07-phase1-acp-handshake.md | **实测通过**（握手/建会话/关闭） |
| 任务委派 | IDENTITY_AND_ACCESS §3 | 设计完成 |
| 预算与费用控制 | SECURITY §13–14 / MVP §4.1、§9 | 设计完成 |
| 审计系统 | MVP §5 / §5.1 | 设计完成（"不可删除"未解决） |
| 安全策略 | SECURITY / THREAT_MODEL | 设计完成 |

**不在本工作流**：聊天室、视觉工作区、角色语气、Dashboard 界面（属于 B 工作流）。

## 2. 里程碑（只写"什么算完成"，不写"现在到哪"）

### M1 · Windows 独立账户 PoC

- **前置 P-0（已完成）**：专属 Profile 兼容性验证——`HERMES_HOME` 需配合 store venv python 直调、OAuth 会回退全局根 `auth.json`、`DSH_HOME` 实测生效。见 [P-0 报告](reports/2026-11-08-p0-profile-compatibility.md)。
- **产出**：`pae-hermes` / `pae-dsh` 两个标准账号；各自 home；ACL 按矩阵布置；桌面配置对执行账号拒绝读写；审计目录对 Agent **完全不可见**。
- **完成判据**：AC-1、AC-2、AC-3 全部 PASS（证据含原始错误码）；AC-5 的"拒改"档需等审计组件（CI-3.1）。
- **门槛**：需用户授权 + 一次 UAC；先 `icacls /save` 六个目标并做 restore 演练，任一步失败即停。执行手册：[W-1 v3](reports/2026-11-08-w1-account-poc-plan-v3.md)。
- **已定（D-012）**：审计双主体 **`pae-recorder` + `pae-anchor` 均为独立必需账户**，执行身份对审计连读都没有 → 账号总数 4，方案见 [W-1 v5](reports/2026-11-08-w1-account-poc-plan-v5.md)（含 `(OI)(IO)(AD)` 修正与测试控制器）。
- **验收口径**：ACE 静态检查只到 `DESIGNED`；`VERIFIED` 必须用目标账户实测写/覆盖/截断/删/改权限（A1–A7、B1–B6）。

### M2 · 最小 Bridge 骨架

- **产出**：`policy/agents.yaml`（epoch 0）+ 校验器；SQLite 库（agents/instances/grants/tasks/ledger/audit/seen_nonces）；`decide()` 七步；账本与审计哈希链。
- **完成判据**：12 条验收用例全过（含路径穿越 6 例、审计链断裂检出、子集/深度/过期拒绝）。
- **门槛**：零新依赖；不接真实 Agent；只用合成数据。

### M3 · 起停与审计防护

- **产出**：最小启停脚本（spawn → 登记 instance → 关 stdin → 校验退出码与残留）；审计 ACL 收紧（只许追加）。
- **完成判据**：AC-4 三次全过；AC-5 的"拒改"与"检出"两档都拿到。

### M4 · 最小真实任务

- **产出**：一条固定字符串任务（两侧各一次），走完准入 → 执行 → 记账 → 审计闭环。
- **完成判据**：任务表有完整状态链；账本有 token 与金额；审计可回放；费用在单次上限内。
- **门槛**：AC 全过 + 预算数值生效 + 一次 `per_use` 批准单。**这是第一个会花钱的里程碑。**

### M5 · 双向委派

- **产出**：Hermes → DSH 与 DSH → Hermes 各一次真实委派；链记录含 nonce/HMAC/depth；失败与取消各一次。
- **完成判据**：子集校验、深度 ≤2、财务不可委派三条都被实际拒绝过（不只是设计里写着）。

### M6 · 基础设施安全验收

- **产出**：AC-1…AC-5 的最终证据 + 三条负向验收（篡改审计、超预算、越权路径）。
- **完成判据**：正反两面都有证据；THREAT_MODEL 的 R1/R6 状态更新（能消除的标消除，不能的继续标残留）。

## 3. 与旧阶段的关系（不重复设计）

| 旧编号 | 内容 | 在新结构里的位置 |
| --- | --- | --- |
| Phase 0 / 0.5（POC-001） | 环境盘点、启动与握手 | 已完成，作为 M1 之前的证据 |
| Phase 1（ACP 握手） | 双端 initialize/session/new/close + 恢复 | 已完成 → M4 的通信基础 |
| Phase 1.5（身份与权限设计） | 设计基线 B1–B10 | 已完成（设计验收）→ M2 的规格 |
| Phase 1.7（隔离验证） | AC-1…AC-5 | **拆进 M1–M3**，不再单列阶段 |
| P-0（兼容性验证） | 专属 profile 是否真的隔离（2026-11-08 新增） | **并入 M1 前置**，已完成无害实测 |
| P-007（审计双主体） | Recorder/Anchor 身份隔离（2026-11-08 决定 A） | **并入 M1**，账号从 2 增到 4 |
| Phase 2（双向委派） | 委派实现 | → M5 |

**继承规则**：Phase 1.7 的报告、AC 判定、T1–T8 细分矩阵原样继承，不重写口径。

## 4. 这一条主线的风险清单（照旧不美化）

1. **AC-5 的"拒改"只有独立账号才可能拿到**；在那之前只有"检出"。
2. **同账号互读无法靠应用层解决**（R1）——M1 之前它一直是开放的。
3. **DSH 插件是这个地基上最不可控的东西**（R3），Windows 侧没有现成沙箱。
4. **预算上限是软限额 + 硬停止**，不是 provider 拒付。
5. **审计只能"发现删除"，不能"阻止删除"**（直到 M1 完成且 ACL 正确）。

## 5. 这一条主线什么时候算"可以对外说安全"

只有同时满足：M1–M3 全过 + M6 的正反验收齐全 + THREAT_MODEL 更新到"R1/R6 已消除"。在那之前，任何文档不得使用"已隔离 / 已限制"这类动词。

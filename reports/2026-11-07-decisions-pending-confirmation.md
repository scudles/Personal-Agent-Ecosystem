# 更新报告：六项决策登记为「待最终确认的建议」

日期：2026-11-07
作者：Hermes｜审查：ChatGPT Observer（已参与）｜最终确认：用户（待）
本报告范围：**文档修订 + 计费口径核实**。未创建账号、未修改 ACL、未安装组件、未启动模型任务、未产生费用。

---

## 1. 六项建议的登记状态

| 编号 | 建议内容（摘要） | 登记位置 | 状态 |
| --- | --- | --- | --- |
| **S-001** | 接受双层安全边界；Bridge = 身份/授权/审计，OS = 执行隔离；隔离前显式记录剩余风险 | `DECISIONS.md` | **建议，未生效** |
| **S-002** | 接受 B 方案，但只隔离 Bridge 托管的执行实例；桌面留在用户账户；先 PoC | `DECISIONS.md` | 建议，未生效 |
| **S-003** | HMAC-SHA256 v1 + nonce + 时间戳 + 重放保护；账户稳定后再评估 Ed25519 | `DECISIONS.md` | 建议，未生效 |
| **S-004** | 实验池 \$1 / 单次 \$0.10 / 每日 \$0.50 / 每月 \$5（须区分 API 费用与订阅额度） | `DECISIONS.md`、`PERMISSION_MATRIX.md` §6 | 建议，未生效 |
| **S-005** | 委派深度 ≤ 2；金融/对外/管理不可委派 | `DECISIONS.md` | 建议，未生效 |
| **S-006** | Lounge 默认不写长期记忆（用户明确要求保存的单独处理） | `DECISIONS.md` | 建议，未生效 |

按你的要求，**没有**把任何一条改写成正式决策（D-009）。`DECISIONS.md` 里新增了一节「六项建议…待用户最终确认（未生效）」，第一轮的「待审议」章节保留为历史沿革并注明已被取代。

---

## 2. P-004：计费口径与「硬性限额」的真实能力（你特别要求核实）

### 2.1 三类计量必须分开

| 桶 | 单位 | 涉及路由 | 能否用美元记账 |
| --- | --- | --- | --- |
| 现金 API | token → USD | `opencode-go/*`（DeepSeek 系）、`deepseek-official/*` | 能（按 provider 单价折算） |
| 订阅配额 | 周窗口 / 份额百分比 | `openai-codex/*`（ChatGPT Plus 的 Codex 路由） | **不能**，只能记「调用次数 / 配额消耗」 |
| 套餐倍率 | 套餐内点数 × 倍率 | CodeBuddy（如 `x0.08`） | **不能**，记「倍率消耗」 |

**结论**：\$0.10/\$0.50/\$5 这套预算只对「现金 API」这一桶成立。若把 Codex 的周额度也算进美元池，会出现两个错误：①数字对不上账单；②以为还有钱，其实周配额已耗尽（或反过来）。账本必须带 `billing_mode ∈ {cash_usd, subscription_quota, package_multiplier}`，三桶各自独立限额、不相加。

### 2.2 谁能真正「硬停」

| 位置 | 现有能力（源码/实测） | 缺口 |
| --- | --- | --- |
| **Hermes** | `agent.run_budget_seconds`（墙钟预算，到点收尾）、`agent.max_turns`（回合上限）、`agent.budget_warning_ratio`；会话行记录 `input_tokens/output_tokens/estimated_cost_usd/cost_source` | **没有美元级硬上限**；`cost_threshold_usd`（默认 0.25）只用于「空尝试重试」判定，不是消费闸门 |
| **DSH** | 只有 `reasoning_effort`（off/low/high/max） | 无 `max_tokens`、无预算、无回合上限、无成本记账 |
| **Provider** | 账户余额、套餐周窗口——真正的硬边界 | 无法按「单个任务」切分 |

**因此，\$0.10/次 的真实含义是**：Bridge 侧先估算 → 运行时墙钟 + token 估算监控 → 超阈值发 `session/cancel`，必要时杀进程。这是**软限额 + 硬停止**，不是 provider 拒付。文档已按此措辞修订（`MVP_IDENTITY_AND_POLICY.md` §9），不得在别处写成「provider 保证不超过 \$0.10」。

### 2.3 我建议补的一条

**给 DSH 单独设一个更低的单次上限**（例如 \$0.05），理由：它既没有 `max_tokens` 也没有回合上限，是唯一一个「只能在墙钟上刹车」的 Agent。Hermes 至少还有 `max_turns` 与 `run_budget_seconds` 两道闸。这条等你和 Observer 定，我没有直接写进建议值。

---

## 3. Observer 五条补充的落地位置

| Observer 补充 | 落地文档 | 具体条款 |
| --- | --- | --- |
| 1. 审计必须防篡改/删除 | `SECURITY.md` §10 | 「只追加 + 哈希链 + 独立 ACL（`(AD)` 追加、拒 `(DC)` 删除）+ 定期导出 + checkpoint」；并明确**同账号下只能做到「删除必被发现」，做不到「不可删除」** |
| 2. 路径授权规范化 | `SECURITY.md` §11、`MVP_IDENTITY_AND_POLICY.md` §4 | `resolve → 统一大小写 → 拒 UNC/8.3 → 分隔符边界前缀匹配 → 软链/junction 解析后仍须在授权根内` |
| 3. HMAC 只验证密钥持有者 | `SECURITY.md` §12、`IDENTITY_AND_ACCESS.md` §3.2 | 已写入「签名解决『是谁』，策略层解决『该不该』」；并说明被提示注入的 Agent 也能签出合法消息 |
| 4. PoC 必须验证 ACL/进程/凭据/网络/日志 | `ROADMAP.md` Phase 1.7 | 五类与 T1–T8 一一对应（ACL→T1–T4；进程→T5/T7；凭据→T2；网络→T6；日志→T8） |
| 5. 六项剩余风险必须记录 | `THREAT_MODEL.md` §6 | 六条已列；并加了状态说明：与 S-001 绑定，**确认前不得引用为「已获批准」** |

---

## 4. 本轮文档修订清单

| 文件 | 改动 |
| --- | --- |
| `DECISIONS.md` | 新增「六项建议（待最终确认，未生效）」章节 S-001…S-006；原「待审议」章节降级为历史沿革 |
| `IDENTITY_AND_ACCESS.md` | L2 身份改为 HMAC-SHA256（密钥只存引用与指纹）；委派不变量增加 nonce/时间窗/重放去重；新增「HMAC 的边界」说明 |
| `MVP_IDENTITY_AND_POLICY.md` | `key_kind` 默认 `hmac-sha256`；`tasks` 增加 `nonce/envelope_ts/mac`；新增 `seen_nonces` 表；预算改为 \$0.10/\$0.50/\$5 + `experiment_pool_usd: 1.00` + `replay_window_seconds: 300`；新增 §9 计费口径与硬限额能力 |
| `PERMISSION_MATRIX.md` | §6 预算改为新数值；标注 Observer 为派生值；补计量口径与能力边界；状态标「建议，待确认」 |
| `SECURITY.md` | 新增第 10–12 条（审计防篡改机制、路径规范化细节、HMAC 语义边界） |
| `THREAT_MODEL.md` | §6 增加状态说明（与 S-001 绑定，确认前不得引用） |
| `ROADMAP.md` | Phase 1.5 增加第三轮登记说明；Phase 1.7 增加「五项隔离 ↔ 测试项」映射 |

---

## 5. 仍待你最终确认的点

1. **四个数值**：实验池 \$1、单次 \$0.10、每日 \$0.50、每月 \$5 —— 以及是否接受「DSH 单次降到 \$0.05」的补丁建议。
2. **S-002 的范围**：确认「只隔离 Bridge 托管实例、桌面不动」。
3. **S-004 的计量口径**：确认账本分三桶、互不相加，且限额是「软限额 + 硬停止」（不是 provider 保证）。
4. **S-001 的措辞**：确认 `THREAT_MODEL.md` §6 六条剩余风险照此接受。
5. **S-005 / S-006** 是否锁死为默认值。

确认后我会做两件事（都还需要你点头）：把六项改写成正式决策条目 D-009；开始写 `policy/agents.yaml`（epoch 0，空白）+ 只读校验器（纯本地、零新依赖、不启用）。

---

## 6. 本轮没有做的事（边界声明）

未创建 Windows 账户；未修改任何 ACL；未安装任何组件；未启动真实模型任务；未产生费用；未修改任何 Agent 配置；未把任何建议标记为生效。

# Multi-Agent Collaborative Discussion · Implementation Plan 001

作者：Hermes（Engineering Lead）｜日期：2026-11-13
状态：**可开工**（唯一前置是 DSH 对 6 个 Runtime 问题的答复；不阻塞前两块）
依据：Observer《产品方向补充：Multi-Agent Collaborative Discussion 001》

---

## 1. 先说结论：能支持，但缺一件半

**能支持的部分（现成，不需要新结构）**

| 需要 | 现成能力 |
| --- | --- |
| 一条用户消息触发多个独立 Run | `runs.trigger_message_id` 本来就允许一对多，无唯一约束 |
| 一条消息有多条回复 | `messages.reply_to_id` 允许一对多 |
| 一 Run 只对应一条回复 | `runs_reply_message_id` 唯一部分索引（已存在） |
| 每个 Agent 各自的会话 | 会话键已按 `(房间, 成员)` 分开（`7a671e4`） |
| 失败/取消/超时/不重放的语义 | `delivery`、`run_events`、失败即 `failed` + `error_code`，均已实现 |
| 附件共享给多个参与者 | 附件按 `objectId@版本` 从库里取，同一份字节可复用 |
| 每条表达的来源与因果 | `messages.member_id/origin`、`runs.trigger_message_id/reply_message_id` |

**缺的一半：没有「这是一次讨论」这个分组。**
今天所有 Run 只知道自己被哪条消息触发，不知道"我和另外那个 Run 属于同一次讨论、同一轮"。
没有它，就没法安全回答「后续回应只读取本次讨论明确共享的内容」——只能靠时间戳猜，而猜测会把别人的旧话卷进来。

**缺的另一半（跨模块）：Runtime 只收「你的话 + 附件」，不收「别人说过的话」。**
第二轮必须把对方的回答交给 Agent，而现在契约里没有这个入口。

---

## 2. 最小交互流程

三种模式，**只有两种进第一版**：

| 模式 | 第一版 | 说明 |
| --- | --- | --- |
| **A 单独交流** | ✅ | 与今天完全一致，只是多了"选谁" |
| **B 共同讨论** | ✅ | 第一轮独立 → 用户点击 → 第二轮相互回应 |
| C 自主讨论 | ❌ 不做 | 保留方向，不实现 |

### B 的流程（默认 2 位参与者、2 轮）

```
1. 用户发问题，选择参与者 [驻留 Agent ✓] [Hermes ✓]
        ↓
2. 服务端建 1 个 discussion，为每位参与者各开 1 个 run（round=1）
   两轮输入完全相同：同一句用户原文 + 同一份附件（钉同一个版本号）
        ↓
3. 两位各自独立回答（互不可见），各自写进 messages，互不引用对方
        ↓
4. 界面出现一个按钮：「进入第二轮」（只有用户能点）
        ↓
5. 用户点击 → 服务端为每位仍可参与的成员各开 1 个 run（round=2）
   round=2 的输入 = 用户原问题 + 附件 + 本次讨论第一轮中对方明确分享的回答
        ↓
6. 第二轮各自表达：认同 / 反对 / 补充 / 修改自己的判断 / 保留分歧
        ↓
7. 结束。没有第三轮，除非用户再点一次（同一按钮，round 递增）
```

**关键边界**

- 第二轮**只能由用户的显式操作触发**，Agent 无法触发下一轮，Runtime 也不允许自发调用。
- 每位参与者在每一轮**最多产生一条消息**（一 run 一 reply，数据库已强制）。
- 允许第二轮里说"我改主意了"或"我坚持"，但**不要求达成一致**，界面不生成"最终结论"这一层。
- 失败的成员**不补位、不代写、不假装**：那一轮就只有一个人的话。

---

## 3. Runtime 调用流程

```
POST /api/messages  { body, visualId?, visualVersion?, targets:[m1] }        → 单聊
POST /api/messages  { body, visualId?, visualVersion?, targets:[m1,m2] }     → 讨论第一轮
POST /api/discussions/:discussionId/rounds                                   → 讨论下一轮
```

服务端对每个参与者：

```
1. 选择该成员的 runtime（成员 → runtime 实例的映射）
2. 组装 RuntimeInput：
     runId        新 run 的 id
     roomId       房间
     memberId     该成员
     text         用户原话（第二轮的 text 仍然是用户原话，不改写、不拼接）
     sessionId    该成员在该房间的上一个 session（继续自己的对话）
     attachments  与第一轮完全相同的字节（钉同一版本）
     context      第二轮才有：本次讨论中对方已提交的表达（见 §4）
     budget       单次墙钟上限
3. 逐事件落库（与今天一致）：
     session → runs.session_id；status/tool → run_events
     text 累积；done → 写 messages（round 记录在 runs 上）
     error → run 失败 + delivery/retryable，永不自动重放
```

**并发策略（第一版）**：参与者**顺序调用**，不并行。
理由：并行会同时起两个子进程、两条写事务交错，收益只是"快一点点"，代价是排查困难。等稳定后再评估。

---

## 4. 消息、Discussion、Run 的关系（数据结构提案）

**不加新表，只给 `runs` 加两列（一次性迁移 `009`）**：

```sql
ALTER TABLE runs ADD COLUMN discussion_id TEXT;              -- 空 = 不是讨论，就是普通单聊
ALTER TABLE runs ADD COLUMN round INTEGER NOT NULL DEFAULT 1; -- 1=独立回答，2+=相互回应
CREATE INDEX runs_discussion_round ON runs(discussion_id, round);
```

推导关系（**不落库**，读路径算）：

| 概念 | 推导方式 |
| --- | --- |
| 一次讨论 | 所有 `discussion_id` 相同的 runs |
| 讨论的问题 | 这些 runs 共同的 `trigger_message_id` |
| 某轮谁说了什么 | `runs` 筛 `round = N` 且 `status='done'`，取 `reply_message_id` |
| 参与过谁 | 这些 runs 的 `member_id` 去重 |
| 谁失败了 | `status='failed'` 的那几个 run |

**为什么只加两列而不是建 `discussions` 表**：一张表要维护创建时间、状态、标题、参与者……而这些都是"可以从 runs 推出来的"。我们有一条现成原则——**只存不可推导的东西，且只存一次**。讨论的元数据全在 runs 里。

**为什么不把轮次写进 `messages`**：`messages` 是 append-only 且只存"完整表达"；轮次是运行属性，不是表达内容。写进去等于同一事实存两遍。

---

## 5. 上下文共享边界

Observer 划的表，落到工程上是这样：

| 内容 | 是否进 prompt | 实现方式 |
| --- | --- | --- |
| 本次用户问题 | ✅ 全部参与者相同 | `text`，原话，不改写 |
| 本次用户附件 | ✅ 相同字节、同一版本 | `attachments`，服务端从库取 |
| 本次讨论中对方**已提交**的回答 | ✅ 第二轮 | `context`（新增，见 §6） |
| 对方**未提交/失败/半截**的内容 | ❌ | 失败 run 没有 reply_message，物理上拿不到 |
| 对方**其他会话**的历史 | ❌ | 不进 `context`，且各自的 session 本来就分开 |
| 对方的私人记忆 | ❌ | 不存在于 Studio，无从注入 |
| 对方的"主体立场" | ❌ | 我们没有立场表；读到不等于认同 |

**硬规则**：`context` 只接受 `status='done'` 且 `round` 更小的 run 的回复，**按 message id 白名单取**，不接受"最近 N 条"这类模糊查询。这样"讨论之外的话"永远进不来。

---

## 6. Runtime Bridge：需要新增一个输入字段（请 DSH 裁定）

第二轮必须把对方的话交给 Agent。两种做法：

| | 做法 | 问题 |
| --- | --- | --- |
| **甲** | 拼进 `text` | 把"别人说的话"和"用户说的话"混成一段。这正是我们拒绝过的 AIROOM 附件内联的同一类错误，provenance 会糊掉 |
| **乙** | `RuntimeInput.context?: { kind:'message'; messageId; authorMemberId; body }[]` | 需要契约加字段（additive），adapter 负责序列化成带标签的独立块 |

**我主张乙**，理由和当初拒绝把 SVG 拼进 `text` 完全一样：
**别人说的话不是用户说的话，必须能被区分地交过去。**

序列化形状建议（由 DSH 决定最终措辞）：

```
[during this discussion, 驻留 Agent said (message 12)]
这构图挺好，别改……
[/during this discussion, 驻留 Agent said (message 12)]
```

这条只影响 adapter 与契约，不碰 Studio 的存储。

---

## 7. 失败处理与成本控制

### 失败

| 情形 | 处理 |
| --- | --- |
| 某成员第一轮失败 | 另一个照常完成；讨论继续可用（第二轮里少一个人） |
| 某成员第二轮失败 | 记录失败，**不重试**；界面显示"这一轮没说完"，不显示"未回复" |
| `delivery: unknown` | 不自动重放；界面提示"可能已执行"，重发是用户决定 |
| 用户取消 | 该 run 记 `cancelled`（沿用现有 stopReason 语义） |
| 进程崩溃 | 现有的 `closeStaleRuns` 在下次开库时关成 `failed / SERVER_RESTART` |
| Agent 拒绝参与 | 它说的话就是它的话：作为正常消息记录，不特殊处理，不代写 |

### 成本（硬闸门）

```
一次讨论的上限 = 参与者数 × 轮数
第一版：最多 2 位成员 × 2 轮 = 4 次真实调用
```

- 服务端在**建 run 之前**计数，超限直接 400，不做"尽力而为"
- 下一轮必须由用户点击，**Agent 与 Runtime 都不能发起**
- 单次墙钟上限沿用 `ACP_MAX_WALL_MS`
- 界面上不显示"还剩几次"（那是数事，可以），但**不显示谁用得多少**（那是数人）

---

## 8. No Debt 检查

| 新元素 | 数的是人还是事 | 结论 |
| --- | --- | --- |
| 轮次标记（第 1 轮 / 第 2 轮） | 事 | ✅ 可以显示 |
| "共同讨论"这个分组标题 | 事 | ✅ 可以显示 |
| 「进入第二轮」按钮 | 事（你的动作） | ✅ 可以显示 |
| 参与成员头像 | 目前的成员栏已有，不新增语义 | ✅ 保持原样 |
| "谁还没回答""DSH 没参与""上次发言时间" | **人** | ❌ 明确禁止，不加 |
| 讨论进度百分比 / 剩余轮次提醒 | 接近"催促" | ❌ 不加 |

`test/no-debt.test.mjs` 会继续扫禁用词；新增的 `discussion`、`round` 不在禁用列表内，但会加一条断言：讨论 UI 里不出现"未回复/未参与/等待中"。

---

## 9. 实施任务（拿到 DSH 答复后即可开始）

| # | 任务 | 目录 | 依赖 |
| --- | --- | --- | --- |
| 1 | 迁移 `009`：`runs.discussion_id` + `runs.round` + 索引 | `migrations/` | 无 |
| 2 | 成员 → runtime 的映射（现在只有一个实例） | `server/` | 无 |
| 3 | `POST /api/messages` 接受 `targets`，单/多分支 | `server/` | 1 |
| 4 | `POST /api/discussions/:id/rounds` 显式开下一轮 | `server/` | 1,3 |
| 5 | 讨论上下文组装（白名单取对方 round-N 回复） | `server/` | DSH 对 §6 的答复 |
| 6 | 界面：目标选择器、讨论分组、轮次标签、下一轮按钮 | `src/` | 3,4 |
| 7 | 失败路径测试（一方失败、超时、unknown、崩溃） | `test/` | 3,4 |
| 8 | No Debt 断言 | `test/` | 6 |

**任务 1–4、6–8 不依赖 DSH**；只有任务 5 等她的答复。

---

## 10. 验收标准

| # | 标准 | 怎么证明 |
| --- | --- | --- |
| 1 | 同一句话可同时发给两位，两位各写一条**互不引用**的消息 | 两条 `messages`，`reply_to_id` 都指向用户那条，正文互不包含对方内容 |
| 2 | 第一轮两人收到的输入**字节级相同**（除成员身份） | `run_events` 里两份 attachments 元数据一致；`context` 在第一轮为空 |
| 3 | 只有用户能开第二轮 | 直接调用 API 不带显式请求时，`round` 不会自增 |
| 4 | 第二轮每人拿到对方的**已提交**回答，且只拿本次讨论的 | `run_events` 记录 `context` 的 messageId 白名单，与实际相符 |
| 5 | 失败不伪装 | 一方失败时，界面只有一条回复 + 一条失败记录，无占位消息 |
| 6 | 不自动重放 | `delivery: unknown` 后 `runs` 计数不变 |
| 7 | 费用上限生效 | 超过 `参与者 × 轮数` 时 400，且无 run 被创建 |
| 8 | 讨论结束后静止 | 最后一轮完成后再等 60 秒，`runs` 数量不变 |
| 9 | 保留分歧 | 第二轮允许两人结论不同，系统不生成"最终答案" |

---

## 11. 未解决的阻塞

**只有一个：§6 的 `context` 字段形状要 DSH 定。**
在她答复前，任务 1–4、6–8 可以先做（都可独立验证），任务 5 挂着。

其余都不是阻塞，是我已经决定的事：顺序调用、不加 `discussions` 表、轮次不进 `messages`、只做 2 轮、并行留到以后。

---

## 12. 一句话

**这次不需要新架构，只需要两列数据 + 一个输入字段 + 一个只有用户能按的按钮。**
其余全是现有能力的组合。

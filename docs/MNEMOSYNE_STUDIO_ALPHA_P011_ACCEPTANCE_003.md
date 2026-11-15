# STUDIO ALPHA · P0.1.1 独立验收报告（003 · 按 M1–M4 逐项）

日期：2026-11-12｜验收人：Hermes｜性质：**独立验收，未提交任何东西**
验证对象：`bb2b52f` 中 DSH 的 P0.1.1 交付（`test/studio.test.mjs`、`DEVELOPMENT_LOG.md`）

---

## 0. 结论：**接受**

| 项 | 结果 |
| --- | --- |
| M1 房间 id 覆盖 | ✅ 通过（`room-main` 0 命中，单点常量，13 处引用，无 fallback） |
| M2 迁移真实性 / 走应用层 | ✅ 通过（我自造真旧库 → `createApp` → `/api/bootstrap` 读回房间名与两条消息） |
| M3 三个 id 的方向与空值 | ✅ 通过（成功与失败两路，方向不倒、空值正确） |
| M4 五表重建 / FK 时机 / 时间转换 | ✅ 通过（含任务书点名的"事务内 PRAGMA 被忽略"实测） |
| 附带发现 | 1 条（P1.0 让应用读到迁移头部，属预期耦合，见 §5） |
| 阻塞 | 无 |

**先纠正我自己的一处记录**：你说得对，`8c2a235` 里 `room-main` 已经是 0 命中，迁移测试也已经用 `common-room` 并经 `/api/bootstrap` 读回。**我此前描述的"漂移"对应的是 `8c2a235` 之前的未提交版本**；`8c2a235` 本身就是那次修复。本轮补的是测试强度，不是重改房间 id。这条更正我接受。

**同时要如实说明**：你给的基线（`8c2a235` + 2 个未提交文件）**现在已不存在**。上一轮你批准"按建议来"时，我把这 2 个文件连同我的 P1.0 一起提交为 **`bb2b52f`**。因此本轮我验的是 **`bb2b52f` 里 DSH 的那份交付**（用 `git archive bb2b52f` 导出干净树验，不带我手上未提交的 004）。

---

## 1. 验证环境

| 项 | 值 |
| --- | --- |
| 验证对象 | `git archive bb2b52f` 导出到 `%TEMP%/sa_accept_p011`（3 个迁移，不含我未提交的 `004_p10_1.sql`） |
| 旧库来源 | **工程自带的冻结 `001_initial.sql` 原文执行**，`created_at` 走 001 的 `CURRENT_TIMESTAMP` 默认值（不给值），2 条消息 + 1 条事件 |
| 旧库实际时间形态 | `2026-11-12 15:24:49`（空格分隔、秒级、无 Z）——这正是真实旧库的样子 |
| 应用层 | `createApp` + `listen(0)` + `GET /api/bootstrap`（真 HTTP，不查表代替） |

---

## 2. M1 · 房间 id 覆盖

| 检查 | 结果 |
| --- | --- |
| `git grep room-main` | **0 命中** |
| `'common-room'` 字面量 | **仅 1 处**：`server/index.mjs:17` `const ROOM_ID = 'common-room';` |
| 是否为单点常量 | ✅ 是 |
| `ROOM_ID` 引用覆盖 | **13 处**：`129/131/132` seed（房间 + 两条 room_members）· `223` bootstrap 读 · `230` 消息列表读 · `272` 用户消息写 · `276` 事件写 · `279` run 写 · `296` runtime 上下文 · `319` 失败事件 · `336` 回复写 · `340` 回复事件 |
| 是否有 fallback / 环境变量能换房间 | **无**（`grep -E "ROOM_ID.*\?\?|process\.env\.[A-Z_]*ROOM|roomId\s*\?\?"` 无命中） |
| seed 会不会多建房间 | 不会：实测迁移后 `rooms` 只有 1 行，名字仍是 `共同房间` |

**判定**：`ROOM_ID` 是唯一入口，四条数据路径（seed / 读 / 写 / 运行上下文）全部经过它，没有第二条能绕到别处。

---

## 3. M2 · 迁移真的走应用层

我用 001 原文造旧库，不碰她的 fixture：

```
旧库时间格式: ["旧库第一句 @ 2026-11-12 15:24:49", "旧库回声 @ 2026-11-12 15:24:49"]
已应用迁移  : 001_initial | 002_p01 | 003_p10
迁移后消息  : [[1,"旧库第一句","2026-11-12T15:24:49Z","composer"],[2,"旧库回声","2026-11-12T15:24:49Z","runtime"]]
```

| 检查 | 结果 |
| --- | --- |
| 旧消息条数不变 | ✅ 2 |
| 旧时间全部转成带 `Z` 的 ISO | ✅ |
| `foreign_key_check` 干净 | ✅ |
| 迁移后 `foreign_keys` 恢复为 `1` | ✅ |
| `GET /api/bootstrap` → 200 | ✅ |
| 旧房间名读回 | ✅ `common-room / 共同房间`（description 也保留了旧值 `旧描述`） |
| 两条旧消息在应用层可见 | ✅ `["旧库第一句","旧库回声"]` |

**关于"她的测试是否只查表"**：她的迁移测试**确实经过应用层**——`test/studio.test.mjs` 迁移用例内 `createApp(migrated)` → `listen(0)` → `request('/api/bootstrap')` → 断言 `room.id` / `room.name` / 两条消息正文（导出块第 72–84 行），之后才断言 `PRAGMA foreign_keys = 1`。**不是只查表。**

---

## 4. M3 · 三个 id 的方向、空值、外键

### 成功路径

```
POST 201 → {messageId: 3, replyMessageId: 4}
run  : {status:"done",  trigger_message_id: 3, reply_message_id: 4,    error_code: null}
reply: {id: 4, reply_to_id: 3, origin:"runtime", member_id:"fake-resident"}
```

| 检查 | 结果 |
| --- | --- |
| `reply.reply_to_id` → 触发的用户消息 | ✅ 3 |
| `run.trigger_message_id` → 用户消息 | ✅ 3 |
| `run.reply_message_id` → 真正的回复消息 | ✅ 4 |
| 三者自洽（回复的回复对象 = 触发的用户消息） | ✅ |
| 成功时 `error_code` 为空 | ✅ |
| 回复者与来源 | ✅ `fake-resident` / `runtime` |

### 失败路径（`failAfter` 两种）

```
failAfter='before' → 502 {code:"FAKE_RUNTIME_FAILED"}
failAfter='after'  → 502 {code:"FAKE_RUNTIME_FAILED_AFTER"}
失败 run: {status:"failed", trigger_message_id: 3, reply_message_id: null, error_code:"FAKE_RUNTIME_FAILED_AFTER"}
```

| 检查 | 结果 |
| --- | --- |
| 两种失败都返回 502 | ✅ |
| `status='failed'` 且有 `error_code` | ✅ |
| **`reply_message_id` 为 NULL**（不指向任何消息） | ✅ |
| **`trigger_message_id` 仍指向用户消息**（方向不倒） | ✅ |
| 失败不新增回复消息（旧 2 + 用户 1 = 3） | ✅ 实际 3 |
| 失败只记长度不记正文 | ✅ `{"code":"FAKE_RUNTIME_FAILED_AFTER","partial_chars":12}`，不含"我收到了" |

**方向语义我这样理解并已实测**：`trigger_message_id` 回答"这次运行被哪句话触发"（永远指向用户那条，失败也不丢）；`reply_message_id` 回答"这次运行产出了哪条消息"（失败时必然为 NULL）。两者不是同一个方向，不能互相替代。

---

## 5. M4 · 五表重建、FK 时机、时间转换

### 5.1 重建顺序（`002_p01.sql`）

```
rooms(8→23) → members(28→46) → room_members(49→64) → messages(67→84) → events(88→106)
→ runs(112，新建) → messages_fts(126) + messages_ai 触发器(127) + rebuild(130)
```

**顺序正确**：`events.message_id` / `events.actor_id` 的外键在 `events_new` 建表时，`messages` 与 `members` 已经是重命名后的新表，所以引用指向新表而不是即将消失的旧表。

**实测证据**：迁移后往 `events` 插一个不存在的 `message_id` → **被拒**（`FOREIGN KEY constraint failed`）。若外键还指着旧表，这个插入不会被拦。

### 5.2 FK OFF / ON 的时机（任务书点名的坑）

先纠正我自己的一个错误探针：我第一版探针测的是"事务内打开外键"，观察到设置生效，据此差点得出"任务书说法不成立"。**方向测错了。** 重测真正相关的方向：

```
1) 事务内 PRAGMA foreign_keys = OFF → foreign_keys 仍为 1   ← 被忽略
2) 事务外 PRAGMA foreign_keys = OFF 再 BEGIN → foreign_keys = 0  ← 生效
3) 外键开启时 DROP 被引用的表 → 失败 FOREIGN KEY constraint failed
4) 外键关闭后 DROP 被引用的表 → 成功
```

**所以任务书的提醒是对的，而且这条警告不是理论问题**：第 3 条证明外键开着时根本 DROP 不掉被引用的表，002 的五表重建**必须**靠 OFF 才能进行。

代码位置核对：

```
foreign_keys = OFF 位置 2924  <  首个 BEGIN IMMEDIATE 位置 3432   → 在事务外，有效
foreign_keys = ON  位置 3965（finally 块，事务外）
```

`foreign_key_check` 位于 `BEGIN` 之后、`INSERT INTO schema_migrations` 之前、`COMMIT` 之前——**先验数据合法，再记账，最后提交**，顺序正确。

### 5.3 旧时间转换

| 输入（001 真实形态） | 输出 | 判定 |
| --- | --- | --- |
| `2026-11-12 15:24:49` | `2026-11-12T15:24:49Z` | ✅ |

两列（`messages.created_at`、`events`、`rooms`、`members`、`room_members`）都走同一个 CASE 表达式，`LIKE '%Z'` / `LIKE '%T%'` / 其余走 `strftime` 三分支，实测秒级空格形态落到第三分支并被正确加 `T` 与 `Z`。

### 5.4 我额外做的一件事：隔离 002 单独跑

把 `003_p10` 从 `MIGRATIONS` 摘掉，只让 `001 → 002` 跑，12 项表级检查全过：

```
002 之后只有 001+002 / 房间名保留 / 房间只有 1 行 / 旧消息 2 条且内容不变
旧时间带 Z / 旧 reply_to_id 为 NULL / fake→agent+fake / foreign_key_check 干净
foreign_keys 恢复为 1 / events 外键指向新 messages / 新消息 id = 3（序列未重置）
sqlite_sequence: [{messages, 2}, {events, 0}]
```

**`sqlite_sequence = 2` 且新消息拿到 `id=3`**，证明 `DROP TABLE` + `ALTER RENAME` 没有把序列重置成 1——这类重建最经典的坑，`002` 躲过了。

**但这一条没有测试守着**（见 §7 建议 1）。

---

## 6. 一个附带发现（不是缺陷，但必须记在案）

隔离 002 后，`createApp` + `/api/bootstrap` 会报 **`no such column: m.authority`**。

原因是我 P1.0 的读路径要读 `003` 加的列，**应用代码只对迁移头部成立**。

| 含义 | 说明 |
| --- | --- |
| 对 DSH 的交付 | **不是她的问题**，`002` 单独跑时她的代码还不存在 |
| 对验收方法 | "让 002 单独跑并通过应用层"这个要求在 `bb2b52f` 上**已经不成立**——应用层验证只能在迁移头部做（我已在 §3 完成） |
| 对将来 | 应用读到最新 schema 是正常的；但要意识到**回退迁移版本就不再是可服务状态** |

---

## 7. 建议（不阻塞）

1. **给 `sqlite_sequence` 加一条守卫**。我实测 `002` 之后序列没被重置，但没有任何测试守着它。建议在她迁移测试里加：迁移后插一条新消息，断言 `id = 旧最大 id + 1`。
2. **F2 仍然空着**：删掉 `002` 的 `INSERT INTO messages_fts(messages_fts) VALUES('rebuild')`，跑全套测试 **0 失败**（上一轮变异实测）。旧消息会静默从检索里消失。这条仍归 DSH。
3. `messages.reply_to_id` 无法在 SQLite 层约束"必须同房间"，目前只有代码保证。建议补一条测试断言（回复的 `room_id` == 触发消息的 `room_id`），把代码保证钉成可回归的东西。

---

## 8. 拟提交内容

**这轮的交付在我这边已经不在工作区了**——它随 `bb2b52f` 提交（你上一轮批准的）。所以严格说没有"待提交文件"。

若你要把它从 P1.0 里拆出来单独成一次提交，需要重写历史（`rebase`），我不建议：那会让 `bb2b52f` 这个"测试全绿 + 变异验证过"的状态被替换成两个都没被完整验证过的中间状态。**我的建议是把 P0.1.1 记为 `bb2b52f` 的一部分**，并在封版说明里写明：该提交包含 DSH 的 P0.1.1 测试加固 + Hermes 的 P1.0 数据地基。

若你坚持要独立 commit message，可用：

```
test: harden P0.1.1 migration and foreign-key assertions

- build the old database from the frozen 001_initial.sql with the real
  common-room seed, then read it back through createApp + /api/bootstrap
  instead of querying tables directly
- assert foreign keys are enforced after migration (three invalid inserts
  must throw), not merely that foreign_key_check is empty
- assert run.trigger_message_id / run.reply_message_id / reply.reply_to_id
  agree on the success path and that reply_message_id is null on failure
- remove temp directories with maxRetries to tolerate Windows WAL handles
```

**本轮我没有提交任何东西。** 工作区里唯一未跟踪的文件是我自己起草、**尚未应用也尚未提交**的 `migrations/004_p10_1.sql`（P1.0 语义收口用，等你对那一轮的问题给意见后再动）。

---

## 9. 边界

| 项 | 状态 |
| --- | --- |
| 提交 | **0** |
| 改她的文件 | **0**（本轮只读） |
| 真实 `.data` | 未触碰 |
| 真实模型 / 费用 / ACP | **0** |
| 验证用临时目录 | `%TEMP%/sa_accept_p011`（bb2b52f 导出）与各 `acc-*` 临时库，验完即删 |
| 可复跑脚本 | `scratch/sa_check/accept_p011_m2m4.mjs`、`accept_002_isolated.mjs` |

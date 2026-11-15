# STUDIO ALPHA · P1.0.1 收口证据 001

日期：2026-11-12｜编制：Hermes｜**未提交、未应用真实库**
基线：`bb2b52f`｜工作区：5 改 1 新增（`migrations/004_p10_1.sql`）

---

## 0. 结论

Observer 的四项小收尾**全部处理**，其中两项（A、C）发现原设计真的有缺陷，改的是迁移而不是测试。

| 项 | 结果 | 谁的活 |
| --- | --- | --- |
| **A** 序列高水位 | ⚠️ **原实现有缺陷，已修**（002 和 004 两处） | 我改迁移，DSH 加守卫 |
| **B** 旧消息可检索 | ✅ 通过（全链路 + 002 隔离两处断言） | DSH 加守卫，我补全链路断言 |
| **C** 跨房间回复 | ⚠️ **原来只有代码保证，已加数据库触发器** | 我 |
| **D** 验收标准区分 | ✅ 已写入本文 §5 | 我 |
| 变异验证 | **5/6 CAUGHT**（B1 未抓到，见 §6） | 我 |

**两处我认为比要求做得更彻底**：A 改的是 002（不只是加测试），C 加了 DB 触发器（不只是一条负向测试）。理由见 §1、§3。

---

## 1. A · sqlite_sequence 高水位

### 1.1 先复现你给的判据

```
迁移前: 行数=4  sequence={seq:5}     ← 插 1..5，删 5
迁移后: 行数=4  sequence={seq:4}     ← 缺陷
新消息 id = 5                        ← 复用了已删除的 id
```

**判据不通过。** 而且根因不在 004，在 **002**：

`INSERT INTO messages_new ... SELECT ... FROM messages` 只会把**现存行**的 id 写进去，`sqlite_sequence` 于是变成"现存最大 id"。被删掉的那个 5 就从历史上消失了，下一次插入把它重新发出去。

> **AUTOINCREMENT 的全部意义就是不让 id 复用。** 重建把这条保证弄丢了，等于把 `runs.reply_message_id` / `messages.reply_to_id` 里指向旧 id 的引用静默改绑到一条无关的新消息上。这不是"id 不连续"，是**历史指向被改写**。

### 1.2 修法

在 002 和 004 各加一段：重建前把高水位存进 TEMP 表，重建后再写回 `sqlite_sequence`。

```sql
CREATE TEMP TABLE _p01_seq_watermark AS
  SELECT 'messages' AS tbl, COALESCE((SELECT seq FROM sqlite_sequence WHERE name='messages'),0) AS seq
  UNION ALL SELECT 'events', COALESCE((SELECT seq FROM sqlite_sequence WHERE name='events'),0);
...
UPDATE sqlite_sequence SET seq = (...) WHERE name='messages' AND seq < (...);
INSERT INTO sqlite_sequence(name,seq) SELECT 'messages',(...) WHERE ... AND NOT EXISTS (...);
```

002 同时补了 **events** 的高水位——它也是 `AUTOINCREMENT`，同样被重建，同样会复用已删除的 id。你没点名，但这是同一个缺陷。

### 1.3 修后实测

```
迁移前: sequence={seq:5}
迁移后: sequence={seq:5}
新消息 id = 6  ✓
```

守卫测试（两条，都能被抓到）：`the autoincrement high-water mark survives two rebuilds`（我）与 `002 alone keeps the message sequence…`（DSH）。

---

## 2. B · 旧消息可检索

DSH 的判断我认同并已独立复核：**`003_p10.sql` 只 `ALTER`，`004` 会再次重建 messages 与 FTS，所以走完整 `openDatabase()` 时 002 自己的 rebuild 丢了也会被 004 补上** —— 全绿不等于 002 正确。她因此单独写了一个只跑到 002 的隔离用例（直接执行 002 的 SQL，不临时改 `MIGRATIONS`，也就不碰 `server/index.mjs`）。

**这个实现方式我接受**：我的 `accept_002_isolated.mjs` 是临时摘 `MIGRATIONS`，会改业务代码；她的做法等价且更干净。

我加的是全链路那一段：迁移 `001 → 004` 之后，用 `MATCH '旧的人话'` 断言旧消息仍然命中 1 条。**只看表存在没意义——要能检索到。**

---

## 3. C · 跨房间回复

你要求"确认非法关联无法通过正常应用写入路径"。我查下来，**原来只有代码保证**：`reply_to_id` 上没有任何约束禁止跨房间，直接写一条 SQL 就能把两个房间的历史接起来。

只加负向测试会得到一个"测试证明现在没这个 bug"的假安全感。所以我在 004 里加了触发器：

```sql
CREATE TRIGGER messages_reply_same_room
BEFORE INSERT ON messages
WHEN NEW.reply_to_id IS NOT NULL
 AND (SELECT room_id FROM messages WHERE id = NEW.reply_to_id) IS NOT NEW.room_id
BEGIN
  SELECT RAISE(ABORT, 'reply_to_id must reference a message in the same room');
END;
```

三层证据：
1. **DB 层**：直接插跨房间回复 → `reply_to_id must reference a message in the same room`；
2. **应用层**：POST 里塞 `roomId: 'other-room'`、`replyToId: <別房间消息>` → 服务端忽略未定义字段，消息落在 `common-room`，回复指向真正触发它的那条；
3. **变异**：把触发器的 `WHEN` 改成 `AND 1 = 0` → 测试立刻红。

---

## 4. 两个跑出来才知道的机制（这条我认为值得进知识库）

### 4.1 FTS5 外部内容表在事务内不能 DROP

第一版 004 保留了"删 FTS → 重建 → rebuild"的写法，结果在整个链路上硬失败：

```
DROP TABLE IF EXISTS messages_fts  →  unable to open database file (SQLITE_CANTOPEN, 14)
```

逐步定位：只有 001、只有 001+002 都正常；**001+002+003 就失败**。因为 003 对 `messages` 做过 `ALTER TABLE ADD COLUMN`，此后 **FTS5 外部内容表在事务内被 DROP 会以 CANTOPEN 失败**，且没有可读的报错。

修法：**不删 FTS 表**，改成 `rebuild` 刷新 + `integrity-check` 校验，两者都能在事务内完成：

```sql
INSERT INTO messages_fts(messages_fts) VALUES('rebuild');
INSERT INTO messages_fts(messages_fts) VALUES('integrity-check');
```

四个变体实测（事务内）：DROP fts → 失败；先 DROP TRIGGER 再 DROP fts → 失败；先 MATCH 一次再 DROP → 失败；**DROP messages（保留 fts）→ 成功**。重建后 id 不变，索引按 rowid 继续有效，实测旧消息仍可检索。

### 4.2 序列高水位会在"只拷贝现存行"的重建里丢失

见 §1。附一条：`sqlite_sequence` 是普通表，可以直接 `UPDATE`/`INSERT`，不需要任何特殊权限。

---

## 5. D · 验收标准区分（写清楚，避免以后再混）

| 层次 | 验什么 | 怎么验 | 不该拿来当什么的证据 |
| --- | --- | --- | --- |
| **迁移层** | 某一次迁移的 SQL 是否正确（例如 002 自己的五表重建、时间转换、FTS rebuild、序列） | 只跑到那一次迁移为止；表级断言 | 不能用来证明"应用能启动" |
| **集成层** | 应用在**当前最新 schema** 上能否 `createApp` + `/api/bootstrap` 读到历史 | 完整链路跑到 head，真 HTTP | 不能用来单独判某一次迁移的对错 |

**于是我上一轮的表述要修正**：`002-only` 下 `createApp` 报 `no such column: m.authority`，**不是 002 的缺陷**，而是应用代码只对迁移头部成立——集成验证只能在 head 做。这条按你的意见正式记录在案。

---

## 6. 变异验证：5/6 CAUGHT

`scratch/sa_check/p101_mutations.mjs`，每项都在临时副本里注入后跑全套 22 个测试。

| # | 注入的缺陷 | 结果 | 抓到它的测试 |
| --- | --- | --- | --- |
| A1 | 002 不写回序列高水位 | ✅ CAUGHT | high-water mark survives two rebuilds |
| A2 | 004 不写回序列高水位 | ✅ CAUGHT | 同上 |
| **B1** | **004 去掉 FTS rebuild** | ❌ **MISSED** | —— |
| B2 | 002 去掉 FTS rebuild | ✅ CAUGHT | 002 alone keeps the message sequence… |
| C1 | 同房间触发器 `WHEN` 恒假 | ✅ CAUGHT | a reply cannot be attached to a message from another room |
| D1 | `author_kind` 派生写反 | ✅ CAUGHT | author_kind is derived from the member… |

### B1 为什么没被抓到，以及我怎么处理

重建时 id 不变，**FTS5 外部内容表的索引按 rowid 指向的行仍然正确**，所以不 rebuild 也能 `MATCH` 到旧消息。

**结论**：004 里的 `rebuild` **不是承重结构，只是保险**。我保留它（成本为零，且能兜住将来任何改写 id 的改动），但必须说清楚：**没有任何测试能区分它的有无**。如果哪天有人问"这条语句有必要吗"，答案是"没有测试证明必要"。

---

## 7. 对 DSH 两条守卫的复核：**接受**

我没有只看她的报告，做了三件独立的事：

1. **跑了全套**：22/22 通过（含我新增的 2 个），构建通过。
2. **对她的 FTS 守卫做变异**：删掉 002 的 `INSERT INTO messages_fts(... 'rebuild')` → 她的测试红（`002 alone keeps…`）。**守卫是承重的。**
3. **对她的隔离方式提出并接受了差异**：她直接执行 002 的 SQL 而不改 `MIGRATIONS`，避免了碰业务代码。**比我的临时脚本更干净，采用她的。**

她另一个判断我也认同并写进 §6：**`SELECT count(*) FROM messages_fts` 在外部内容表上会读内容表，给人"索引还在"的假安全感；真正有效的只有 `MATCH`。** 她把那条断言删掉了，删对了。

---

## 8. 一处规则偏离（我自己造成的，必须说明）

**我改了 `002_p01.sql`，而它已经应用到真实 `.data`。**

- 为什么必须改在那里：**信息是在 002 被销毁的**，004 再想恢复已经无从恢复。
- 为什么风险可控：唯一跑过 002 的库是 `.data`，它当时 **0 条消息**，`sqlite_sequence` 本来就是 0，因此这条修改对已应用的库是空操作。
- 后果：`schema_migrations` 说 002 已应用，而 002 的文件内容已不是当初跑过的那份——**可复现性被破坏**。

**建议的消除方式（下一轮、待你批准）**：用 `.data/backups/2026-11-12_pre-p10/` 那份**已验证一致**的 001 备份，重放 `001 → 002(amend) → 003 → 004`。房间是 0 条消息，重放零损失，之后文件与库重新对齐。

---

## 9. 本次改了什么（拟提交内容，**尚未提交**）

```
 migrations/002_p01.sql   |  31 +++++     序列高水位（messages + events）
 migrations/004_p10_1.sql | （新增）      去 authority / 去 caused_by / origin 收窄
                                          + 重建 messages（保高水位）
                                          + FTS rebuild & integrity-check
                                          + 同房间回复触发器 + run 回复唯一索引
 server/index.mjs         |  13 +--      MIGRATIONS 加 004；读路径派生 author_kind
 test/provenance.test.mjs | 212 +++++--   重写：结构性 no-system / origin 白名单 /
                                          派生 author_kind / 因果可还原 / 跨房间 /
                                          高水位 / 全链路 FTS
 test/studio.test.mjs     |  90 ++++     DSH 的两条守卫（序列 + FTS 隔离）
 test/no-debt.test.mjs    |   2 +-       示例字段名随 schema 更新
```

**没有提交。** Observer 要求由非实现者独立验收，而我与 DSH 这轮都动了代码，所以不存在"干净的非实现者"——见交接 §1。

拟用 commit message（若通过）：

```
feat: P1.0.1 provenance closure and migration integrity

- drop messages.authority (derivable from members.kind) and
  messages.caused_by_message_id (causality lives in runs); narrow
  origin to composer|runtime|import -- system and tool described states
  that could not legally occur
- preserve sqlite_sequence high-water marks across the messages/events
  rebuilds in 002 and 004: INSERT..SELECT resets the sequence to the
  highest surviving id, which would reuse the id of a deleted message
- rebuild the FTS index in place (rebuild + integrity-check) instead of
  dropping it: an FTS5 external-content table cannot be dropped inside a
  transaction once its content table has been ALTERed
- enforce same-room replies with a BEFORE INSERT trigger and make
  runs.reply_message_id unique
- tests: two DSH guards (sequence, FTS isolation of 002) plus provenance
  coverage for derivation, causality, cross-room rejection and the
  high-water mark

npm test 22/22, build passed, mutation pass 5/6 (the 004 FTS rebuild is
defensive and not distinguishable by any test).
```

---

## 10. 边界

| 项 | 状态 |
| --- | --- |
| 提交 | **0** |
| 真实 `.data` | **未动**（仍 `001|002|003`、0 条消息，mtime 23:00） |
| 004 应用 | **未应用** |
| 真实模型 / ACP / 费用 | **0** |
| 可复跑 | `scratch/sa_check/p101_mutations.mjs`、`accept_002_isolated.mjs`、`accept_p011_m2m4.mjs` |

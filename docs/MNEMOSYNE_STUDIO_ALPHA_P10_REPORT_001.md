# STUDIO ALPHA · P1.0 交付与验收证据 001

日期：2026-11-12｜提交：**`bb2b52f`**｜实施与验收：Hermes（Engineering Lead）
基线：`8c2a235`（P0.1）｜工作区：干净

---

## 0. 结论

**P1.0 完成并封版。真实数据库已从 `001` 迁到 `003`，房间仍是 0 条消息。**

| 项 | 结果 |
| --- | --- |
| 测试 | **17/17**（原 10，新增 7） |
| 构建 | 通过 |
| 我的变异测试 | **6/6 CAUGHT** |
| 真实库 | `001_initial | 002_p01 | 003_p10`，`foreign_key_check` 干净，`foreign_keys=1` |
| 备份 | 三件套，已验证与原始一致 |

---

## 1. 做了什么

### 1.1 `migrations/003_p10.sql`

| 列 / 表 | 内容 |
| --- | --- |
| `messages.authority` | `human` / `member`——**没有 `system` 这个值**。系统产出的文字不是谁说的话 |
| `messages.origin` | `composer` / `runtime` / `tool` / `system` / `import`（技术通道，与授权不是一个问题） |
| `messages.caused_by_message_id` | 因果链，**区别于 `reply_to_id`**（后者是界面上显示的"回复给谁"） |
| `run_events` | `run_id` / `seq` / `type` / `payload_json`；一 run 内 seq 单调，`UNIQUE(run_id, seq)` |

**刻意做成增量迁移，不再重建 `messages`。**
SQLite 支持 `ALTER TABLE ... ADD COLUMN` 带列级 `CHECK`（已实测：加列后插 `authority='system'` 被 CHECK 拒绝）。002 已经因为要改 CHECK 重建过五张表；**再重建一次唯一要装历史的表，等于把 `sqlite_sequence` / `DROP`+`RENAME` 的风险白担一遍。**

**回填**：按 `members.kind` 把旧行标成 `human/composer` 与 `member/runtime`。P1.0 之前不存在系统生成的消息，所以没有一行是模糊的。

### 1.2 运行路径

- 用户消息写 `authority='human', origin='composer'`
- 回复写 `authority='member', origin='runtime', caused_by_message_id=触发消息`
- **失败时**：`run_events(type='error', {code, partial_chars})`——**只记长度，永不记正文**

### 1.3 两个新测试文件

**`test/no-debt.test.mjs`**（2 个测试）
扫描 `src/`、`server/`、`migrations/` 的社会压力词汇：`unread` / `badge` / `lastSeen` / `presence` / `typing` / `streak` / `catchUp` / `readReceipt` / `nudge` …
**按词首前缀匹配**，所以 `lastSeenAt`、`badgeCount` 也会被抓；散文说明可用 `no-debt-allow` 放行（放行这件事本身要人读一遍这个文件）。
第二个测试专门验证"扫描器真的会响"——防止这条规则悄悄退化成永远通过的空操作。

**`test/provenance.test.mjs`**（5 个测试）
`authority='system'` 被 CHECK 拒 / 来源与因果 / `run_events` 不进读路径也不进检索 / **失败后产出过文本也绝不生成回复消息** / 用冻结 001 造真旧库验证 003 回填。

---

## 2. 变异测试（对我自己的标准）

`scratch/sa_check/p10_mutations.mjs`，全部在临时副本里注入缺陷，跑 **17 个测试**。

| # | 注入的缺陷 | 结果 | 抓到它的测试 |
| --- | --- | --- | --- |
| P1 | 用户消息写成 `authority='member'`（来源混淆） | ✅ CAUGHT | provenance ×2 |
| **P2** | **失败前已产出的半句插进 `messages`** | ✅ **CAUGHT** | `run_events is process…` + `fails after producing text…` |
| P3 | 把半句正文写进 `run_events` | ✅ CAUGHT | `run_events is process…` |
| P4 | 往 `server/` 塞一个 `unreadCount` | ✅ CAUGHT | no-debt 扫描 |
| P5 | 003 没登记进 `MIGRATIONS` | ✅ CAUGHT | 12 个测试连带失败 |
| P6 | `authority` 的 CHECK 放宽，允许 `system` | ✅ CAUGHT | `cannot be authorised by 'system'` |

> **P2 就是上一轮 0 条测试报警的那一条。** 现在两个测试守它。

---

## 3. 真实库迁移

| 步骤 | 结果 |
| --- | --- |
| 备份三件套 → `.data/backups/2026-11-12_pre-p10/` | 4,096 B + 111,272 B + 32,768 B |
| **验证副本与原始一致** | ✅ 六张表行数、房间 id、迁移版本全部相同 |
| 迁移 `001 → 003` | ✅ `001_initial \| 002_p01 \| 003_p10` |
| 迁移后 | `foreign_key_check` 干净、`foreign_keys=1`、`messages=0`、`runs=0`、`run_events=0` |
| **应用层读取真实文件** | ✅ `GET /api/bootstrap` 返回 `common-room` / `你` / `Fake Resident` / 0 条消息 |

**一个必须记住的细节**：迁移前主库只有 **4,096 B**，而 **WAL 有 111,272 B**。
**只拷 `.sqlite` 会丢掉几乎全部数据。备份必须是三件套。**

迁移后 WAL 已 checkpoint 回主库（110,592 B），`-wal` / `-shm` 随连接正常关闭消失。

---

## 4. 我改了 DSH 的两处断言（必须说明）

`test/studio.test.mjs` 里两处 `schema_migrations` 断言原本是 **硬编码 `=== 2`**，加了 003 就挂。
我把它们改成**比对 `migrations/*.sql` 与实际已应用版本**：

```js
assert.deepEqual(appliedMigrations(db), migrationFiles());
```

理由不只是"让它过"：**固定数字在每次新迁移时都会碎，而且它抓不到真正该抓的失败——迁移文件加进来了但从未被应用。** 改完之后 P5 变异（003 从 `MIGRATIONS` 摘掉）才真的会报警。

**这是我在她文件里唯一的改动，两处断言 + 一个 import + 两个 helper。**

---

## 5. 分工上的实情

原计划 F1（半句不入库的测试）归 DSH。**我改由自己做了**，原因：

1. 这条的行为本身在 P1.0 变了（失败路径新增 `run_events`），**测试必须对着新代码写**；
2. 不做它，P1.0 的验收条件 ④ 无法成立。

**F2（FTS `rebuild` 被删掉无人守）仍然归 DSH，我没动。**

---

## 6. 仍未解决

| # | 项 | 归属 |
| --- | --- | --- |
| F2 | 002 的 FTS `rebuild` 无测试守（变异 → 0 失败） | **DSH** |
| G4 | 头像仍是字面量 `'F'`（接第二个 agent 会两个 F） | Hermes（P1.1） |
| G5 | `STUDIO_LOCAL_TOKEN` 启动时随机打印，ACP 子进程拿不到 | Hermes（P1.2） |
| G6 | `GET /api/bootstrap` 无鉴权 | Hermes（P1.2） |
| — | DSH ACP 根因未判别（实例锁 vs 插件未加载） | **DSH**（P1.3） |

---

## 7. 边界

| 项 | 状态 |
| --- | --- |
| 真实模型调用 / 费用 | **0** |
| ACP 连接 | **未接** |
| 房间内容出站 | **0** |
| `.data` 唯一改动 | 迁移 + 新建 `backups/`（均被 `.gitignore` 覆盖） |
| 房间消息 | **仍是 0 条**——我没有往房间里写任何测试消息 |

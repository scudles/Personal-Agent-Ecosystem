# Studio Alpha P0.1.1 工程修复报告

日期：2026-11-12
基线：`8c2a235 feat: P0.1 runtime isolation, security gate and run records`
范围：只处理 P0.1.1；未接 ACP、未调用模型、未改动真实 `.data`、未提交。

## 0. 结论

迁移测试已经不再用“手写近似库”证明迁移，而是从真实 `001_initial.sql` 建旧库、走 `openDatabase` 的迁移路径、再经 `createApp` + `/api/bootstrap` 读回旧房间与旧消息。四项定点核查完成，测试 10/10，build 通过。

需要先说明一处基线事实：`8c2a235` 中代码已经使用 `ROOM_ID='common-room'`，`git grep room-main` 为 0，迁移测试也已使用 `common-room` 并经 bootstrap。Hermes 描述的“测试仍用 `room-main`”对应的是修复前的版本。P0.1.1 真正补上的，是“旧库构造是否等于现实路径”的强度，而不是把一个仍然存在的 `room-main` 改掉。我没有把“已经修好”当成“不用验”。

## 1. 修改文件清单

| 文件 | 改动 |
|---|---|
| `test/studio.test.mjs` | 重写 `001 → 002` 迁移测试；新增 fresh-DB 外键强制测试；成功/失败路径补 `trigger_message_id`、`reply_message_id`、`reply_to_id` 方向断言 |
| `DEVELOPMENT_LOG.md` | 增加 P0.1.1 小节；测试数改为 10；移除文档中旧房间 id 字面量，避免 grep 误报 |

未改动：`server/index.mjs`、`migrations/002_p01.sql`、`src/App.tsx`、`package.json`、真实 `.data` 数据库。

## 2. 迁移测试修复前后的差异

**修复前（`8c2a235`）**

- 旧库由真实 `001_initial.sql` 建表，但只插入 1 条成员、1 条房间、1 条消息、1 条事件。
- 时间用固定字面量 `'2026-11-11 15:30:36'`，不是从 `CURRENT_TIMESTAMP` 的真实形态生成。
- 断言以 SQL 层为主：成员 kind、消息时间、消息数、房间数、`schema_migrations` 数。
- 虽然也调用了 `createApp` + `/api/bootstrap`，但只断言 1 条旧消息。
- 没验证迁移后外键是否仍开启、`reply_to_id`/`reply_message_id` 的成功与失败方向。
- 临时目录清理 `rm(..., { recursive: true, force: true })`，Windows 上可能因 WAL 句柄 EBUSY 失败。

**修复后（本轮，未提交）**

- 仍用真实 `001_initial.sql`，但旧库按真实 `CURRENT_TIMESTAMP` 形态生成：`datetime('now','-2 days')` / `datetime('now','-1 day')`，形如 `YYYY-MM-DD HH:MM:SS`。
- 旧库有 2 个成员、1 个房间、2 条按时间排序的消息、1 条事件。
- 迁移后断言：房间仍是 `common-room` 且名字是 `共同房间`；房间数仍为 1；`legacy-fake` 变为 `agent` + `fake`；两条消息都在，时间转成带 `Z` 的 ISO（允许毫秒）；`reply_to_id` 为 `null`；事件仍在；`schema_migrations` 为 2；`PRAGMA foreign_key_check` 为空。
- 经 `createApp` 启动、`/api/bootstrap` 读回：`room.id`、`room.name`、两条消息的正文和顺序都正确。这证明的是应用层可见性，不只是表还在。
- 迁移后连接上 `PRAGMA foreign_keys` 必须为 1；向 `messages.room_id`、`messages.reply_to_id`、`runs.trigger_message_id` 插入悬空引用必须抛错。
- 新增 fresh-DB 外键测试：新库迁移后同样必须拒绝悬空 `messages.room_id` 与 `runs.trigger_message_id`。
- 临时目录清理改为 `maxRetries: 3, retryDelay: 50`，覆盖 Windows WAL 句柄释放延迟。

## 3. 四项核查结果

### M1：房间 ID

- `git grep -n "room-main"`：**0 命中**（含代码、测试、文档）。
- `ROOM_ID = 'common-room'` 在 `server/index.mjs:17`，覆盖：
  - seed：`:113-116`；
  - bootstrap 房间查询：`:207`；
  - bootstrap 消息查询：`:212-213`；
  - 用户消息插入：`:254-255`；
  - `message.created` 事件：`:258-259`；
  - run 创建：`:261-262`；
  - `runtime.send` 的 `roomId`：`:279`；
  - 失败事件：`:301-302`；
  - 回复消息插入：`:314-315`；
  - 回复事件：`:318-319`。
- 没有 fallback。`bootstrap` 找不到房间时返回 500，而不是悄悄显示一个空房间；这是 fail-loud 的选择，符合“不要用 fallback 掩盖漂移”。
- 仍存在硬编码成员 id `human-local` / `fake-resident`，属于 P0.1 的固定单房间模型，不是房间 id 漂移；P1 接多成员时应改为从成员表解析。

### M2：迁移真实路径

迁移测试的调用顺序是：真实 `001_initial.sql` → 旧格式数据 → `openDatabase(file)`（执行 002）→ `createApp(migrated)` → `app.listen` → `GET /api/bootstrap` → 断言旧房间与两条旧消息。不是只查表存在或只查 SQL 行数。

### M3：回复关系

迁移后的外键图（`PRAGMA foreign_key_list` 实测）：

- `messages.reply_to_id → messages.id`
- `messages.member_id → members.id`，`messages.room_id → rooms.id`
- `events.message_id → messages.id`
- `runs.reply_message_id → messages.id`
- `runs.trigger_message_id → messages.id`
- `runs.member_id → members.id`，`runs.room_id → rooms.id`

语义与方向：

- 成功路径：触发消息的 `reply_to_id IS NULL`；回复消息的 `reply_to_id = 触发消息 id`；`runs.trigger_message_id = 触发消息 id`；`runs.reply_message_id = 回复消息 id`。三者指向同一条回复链。
- 失败路径：`runs.status='failed'`、`error_code='FAKE_RUNTIME_FAILED'`、`trigger_message_id` 保留、`reply_message_id IS NULL`；没有回复消息被插入（消息数仍为 1）。
- 空值：`messages.reply_to_id` 与 `runs.reply_message_id` 可空；`runs.trigger_message_id` 非空。
- 删除：两个回复外键都是默认 `NO ACTION`，删除被引用的消息会被阻止，不会留下悬空引用。

### M4：SQLite 迁移安全

- 重建顺序：`rooms → members → room_members → messages → events → runs`；`messages_fts` 在 `messages` 重建前后 drop/rebuild。依赖顺序正确。
- `migrate()`（`server/index.mjs:62-89`）：`PRAGMA foreign_keys = OFF` 在 `BEGIN IMMEDIATE` **之前**；每个迁移 `BEGIN IMMEDIATE` → 执行 SQL → `PRAGMA foreign_key_check` → 写 `schema_migrations` → `COMMIT`；`finally` 里恢复 `PRAGMA foreign_keys = ON`。
- 实测：迁移后 `PRAGMA foreign_keys` 为 1；在事务内执行 `PRAGMA foreign_keys = OFF` 仍是 1（SQLite 在事务中忽略该 PRAGMA），所以“在事务内关 FK”是无效的，当前代码放在事务外是正确的。
- `PRAGMA foreign_key_check` 在迁移提交前执行，迁移后为空。
- 时间转换：001 的 `CURRENT_TIMESTAMP` 形态（空格、无时区）走 `strftime('%Y-%m-%dT%H:%M:%SZ', ...)`；带 `T` 无 `Z` 的补 `Z`；已带 `Z` 的不动。测试覆盖真实形态。
- 残余：带数字偏移（如 `+08:00`）的旧时间不在转换分支内；真实 001 不会产生这种值，但若未来导入外部旧库，需要 003 或导入前规范化。

## 4. 实际命令与结果

```text
cd D:\Personal Agent Ecosystem\studio-alpha
npm test    → 10 tests, 10 pass, 0 fail
npm run build → tsc --noEmit + vite build 通过（29 modules）
git grep -n "room-main" -- . → 0 matches
```

测试清单（10）：

1. bootstrap exposes the room, the human member and seeded members
2. message flow stores ISO UTC timestamps and a reply link
3. malformed URL returns 400 and the server stays alive
4. cross-site and token-less writes are rejected
5. runtime failure keeps the human message and records a failed run
6. a delayed runtime does not block a second message
7. FakeRuntime yields status/text/done and supports delay and failure
8. member kinds are constrained and foreign keys stay clean
9. 002 migrates a real 001 database and bootstrap still shows its room and messages
10. foreign keys are enforced on a fresh database after migration

外键探针（在 `.data` 的临时副本上执行，真实文件未打开）：

```text
fk_on 1
messages [reply_to_id→messages.id, member_id→members.id, room_id→rooms.id]
events   [message_id→messages.id, actor_id→members.id, room_id→rooms.id]
runs     [reply_message_id→messages.id, trigger_message_id→messages.id, member_id→members.id, room_id→rooms.id]
fk_inside_tx_after_off 1
check []
```

## 5. 尚存问题

1. **偏移时间格式**：`+08:00` 这类旧值不在 002 的转换分支内；真实 001 不会产生，但外部导入需要额外处理。
2. **FTS 漂移**：`messages_fts` 仍只有 INSERT trigger，UPDATE/DELETE 不会同步；这是 P0.1 之前就存在的问题，P1 处理。
3. **bootstrap 无鉴权**：`GET /api/bootstrap` 仍不需要 token；已列入 P1 前置。
4. **UI 头像**：现在按 `mine ? 'human' : 'fake'` 和字面量 `'F'` 渲染；接入 Hermes 前必须改为按 `member.kind` + `display_name`，否则两个 F 无法区分。这是接 Hermes 的硬前置。
5. **seed 的字符串模板**：`ROOM_ID` 是常量，当前安全；但 SQL 仍是模板拼接，后续可参数化。
6. **删除策略**：回复外键默认 `NO ACTION`，删除被引用消息会被阻止；当前没有删除消息的功能，属于有意保守，但需要在 P1 明确。
7. **真实 `.data` 的房间 id**：本轮未打开真实库；Hermes 说它是 `common-room`，我按她的验收记录采信，未另做读取验证。

## 6. Git diff 与拟提交内容

- 工作区：`M DEVELOPMENT_LOG.md`、`M test/studio.test.mjs`；未提交，未封版。
- `git diff --stat`：2 files changed, 111 insertions(+), 25 deletions(-)。
- 完整 diff：`D:\Personal Agent Ecosystem\reports\2026-11-12-studio-alpha-p011-diff.patch`。

拟提交信息（等 Hermes 验收、Observer 复核、用户批准后再用）：

```text
test: prove real 001→002 migration through bootstrap

- build the old database from the real 001 schema and CURRENT_TIMESTAMP shape
- keep two messages and one event through 002, then read them via
  createApp + /api/bootstrap, not only via SQL
- assert FK enforcement stays on, and reply_to_id / reply_message_id
  point in the same direction on success and stay null on failure
- retry temp-dir cleanup on Windows WAL handle release
```

本轮不提交、不封版。

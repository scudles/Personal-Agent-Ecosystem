# STUDIO ALPHA · P0.1 回修复核报告 002

日期：2026-11-12｜复核人：Hermes｜被复核：DSH 的 P0.1 回修 1–3
性质：**只读验收 → 通过后建立基线提交。未改源码。**

---

## 0. 结论

**通过。已提交为 `8c2a235`。**

| 项 | 结果 |
| --- | --- |
| 回修 1 · room id | ✅ 修好了，且**修的是根，不是症状** |
| 回修 2 · 迁移测试 | ✅ fixture 换成真实 seed，且**补了"迁移后还看得见"的断言** |
| 回修 3 · `runs.reply_message_id` | ✅ 三处齐（迁移列 / 成功写入 / 测试断言） |
| `npm test` | ✅ **9/9** |
| `npm run build` | ✅ 通过 |
| **我的独立脚本 26 项** | ✅ **26/26**（上一轮 25/26） |

---

## 1. 三项回修逐条核实

### 1.1 room id：确认修的是根

| 检查 | 证据 |
| --- | --- |
| `ROOM_ID = 'common-room'` 常量 | `server/index.mjs:17` |
| 代码里 `room-main` 绝迹 | `grep -rn 'room-main' server/ src/ migrations/ test/` → **0 命中** |
| 常量被真正使用（不是摆设） | 出现在 seed `/207/213` 查询、`/255/259/262/279/302/315` 全部写入点 |
| 旧库迁移后房间数 | **1 行**（`common-room / 共同房间`），不再多出空房间 |
| **旧库迁移后是否能看见旧消息** | ✅ **bootstrap 返回 1 条，`room.id = common-room`** |

**这条是我上一轮的失败项（T1c），现在是 PASS。** 而且她是**改常量而不是改数据**——选对了：id 是内部标识，改名比改数据安全。

### 1.2 迁移测试：fixture 是重点

```js
INSERT INTO rooms(id, name, description, created_at) VALUES ('common-room', '共同房间', ...)
...
assert.equal(migrated.prepare('SELECT COUNT(*) AS n FROM rooms').get().n, 1);   // seed 没新建房间
const bootstrap = await request(base, '/api/bootstrap');                        // 迁移后真起服务
assert.equal(bootstrap.status, 200);                                            // 且能看到旧消息
```

**上一轮缺陷能溜过去的原因就是 fixture 用了新 id。** 现在 fixture 用真实 seed，并**补上了"迁移后通过 bootstrap 能看见"这条断言**——这才是我要的：**测「还看得见」，不只是「还在」。**

### 1.3 `runs.reply_message_id`

| 位置 | 证据 |
| --- | --- |
| 迁移列 | `migrations/002_p01.sql:119` `reply_message_id INTEGER REFERENCES messages(id)` |
| 成功路径写入 | `server/index.mjs:320` `UPDATE runs SET status=?, reply_message_id=?, ended_at=?` |
| 失败路径 | 只写 `failed` + `error_code`，该列为 NULL（正确） |
| 测试断言 | `test/studio.test.mjs:98` `assert.equal(run.reply_message_id, res.body.replyMessageId)` |

**我另外独立跑了一次**（不看她的测试）：

```
POST   = 201 {"ok":true,"messageId":1,"replyMessageId":2}
run    = {"status":"done","reply_message_id":2,"trigger_message_id":1}
reply  = {"id":2,"body":"我收到了：检查 run 指回复","reply_to_id":1}
一致?  = true
```

**三方对齐**：run 指向回复，回复指回触发它的用户消息。**这条链现在完整了。**

---

## 2. 回答你的两个问题

### Q1 · 我这边有没有跑过旧版 P0.1、库里有 `room-main` 副本？

**有，但不是我的，而且是测试遗留 —— 所以不需要一次性兼容迁移。**

| 位置 | 内容 | 判断 |
| --- | --- | --- |
| **真实 `.data/studio-alpha.sqlite`** | `migrations = [001_initial]`；`rooms = [common-room/共同房间]`；**无 `runs` 表**；messages = 0 | ✅ **从未被迁移过** |
| 我的验收脚本 | 全部走 `mkdtempSync` 临时目录（前缀 `sa-accept-`），跑完即删 | ✅ **我这边零残留** |
| **`%TEMP%/studio-alpha-migrate-mXwJ9S`** | `rooms = [room-main/主房间]`，`migrations = [001,002]`，**runs 无 `reply_message_id`** | ⚠️ **你旧版测试的遗留** |
| **`%TEMP%/studio-alpha-migrate-vf2mEW`** | 同上 | ⚠️ 同上 |

**结论：不需要兼容迁移。** 理由三条：
1. 真实库只有 `common-room`，且**从未迁移**；
2. 仅有的两个 `room-main` 库在系统临时目录里，是**测试夹具构造**的，不是任何人的真实数据；
3. **它们连 `reply_message_id` 都没有** → 进一步证明来自旧版本，不是任何在用状态。

**顺手报一个卫生问题**：这两个目录说明**你的测试在 Windows 上有时清不掉临时目录**。
`rm(dir, {recursive:true, force:true})` 在 WAL 句柄未释放时会抛 `EBUSY`，而 `force:true` **只忽略 ENOENT，不忽略 EBUSY**。
建议：`rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 })`。**小事，但会积累垃圾。**

### Q2 · 部分文本后失败，存不存半条？

**同意你的倾向：P0.1 不存半条。但理由不是"简单"，是原则。**

> **一条消息的语义是"某人在某时说过这句完整的话"。**
> **半句被存成一条消息，就会被人当成"她说过"——这是把过程伪装成事实。**

这和我们在 Mnemosyne 里反复确认的那条同源：**不能把"进行中的东西"和"已成立的记录"混成一个存储。**

**所以**：
- P0.1 **保持不存**（你现在的实现是对的：`failAfter:'after'` 时 502，`messages` 只剩用户那条 —— 我验过）；
- 将来真要留证，**记在 run 的 payload 里**（例如 `partial_chars` / `truncated:true`），**不要复用 `messages`**；
- P1 若做流式持久化，应该引入明确的 `draft` / `streaming` 状态，**而不是让 `messages` 承担两种语义**。

---

## 3. 第 4 项（头像）暂缓：同意，但记一条前置

`src/App.tsx` 现在仍是 `mine ? 'human' : 'fake'` + 字面量 `'F'`。

**P0.1 不做是对的。** 但请记在 P1 清单最前面：

> **接 Hermes 之前必须改**，否则房间里会出现**两个 F**（`fake-resident` 和 Hermes 都显示 F）。
> 到时候不是"不好看"，而是**分不清谁在说话**——那就直接违背"按谁说的分"这条。

---

## 4. 提交

因为三项回修我都验过、`npm test` 与 `build` 都过、26 项独立检查全绿，**我把 P0.1 提交进基线了**（不留未提交状态，这是上一轮 AIROOM 的教训）。

```
8c2a235  feat: P0.1 runtime isolation, security gate and run records
6f73049  chore: establish P0 baseline
```

| 项 | 值 |
| --- | --- |
| 提交内容 | 10 个文件，+878 / −134 |
| 工作区 | **干净** |
| `.data/` | 未触碰（仍是 001 / common-room / 0 消息） |
| `dist/` | 被我 rebuild（gitignore，不入库） |

提交信息里写清了 M1–M6 与三项回修的原因，包含"保持 room id = common-room"这条**决策依据**——避免下次有人又把它改回去。

---

## 5. 下一步

| 项 | 状态 |
| --- | --- |
| P0.1 | ✅ **封版 `8c2a235`** |
| P1 范围 | 按上一轮：ACP 客户端（进程外）+ 接 Hermes + pending 状态 + authority |
| P1 前置三件 | ① 头像按 `member.kind`/`display_name` ② `STUDIO_LOCAL_TOKEN` 落盘（脚本与 ACP 子进程要能拿到） ③ GET 鉴权设计（ACP 接入后"本机可读"不再安全） |

---

## 6. 边界

| 项 | 状态 |
| --- | --- |
| 改源码 / 改迁移 | **0**（只提交她已完成的工作） |
| `.data/` | 未触碰 |
| 我的临时库 | 全部清理（`sa-accept-*`、`sa-rmid-*` 跑完即删） |
| 她遗留的两处 | **保留未删**——那是 Q1 的证据 |

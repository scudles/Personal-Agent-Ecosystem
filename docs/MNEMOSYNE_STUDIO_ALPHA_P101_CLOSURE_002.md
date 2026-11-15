# STUDIO ALPHA · P1.0.1 Data Integrity Hardening · 最终证据 002

日期：2026-11-12｜编制：Hermes
提交：**`8dc95a5`**（实现）+ **`ed0bd03`**（复核修正）｜基线：`bb2b52f`｜工作区：干净
真实 `.data`：**未触碰**，仍为 `001 | 002 | 003`，0 条消息

---

## 0. 结论

| Observer 项 | 决定 | 结果 |
| --- | --- | --- |
| **A** 002 修订 | 接受 | ✅ 保留原始 blob、记录影响面、两处高水位、临时重放通过 |
| **C** 跨房间约束 | 接受（需确认 UPDATE 与 runs） | ✅ 已确认，且**比要求更强**：messages 全表 append-only |
| **FTS rebuild** | 原则上删除，除非能证明独立价值 | ⚠️ **我删错了，已放回** —— DSH 找到反例，测试现在会红 |
| 交付 | diff / 重放 / 序列 / 约束 / FTS / 测试 | ✅ 见 §2–§7 |

**一句话**：`8dc95a5` 里我删掉 rebuild 是错的，DSH 用一个可复现的窗口反例推翻了它；`ed0bd03` 放回 rebuild，并把这次修正做成了会红的测试。

---

## 1. 我认下的四处错误（都在 `ed0bd03` 修掉）

| # | 我的错 | 谁发现 | 现在 |
| --- | --- | --- | --- |
| 1 | 声称"没有测试能区分 004 的 rebuild"，据此删掉它 | **DSH** | **放回**，并加了一个会红的窗口测试 |
| 2 | 同一份 004 文件头说"用 rebuild 刷新"、正文说"已删除" | **DSH** | 统一 |
| 3 | 把 FTS5 CANTOPEN 写成 SQLite 规则 | **DSH**（我复测也没再复现） | 改写为"曾观察到一次、之后未复现"，不再当规则用 |
| 4 | 注释里写 `author_member_id`，实际列名是 `member_id` | **DSH** | 全改 |

**关于第 1 条，我要说清 DSH 的反例为什么成立**：
002 与 004 之间存在一个窗口 —— `messages` 这时还没有 delete 触发器，所以一条消息可以被删掉，而索引里留着它的 rowid。002 的 rebuild 管不到这个窗口，因为删除发生在它之后。

实测（`scratch/sa_check/window_rebuild_probe.mjs`）：

| | 004 之后 `MATCH 'token2'` | `integrity-check` |
| --- | --- | --- |
| **带 rebuild** | `[]`（悬空项被清掉） | PASS |
| **不带 rebuild** | `[2]`（悬空 rowid 仍在） | PASS |

**所以 rebuild 是有明确职责的**：它修的是 002→004 之间那段没有守卫的时间。我之前把它当"保险"删掉，是判断错误。

---

## 2. 最终 Git diff

```
ed0bd03 fix: restore the load-bearing FTS rebuild and correct contradictory notes
         ARCHITECTURE.md +8/-3 · DECISIONS.md +14/-8 · 004_p10_1.sql +43/-24
         test/provenance.test.mjs +49
8dc95a5 feat: P1.0.1 data integrity hardening
         ARCHITECTURE.md · DECISIONS.md · DEVELOPMENT_LOG.md
         migrations/002_p01.sql(+31) · migrations/004_p10_1.sql(新增)
         server/index.mjs · test/no-debt · test/provenance · test/studio
```

复核用的完整 diff：`git show 8dc95a5` / `git show ed0bd03`。

---

## 3. 迁移重放（用已提交的树，临时目录，未碰真实库）

从 `2026-11-12_pre-p10`（已验证一致的 **001** 备份）重放：

```
重放前: 001_initial | 消息 = 0
PASS  迁移链到 004            PASS  消息数不变（0）
PASS  房间唯一且为 common-room  PASS  外键干净
PASS  foreign_keys = 1        PASS  messages 列已收口
                                (id,room_id,member_id,body,reply_to_id,origin,created_at)
PASS  六个完整性触发器就位      PASS  FTS integrity-check
PASS  bootstrap 200           PASS  房间名读回「共同房间」
PASS  成员读回
```

**一个必须说准的点（DSH 提的）**：pre-P1.0 备份记录的是 **001**，所以 `002` 会被重新执行一次；如果某个库已经把 002 记进 `schema_migrations`，改过的 002 **不会重跑**。本库是 0 条消息，影响为零，但"已应用"这句话现在写准了。

---

## 4. 两处 sequence 高水位

| 位置 | 变异 | 结果 |
| --- | --- | --- |
| `002`（messages + events） | 去掉写回 | ✅ CAUGHT（`high-water mark survives two rebuilds`） |
| `004`（messages） | 去掉写回 | ✅ CAUGHT（同一条测试） |

判据实测：插 1–5、删 5 → 迁移前 `seq=5`；迁移后 `seq=5`；新消息 `id=6`。
004 只重建 `messages`，因此只处理 messages 的高水位；**events 在 004 里没有被重建，也没有被触碰**。

---

## 5. C · 完整性约束（含 UPDATE）

| 约束 | 机制 | 证据 |
| --- | --- | --- |
| 回复必须同房间 | `messages_reply_same_room` BEFORE INSERT | 变异 `WHEN 1=0` → 测试红 |
| **消息不可改** | `messages_append_only_update` BEFORE UPDATE | 变异 → 测试红 |
| **消息不可删** | `messages_append_only_delete` BEFORE DELETE | 变异 → 测试红 |
| **run 不跨房间（插入）** | `runs_room_consistency_insert` | 变异 `WHEN 0 AND …` → 测试红 |
| **run 不跨房间（更新）** | `runs_room_consistency_update` | ⚠️ 见下 |

**关于 runs UPDATE 那条，我的变异一度显示 MISSED，查清后是变异手法无效**（`0 AND …` 在那个 WHEN 里并没有让触发器失效）。改用受控对照：

```
触发器在  → UPDATE runs SET room_id='other-room'  → 被拒（run must reference messages from its own room）
DROP 掉   → 同一条 UPDATE                         → 成功
```

**所以它是承重的，只是我的变异写法没打到它。** 这条我如实记在这里，不写成"变异通过"。

**UPDATE 保护的回答**：不只是"相关字段不可修改"，而是 **`messages` 整表 append-only**——改一个字、改一个 reply_to_id、删一行，全部被拒。Observer 问的两点都成立。

---

## 6. FTS integrity-check 到底查什么（实测）

按你的要求确认它能否检查外部内容一致性。**答案：不能。**

| 构造 | `MATCH` | `integrity-check` |
| --- | --- | --- |
| 绕过同步触发器插入一条消息 | 查不到（0） | **PASS** |
| 从内容表删掉一条，索引留着 | 仍查得到（1） | **PASS** |

结论：它只校验 FTS5 索引的**内部结构**。所以它保留，但**不能当作"内容与索引一致"的证明**；那件事由测试用 `MATCH` 断言（含新增的窗口测试）。

---

## 7. 测试与构建

```
npm test  → tests 25 / pass 25 / fail 0
npm run build → ✓ built
```

**新增的一条关键测试**：`004 repairs index entries left dangling by a deletion in the 002→004 window`。
删掉 004 的 rebuild → **这条测试红**（已实测）。这是 Observer 要求的"能证明独立恢复价值的隔离测试"，反例由 DSH 给出。

---

## 8. 已修复 / 未覆盖 / 仍存在

**已修复**：authority 与 caused_by 移除；origin 收窄；append-only；同房间（消息与 run）；序列高水位（002 与 004）；FTS 悬空项（004 rebuild）；文档与 004 自相矛盾。

**仅由代码推断、未逐条实测**：`import` 通道的作者归属规则（"member_id 必须是原始发言人"）目前只是文档约定，**没有触发器或测试**。

**尚未覆盖**：
- `schema_migrations` 不存 checksum，同一版本号对应两份 SQL（P1.0.2）。
- 跨房间的 `reply_to_id` 迁移期数据（001 时代没有 reply_to_id，属理论风险）。
- 004 之后若有人 `DROP TRIGGER` 再写入，append-only 会失去意义（DBA 级别的绕过，不在防护范围）。

**仍存在的风险**：
- 我上一轮曾把真实 `.data` 重放到旧版 004；本轮开头已用 `2026-11-12_pre-replay` 备份**回滚到 003**，与 Observer 认知一致。真实库当前 = 003、0 条消息，本轮未再触碰。
- 最终重放（003 → 004）仍需一次批准后执行。

---

## 9. 可复跑脚本

| 脚本 | 证明什么 |
| --- | --- |
| `window_rebuild_probe.mjs` | rebuild 在 002→004 窗口里有独立修复价值 |
| `p101_mutations.mjs` | 高水位 / FTS / 同房间 / 派生 的变异 |
| `p101b_mut2.mjs` | append-only 与 runs 触发器的变异（含 MISSED 那条的解释） |
| `fts_integrity_probe.mjs` | integrity-check 只查内部结构 |
| `final_replay.mjs` | 从 001 备份重放到 004 的 11 项检查 |

# STUDIO ALPHA · P0.1 独立验收报告 001

日期：2026-11-12｜验收人：Hermes｜被验收：DSH 的 P0.1（M1–M6）
性质：**只读验收。未提交、未改源码、未动 .data。**
基线：`main @ 6f73049`（确认未变）

---

## 0. 结论

**有条件通过：25 / 26 项通过，1 项真实缺陷（兼容性断裂），3 项 P1 前必须处理。**

| 判定 | 内容 |
| --- | --- |
| ✅ **A1 已真正修好** | 事务边界、失败保命、并发不锁库——**我用自己的脚本验的，不是只信测试** |
| ✅ M1–M3、M5、M6 全部成立 | 见 §2 |
| ❌ **M-迁移 有缺陷** | 旧库迁移后**界面看不到老消息**（数据还在，房间 id 断了） |
| ⚠️ 3 项 P1 前处理 | UI 硬编码、runs 无法回溯回复、dist 陈旧 |

---

## 1. 先说状态（她的自述 vs 实际）

| 项 | 她的说法 | 实际 | 一致 |
| --- | --- | --- | --- |
| 基线 | `6f73049`，未提交 | `git log -1` = `6f73049` ✓ | ✅ |
| 工作区 | 9 改 + 1 新迁移 | `M` ×9 + `?? 002_p01.sql` = **10 条** | ✅ |
| 未 `add -f` | —— | `git ls-files` 中 node_modules/dist/.data/sqlite 命中 **0** | ✅ |
| `.data` 未动 | "这轮没动" | mtime 仍是 `23:23` / `23:30`（我建基线之前） | ✅ |
| `npm test` | 9/9 | **9/9 通过** | ✅ |
| `npm run build` | 通过 | **通过**（29 modules，606ms） | ✅ |

**先给她一个肯定**：这三条自述我全部核实为真。**她没有夸大。**

---

## 2. 我自己的验收（不用她的测试，另写 26 项）

脚本位置：`D:\HermesAgent\Data\cache\scratch\sa_check\accept.mjs`（工程外，不污染仓库）
方式：直接 import 工程的 `openDatabase` / `createApp`，用临时库 + 随机端口，跑完即删。

### 2.1 通过项

| 组 | 检查 | 结果 |
| --- | --- | --- |
| **M4 事务** | 失败时返回 502 | ✅ |
| | **失败时用户原话仍在**（这是 A1 的核心） | ✅ `messages=1` |
| | `runs.status = failed` + `error_code` | ✅ `FAKE_RUNTIME_FAILED` |
| | 有 `runtime.failed` 事件 | ✅ n=1 |
| | **慢 runtime 下并发两条不锁库** | ✅ 两条都 201 |
| | 两条用户 + 两条回复全部落库 | ✅ `messages=4` |
| | runs 全部 done | ✅ `{done: 2}` |
| | `failAfter:'after'`（有文本才失败）半句不入库 | ✅ 只留用户那条 |
| **M1 时间** | 格式 `YYYY-MM-DDTHH:mm:ss.sssZ` | ✅ |
| | `new Date(x).toISOString() === x` | ✅ 幂等 |
| **M2 URL** | `GET /%` → 400 且服务存活 | ✅ 400 / 随后 200 |
| **M3 门禁** | 跨站 Origin → 403 | ✅ |
| | 无 Origin 无 token → 403 | ✅ |
| | 同源 Origin → 201 | ✅ |
| | token 无 Origin → 201 | ✅ |
| | **错误 token → 403**（她没提，我补的） | ✅ |
| | `text/plain` → 415 | ✅ |
| | `x-content-type-options: nosniff` | ✅ |
| **M6 外键** | `reply_to_id` 自引用指向 `messages` | ✅ `reply_to_id->messages.id` |
| | `PRAGMA foreign_key_check` 为空 | ✅ n=0 |
| | `kind='fake'` 被 CHECK 拒绝 | ✅ |
| | `kind='observer'` + `runtime_type='remote'` 可插入 | ✅ |
| | 旧 `fake` 行迁移为 `agent` + `fake` | ✅ |

**M4 我可以确认修好了，而且是正确地修好的**：`server/index.mjs` 的三段式（提交用户消息 → 事务外 `for await runtime.send()` → 再单独提交回复/失败）**在代码层面站得住**，并发下也没出现 `database is locked`。

### 2.2 失败项（唯一一条）

```
FAIL  T1c 老消息是否出现在 bootstrap — bootstrap 返回 0 条，房间=room-main
```

**现象**：

| 检查 | 结果 |
| --- | --- |
| 旧库（001，`common-room` + 1 条消息）迁移后，消息行还在吗 | ✅ 在，`room_id = common-room` |
| 迁移后房间列表 | ⚠️ **两个**：`common-room`（有数据） + `room-main`（空） |
| bootstrap 返回 | ❌ **0 条消息**，`room.id = room-main` |

**根因（三步）**：

1. `migrations/001_initial.sql` 的 seed 是 **`common-room`**（冻结基线，不能改）；
2. `server/index.mjs:seed()` 现在插入 **`room-main`**，且用 `INSERT OR IGNORE` → **不去重、不改名**，于是旧库多出一间空房；
3. `bootstrap` 硬编码 `WHERE r.id = 'room-main'` → **只读新房间**。

**因此**：任何真正用过 P0 写过消息的人，升级后会看到一间空房，**旧消息在界面上消失**（数据库里还在）。

**为什么她的测试没抓到——这是最值得说的一点**：

她的 `002 migrates old 001 rows without data loss` 用例，构造"旧库"时写的是：

```js
INSERT INTO rooms(id, ...) VALUES ('room-main', '主房间', ...)
```

**用的是新 id `room-main`，不是 001 真实 seed 的 `common-room`。**
→ **这个 fixture 从未走过真实的升级路径。** 它测的是"行还在"，不是"行还看得见"。

**这不是我不信她的测试，是她的 fixture 与冻结的 001 不一致。** 我认为这是本轮唯一实质缺陷，也是 P0.1 唯一必须回修的地方。

---

## 3. 三条"测试通过但生产可能不成立"的假设

她主动请我找这类东西。我找到三条：

| # | 假设 | 为什么不成立 |
| --- | --- | --- |
| **H1** | "迁移保数据 = 迁移可用" | 见 §2.2。**行在 ≠ 能看见** |
| **H2** | "`runs` 记录失败就够 UI 区分" | `runs` 里**没有 `reply_message_id`**。一条 run 失败后，前端只能靠 `events` 反查它是哪条消息触发的；如果将来有重试，一条用户消息会对应多条 run，**无法知道"这条消息现在到底有没有回复"** |
| **H3** | "`createApp` 的默认 token 是安全的" | 默认 `randomUUID()` 每次重启都变。README 说"`npm start` 打印 token"，但**打印出来之后没有落盘**——脚本客户端重启后拿不到旧 token。P1 要接 ACP 时，子进程需要一个稳定的取 token 方式 |

---

## 4. 回答她请我重点挑战的三点

### 4.1 M4 的失败语义：`runs` 够不够？

**不够，但现在不要加 `message_attempts`。**

理由：
- `runs` 记的是**"一次尝试"**，而 UI 要显示的是**"这条消息的回复状态"**——两者在**有重试**时才分叉；
- 现在没有重试，所以 `runs` + `events` 能拼出来，**加表是提前设计**；
- 但**必须补一个字段**：`runs.reply_message_id`（成功时指向产出的回复）。**一行加在 002 里，成本几乎为零，但它决定了将来能不能回答"这条消息被谁答过几次"。**

**建议**：P0.1 回修时加 `reply_message_id`；`message_status` 表等 P1 有重试语义时再说。

### 4.2 Origin 策略

**现在的实现是对的，我不建议改。**

- 同源 `host:port` 精确匹配 + 本机 host 白名单 → 挡 CSRF，够用；
- **一次性 token 不必要**：这是本机单用户，token 的作用是"给非浏览器脚本一个通行证"，不是身份认证；
- **但 GET 无鉴权这条，P1 前要重新评估**：现在 `bootstrap` 把全部消息回给任何本机进程。本机进程本来也能直接读 `.data/*.sqlite`，所以**边际风险≈0**——**直到 ACP 接入为止**。ACP 子进程是"别人的 runtime"，届时"本机就能读"这条前提不再成立。**建议在 P1 设计 ACP 时一并决定：给每个成员一个受限视图，而不是共用 bootstrap。**

### 4.3 迁移策略：无条件重建五表，可接受吗？

**可接受，但必须补 room id 映射。**

| 方面 | 我的判断 |
| --- | --- |
| 无条件重建 vs 按 schema 检测 | ✅ **保持无条件**。001 已冻结、数据量小、有版本表守卫、整段在事务里、提交前 `foreign_key_check`。**改成检测只会增加复杂度，不增加正确性** |
| 事务与回滚 | ✅ 正确（`BEGIN IMMEDIATE` → `foreign_key_check` → 插入版本号 → `COMMIT`，异常 `ROLLBACK`） |
| FK 开关 | ✅ 正确（迁移前 OFF，`finally` 里 ON；且 `PRAGMA foreign_keys` 在事务外调用才生效——这里顺序对） |
| **room id** | ❌ **必须修**：002 加 `CASE WHEN id='common-room' THEN 'room-main' ELSE id END`，`messages` / `events` / `room_members` 三处的 `room_id` 同步映射 |

**或者更简单的一条路**：**别改 room id**——`seed()` 继续用 `common-room`，只更新 `name`。这样零映射、零风险，代价只是一个内部 id 名字不好看。**我倾向这条**，因为 id 是内部标识，用户只看 `name`。

---

## 5. 另外三处（不是缺陷，但 P1 前要处理）

| # | 项 | 说明 |
| --- | --- | --- |
| **S1** | **UI 头像硬编码** | `src/App.tsx` 仍是 `mine ? 'human' : 'fake'` + 字面量 `'F'`。加第二个 agent 会出现**两个 F**。P1 接 Hermes 前必须改成按 `member.kind` / `display_name` 渲染 |
| **S2** | **`dist/` 在我 build 前是旧的** | 她改了 `src/App.tsx` 但没 rebuild，`dist/assets` 还是 `index-UooWfeim.js`（P0 的）。**README 要求 `npm run build`，所以不算缺陷**，但建议把 `build` 写进启动流程，避免"改了没生效"的困惑 |
| **S3** | **`buildS` 后产物名变了** | `index-mK9mBhcZ.js`。`dist/` 已 gitignore，不影响仓库 |

---

## 6. 回修清单（给 DSH，按优先级）

| # | 改什么 | 为什么 | 工作量 |
| --- | --- | --- | --- |
| **1** | **修 room id 兼容性**（二选一：002 加映射 / 或 seed 不改 id） | 真实用户升级后看不到旧消息 | 小 |
| **2** | **把迁移测试的 fixture 改成 001 真实 seed（`common-room`）**，并加一条断言：**迁移后 `bootstrap` 能看到旧消息** | 这是本轮缺陷能溜过去的原因 | 小 |
| **3** | `runs.reply_message_id` | 让"这条消息被谁答过"可追溯 | 极小 |
| **4** | （P1）UI 按 `member.kind` + `display_name` 渲染头像 | 否则第二个 agent 也叫 F | 小 |

**第 1 和第 2 条是一体的**：修了代码不修测试，下次还会漏。

---

## 7. 我的验收结论

> **M1–M6 全部成立。A1 修得干净、正确、可复现。**
> **唯一挡路的是"旧库升级后看不见旧消息"——数据没丢，但用户会以为丢了。**
> **这不是设计问题，是一个 fixture 走错了路的实现问题。**

**判定：有条件通过 —— 修完 §6 的 1、2、3 即可进入 P1。**

---

## 8. 边界

| 项 | 状态 |
| --- | --- |
| 提交 / 改源码 / 改迁移 | **0** |
| `.data/` | **未触碰**（mtime 未变） |
| `dist/` | 被 `npm run build` 重建（gitignore，不入库） |
| 她的工作区 | **原样保留**（10 条未提交改动仍在） |
| 我新增的文件 | 只有工程外的 `scratch/sa_check/accept.mjs` 与本报告 |

# STUDIO ALPHA · 真实工程状态 001

日期：2026-11-12 22:48（快照时刻）｜编制：Hermes（Engineering Lead）
性质：**只记录实测结果。所有数字来自本机命令输出，未引用任何 Agent 的报告。**

---

## 1. 一句话状态

**代码到 P0.1，测试全绿，但真实数据库还停在 P0——002 从未落到 `.data`，房间里 0 条消息。**

---

## 2. Git

| 项 | 值 |
| --- | --- |
| 分支 | `main` |
| 提交 | `8c2a235` feat: P0.1 runtime isolation, security gate and run records |
| 上一基线 | `6f73049` chore: establish P0 baseline |
| 工作区 | **2 个已修改，0 未跟踪** |
| 未提交改动 | `DEVELOPMENT_LOG.md` (+11/−1)、`test/studio.test.mjs` (+111/−25)，`git diff 8c2a235` 合计 **+111/−25** |
| stash / 其他分支 | 无 |
| 最近写入 | `01:51`（约 21 小时前，之后无新改动） |

**未提交的这 2 个文件 = P0.1.1 的全部交付物**（只有测试与日志，**零源码改动**）。

---

## 3. 三种"完成"必须分开看（这是最重要的一张表）

| 层 | 状态 | 证据 |
| --- | --- | --- |
| **代码（CODE）** | ✅ P0.1 已完成 | `server/index.mjs` 392 行、`002_p01.sql` 130 行 |
| **测试（TEST）** | ✅ 10/10 通过 | `npm test` 实测 1.55s，fail 0 |
| **真实库（REAL-DB）** | ⚠️ **仍是 P0 形态** | `schema_migrations` 只有 `001_initial`；**没有 `runs` 表**；`messages=0` |

> **002 至今只在测试的临时库里跑过。真实用户的数据库一次都没迁移。**
> 这不危险（0 条消息、无数据可丢），**但它意味着「P0.1 已完成」这句话目前只对代码成立，不对正在运行的应用成立。**

---

## 4. 真实数据库现状

```
.data/studio-alpha.sqlite        4,096 B   11-11 23:23
.data/studio-alpha.sqlite-wal  111,272 B   11-11 23:23
.data/studio-alpha.sqlite-shm   32,768 B   11-12 00:46
```

| 表 | 行数 |
| --- | --- |
| rooms | 1（`common-room` / 共同房间） |
| members | 2 |
| room_members | 2 |
| messages | **0** |
| events | 0 |
| runs | **表不存在** |
| schema_migrations | 1（`001_initial`） |

**一个容易被忽略的事实**：主库文件只有 4 KB，而 **WAL 有 111 KB**——**数据实际在 WAL 里，还没 checkpoint 回主库。**
→ **只复制 `.sqlite` 的备份是不完整的。任何备份/拷贝必须 `.sqlite` + `-wal` + `-shm` 三件一起。**

---

## 5. 工程目录（17 个入库文件 + 未入库产物）

```
studio-alpha/
├── server/index.mjs          392 行   HTTP + 迁移 + 写入门禁 + FakeRuntime
├── migrations/001_initial.sql    1,491 B  冻结基线（P0 原始形态）
├── migrations/002_p01.sql      130 行    五表重建、ISO 时间、runs、FTS
├── test/studio.test.mjs        371 行    10 个测试
├── src/App.tsx                  37 行    房间界面
├── src/main.tsx / style.css
├── index.html / vite.config.ts / tsconfig.json
├── package.json / package-lock.json
└── README / ARCHITECTURE / DECISIONS / SECURITY / DEVELOPMENT_LOG
```

**未入库（已正确 ignore，`git check-ignore` 实测生效）**：`node_modules/`、`dist/`、`.data/`、`*.sqlite*`

**技术栈**：Node **v26.12.1**、npm **11.20.0**、内置 `node:sqlite` + FTS5、React 19、Vite 7、TS 5.9。**无原生编译依赖。**

---

## 6. 实际测试结果（刚跑，不是引用）

```
ℹ tests 10   ℹ pass 10   ℹ fail 0   duration_ms 1547.76
npm run build → tsc --noEmit && vite build → ✓ built in 794ms
dist/assets/index-mK9mBhcZ.js  225.91 kB │ gzip 70.83 kB
```

10 个测试覆盖：bootstrap / ISO 时间 + 回复链 / 畸形 URL 400 / 跨站与无 token 拒绝 / Runtime 失败保留用户消息 / 延迟 Runtime 不阻塞第二条 / FakeRuntime 事件流 / member kind 约束 + FK 干净 / **真实 001 迁移后 bootstrap 可见** / **迁移后外键真实生效**。

---

## 7. P0.1.1：进度、负责人、状态、未解决

| 项 | 内容 |
| --- | --- |
| **任务** | 修复 P0.1 的迁移真实性 + 四项问题 |
| **负责人（实现）** | **DSH**——已完成，改动留在工作区 |
| **独立验收** | Hermes——2026-11-12 已出报告 `..._P011_ACCEPTANCE_002.md` |
| **修改状态** | **未提交**（2 文件）、**零源码改动**（四项在代码层原本成立，她用测试钉住） |
| **我的验收判定** | **通过（有条件）** |
| **阻塞项** | **F1**：无测试守 `failAfter:'after'` 的"半句不入库"（变异 M5 → 0 失败） |

### 变异测试实测（把代码改坏，看她的测试叫不叫）

| 缺陷 | 结果 |
| --- | --- |
| `ROOM_ID` 改回 `room-main`（复现上轮真实 bug） | ✅ **fail 2（抓到）** |
| 迁移后不恢复 `PRAGMA foreign_keys = ON` | ✅ fail 2（抓到） |
| `runs.reply_message_id` 写成 `null` | ✅ fail 3（抓到） |
| 002 去掉 FTS `rebuild` | ❌ **fail 0（漏）** |
| 失败前已产出的半句也插进 `messages` | ❌ **fail 0（漏）** |

**结论**：三条核心行为有防线；**两条真实行为没有防线，其中最要命的是"半句入库"——它正好是 P1 接真 Runtime 时必然出现的情况。**

---

## 8. 尚未解决的工程问题（按严重度）

| # | 问题 | 现状 | 归属 |
| --- | --- | --- | --- |
| 1 | **真实库未迁移到 002** | `.data` 仍 001，`runs` 表不存在 | 我（工程执行） |
| 2 | **半句/流式内容无测试防线** | 变异 M5 漏 | DSH（补测） |
| 3 | **`authority` / `origin` / `caused_by` 字段不存在** | schema 无此三列 | 我（P1.0） |
| 4 | **`run_events` 不存在** | 无表 | 我（P1.0） |
| 5 | **成员头像硬编码 `'F'`** | 接第二个 agent 会两个 F | 我（P1.1） |
| 6 | **`STUDIO_LOCAL_TOKEN` 启动时随机打印** | ACP 子进程拿不到 | 我（P1.2） |
| 7 | **GET `/api/bootstrap` 无鉴权** | 本机可读；ACP 后前提失效 | 我（P1.2） |
| 8 | **DSH ACP 不可用** | profile 未加载插件 / 实例锁，未判别 | **DSH（专项）** |
| 9 | **No Debt 无结构性检查** | 只是"还没机会违反" | 我（P1.0 附带） |

---

## 9. 我没做 / 我做了什么（边界）

**做了**：只读检查、跑测试、跑构建、读 `.data`（只读打开）、写本文件与 ROADMAP 001。
**没做**：**没改任何业务代码**、**没提交**、**没迁移真实库**、**没跑 ACP prompt**、**没花钱**。

**DSH 正在进行的 P0.1.1 改动保持原样未动**，`git status` 里那 2 个文件就是她的现场。

---

## 10. 一个我认为现在必须说的时间窗

**真实库现在是 0 条消息、0 条事件。**
002 采用「无条件重建五张表」的策略——**在有数据之前迁移，成本是零；一旦房间开始有人的话，同样一步就变成有风险的操作。**

→ **建议在做任何 ACP 接入之前先完成真实库迁移**，让 `.data` 和 `002` 对齐，而不是等到有了几百条消息再动。

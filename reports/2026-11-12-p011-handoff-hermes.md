# Handoff 001 — P0.1.1 独立验收

- 发起者：DSH
- 主要接收者：Hermes
- 状态：`DECISION_REQUIRED`
- 日期：2026-11-12
- 基线：`8c2a235 feat: P0.1 runtime isolation, security gate and run records`
- 工作区：`D:\Personal Agent Ecosystem\studio-alpha`（共享目录，双方可访问）

## A. 接收者

Hermes。她是 P0.1 的独立验收人，也是当前工程基线的封版人。

## B. 交接原因

P0.1.1 的修复由我编写，我不能对自己的修改做独立验收；是否接受、以什么内容提交，需要由未参与编写的人判断。提交动作本身还需要 Observer 复核和用户批准，我不应自行完成。

## C. 需要解决的问题

1. 独立判断本轮迁移测试是否真的覆盖了“真实 001 → 002 → 应用层读回”的路径，而不是只证明表还在。
2. 复核 M1–M4 四项定点核查的结论是否成立。
3. 给出明确结论：接受 / 有条件接受 / 拒绝。
4. 若接受，给出拟提交的文件清单与 commit message；若有问题，指出文件与行号。
5. 按用户要求，本轮不要直接提交；等 Observer 复核、用户批准后再提交。

## D. 可直接转发的消息

Hermes，P0.1.1 的工程修复已完成，请你做独立验收。

基线是 `8c2a235`，工作区当前有 2 个未提交文件：`studio-alpha/test/studio.test.mjs` 和 `studio-alpha/DEVELOPMENT_LOG.md`。没有改 `server/index.mjs`、`migrations/002_p01.sql`、`src/App.tsx`，没有提交，没有动真实 `.data`。

先说明一个基线事实：`8c2a235` 中 `room-main` 已经 0 命中，迁移测试已经使用 `common-room` 并经 `/api/bootstrap` 读回。你描述的漂移对应的是修复前的版本。本轮补的是测试强度，不是重新改房间 id。

请独立验证：

1. 用真实 `001_initial.sql` 建旧库（`CURRENT_TIMESTAMP` 形态、2 条消息、1 条事件），跑 `openDatabase` 的 002，再 `createApp` + `/api/bootstrap`，确认旧房间名和两条消息都能读回。
2. M1：`git grep room-main` 为 0；`ROOM_ID` 是否覆盖 seed、bootstrap、messages、events、runs；是否有 fallback 或硬编码。
3. M2：迁移测试是否真的经过应用层，而不是只查表。
4. M3：`messages.reply_to_id`、`runs.reply_message_id`、`runs.trigger_message_id` 在成功/失败路径上的方向、空值、外键是否一致。
5. M4：002 的五表重建顺序、FK OFF/ON 时机、`foreign_key_check`、事务提交顺序、旧时间转换；注意 SQLite 在事务内会忽略 `PRAGMA foreign_keys`。

请给出：接受 / 有条件接受 / 拒绝；若接受，拟提交的文件与 commit message；若有问题，指出文件与行号。按用户要求，本轮不要直接提交，等 Observer 复核和用户批准。

材料：

- `D:\Personal Agent Ecosystem\studio-alpha`（`8c2a235` + 未提交改动）
- `D:\Personal Agent Ecosystem\reports\2026-11-12-studio-alpha-p011-report.md`
- `D:\Personal Agent Ecosystem\reports\2026-11-12-studio-alpha-p011-diff.patch`
- `studio-alpha/test/studio.test.mjs:240-370`
- `studio-alpha/DEVELOPMENT_LOG.md`
- `studio-alpha/server/index.mjs:62-89`
- `studio-alpha/migrations/002_p01.sql`

测试结果：`npm test` 10/10，`npm run build` 通过。

权限边界：只读验收；可以在临时副本上跑测试和 build；不要改工作区、不要提交、不要打开或迁移真实 `.data`、不要调用模型或使用凭据。

## E. 交接材料

| 材料 | 路径 | 版本/位置 |
|---|---|---|
| 工程工作区 | `D:\Personal Agent Ecosystem\studio-alpha` | `8c2a235` + 2 个未提交文件 |
| 修复报告 | `D:\Personal Agent Ecosystem\reports\2026-11-12-studio-alpha-p011-report.md` | 当前版本 |
| 完整 diff | `D:\Personal Agent Ecosystem\reports\2026-11-12-studio-alpha-p011-diff.patch` | 当前工作区 |
| 迁移测试 | `studio-alpha/test/studio.test.mjs:240-370` | 当前工作区 |
| 开发日志 | `studio-alpha/DEVELOPMENT_LOG.md` | 当前工作区 |
| 迁移执行 | `studio-alpha/server/index.mjs:62-89` | `8c2a235` |
| 迁移 SQL | `studio-alpha/migrations/002_p01.sql` | `8c2a235` |
| 测试结果 | `npm test` → 10 pass；`npm run build` → pass | 2026-11-12 |

## F. 当前状态

**已完成**

- 迁移测试重写：真实 001 schema、2 条消息、1 条事件、`CURRENT_TIMESTAMP` 形态、002 迁移、`createApp` + `/api/bootstrap` 读回。
- 新增加固：FK 开启检查、悬空引用拒绝、成功/失败路径的回复关系断言、临时目录清理重试。
- 文档更新：`DEVELOPMENT_LOG.md` 增加 P0.1.1 小节，测试数改为 10，移除旧房间 id 字面量。
- 测试：10/10；build：通过。
- 真实 `.data` 未打开、未迁移。

**已验证**

- `git grep room-main` → 0。
- `ROOM_ID` 覆盖 seed/bootstrap/messages/events/runs。
- 迁移后 `PRAGMA foreign_keys=1`；`foreign_key_check` 为空；事务内 `PRAGMA foreign_keys=OFF` 被 SQLite 忽略（实测仍为 1）。
- 真实 001 的空格时间格式被转换为带 `Z` 的 ISO。

**仍是假设**

- Hermes 记录的真实 `.data` 房间 id 是 `common-room`；本轮未打开真实库复核。
- 带数字偏移（`+08:00`）的旧时间不在 002 转换分支内；真实 001 不会产生，但外部导入需要处理。

**接收者从哪里继续**

从 `git diff` 与 `test/studio.test.mjs:240-370` 开始；先跑 `npm test` 和 `npm run build`，再按 M1–M4 逐项核对。

## G. 权限边界

- 可以：读取全部材料；在临时副本上运行 `npm test` / `npm run build`；提出修改意见。
- 不可以：修改当前工作区、提交 commit、打开或迁移真实 `.data`、调用模型、使用凭据、改动其他 Agent 配置。
- 交接不代表获得代码修改或提交授权；提交需 Observer 复核与用户批准。

## 后续

Hermes 验收后，若接受，下一步交接给 Observer 做封版前复核；Observer 通过后由用户批准提交。原任务负责人 DSH 继续跟踪直到提交或明确撤回。

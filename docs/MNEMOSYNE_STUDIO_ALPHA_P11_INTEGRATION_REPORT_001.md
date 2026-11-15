# STUDIO ALPHA · P1.1 接入报告 001（Hermes 侧）

日期：2026-11-13｜提交：**`375d992`**｜基线：`873a44a`（DSH，Contract v1.1）
测试：**51/51**（含 `verify/integration` 5 条）｜build 通过｜真实 `.data` 已到 **007**

---

## 1. 契约：我看错了版本，撤回三处"待补"

我上一轮读的是 `873a44a^`（v1.0），据此提了三条待补。**v1.1 里三条都已存在**：

| 我说的 | v1.1 实际 |
| --- | --- |
| `error` 缺 `delivery` | `:45-46` 有，语义在 `:103-116` |
| `tool.state` 没枚举 | `:41-43` 四个取值 + `toolCallId` |
| `session` 事件文档没写 | `:38` 有，§2 `:49-51` 写明"每次 run 第一个事件，恰好一次" |

**结论：契约不需要我确认什么，它已经是可实现的。** 我的错误是拿旧文件当基准——这正是我自己在 004 里犯过的"读的不是当前版本"。

已按 v1.1 实现，包括 DSH 建议的 tool 映射：

| contract `tool.state` | 我的实现 |
| --- | --- |
| `pending` | `tool_call`，每个 `toolCallId` 一行 |
| `in_progress` | 不插行 |
| `completed` | `tool_result`，`{ok:true}` |
| `failed` | `tool_result`，`{ok:false}` |
| 无 `toolCallId` | `status {kind:'protocol_anomaly'}`，不静默合并 |

---

## 2. P1.2 两处残留：都修了

### 2.1 `message_visual_links` 不是 append-only（`007_p12_link_integrity.sql`）

005 只给了 INSERT 的 same-room 守卫。**新迁移**（不修改已应用的 005）：

- `BEFORE UPDATE` → 拒绝（"cannot be rewritten"）
- `BEFORE DELETE` → 拒绝（"cannot be deleted"）
- `BEFORE UPDATE OF message_id, object_id` 的 same-room 条件也加了

> 说明：append-only UPDATE 触发器和 same-room UPDATE 触发器同时存在时，后者**永远不可达**（前者先 ABORT）。我按你的建议都写了，但如实标注它是"防线里的第二层、永不会触发"。如果你认为不该保留不可达的触发器，说一声我删。

测试：`test/visuals.test.mjs` 新增一条，UPDATE/DELETE 双双被拒，链接仍指 v1。

### 2.2 前端只传 `visualId`（`src/App.tsx`）

改成 `attached: {id, version}`：**选中那一刻的版本**被钉住，不是发送时的 latest。

**并且用真实场景验证了**（这是你指出的那个窗口）：

```
界面上点「用于下一条消息」→ 钉住 v1
   ↓  （发送前）
通过 API 追加 v2
   ↓
在输入框发送
   ↓
message_visual_links.version_no = 1   ✓
画布卡片显示 v2 · 共 2 版，消息附图显示 v1
```

这一条是**在真实 `.data`、真实 Agent 下跑出来的**，不是临时库。

---

## 3. 真实端到端：一次真实 Agent 表达

| 项 | 结果 |
| --- | --- |
| 配置 | `STUDIO_RUNTIME=acp`，`ACP_ARGS` 指向 DSH 的 `bin.js --profile acp`，`DSH_HOME` = phase-1 probe home |
| 结果 | `stopReason=end_turn`，正文 94 字，`runs.status=done` |
| `runs.session_id` | `a53c37b0-…`，来自 `session` 事件，落库成功 |
| `run_events` | `status(session)` → 3×`status(progress)`（思维片段）→ `tool_result` → `done{stopReason,chars:94}` |
| 版本钉住 | `message_visual_links.version_no = 1`，画布已是 v2 |
| 回复内容 | "我这个房间里没看到任何画布或形状……麻烦你把那张图或画布内容发给我" |
| 费用 | **cost unknown**（DSH 的 provider 账单，我这侧看不到金额；不记 0） |

**那句回复本身就是 JOINT-02 的证据**：真实的她看不到画布。这不是 bug，是当前输入方式的边界。

---

## 4. 真实流量暴露、已修的问题

**工具结果没有对应的调用行。** 真实 Agent 只发了 `tool_call_update(completed)`，没有 `pending`。原实现会写出一条"工具结束了但从未被调用"的记录。

修法：结果到达而调用未见时，补写 `tool_call` 并标 `inferred: true`，附 `note: 'result arrived without a pending update'`。宁可留一条诚实的重建，不留一条自相矛盾的记录。已加测试（`verify/integration` 第 4 条）。

---

## 5. 集成测试覆盖（`verify/integration/acp-through-server.test.mjs`）

真实 `AcpClient` + 真实服务端 + Fake ACP（零费用）：

1. 成功路径：HTTP 进 → 子进程起 → 回复进 bootstrap → `run_events` 有 tool_call/tool_result/session/done
2. Prompt 失败：**`delivery: completed`**（Agent 给了终止答复，我们知道结局）
3. Prompt 沉默：**`delivery: unknown`**（发出去了、没有答复 → 可能已执行）
4. 两种失败都**不自动重放**（`runs` 恒为 1 行）
5. 孤儿 `tool_result` 配对 + `inferred`
6. 关闭服务端后子进程**确实不存在**（`process.kill(pid,0)` 抛错）

> 第 2 与第 3 条刻意分开：`completed` 和 `unknown` 的区别是"知道结局"与"可能已经执行"，我把它们写成两条会红的测试，而不是一条。

---

## 6. 未完成与风险

| 项 | 状态 |
| --- | --- |
| **Real visual input to the runtime** | **未做**，需要契约先定（见交接） |
| Hermes 侧真实 prompt | 仍卡凭据（`hermes -p bridge config set OPENCODE_GO_API_KEY`），**bus factor 不关闭**，同意 DSH 判定 |
| 多轮上下文 | 同一 session 复用，但**没有测过第二条消息**（真实场景只跑了一轮） |
| cancel / 权限请求 | 服务端没有 cancel 路由，`session/request_permission` 默认 deny |
| 视觉输入 30KB 悬崖 | 未触及：目前根本不发视觉内容 |

---

## 7. 边界

- 未改动 `runtime/`、`verify/runtime/`（DSH 的文件）
- 未改动契约；上面的接口建议只是建议
- 真实 `.data` 迁移 006/007 已做，备份 `2026-11-13_pre-006-007`
- 未提交任何密钥；`DEEPSEEK_API_KEY` 只在子进程环境里

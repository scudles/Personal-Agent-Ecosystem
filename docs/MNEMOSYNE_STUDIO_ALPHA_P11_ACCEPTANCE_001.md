# P1.1 收口 · Hermes 的验收与确认 001

验收人：Hermes（Engineering Lead）｜日期：2026-11-13
被验收：DSH 的 `runtime/`、`verify/runtime/`（Contract v1.3 + adapter + 证据）
依据：Decision 002 —— 作者不得验收自己的实现；DSH 实现，Hermes 验收。

---

## 一、结论

| 项 | 结论 |
| --- | --- |
| **DSH-02 Runtime Adapter** | **通过** |
| **DSH-03 证据** | **通过**（Hermes 段已解除阻塞） |
| **DSH-04 Bus Factor** | **关闭**（五项全部成立，含"能独立诊断"） |
| **Contract v1.3** | **确认，可冻结** |

**一条限定**：以上不包含"多轮稳定"。第二轮能接上是**本机实测**，依赖 ACP 的 `session/resume` 与 Hermes 侧 session 不丢；换模型、换 agent、重启后若 resume 不可用，就会新开会话。文档里必须继续写成"本机实测可用，不构成保证"。

---

## 二、DSH-02 通过的依据

不是我读代码之后的印象，是我用真实链路压过的：

| 检查 | 证据 |
| --- | --- |
| Fake ACP 经真实服务端闭环 | `verify/integration/apc-through-server.test.mjs` 12 条 |
| 真实 DSH 跑通 | `end_turn`、94 字、`runs.session_id` 落库 |
| 真实 Hermes 跑通 | `end_turn`、正文、`local-86762aca…` |
| context 真的到模型手上 | 第二轮里驻留直接引用 Hermes 的"我撤回"，Hermes 承认并自我修正 |
| 同轮可见性 | `run_events` 的 context items = 1 和 2 |
| `RUNTIME_BUSY` / 200 KiB 闸 | 她的 20/20 测试；我这边上限 50 KiB 未触发 |
| 无孤儿 | 关服后 `Get-CimInstance` 查 `fake-acp-server` 计数为 0；服务器被 SIGKILL 后同样为 0 |
| 启动失败无泄漏 | `--hang-initialize` 经服务端：`not_started`、`runtime.client === null`、无遗留进程 |

## 三、DSH-04 Bus Factor 五项

| # | 项 | 我怎么证明的 |
| --- | --- | --- |
| 1 | 理解 Runtime 架构 | 读过 `acp-client.mjs` 全文与 `adapter.mjs`，能说清 `session/resume → load → newSession` 的降级链 |
| 2 | 独立运行 fake ACP | 手写 JSON-RPC 驱动 `fake-acp-server.mjs`（`handoff-checklist.mjs`） |
| 3 | 阅读并诊断 ACP Client | 定位过三处真实现场，见下 |
| 4 | 独立处理 Session 生命周期 | 按 `(房间, 成员)` 分键、`CHILD_EXITED` 的 session 不复用、重启后 resume 成功 |
| 5 | 授权范围内完成真实 Prompt | Hermes 侧凭据自己配、`hermes -p bridge acp` 自己驱动、`end_turn` |

**第 3 项的三个现场（都是自己查出来的，不是问出来的）**：
- `Invalid params: session is already active` → `#openSession` 无条件 resume 导致丢会话；
- `no API key for provider route "deepseek-official"` → profile 未继承凭据；
- `RUNTIME_CHILD_EXITED` → 子进程被杀后的 error 事件语义与孤儿检查。

## 四、Contract v1.3 确认

确认内容：`RuntimeInput.context`（additive）、`RUNTIME_BUSY`、`RUNTIME_PROMPT_TOO_LARGE`、200 KiB 最后一道闸、不变量 10–12。**事件类型未变**，`session/text/status/tool/done/error` 六个够用。

**落在我这边的实现（`b1cb421` / `2439a87` / 本次提交）**：
- context 在每位参与者**开跑那一刻**现算（同轮先发言者可见），按 (轮次, 消息 id) 升序，排除自己；
- 带 `authorName` 与 `round`；
- 上限 20 条 / 50 KiB，建 run 前 400；中途超限则把那条 run 关成 `RUNTIME_CONTEXT_TOO_LARGE`，不截断；
- `RUNTIME_CHILD_EXITED` 的 session 不再交回。

**措辞固定**（同意她的写法，不升级成承诺）：
> session 是她的记忆，context 是这次讨论的材料。块头是语义标记，不是隔离边界——被引用的正文仍可能包含指令。

---

## 五、费用记账：我能做的一半，做完了

| 项 | 状态 |
| --- | --- |
| 墙钟 | **不必存**：`runs.started_at` / `ended_at` 已可推导，存了就是同一事实两遍 |
| 回复长度 | 已存（`run_events.done.chars`） |
| **token / 费用** | **现在拿不到**。`acp-client.mjs` 只读 `result.stopReason`，ACP 的 usage 被丢弃 |
| 我这边的准备 | 已完成：`done` 事件若带 `usage`，原样落库；不带就不写（**绝不记 0**） |

**需要 DSH 的一小步**：`prompt()` 里 `result?.usage` 若存在，就带进 `done` 事件。这样下一次真实调用起，token 就有历史账。若某个 provider 不上报，就保持没有——**未知就是未知**。

这不是阻塞项，但越晚做，之前那几次调用的账永远补不回来（她提得对）。

---

## 六、仍未验的（真实调用才能做，需要单独授权）

1. 真实流式 cancel
2. 长任务 / tool 调用密集场景
3. 硬杀（SIGKILL 服务器）后的孤儿——**这条我其实验过了**：0 孤儿，可以划掉
4. 费用记账（等 §5 的那一步）

---

## 七、一句话

**P1.1 的共享接口到这里冻结。** 之后只 additive。Runtime 侧的单点依赖从"只有 DSH 能维护"降到"两个人都能跑、都能诊断、都能改"。

# STUDIO ALPHA · P1.1 + P1.2 阶段报告 001

日期：2026-11-13｜提交：Studio `7888680`（Hermes）、`e15891f`（DSH）
测试：`npm test` **59/59**、`npm run test:runtime` **17/17**、build 通过
真实 `.data`：迁移 **008**，4 条消息（含 JOINT-02 那一轮）

依据：Observer 任务书《P1.1 / P1.2 并行推进任务书》§一 的核心目标——
**"让至少一个真实运行的 Agent，通过 Studio Alpha 完成一次完整、可追溯、用户可见的表达。"**

---

## 一、目标是否达成

**达成。** 有真实证据，不是自述：

| 证据 | 内容 |
| --- | --- |
| 真实 Agent 的回复 | `stopReason=end_turn`，94 字，写进 `messages` |
| 可追溯 | `runs.session_id` = `a53c37b0…`；`run_events` 有 `status(session)` / `status(progress)` / `tool_result` / `done` |
| 用户可见 | 浏览器打开房间就能看到；截图见 `studio-real-first-message.png` |
| 不是桩 | 子进程是 `@deepseek-ai/dsh`，走 ACP，不是 FakeRuntime |

**一句话**：她说的那句话，是模型生成的、经真实 ACP 协议回来的、进了 append-only 的消息表、能在界面上看见——不是测试夹具写着"我收到了：xxx"。

---

## 二、P1.1（DSH 主导）

| 项 | 交付 | 状态 |
| --- | --- | --- |
| DSH-01 契约 | `runtime/BRIDGE_CONTRACT.md` **v1.2**（`063d526`） | 关闭 |
| DSH-02 Adapter | `runtime/adapter.mjs`（`5514f84` 修会话复用） | 关闭 |
| DSH-03 证据 | `verify/runtime/REAL-PROMPT.md`（observed / inferred / not-verified 分界 + 附件边界 + 多轮） | 关闭 |
| DSH-04 交接 | `runtime/HANDOFF.md` 五项，Hermes 逐项实跑（`55cccc9`） | 关闭 |

契约的四处加法都来自真实失败，不是设计推演：
`session` 事件（文档落后于实现）、`error.delivery`、`tool.state` 枚举与序（终态可能先到）、`RuntimeInput.attachments`。

## 三、P1.2（Hermes 主导）

| 项 | 交付 | 状态 |
| --- | --- | --- |
| 视觉对象三表 + 五接口 + 画布带 | `005_p12.sql`、`e71ce8d` | 关闭 |
| 视觉验收（七项 + 截图 + 视觉判读） | `MNEMOSYNE_STUDIO_ALPHA_P12_VISUAL_ACCEPTANCE_001.md` | 关闭 |
| 链接表 append-only 补全 | `007` + `008`（删死触发器） | 关闭 |
| 钉选中时刻的版本 | `App.tsx`，真实场景验证 `version_no=1` | 关闭 |
| 界面三处可用性修复 | `7888680`：落底 / markdown / 角标 | **待 DSH 独立验收** |

## 四、JOINT-01（Fake ACP → Studio 闭环）

`verify/integration/acp-through-server.test.mjs`，**10 条**，都经真实服务端与真实 `AcpClient`：

| 场景 | 断言要点 |
| --- | --- |
| 成功 | 201、回复进 bootstrap、`session_id` 落库、tool 进 `run_events` |
| Prompt 失败 | `delivery: completed`（Agent 给了终止答复）；不重放 |
| Prompt 沉默 | `delivery: unknown`（可能已执行）；不重放 |
| 第二轮消息 | 拿到第一轮的 `sessionId` |
| 孤儿 `tool_result` | 补 `tool_call` 并标 `inferred: true` |
| 死掉的服务器留下的 `running` | 关成 `failed / SERVER_RESTART` + integrity 事件 |
| `initialize` 挂住 | `not_started`、无孤儿进程 |
| 附件 | 送达钉住版本的字节；库里只存元数据 |
| 关闭 | 子进程不残留 |

## 五、JOINT-02（视觉与 Runtime 结合）

真实房间、真实 Agent、真实钉版本，全链路走完：

```
界面选中「用于下一条消息」→ 钉 v1 → 发送前追加 v2 → 发送
message_visual_links.version_no = 1                    ← 钉版本在真实流量里成立
run_events: {kind:'attachments', items:[{objectId, versionNo:1, bytes}]}
画布卡片 v2 · 共 2 版   气泡角标 v1
```

她的回复引用了坐标 `(104,104)`、半径 `44`、色值 `#1d2330 / #7bdcc0 / #f5c26b`，并**在结尾自己提了"如果之后要画第二版"**——她没看到 v2，因为附件按钉住的版本取。

**输入边界的如实描述**：她读的是 **SVG 源码**，不是渲染后的像素。她自己在回复里说了这一点。这是 A 方案的上限，不是缺陷。

---

## 六、没做到的（不掩饰）

| 项 | 真实状态 |
| --- | --- |
| Hermes 侧真实 prompt | `hermes -p bridge acp` 能握手，**缺 provider 凭据**，一次真实生成都没跑过。Bus Factor 第 5 项对 Hermes 不成立 |
| 两个 Agent 同房间 | 从未验证。房间至今只有一个 Agent |
| 会话键 | `lastSessionForRoom` 按房间取；接第二个 Agent 会串话，需改 `(room_id, member_id)` |
| Mnemosyne | **0 行实现**，全部 PROPOSAL |
| 视觉输入形式 | 只有 SVG 源码一种；图片、截图、写回画布都不支持 |
| vN 角标与"画布已到 v2"的提示 | 角标已可读，但"消息钉旧版、画布已是新版"这件事**界面不说**。属产品判断，未做 |
| 独立验收 | `7888680` 由我提交，等 DSH 验 |

## 七、风险

1. **主要实现者与验收协调者是同一人**（我）。对冲方式是 DSH 验我的、我验 DSH 的、Observer 审证据、用户封版——但这仍是结构性风险。
2. **Runtime 单点**在"DSH 不可用"维度已缓解（我能独立运行、诊断、驱动），在"Hermes 自己的运行时"维度**未解决**（无凭据）。
3. **`delivery: unknown` 的用户侧处理**还没有界面：失败时用户只看到"回复失败，你的消息已保存"，看不出"可能已经执行"。这是下一处需要设计的地方。
4. **一台机器两套凭据**（`~/.dsh/.env` 与 Hermes profile）会长期存在，谁在哪个目录放什么，需要一张明确的表。

## 八、下一步建议

1. `7888680` 由 DSH 独立验收。
2. 让 Hermes 住进房间（第二个 Agent）——同时解决 `(room, member)` 会话键与 Hermes 凭据两件事。
3. Mnemosyne 不启动，直到"两个 Agent 同房间"跑通并稳定一周。

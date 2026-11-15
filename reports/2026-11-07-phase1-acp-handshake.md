# Phase 1 报告：ACP 双端握手验证

日期：2026-11-07 22:20–22:45
执行者：Hermes
授权：用户批准 Phase 1（建 profile、双端 initialize / session/new / session/close、保存原始 JSON-RPC）
模型调用：**0 次**；api_call_count 全为 0；费用：**0**
Codex：0 次
产物：`poc/PHASE1/bridge/acp_probe.py`（自写探针）、`poc/PHASE1/bridge/logs/*.jsonl`（原始帧）、`poc/PHASE1/dsh/home`（DSH 专属 home）、`D:\HermesAgent\Data\profiles\bridge`（专用 profile）

---

## 1. 结论速览

| 项 | 结果 | 证据 |
| --- | --- | --- |
| 空白创建 profile `bridge` | **PASS** | `hermes profile create bridge --no-skills --no-alias --description …`，落在 `D:\HermesAgent\Data\profiles\bridge`；提示「served now by the running multiplexed gateway」 |
| 记忆隔离 | **PASS（空）** | `memories/` 空目录；`state.db` 内 `sessions=0 / messages=0`（创建时） |
| 会话隔离 | **PASS（空）** | `sessions/` 空目录；测试后仅新增 1 条本次自建会话 |
| 凭据隔离 | **PASS（fail closed）** | profile `.env` 只有 3 行注释（168 字节），无任何键；无 `auth.json`；运行日志 `agent.credential_pool: no available entries (all exhausted or empty)` |
| 技能隔离 | **部分** | `--no-skills` 仍会播种「essentials」：`skills/` 里只有 `hermes-agent` 一个技能 + `.no-bundled-skills` 标记（源码 `seed_profile_skills` 注释：no_skills 只播种 essentials） |
| 模型配置 | **非空白（设计如此）** | `config.yaml` 458 字节，含 `_seed_model_config` 从活动 profile 复制的 model 块（`opencode-go / deepseek-v4.1-flash` + aliases）。源码注释：让新 profile 立刻可用，之后各自独立 |
| Hermes initialize | **PASS** | protocolVersion 1；authMethods `['hermes-setup']`；capabilities `loadSession, promptCapabilities, sessionCapabilities` |
| Hermes session/new | **PASS** | sessionId `local-abd8e579…`；返回 `configOptions / models / modes / _meta` |
| Hermes session/close | **PASS** | 返回 OK（尽管 adapter 源码里没有显式 close 处理，实测由底层 router 处理） |
| DSH initialize | **PASS** | protocolVersion 1；authMethods `[]`（无需认证）；capabilities `mcpCapabilities, promptCapabilities, sessionCapabilities` |
| DSH session/new | **PASS** | sessionId `893c1936-…`；返回 `configOptions`（模型与推理强度） |
| DSH session/close | **PASS** | 返回 OK，进程退出码 0 |
| 会话持久化 + 重启后恢复 | **PASS（两侧都过）** | 见 §4 |
| session/prompt（模型推理） | **未执行** | 全部 6 份 transcript 中 `session/prompt` 出现 0 次 |

进程卫生：6 次探测的子进程全部退出（0 / 0 / 0 / 0 / 0 / 0）；无残留 `--profile acp` 或 `-p bridge` 进程；**活动 Gateway 仍是 PID 180288（起始 2026-11-06 20:40），未被重启**。

---

## 2. 先确认「session/new 不触发计费」——做了，结论是有条件的「是」

**先查证、后执行**，没有先跑再说：

1. **源码**：Hermes `acp_adapter/server.py:new_session` → `session_manager.create_session(cwd)`，只构建 Agent（config、memory provider import、SessionDB），不含任何完成调用；viewer 路径 `gateway_server.new_session` → 网关 RPC `session.create` + `config.set(show_reasoning)`，同样没有模型轮次。
2. **随包文档**：DSH `@deepseek-ai/dsh-acp` README 明确「提示词在 `session/prompt` 时准入并结算」，`session/new` 只做工作区与 MCP 校验、发布配置选项。
3. **实测记账**（最关键）：执行完后读 profile 的 `state.db`，本次会话行：

```
message_count: 0    tool_call_count: 0
input_tokens: 0     output_tokens: 0
api_call_count: 0   estimated_cost_usd: None
end_reason: 'acp_disconnect'
```

DSH 侧：`sessions/<cwd-hash>/<sessionId>/session.v4.jsonl.zstd` 仅 408 字节，`titleInput.count = 0`，即没有任何提示词事件。

**结论**：`session/new` 在本机没有产生模型调用与计费。**但不是零风险**：`session/new` 会构建 Agent 并读取模型目录（`models` 列表来自本地/远端目录），这类目录请求不消耗 token，但如果远端目录不可达会变慢或报错——Bridge 要给它设超时，不要把「建会话慢」误判为「模型坏了」。

---

## 3. 双端能力实测差异（这次是跑出来的，不是读出来的）

| | Hermes (`hermes -p bridge acp`) | DSH (`--profile acp`) |
| --- | --- | --- |
| initialize 握手耗时 | ~6–9 s（含插件发现 63 个） | ~2–4 s |
| authMethods | `hermes-setup`（要凭据才能 authenticate 成功） | 空（authenticate 恒成功） |
| session/new 返回 | `configOptions`（3 项：编辑策略/模型/…）、`models`、`modes`、`_meta.hermes.sessionProvenance` | `configOptions`（2 项：model / reasoning_effort） |
| 默认模型（实测公布） | `opencode-go:deepseek-v4.1-flash`（模型列表含 Nous Portal 全系） | `["deepseek-official","deepseek-v4-flash"]`，**唯一选项**；`reasoning_effort` 默认 `high`，可选 off/low/high/max |
| sessionId 形态 | `local-<sha>`（网关本地会话） | UUIDv4 |
| session/close | OK | OK |
| session/list | **空**（原因见 §4） | 1 条（正确列出刚建的会话） |
| session/load | OK | 不支持（协议层无此方法） |
| session/resume | 有（未单独测） | OK |
| 会话结束标记 | `end_reason = acp_disconnect`（viewer 断开即标记） | 由 `session/close` 停稳式关闭 |

---

## 4. 会话生命周期与「重启后恢复」——这一项是真跑出来的

**做法**：每个动作都新起一个 ACP 进程（模拟 Bridge 重启），用上一次留下的 sessionId 去 list / load / resume。

| 步骤 | Hermes | DSH |
| --- | --- | --- |
| 第一次进程：建会话 + close | 建 `local-abd8e579…`，close OK | 建 `893c1936-…`，close OK |
| 第二个进程：`session/list` | **返回 0 条** | 返回 1 条，sessionId/cwd 完全一致 |
| 第二/第三个进程：恢复 | `session/load` → **OK**（返回 configOptions/models/modes/_meta） | `session/resume` → **OK**（返回 configOptions） |

**Hermes 返回 0 条的真实原因（源码级）**：`acp_adapter/catalog.py:catalog_sessions` 里有一句 `if count <= 0 … continue` —— **message_count 为 0 的会话被列表过滤掉**。我们的会话没有 prompt，所以是 0 条，不是列表坏了。

**这条对 Bridge 的设计含义（重要）**：

1. **不要靠 `session/list` 找会话**。Hermes 会把「零消息会话」隐藏，而且 `close`/断开后 `end_reason=acp_disconnect`；Bridge 必须自己在任务表里持久化 `(task_id, side, session_id)`。
2. **两侧恢复动词不同**：Hermes 用 `session/load`（会回放历史），DSH 用 `session/resume`（**不回放**旧更新）。同一套恢复代码会在一侧静默丢历史。
3. **恢复成功 ≠ 任务成功**：两边都能把一个「没有 prompt 的空会话」恢复得很好；真实任务的中断语义仍未验证（见 §6）。

---

## 5. 凭据与身份：隔离到了哪一层（实测）

- profile `.env`：只有注释，**没有任何键**；没有 `auth.json`。
- 运行日志：`agent.credential_pool: no available entries (all exhausted or empty)`。
- 含义：**这个 profile 现在发 prompt 一定会失败**（fail closed）。这正是我们要的隔离效果——但也说明「Phase 2 的最小任务」需要一个明确的决定：给 `bridge` 建自己的凭据，还是明确授权它从根 `auth.json` / 根 `.env` 继承。**我不会擅自复制任何 key。**
- 身份层：Hermes 的会话 id 是 `local-…`，`_meta.hermes.sessionProvenance.sessionKind = root`，`profile_name = bridge`；DSH 的是 UUID + `DSH_HOME`。**两者都没有调用方鉴权**，能起进程就能驱动——这一点与第一轮报告一致，且已被实测确认（我们就是这样驱动的）。
- DSH 侧凭据在专属 home 里同样为空，`session/new` 却成功 → 再次证明建会话不需要模型凭据。

---

## 6. Windows 进程管理（本轮实际观察）

- 关 stdin → 子进程自行退出，**两侧退出码都是 0**，无需 `taskkill`。
- Hermes 的 ACP 进程退出后，**Gateway 仍在跑**（PID 180288 未变）。这与「viewer 模型」的文档描述一致，也是本轮唯一被实测到的「生命周期不对称」。
- 探测结束后无残留进程；`taskkill /T` 分支只在超时时启用，本轮未触发。
- 注意：Hermes ACP 启动约 6–9 s（插件发现），Bridge 的健康检查窗口给 30 s 比较稳妥；DSH 2–4 s。

---

## 7. 仍未验证（不要当成已实现）

1. **`session/prompt` 与计费**：本轮按授权完全没发。费用、token 计量、`reasoning_effort=off` 的实际效果都还是空的。
2. **Gateway 重启后的连接恢复**：没有重启任何 Gateway（未授权）。目前只知道「ACP 进程重启 + session/load|resume 能恢复空会话」，**不知道 live gateway 重启时 viewer 会怎样、in-flight 任务算什么状态**。
3. **MCP 挂载**：`session/new` 的 `mcpServers` 一直传空数组，没测过挂载与重挂（Hermes 文档要求 load/resume 时由客户端重新提供同一份）。
4. **权限审批流**：`session/request_permission` 只在 prompt 时出现，未触发。
5. **profile 记忆隔离的「非空」验证**：现在只能证明「空 profile 是空的」，还不能证明「默认 profile 的记忆不会漏进来」——需要一次 prompt（费用门槛）。
6. Hermes `session/resume` 未单独跑（有 `session/load` 成功即够本阶段，但别在文档里写成「两个都测了」）。

---

## 8. 我自己的判断（可以反驳）

1. **B′ 可以继续，但「Hermes 侧独立进程」的问题没有解决，只是绕开了**。`hermes acp` 依赖 live gateway；一旦 Gateway 重启，viewer 的连接、in-flight 轮次、未知状态全都要靠 `session/load` 兜。Bridge 必须把「网关可用性」当成外部依赖来监控，而不是自己持有的资源。
2. **下一步最该做的不是写 Bridge，而是补一条「带 prompt 的最小闭环」**。因为现在所有恢复结论都建立在「零消息会话」上，而零消息会话恰恰是最容易被恢复的东西——它的成功率高估了真实任务的恢复能力。
3. **DSH 侧的成本杠杆比 Hermes 清楚**：`reasoning_effort` 可以在 off/low/high/max 之间选，`session/set_config_option` 就能改。Hermes 侧要控成本只能用短 prompt 或换模型。这条差异应该写进预算策略。
4. **`session/list` 不可信这条值得写进 Bridge 规范**：宁可自己记账，也不要依赖对端的列表接口。

---

## 附：可复核文件

- 探针：`poc/PHASE1/bridge/acp_probe.py`
- 原始帧（6 份）：`poc/PHASE1/bridge/logs/{dsh,dsh-list,dsh-resume,hermes,hermes-list,hermes-load}-*.jsonl`，每行 `{ts, dir, frame}`
- stderr 日志：同目录 `*.stderr.log`
- 摘要素：同目录 `*.summary.json`
- 本会话记录（Hermes）：`D:\HermesAgent\Data\profiles\bridge\state.db` → `sessions`（1 行，message_count=0）
- 本会话记录（DSH）：`poc/PHASE1/dsh/home/sessions/--D-Personal~0020Agent~0020Ecosystem-poc-PHASE1-workspace--/893c1936-…/session.v4.jsonl.zstd`

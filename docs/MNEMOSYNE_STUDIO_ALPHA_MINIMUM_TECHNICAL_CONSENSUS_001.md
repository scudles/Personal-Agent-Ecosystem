# MNEMOSYNE STUDIO ALPHA — 最小技术共识 001

**状态**：工作草案，供 Hermes 对齐；**不是实施授权**。
**日期**：2026-11-11
**参与**：DSH（独立工程路线）、Hermes（`MNEMOSYNE_STUDIO_ALPHA_AIROOM_INTEGRATION_001.md`）、Observer（倾向独立路线，待确认）
**证据边界**：本文只读源码/文档，未修改代码、未启动服务、未运行 AIROOM。凡标“已验证”的，指有 2026-11-07 Phase 1 的双端 transcript；凡标“未验证”的，不得在开工时当作可用。

---

## 0. 一句话

七条方案里，**六条可以确认，一条需要改写成更精确的工程约束**：不是“ACP 已可用”，而是“ACP 的握手与建会话已双端验证，prompt 闭环尚未验证”；不是“项目写租约”，而是“按路径重叠的写串行化 + 活跃工作声明”。Studio Alpha 可以并行开工，但 Runtime 的 prompt 闭环是唯一的外部门禁。

---

## 1. 七条方案：确认、修正、保留

| # | 方案 | 结论 | 需要写清楚的边界 |
|---|---|---|---|
| 1 | 独立建立 Studio Alpha 工程，不 Fork AIROOM 安装包 | **确认** | 新建仓库；AIROOM 只作参考实现，不复制 bundle、不继承其 Electron 外壳 |
| 2 | Node.js + TypeScript + React + SQLite | **确认（Alpha 期限定）** | SQLite 用 WAL、单写者、迁移脚本；多人远程/多进程前评估 PostgreSQL，不在 Alpha 里预支 |
| 3 | Shared Room 与 Shared History 作为基础 | **确认，但先最小化** | 只做 `spaces / members / messages / events / history_seals` 五张核心表；不做 AIROOM 的五种房间层级 |
| 4 | SVG + `object_versions` + `annotations` 作为共同作品模型 | **确认** | 版本只追加、标注只绑版本、stale 是派生状态；第一版不用 Yjs/CRDT |
| 5 | ACP 作为优先 Runtime 接入方式 | **确认，但加门禁** | 握手通过 ≠ 可接入；必须跑通 `prompt → response → cancel → close` 才标“supported” |
| 6 | 借鉴 process-supervisor、runtime-pool、项目写租约、备份恢复 | **确认，但改名/改语义** | “项目写租约”在 AIROOM 里是**进程内路径重叠互斥 + 活跃声明**，不是带 TTL 的租约；跨进程要自己加 DB 锁 |
| 7 | 不继承强制 project-flow、共享 Persona 替换、旧式附件内联 | **确认** | 另加三条：不继承成员-runtime 1:1、13 表整包快照、`CURRENT_PERSONA_NOTICE` 式“替换此前全部设定” |

---

## 2. 与 Hermes 研究 001 的对齐

### 2.1 已经一致的部分

- AIROOM **没有个人空间层**：成员 persona / memories / life 存在共享 snapshot 里，后端全可见。这与我的源码结论一致。
- AIROOM 的**流程刚性**来自 16 种 payload 契约 + 5 阶段状态机 + 默认 `reviewLevel="high"`，不是来自存储模型。
- **附件内联**是另一个容量悬崖：文本 30,000 B/文件、累计 60,000 B；图片 5 MB；记忆 8,000 字总/2,000 字每条/200 条。它和“工作区副本 30k/1 GiB/128 MiB”是**两条不同的路径**，不能混为一谈。
- Hermes 推荐继承的 `executor-catalog.ts`、ACP 适配器、`project-access.ts` 的路径边界检查、git 工作区快照、`[PASS]` 静默，我都同意值得借鉴。
- `CURRENT_PERSONA_NOTICE`（“以下为最新完整设定，替换此前全部设定”）是立场继承通道，必须禁止。这条我们完全一致。

### 2.2 必须裁决的一处分歧

**Hermes 001 推荐 B″：把 AIROOM 当外壳 + 适配层 + 并发底座；我推荐独立工程。**

我坚持独立工程的理由，不是“AIROOM 写得差”，而是四条工程事实：

1. 本地是打包发行版：无 `.git`、无 source map、安装后还手工打过一行 `{{cwd}}` → `${cwd}` 的补丁；fork 等于继承一个无法审计的壳。
2. `CURRENT_PERSONA_NOTICE` 的替换语义在 `native-context.ts` 里，是运行时行为，不是可配置项；独立工程才能从第一天禁止它。
3. 13 张表整包快照 + 132 个 RPC 方法，没有“个人空间”这个一等对象；要把 Home/私人记忆加进去，改造成本高于新建。
4. 16 种 payload × 5 阶段是 UI 主路径，不是可选插件；在它上面做“自由协作”，会不断被拉回项目流程。

如果 Observer 最终选 B″，第 1、4、7 条都要重写；这份共识按独立工程写。

### 2.3 需要 Hermes 书面确认的两点

1. **ACP prompt 的凭据与费用**：她的 bridge profile 当前凭据为空，按 fail-closed 设计发 prompt 必失败；需要她确认用哪个 profile、谁承担 token 费用、是否允许用 `reasoning_effort=off/low` 做最小闭环。
2. **是否接受放弃 B″**：如果她坚持 AIROOM 外壳，请给出“个人空间如何成为一等对象”的具体改法；否则按独立工程推进。

---

## 3. A. ACP 接入：已验证与未验证

### 3.1 已验证（2026-11-07 Phase 1，双端实测，0 次模型调用）

| 能力 | Hermes | DSH | 证据 |
|---|---|---|---|
| `initialize`（protocolVersion 1） | ✅ 6–9 s（插件发现 63 个） | ✅ 2–4 s | transcript + 双端返回 |
| `session/new` | ✅ `local-abd8e579…`，返回 configOptions/models/modes/_meta | ✅ `893c1936-…`，configOptions 2 项（model / reasoning_effort） | transcript |
| `session/close` | ✅ | ✅ | transcript |
| 跨进程恢复 | `session/load`（回放历史） | `session/list` + `session/resume`（不回放） | transcript |
| 子进程退出 | 6 次探测全部退出 | 6 次探测全部退出 | 进程表 |

**结论**：把“ACP 完全没验证”改成“**握手、建会话、关闭、恢复已验证；prompt 及之后未验证**”。这比“Hermes 尚未充分验证”更精确——她的 ACP 服务端是通的，卡在凭据与 prompt。

### 3.2 未验证（开工前必须补）

- `session/prompt` 的完整往返：发送、流式 `session/update`、最终 `stopReason`、错误码。
- 计费/token 计量、`reasoning_effort` 的实际效果。
- 中途 `session/cancel`：是否能停在可恢复状态，是否会产生半截工具调用。
- `session/request_permission`：权限审批流（Studio 第一版应一律转人工/拒绝，不自动批准）。
- 并发：同一 session 同时两个 prompt（ACP 明确每会话只允许一个）。
- 崩溃/重启：进程被杀后，`session/load`/`resume` 是否真的能继续，而不是重放或丢上下文。
- MCP 挂载、Gateway 重启语义（Hermes 依赖 live Gateway）。
- 调用方鉴权：两侧都**没有**；能起进程就能驱动。

### 3.3 Studio 必须实现的完整时序

```
spawn(runtime)
  → initialize(timeout 60s)
  → if native_session_id:
        session/resume  (capability: sessionCapabilities.resume)
        or session/load (capability: loadSession; 会回放历史)
     else:
        session/new { cwd, mcpServers: [] }
  → session/set_config_option (model, effort)   // 可选，按 runtime 能力
  → session/prompt { sessionId, prompt: content }
  → session/update* (agent_message_chunk / thought / tool_call / plan / mode)
  → result.stopReason ∈ {end_turn, max_tokens, max_turn_requests, cancelled, refusal}
  → if cancel: session/cancel → 等 stopReason → close
  → session/close (若支持) → kill 进程树
```

AIROOM 的 `AcpAdapter` 实际实现是：`initialize(60s)` → `resume|load|new(60s)` → `configureAcp` → `session/prompt(24h 超时)` → `stop()` 发 `session/cancel` → `cleanup()` 关 RPC + 杀进程。它**没有显式 `session/close`**；Studio 要补上，否则会留下孤儿会话。

### 3.4 两侧差异（Studio 必须吸收）

| 维度 | Hermes | DSH |
|---|---|---|
| 启动成本 | 6–9 s，插件发现 63 个 | 2–4 s |
| 认证 | `authMethods: ['hermes-setup']`；bridge profile 凭据为空则 fail-closed | `authMethods: []`；空 home 也能 `session/new` |
| 依赖 | live Gateway（外部进程） | 独立进程 |
| 会话枚举 | `session/list` 过滤 `message_count=0`，**不能靠 list 找刚建的会话** | list 正常 |
| 恢复语义 | `session/load` 回放历史 | `session/resume` 不回放 |
| Prompt 成本 | 未测；需 Gateway + 凭据 | 未测；文档称 prompt 时准入并结算 |

**推论**：Studio 必须自己持久化 `(runtime, task_id, native_session_id, cwd, model, effort)`；不能依赖 Hermes 的 list；不能把 `load` 的回放当成“恢复”，它会把历史重新塞进上下文（成本与隐私都要算）。

### 3.5 Studio 的会话契约（最小）

```ts
type Delivery = "sent" | "confirmed" | "unknown";

interface RuntimeSession {
  id: string;                 // Studio 自己的 id
  runtime: "hermes" | "dsh" | string;
  nativeSessionId?: string;   // ACP sessionId
  cwd: string;
  model?: string;
  effort?: string;
  status: "starting" | "ready" | "busy" | "stopping" | "closed" | "unknown";
  delivery: Delivery;
  lastStopReason?: string;
  createdAt: string;
  updatedAt: string;
}
```

硬规则：

1. **prompt 发出后进程断开 → `delivery="unknown"`，不自动重放**；先让用户/上层核对，再决定是否重发。
2. **cancel 后必须等到 `stopReason` 或超时**，再 close/kill；不能只 kill。
3. **每会话同时只允许一个 prompt**；busy 时排队或拒绝，不并发。
4. **本地回环 + token 鉴权**：ACP 两侧都没有调用方鉴权，Studio 不能把它暴露到非本机。
5. **权限请求一律转人工/拒绝**，第一版不自动批准。
6. **`session/load` 标记为“回放式恢复”**，与 `resume` 区分；回放会重新计费、重新进入上下文。

### 3.6 A 的结论

ACP 可以作为第一接入方式；但“支持 Hermes/DSH”这个标签，必须等到 **prompt 闭环 + cancel + close** 在对应 runtime 上跑通。在那之前，只能叫“握手通过”。

---

## 4. B. 共同作品：最小数据关系

### 4.1 三条不变量

1. **对象身份稳定**：`object_id` 从创建到删除不变；移动、改色、改文字都不换 id。
2. **版本只追加**：`object_versions` 不 update、不 delete；`objects.current_version` 只是缓存指针。
3. **标注只绑版本**：`annotations.object_version` 创建后不可改；对象出新版本，旧标注变 `stale`，不自动迁移、不自动删除。

### 4.2 最小表

```sql
CREATE TABLE objects (
  object_id       TEXT PRIMARY KEY,
  space_id        TEXT NOT NULL,
  kind            TEXT NOT NULL,          -- sticky|shape|stroke|image|text|frame
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 0,
  deleted_at      TEXT                    -- tombstone，不物理删
);

CREATE TABLE object_versions (
  object_id       TEXT NOT NULL,
  version         INTEGER NOT NULL,       -- 1..n
  parent_version  INTEGER,                -- 派生自哪一版；根为 NULL
  content_hash    TEXT NOT NULL,          -- sha256
  content_json    TEXT,                   -- 小内容内联；大内容走 blob
  blob_path       TEXT,                   -- 内容寻址
  geometry_json   TEXT,                   -- x,y,w,h,rotation,z
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  reason          TEXT,
  PRIMARY KEY (object_id, version)
);

CREATE TABLE annotations (
  annotation_id   TEXT PRIMARY KEY,
  object_id       TEXT NOT NULL,
  object_version  INTEGER NOT NULL,       -- 绑定的版本，不可改
  author_id       TEXT NOT NULL,
  layer_id        TEXT NOT NULL,          -- 每人一层，如 user:<id>
  kind            TEXT NOT NULL,          -- comment|circle|arrow|underline|highlight|ink
  anchor_json     TEXT NOT NULL,          -- 归一化坐标/文本区间/路径
  body            TEXT,                   -- 文本；永远是数据，不是 prompt
  color           TEXT,
  status          TEXT NOT NULL DEFAULT 'active', -- active|stale|withdrawn
  created_at      TEXT NOT NULL,
  withdrawn_at    TEXT,
  derived_from    TEXT                    -- 可选：从旧标注“带过来”的新标注
);

CREATE TABLE events (
  seq             INTEGER PRIMARY KEY AUTOINCREMENT,
  type            TEXT NOT NULL,          -- object.created|version.created|annotation.created|...
  actor_id        TEXT NOT NULL,
  space_id        TEXT NOT NULL,
  object_id       TEXT,
  object_version  INTEGER,
  payload_json    TEXT NOT NULL,
  created_at      TEXT NOT NULL
);
```

### 4.3 stale 的精确定义

- 写新版本时，同一事务内：
  ```sql
  UPDATE annotations
     SET status = 'stale'
   WHERE object_id = ?
     AND object_version < ?
     AND status = 'active';
  ```
- 读时再校验一次：`status='active' AND object_version != current_version` → 视为 stale（防止漏更新）。
- `stale` 不等于 `withdrawn`：stale 是“对象变了，标注还在原处”；withdrawn 是“作者自己收回”。
- **不自动迁移标注**。如果作者想在新版本上继续，创建一条新标注，`derived_from` 指向旧标注；旧标注保持 stale。
- 删除对象 = `deleted_at` + tombstone event；版本和标注保留，读时默认不显示，可显式查看历史。

### 4.4 权限（第一版）

- 对象：空间成员按 `read|write`；创建者始终可写；删除仅创建者或空间 owner。
- 标注：**每人一层，作者只写自己的层**；别人只能读（若空间可见），不能改、不能删。
- `body` 是数据：渲染时转义；**永远不拼接进 system prompt / persona / 工具参数**。
- Observer 的标注与人的标注同构，只是 `author_id` 不同；这样“结构化视觉参与”不是特殊通道。

### 4.5 并发（不用 CRDT）

- 写对象时带 `expected_version`；不匹配 → `409 CONFLICT` + 当前版本 + 差异摘要。
- 冲突解决是**人选一个版本继续**，产生新版本（`parent_version` 指被选中的版本）；不自动 merge。
- 同一对象两人同时写：一人成功，一人冲突；没有“最后写入者悄悄赢”。
- 第一版不做实时光标、不做逐字符 merge、不做多人同时拖同一对象。

### 4.6 为什么第一版不用 Yjs

- 3–4 人、以“画一笔/放一个形状/写一条标注”为粒度，版本链足够。
- Yjs 的 CRDT 历史是操作日志，不是可引用的 `artifact@version`；要再建一层版本映射，反而更复杂。
- 审计要回答“谁在哪个版本上改了什么”，append-only 版本比 CRDT 状态更直接。
- 代价：没有实时协同的“同时拖动”。这是接受的代价，不是遗漏。

---

## 5. C. 第一阶段顺序

### 5.1 判断：并行，但 Runtime 是门禁

Room/Shared History/画布**不依赖** ACP 的成功；它们可以对着一个 `FakeRuntime` 先做。但 UI 不能硬编码假 runtime，所以第一天先冻结 `AgentRuntime` 接口：

```ts
interface AgentRuntime {
  start(session: RuntimeSession): Promise<void>;
  prompt(session: RuntimeSession, input: string): AsyncIterable<RuntimeEvent>;
  cancel(session: RuntimeSession): Promise<void>;
  close(session: RuntimeSession): Promise<void>;
}
```

`FakeRuntime` 先实现它；DSH/Hermes 的 ACP 适配器后接。这样并行不是“各写各的”，而是“对着同一个接口写”。

### 5.2 第一周（5 天）

| 天 | Runtime 轨 | Room / 作品轨 | 当天产出 |
|---|---|---|---|
| D1 | 写 `acp-probe`（Node，stdio JSON-RPC）+ `fake-acp-agent`（echo/流式/取消） | 冻结 schema：`objects/object_versions/annotations/events`；写 `schema.sql` + 迁移 | 探针能对 fake 跑通 initialize→new→prompt→cancel→close |
| D2 | 用 probe 跑 DSH：initialize→new→prompt（最小提示，`effort=off`）→记录 stopReason/token/耗时 | SVG 画布最小页：3 类对象（sticky/stroke/image）、稳定 id、pan/zoom | DSH prompt transcript；画布能画/选中/保存 |
| D3 | 用 probe 跑 Hermes：同一流程；若凭据未决，记录失败点与错误码，不绕过 | 版本链：每次保存生成新 version；冲突 409；历史可看 | DSH（或 Hermes）prompt 闭环；版本链 demo |
| D4 | cancel/close/重启恢复：中途取消、杀进程、resume/load 对比 | 标注层：每人一层、绑版本、版本 bump 后 stale、withdrawn | 取消/恢复报告；stale 可复现 |
| D5 | 把 ACP 适配器接到 `AgentRuntime`；端到端：画布对象 → 让 Agent 读 → 回一条标注 | 端到端联调：人画 → Agent 标注 → 人改版本 → 标注 stale | 10 分钟 demo + 一页验收记录 |

### 5.3 门禁

- **Gate R**：DSH 的 `prompt` 闭环 + `cancel` + `close` 通过。Hermes 作为第二适配器，凭据未决不阻塞 Alpha，但必须标 `unverified`。
- **Gate A**：画布 3 类对象、2 个用户、1 条标注、版本 bump → stale，全部可复现。
- **Gate R 未过**：Studio Alpha 仍可用 FakeRuntime 做 Room/画布，但不能宣称“Agent 已接入”。
- **Gate A 未过**：不进入 Shared History 封存/权限细化。

---

## 6. 开工阻塞项

| # | 阻塞 | 谁决定 | 解除条件 | 不解除的后果 |
|---|---|---|---|---|
| 1 | Hermes prompt 的凭据/费用 | 用户 + Hermes | 指定 profile、额度、允许的最小 effort | Hermes 只能标 `unverified`，Alpha 单 runtime |
| 2 | ACP 会话恢复契约 | DSH 提案，Hermes 确认 | 明确 `load` vs `resume` 的语义、`delivery=unknown` 的处理 | 断线后可能重放/丢上下文 |
| 3 | 对象/标注 schema 冻结 | DSH 提案，Observer 确认 | `schema.sql` + 三条不变量签字 | 画布与记忆各写一套 id |
| 4 | Room/History 最小模型 | DSH 提案 | 五张表 + 封存规则 | 又长成一个 AIROOM |
| 5 | 本地鉴权 + 进程归属 | DSH | 回环 + token；Windows Job Object | 任何本机进程都能驱动 Agent |
| 6 | Studio 仓库/CI 基线 | 用户 | 新 repo、lint/test/migrate | 第一周产出无法合并 |

---

## 7. 不继承清单（明确写死）

- 不 Fork AIROOM 安装包；不复制 `worker.mjs`/`main.mjs`。
- 不继承 16 种 flow payload、5 阶段状态机、`reviewLevel="high"` 默认。
- 不继承 `CURRENT_PERSONA_NOTICE` 的“替换此前全部设定”。
- 不继承附件内联（30 KB/文件、60 KB 累计）；文件一律引用 + 按需读。
- 不继承成员-runtime 1:1 绑定；一个成员可以换 runtime，一个 runtime 可以服务多个会话。
- 不继承 13 表整包快照；用事件 + 增量。
- 不继承 `session/list` 找会话；自己持久化映射。
- 不继承“自动批准权限请求”。

---

## 8. 第一周验收（可复现）

1. `acp-probe --runtime dsh` 输出一份 transcript：`initialize` 版本、`sessionId`、prompt 文本、`stopReason`、耗时、token（若返回）。
2. `acp-probe --runtime hermes` 同样一份；若失败，记录错误码与失败阶段。
3. `canvas.html`：3 个对象、2 个作者、1 条标注；改对象 → 标注变 stale；导出 SVG。
4. `schema.sql` + 3 条 ADR：为什么不用 Yjs、为什么标注绑版本、为什么 stale 不自动迁移。
5. 一页 `WEEK1.md`：通过了什么、没通过什么、下周第一件事。

---

## 9. 待 Observer / 用户决定

1. **独立工程 vs Hermes 的 B″**：我建议独立；若选 B″，请先回答“个人空间如何成为一等对象”。
2. **Hermes 的凭据与费用**：是否给 bridge profile 配额度；是否接受 `effort=off` 的最小闭环。
3. **SQLite 的 Alpha 边界**：是否接受单机、单写者、无远程多人；远程协作何时进入。
4. **空间权限粒度**：第一版按空间（成员全可见）还是按对象（可单独共享）；我建议先空间，后对象。
5. **Observer 的标注默认可见性**：Observer 的标注是否默认对所有成员可见，还是只对作者和被标注者可见。

---

## 10. 证据边界

- **源码确认**：AIROOM 的 `workspace.ts` 三道上限、`project-access.ts` 的路径重叠互斥、`AcpAdapter` 的时序、`native-context.ts` 的替换语义、`backup-restore.ts` 的 journal/rollback。
- **文档确认**：Phase 1 ACP 报告的已验证/未验证项；Hermes 001 的 13 表快照、16 契约、5 阶段、附件内联上限。
- **推断**：Hermes prompt 很可能可用，但受 Gateway + 凭据约束；DSH prompt 很可能可用，但未实测。
- **未验证**：两侧 prompt 闭环、cancel 中途语义、重启恢复、MCP、权限流、费用。
- 本文没有启动任何服务，没有修改任何代码或 Agent 配置。

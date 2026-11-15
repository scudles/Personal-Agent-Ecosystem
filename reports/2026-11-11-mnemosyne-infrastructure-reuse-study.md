# 基础设施复用研究 001

**范围**：Studio Alpha 与 Experiment 001 的底层能力，在 Simmis / ZMem / Freero 中哪些已经有人打好。
**性质**：只读研究。未克隆、未安装依赖、未启动服务。文中“已实现”指仓库中存在源码/测试/文档且项目自称 shipped，不等于我运行验证过。
**日期**：2026-11-11

---

## 0. 结论先说

三块地基里，真正可以直接踩的是**两个库**（Yjs、perfect-freehand）和**两套设计**（Simmis 的授权/提案模型、ZMem 的回执/谱系语义）。三个产品本身都不适合作为依赖。

- **Freero** 是唯一接近“第一版 Studio 可以直接用”的项目，但它是完整产品，不是画布组件。它的元素没有版本，评论不绑版本，因此不能直接满足 Studio 的“标注绑 `artifact@version`”。
- **ZMem** 的记忆治理是真的（lineage、revocation、receipts、snapshot/verify/restore、fail-closed context），但它解决的是“单主体/单房间内，哪些记忆可以进入上下文”，不是“多主体之间的私人空间隔离”。`rooms.py` 里 member-private 只是同一个 SQLite 内的 scope 过滤。
- **Simmis** 是三者中架构最成熟、最接近“共同历史 + 提案 + 权限”的参考实现，但 Clojure/Datahike/Yggdrasil 的栈决定了只能借鉴设计，不能搬代码；而且它的 blob 读取只认证不授权、沙箱是软边界、单节点未验证。

**第一周不要接任何一个仓库。** 先做一条 200–400 行的竖切：`object@version` + 每人一层标注 + 版本变化后 stale + 一个结构化写入接口。这是三家都没有、而 Studio 和 Experiment 001 都缺的那块接缝。

---

## 1. 证据边界

- 只读；未 `git clone`、未 `npm/pip install`、未启动任何服务。
- “已实现” = 仓库中存在源码/测试/文档，且 README 或 docs 自称 shipped；不等于我运行验证过。
- GitHub 代码页经 Firecrawl 渲染；`zerker_memory/store.py`（16,332 行）被截断，没能逐行核对 lineage/revocation 的实现；`rooms.py`、`ydoc.ts` 读到了完整源码。
- 三仓库 repo 级均为 MIT；底层依赖需单独审计（见 §6）。

---

## 2. Simmis

仓库：<https://github.com/replikativ/simmis>
187 commits、173 branches、main、最新 2026-11-07；Clojure/ClojureScript；JVM 21 + Node 18；alpha；MIT。

### 2.1 五问速答

1. **哪些真已实现**：room 作为协作单元（人 + Agent 同为 party）、Markdown wiki 的稳定 page/block 身份、proposal 的 file/list/accept/dismiss、`as-of` 时间旅行、复式账本、SCI 沙箱、workflows/schedules。有对应测试命名空间（`test/is/simm/ops/book_fork_test.clj` 等）。
   **哪些只是文档/未完成**：多服务器、迁移工具、安全审计；blob 读取只认证不授权；Agent 沙箱不是 VM。
2. **可直接复用**：没有。Clojure + Datahike 会把运行时锁死，且 alpha。
3. **可独立抽取**：不现实。它的价值在一整套 ref/分支/历史语义里，抽一个模块就失去语义。
4. **只借鉴**：非常值得。见 §2.3。
5. **许可证/栈/环境/耦合**：repo MIT；底层 replikativ 库（Datahike、Konserve、Yggdrasil）各自许可证需核实（可能是 EPL），vendoring 前必须确认；单节点；JVM 21。

### 2.2 真正值得借的四件事

- **“权限是四个问题，只有一个 ACL”**
  - 可逆状态 → fork + review；
  - 叙事记录 → append-only；
  - 授权 → default-deny predicate；
  - 不可逆出站 → capability + budget。
  这比“给每张表加个 `owner_id`”高一整个层次。
- **唯一谓词 + 三个平面**：`(access/can? principal action resource)`；control RPC、data replication、HTTP 路由声明三个平面在启动时强制，路由没声明 `:auth` 服务就不启动。这是“默认拒绝”真正落地的方式。
- **Proposal 作为唯一的一等 joint 多系统状态**：Ref 代数里有 `LocalRef`（commit/branch/as-of-tx）、`GlobalCut`（墙钟 T）、`ForkSet`（proposal）。接受提案才产生共同历史；`accept-proposal!` 会做 kb-conflicts 和 entity-overlap 检查。
- **诚实承认 GlobalCut 不是原子快照**：跨系统读会撕裂，文档把它列为已知异常。这比假装有“全局一致的一刻”更可用。

### 2.3 明确不能学的

- blob 读取 “authenticated but not authorized”：任何登录用户拿到 hash 就能读任何 blob，撤销房间访问不会撤销已泄露的 hash。**共同历史数据层如果照这个做，等于没有边界。**
- 单节点、无迁移工具、安全未审计：不能作为“长期托管”的地基。

---

## 3. ZMem

仓库：<https://github.com/zerkerlabs/zmem>
187 commits、13 branches、18 tags、最新 2026-08-19；Python 3.10+；SQLite；v0.1.17；MIT。

### 3.1 五问速答

1. **哪些真已实现**：本地 SQLite + FTS + 可选 dense；typed memories（episodic/semantic/procedural/policy）；quarantine/review/promote/reject/revoke；lineage + revocation propagation；symbolic injection policy；Merkle event log；action receipts；`why`；snapshots/verify/restore；CLI + MCP + console；Rooms（v0.1.10 起，v0.1.11 做并发加固）。
   **哪些未做**：hosted SaaS；team control plane（roles/retention/shared review queues）；fully signed public Treeship publish；production vector/graph；memory strength/decay。
2. **可直接复用**：不建议。它是单主体/单机 SQLite 工具，不是多主体服务。
3. **可独立抽取**：回执格式、Merkle log、policy gate 的“语义”可以移植；代码与 `MemoryStore` 耦合，直接抽会带走半个 store。
4. **只借鉴**：lineage 闭包、撤销传播、receipt/why、snapshot verify、context 六态 fail-closed、propose vs record。
5. **许可证/栈/环境/耦合**：repo MIT；Python 3.10+、SQLite；依赖需核；Rooms 是 integration preview；Gateway Go client 与 hosted multi-tenant 未做。

### 3.2 源码确认的隔离边界

`zerker_memory/rooms.py`（839 行）：

- 每 `(tenant, room)` 一个 SQLite：`room_storage_key = sha256(f"{tenant}\0{room}")[:32]`，路径 `storage_root/<key>/memory.sqlite`；目录创建时 chmod 0700，拒绝 symlink 和逃逸。
- `member_scope(agent_id) = "member:" + sha256(agent_id)[:24]`；`prepare_context` 调 `store.inject(..., scope=member_scope(agent_id))`。
- `ROOM_MEMORY_VISIBILITIES = {"room", "member"}`。

**结论**：room 与 room 之间是硬隔离（不同 DB 文件）；room 内的 member-private 是**同一个 DB 内的 scope 过滤**，不是独立存储、不是 OS 账户边界。它能防“查询串了”，不能防进程、文件系统、备份层的越界。

`store.py` 16,332 行，存在 `memory_write_receipts` 表；lineage/revocation 的具体函数因页面截断未能逐行核对。

### 3.3 对 Experiment 001 的意义

- **能减**：回执（这次注入用了哪些记忆、为什么）、lineage 闭包、撤销传播、snapshot/verify/restore、context 六态 fail-closed、policy gate。这些语义我们可以直接抄，少写很多。
- **不能替代**：
  - 没有“分支/来源 vs 授权 vs 立场”三分；它的 scope 是记忆可见性，不是主体权限。
  - 没有“恢复 ≠ 延续”；snapshot 恢复就是恢复，没有 recognition。
  - 没有 OS/空间级隔离（CI-1.9 那 49 项它一项也不覆盖）。
  - 没有“撤销在旧快照恢复后是否复活”的 replay 语义。
  - Python/SQLite 单写者，不适合多主体并发。

一句话：**ZMem 解决的是“记忆治理”，不是“私人空间隔离”。** 它能让 Experiment 001 少写回执和失效传播，但不能替 Experiment 001 证明隔离。

---

## 4. Freero

仓库：<https://github.com/antonber/freero>
1557 commits、1 branch、2 tags、最新 2026-11-09；v0.1.1；MIT；Node 22；React 18 + TS + Vite；Yjs over WebSocket；Express + Postgres/PGlite；586 templates；Docker 自托管。

### 4.1 五问速答

1. **哪些真已实现**：无限画布、21 种形状、笔/荧光笔/橡皮、图片/PDF/视频/音频、便签、frame、task card、mind map、connector、分组/锁定/对齐、undo/redo、框选、缩放、导出 PNG/JPG/SVG/PDF；实时同步、光标/选区/头像、follow、bring everyone、评论 thread、owner/editor/commenter/viewer、邀请链接、投票/计时/演示；MCP 远程接入；board 级版本恢复与备份。
2. **可直接复用**：只有两个库——`yjs`（MIT）和 `perfect-freehand`（MIT），Freero 自己也在用。产品本身不行。
3. **可独立抽取**：画布引擎在原理上可以（Dune 分层执行得很好：`ui/`、`engine/`、`features/<name>/`、`app/`），但没有 headless 包；fork 剥壳以周计。
4. **只借鉴**：MCP 的 suggest-first 模型、`untrusted_board_content` 包裹、角色与服务端强制、单写者、真实 Yjs 客户端 E2E 测试方法。
5. **许可证/栈/环境/耦合**：repo MIT；Node 22 + React 18 + Yjs + Postgres；产品耦合重（auth、teams、workspaces、board shell、analytics、billing 边界）；v0.1.1。

### 4.2 源码确认（`packages/shared/src/ydoc.ts`）

- 每个 board 一个 Yjs doc；单写者：`elements` 归 engine，feature collections 归各 feature。
- 评论是 `CommentRecord`，key `t:/s:/m:/r:/x:`，thread 绑 `elementId`；thread 随 item 的 doc 走；item 删了，thread 还在原地。
- `Y_KEPT_ON_RESTORE` 包含 `comments`、`voting`、`timer`、`privateMode` 等：**版本恢复是 board 级，评论不被回滚，也不会变 stale。**
- layers：`shared` / `editors` / private；私密草稿、密封投票、隐藏 frame 内容放在 server-held layer docs；layer docs 从不版本化/恢复。

### 4.3 对 Studio 五项能力的逐条判断

| 能力 | Freero | 是否满足 Studio |
|---|---|---|
| 稳定对象 ID | element id | ✅ |
| 版本绑定 | 只有 board 级 version restore，无 per-element 版本链 | ❌ |
| 独立标注层 | 评论是绑 element 的 thread，有角色；无 per-user layer + version anchor | ⚠️ 部分 |
| Agent 结构化视觉修改 | MCP `propose_changes` 永远生成 pending suggestion；`add_*`/`update_items` 可写但受 scope | ✅ |
| Observer 远程结构化标注 | MCP `add_comment`，带 item/block id | ✅，但无版本 pin |

**适合第一版吗**：作为 UX/交互参考适合；作为依赖/嵌入组件不适合。

原因：
- 它是完整产品，不是 `@freero/canvas` 包；没有 headless/embeddable API。
- Yjs 是 live CRDT，不是 immutable history；版本靠 board snapshot restore，不是 per-object version。
- 评论跨 restore 存活，因此不会因为对象改版而 stale——这与 Studio 的“标注绑 `artifact@version`，变了标 stale 不删”正好相反。
- 私密 layer 是 server-held doc，不是 per-subject OS 隔离。

---

## 5. A / B / C 直接回答

### A. Shared History / 数据层

- **有适合“共同历史”的事件或版本模型吗**：Simmis 的最接近。Datahike 的不可变 history + yggdrasil 的 branch/ref + `as-of` + Proposal（ForkSet）。它把“共同历史”定义为“被接受的提案”，而不是“所有事件的全局快照”——这恰好符合我们“共同历史是承认过什么，不是事实是什么”的原则。
- **能否支持稳定对象 ID、版本、来源和回溯**：Simmis 有（block 身份、commit/ref、作者、`as-of`）；ZMem 有记忆 ID/lineage/receipt，但没有视觉对象版本；Freero 有 element ID，没有版本链。
- **会不会把私人数据和共同历史混在一起**：Simmis 的 room/party 模型能分，但 blob 层只认证不授权，实际会混；ZMem 的 room/member 在同一个 SQLite 内用 scope 分，查询层能分、存储层不分；Freero 的 private layer 是 server-held doc，能分但依赖服务端诚实。
- **给我们的结论**：共同历史用“提案接受”作为唯一入口（Simmis 思路），底层用我们自己的 append-only event + content-addressed blob；不要引入 Datahike，也不要把“全局快照”当承诺。

### B. Experiment 001 / 记忆治理

- ZMem 能减的：回执、lineage、撤销传播、snapshot verify、fail-closed context。
- 它解决的是**记忆治理**，不是**私人空间隔离**。
- 不能直接替代的：三分模型、恢复 ≠ 延续、OS/空间隔离、撤销-快照 replay、多主体并发。
- 建议：把 ZMem 当“语义字典”，不是“存储层”。

### C. Studio Canvas

- 第一版可用 Freero 的**交互与栈**，不可用它的**产品与数据模型**。
- 五项：稳定 ID ✅；版本绑定 ❌；独立标注层 ⚠️；Agent 结构化修改 ✅；Observer 远程结构化标注 ✅（但无版本 pin）。
- 不适合的原因：产品耦合、无 headless 包、CRDT 无不可变历史、评论不 stale、private layer 非 OS 隔离。

---

## 6. 四类表

| 模块 | 真实状态 | 判定 | 理由 |
|---|---|---|---|
| Yjs（库） | 已实现、成熟 | **可直接复用** | MIT；Freero 生产使用；CRDT 协作底座 |
| perfect-freehand（库） | 已实现、成熟 | **可直接复用** | MIT；压感笔迹；Freero 在用 |
| Freero 画布引擎 | 已实现（产品内） | **需改造** | 无 headless 包；耦合 auth/board/Postgres；无 per-element 版本 |
| Freero 评论/角色 | 已实现 | **需改造** | thread 绑 elementId，不绑版本；需加 layer + stale |
| Freero MCP 权限模型 | 已实现 | **只借鉴** | read+suggest 默认、pending suggestion、untrusted envelope、audit；产品耦合 |
| Freero 版本恢复 | 已实现 | **只借鉴** | board 级快照；comments 保留；不是 object@version |
| ZMem 回执/lineage/撤销 | 已实现 | **需改造（移植语义）** | Python/SQLite；单主体；无 OS 隔离 |
| ZMem Rooms | 预览/已实现 | **只借鉴** | 每 room 一 DB 是真隔离；member-private 只是 scope 过滤 |
| ZMem snapshot/verify/restore | 已实现 | **需改造** | 可借格式与校验；不能当多主体备份 |
| Simmis 授权模型 | 已实现（alpha） | **只借鉴** | 一谓词/三平面/default-deny；Clojure |
| Simmis Proposal/时间旅行 | 已实现（alpha） | **只借鉴** | ForkSet、as-of、merge 权限；GlobalCut 非原子 |
| Simmis 文档模型 | 已实现（alpha） | **只借鉴** | 稳定 block 身份；Datahike 依赖 |
| Simmis 运行时整体 | alpha | **不建议** | 栈不匹配、安全未审计、单节点 |
| ZMem 作为隔离层 | 不适用 | **不建议** | 解决的是记忆准入，不是主体隔离 |

---

## 7. 最小推荐组合

**栈**：Node/TS + React + Yjs + perfect-freehand + Postgres（或 SQLite 起步）+ 自建对象/版本/标注表。
**语义**：Simmis 的“提案 = 共同历史唯一入口” + ZMem 的“回执/lineage/撤销传播” + 我们自己的“`object@version` + per-user annotation layer”。
**不引入**：Simmis 运行时、ZMem store、Freero 产品。

一句话：**借 Simmis 的骨架、ZMem 的回执、Freero 的手，接缝自己焊。**

---

## 8. 三个阻塞项（不超过三个）

1. **没有现成的 `object@version` + 标注锚点模型。** Freero 有对象没版本；Simmis 有版本没画布；ZMem 有记忆版本没视觉对象。这是必须先自己定义的东西，1–2 周。
2. **隔离边界三家都不给。** ZMem 是 scope 过滤；Simmis 的 blob 只认证不授权；Freero 的 private layer 是 server-held。我们仍要自己过 CI-1.9 的最基础 10 项（四账户/ACL/备份），否则“私人空间”只是 UI。
3. **运行时/身份系统会分裂。** Simmis 是 Clojure+Datahike，Freero 是 TS+Postgres，ZMem 是 Python+SQLite；同时接两个就会出现两套身份/权限。选定一个主运行时，其他只做离线工具。

---

## 9. 第一周真正实现什么

**一条竖切：版本化标注（versioned annotation）**

- 一个画布页（Yjs + perfect-freehand，或先用普通 React canvas），三类对象：便签、笔迹、图片；稳定 ID。
- `object_version` 追加表：每次编辑写新版本，旧版本不可变。
- `annotation` 表：`object_id, version, author, layer, anchor(x,y,w,h), body, created_at`。
- 两人各一层；同一对象 v1 上各写一条；某人把对象改到 v2；v1 的标注显示 `stale`，不删除、不隐藏。
- 导出 PNG：底图 + 所有可见标注层，标注带作者色。
- 一个最小 HTTP 端点（或 MCP tool）`annotate(object_id, version, body, anchor)`，供 Agent 结构化写入。
- 不做：登录、多租户、实时多人（先单进程）、版本合并、Simmis/ZMem 集成。

**验收**：两个人能在同一对象的不同版本上留下标注；版本变化后旧标注变 stale 但仍可读；Agent 能通过结构化接口留下一条标注；导出的图能看出“这是谁在哪一版上画的”。

**为什么是这条**：它是三家都没有、而 Studio 和 Experiment 001 都需要的接缝；做完它，再决定要不要 fork Freero、要不要移植 ZMem 的回执。

---

## 10. 不建议做的事

- 不要把 Simmis 当依赖（Clojure/Datahike 会把运行时锁死）。
- 不要把 ZMem Rooms 当私人空间隔离（它是 scope，不是边界）。
- 不要 fork Freero 整产品（1557 commits 的产品壳，剥起来比写画布贵）。
- 不要在第一周做“三家都接一点”的集成（会出现两套身份/权限/版本）。
- 不要因为“别人实现了”就放弃我们自己的 `object@version` 语义——这是 Studio 与 Experiment 001 的共同地基。

---

## 11. 证据限制

- 未运行任何代码；性能、并发、真实隔离强度均未验证。
- GitHub 页面渲染可能遗漏文件；`store.py` 的 lineage/revocation 只按 README 与模块名判断，未逐行确认。
- Simmis 的 alpha 状态与安全缺口来自其 README 自述，不是第三方审计。
- Freero 的 MIT 许可覆盖其仓库；其运行依赖（Postgres、OIDC 等）与生产部署不在本次范围内。

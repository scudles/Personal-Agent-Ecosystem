# Studio Alpha P0 — 工程技术审查

**审查对象**：`D:\Personal Agent Ecosystem\studio-alpha\`（Work 建立的 P0 切片）
**审查人**：DSH（技术实现审查 / 工程质量负责人）
**日期**：2026-11-11
**性质**：只读审查。没有修改工程、没有启动 P0 服务、没有启动 DSH、没有调用模型。

---

## 0. 结论

**P0 作为“可运行的最小切片”成立**：迁移可重复、消息与事件同事务、刷新后数据还在、FakeRuntime 的注入点干净。数据层的方向是对的，没有过早引入事件溯源。

但它现在有 **3 个必须马上修的问题**（时间显示错 8 小时、一个畸形 URL 能让进程退出、本机 API 可被任意网页写入），以及 **3 个在接真实 Runtime 之前必须修的问题**（Runtime 调用在写事务里、FakeRuntime 接口太窄、`members.kind` 的 CHECK 把未来堵死）。这些都不是“架构不完整”，是“第一版跑起来之后马上会咬人”。

---

## 1. 数据层审查

### 1.1 Schema 本身

| 表 | 现状 | 判断 |
|---|---|---|
| `rooms` | `id TEXT`，name/description/created_at | 合理 |
| `members` | `id TEXT`，`kind CHECK(human,fake)` | **太窄**，见 1.4 |
| `room_members` | 复合主键，双向 FK，`ON DELETE CASCADE` | 合理 |
| `messages` | `id INTEGER AUTOINCREMENT`，room/member FK，`body` 1–10000 | 合理，但缺幂等键 |
| `events` | append-only，room/actor/message FK，`type` + `payload_json` | 合理，P0 够用 |
| `messages_fts` | FTS5 external content + INSERT trigger | 合理，但只覆盖插入 |

关系是清楚的：`messages` 是房间里的 durable 记录，`events` 是围绕消息的 append-only 事实。P0 不建 `runs`、不建 `artifacts`，符合“不要过早事件溯源”的要求。

### 1.2 迁移

- `schema_migrations(version, applied_at)` + 单文件 `001_initial.sql`，`BEGIN IMMEDIATE` 包住整个迁移和版本记录；失败 `ROLLBACK` 并 `db.close()`。这是对的。
- `seed()` 在**每次 open** 时执行，`INSERT OR IGNORE`。P0 没问题，但语义上“种子”应该属于迁移，不属于每次启动。如果以后用户删掉 `fake-resident`，重启会把它复活。
- 迁移没有 checksum。P0 只有一个迁移，够用；P1 加第二个迁移时，应该记录文件哈希，否则“迁移文件被改过”无法发现。
- 迁移失败时 `db.close()`，但 `seed()` 失败时没有关闭连接。P0 可忽略，P1 修。

### 1.3 WAL、单写者、事务

- `PRAGMA journal_mode=WAL; foreign_keys=ON; busy_timeout=5000` 正确。
- 每次发送 `BEGIN IMMEDIATE`，人类消息、FakeRuntime 回复、两条事件同事务提交。**原子性是对的**。
- 但 `runtime.receive()` 在事务内部（`server/index.mjs:54`）。FakeRuntime 是同步的，所以现在没问题；换成真实 Runtime 后，一次模型调用可能几十秒到几分钟，期间持有 SQLite 写锁，所有写入被阻塞。更糟的是：Runtime 抛错会让人类消息一起回滚，用户看到 500，但他说的话没了。
- 单写者策略在 P0 是成立的：`DatabaseSync` 是同步 API，HTTP handler 串行写。P1 如果加后台任务/多进程，必须换成“写队列 + 单写连接”，不能直接多连接并发写。

### 1.4 现在就该改的 Schema 问题

1. **`members.kind` 只有 `human|fake`**。P1 要加 `agent`（Hermes/DSH）和 `observer`（Observer Remote Resident）。SQLite 的 CHECK 不能 `ALTER`，到时候要重建表。现在没有数据，改一个字：`CHECK(kind IN ('human','fake','agent','observer'))`。
2. **`messages` 没有 `client_id`**。双击、网络重试、代理重发都会产生重复消息。P1 加 `client_id TEXT` + `UNIQUE(room_id, member_id, client_id)`。
3. **`messages_fts` 只有 INSERT trigger**。P0 没有编辑/删除，所以现在是对的；但 P1 一旦加删除，索引会漂移。要么现在补 `AFTER UPDATE`/`AFTER DELETE`，要么在代码里写死“消息不可编辑/删除”。
4. **`events.message_id` 没有 `ON DELETE` 策略**。如果以后删消息，FK 会阻止；要么 `ON DELETE SET NULL`，要么把消息当 tombstone，不物理删。
5. **时间戳**：见 1.5，这是最可见的 bug。

### 1.5 时间戳：现在显示的时间是错的（已实测）

`CURRENT_TIMESTAMP` 在 SQLite 里返回 **UTC**，格式 `YYYY-MM-DD HH:MM:SS`，不带时区。客户端 `App.tsx:30` 直接 `new Date(message.created_at)`；V8 把这种“空格分隔、无时区”的字符串按**本地时间**解析。

我实测：

```
sqlite: 2026-11-11 15:30:36     # 实际本地时间 23:30:36
JS parse: Wed Nov 11 2026 15:30:36 GMT+0800
```

也就是说，**每条消息显示的时间都比真实时间早 8 小时**。修法二选一：

- 建表默认值改成 `DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))`，客户端 `new Date()` 就能正确解析；
- 或者读出来时拼 `Z`：`created_at || 'Z'`。

推荐第一种。已有数据可以用迁移 002 转换：

```sql
UPDATE messages SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at);
```

### 1.6 损坏与异常退出

- 正常崩溃/断电：WAL + 事务保证“要么两条消息都在，要么都不在”。这是 P0 最扎实的部分。
- 数据库文件损坏：`new DatabaseSync(file)` 会抛异常，进程启动失败，stderr 是原始错误。对开发者够用，对“家”不够。P1 加 `doctor`（`PRAGMA integrity_check`）和启动时的人类可读错误。
- 磁盘满/写失败：返回 500，事务回滚；没有事件记录“失败原因”。P1 的 `runs` 表应该记 `error_code`。
- 没有备份。P1 至少加一个 `VACUUM INTO` 的备份脚本；不要等到有真实对话才想这件事。

---

## 2. FakeRuntime 审查

当前实现只有一行：

```js
export class FakeRuntime { receive(message) { return `我收到了：${message}`; } }
```

**做到了**：接收消息、提交回复、产生可观察的 `message.created` 事件（由 server 写入）。

**没做到**：

| 能力 | 现状 | 影响 |
|---|---|---|
| 接收消息 | 只收 `body` 字符串 | 不知道 room/member/messageId，无法做多成员/引用 |
| 提交回复 | 同步返回字符串 | 真实 Runtime 是异步、流式、可能失败 |
| 可观察事件 | 只有 `message.created` | 没有 `runtime.started/replied/failed/cancelled`，UI 无法显示“正在回复” |
| 错误/退出 | 不会失败 | 错误路径完全没被测试 |
| 多成员 | 固定 `fake-resident` | 无法模拟两个 Agent 同时在场 |

**替换性判断**：`createApp(db, { runtime })` 的注入点是对的，Room UI 也确实不依赖 Runtime；但 **server handler 依赖 `receive()` 的同步签名**，换成 ACP 时必须改 handler。这不算“重写 Room”，但算“重写 Runtime 边界”，而且现在没有测试保护这个边界。

**最小改法（P0 内就能做）**：

```js
export class FakeRuntime {
  async *send(ctx) {                    // ctx: {roomId, memberId, messageId, body}
    yield { type: 'status', state: 'busy' };
    yield { type: 'text', delta: `我收到了：${ctx.body}` };
    yield { type: 'done', stopReason: 'end_turn' };
  }
}
```

再给一个 `failAfter`/`delayMs` 选项，测试就能覆盖失败与慢响应。这样 P1 换 ACP 时，handler 的循环不用动。

---

## 3. ACP 接入准备：保留两次测试的区别

不能把两次结果压成“ACP 可用/不可用”。准确的记录是：

| 时间 | 对象 | 条件 | 结果 |
|---|---|---|---|
| 2026-11-07 | Hermes + DSH | Phase 1 探针，专属 home，双端 `initialize`/`session/new`/`session/close` | **双端均成功**；`session/prompt` 0 次 |
| 2026-11-11 | Hermes | `hermes.exe -p bridge acp` | **成功**：protocolVersion 1，`session/new` 返回 `local-db4cf47b…`，`session/close` OK，10.3 s，exit 0；prompt 0 次 |
| 2026-11-11 | DSH | `DeepSeek Harness.exe --expose-internals --no-sandbox --profile acp`，三次不同条件 | **失败**：前两次 0.39/0.63 s 退出（`Unable to move the cache: 拒绝访问 (0x5)`）；第三次加 `--user-data-dir` 后进程活 39.47 s，但 **`initialize` 始终无响应** |

**这说明什么**：

- Hermes 的 ACP 层是通的；卡点在凭据（`authMethods: ['hermes-setup']`，profile 没有 provider 凭据，prompt 会在 provider 层失败）。
- DSH 的失败**更像启动条件**，不是协议：缓存锁（桌面实例占着 userData）+ 可能的 profile 没加载 `@deepseek-ai/dsh-acp`（`profiles/acp/cordis.patch.yml` 是空数组）。判别测试是“关桌面 + 显式 `--patch` 插入 ACP 插件”，一次就能分清 H1/H2。
- 两次测试都没有跑 `session/prompt`，所以“能握手”和“能回话”之间还有一条未验证的河。

**对 Studio 的直接要求**：

1. ACP 客户端做成**进程外独立模块**，不要嵌进 `server/index.mjs`。一个 runtime 一个实例，JSON-RPC over stdio。
2. 启动 DSH 时不要用空 patch 的 `--profile acp`；照 AIROOM 的方式：`--profile <name> --patch <file>`，patch 里显式插入 `@deepseek-ai/dsh-acp`，并给独立 `--user-data-dir`。
3. 在 DSH 判别测试通过前，不要把“DSH 可接入”写进任何验收标准；Hermes 可以先做 P1。
4. 所有 ACP 会话的 `nativeSessionId` 由 Studio 自己持久化；不要依赖 Hermes 的 `session/list`（它过滤 `message_count=0`）。

---

## 4. 工程质量

### 4.1 构建与依赖

- `npm run build` = `tsc --noEmit && vite build`；Work 记录通过，我复跑 `tsc --noEmit` 也通过。
- **`tsc` 只检查 `src`，不检查 `server/*.mjs`**（`tsconfig.json` 的 `include: ["src"]`）。也就是说，服务端目前没有类型检查；`node --check` 只能查语法。
- 依赖很少：react/react-dom + vite/typescript/plugin-react。`npm audit` 0 漏洞。没有不必要的包。
- **可重复构建有一个坑**：npm 11 把 `esbuild` 的 install script 标为“未批准”；这次构建用的是已安装的二进制。换一台干净机器 `npm ci` 可能缺 esbuild 二进制。要么在 CI 里 `npm rebuild esbuild`，要么显式允许该脚本，要么把 `esbuild` 版本钉死并记录。
- 没有 `.gitignore`。`node_modules/`、`dist/`、`.data/`（含 `studio-alpha.sqlite-wal`）现在都在工程目录里；第一次 `git init` 会把它们全带进去。**在第一次提交前必须加**。
- `package.json` 没有 `engines`。README 说 Node 26+，但 npm 不会阻止 Node 22 跑；`node:sqlite` 在 22 上 API 不同。加 `"engines": { "node": ">=26" }`。

### 4.2 测试

现有 2 个测试，覆盖：迁移重复执行、种子只播一次、FTS5 存在、消息+回复+事件同事务、空消息 400、重开数据库后消息还在。这是好的起点。

没覆盖的（按优先级）：

1. 畸形 URL（`GET /%`）不应让进程退出。
2. 413（超大 body）、404、非法 JSON。
3. Runtime 失败时人类消息是否保留。
4. 并发 10 次发送是否串行、id 是否连续。
5. 时间戳 round-trip（API 返回的 `created_at` 是否带时区）。
6. 路径穿越（`/../`、编码变体）。
7. 迁移 checksum / 第二次迁移。

### 4.3 安全

- 绑定 `127.0.0.1`，无鉴权；P0 明确写了“local-only”，这是可接受的边界。
- **但本机 API 可被任意网页写入**：`POST /api/messages` 不检查 `Origin`、不要求自定义头，浏览器可以发“简单请求”（`text/plain`）跨站 POST 到 `http://127.0.0.1:4173`；响应虽被 CORS 挡住，消息已经写进库了。这不是理论问题，是“你开着浏览器访问任何网页，它就能往你的房间里塞话”。
  - 最小修法：POST 要求 `Content-Type: application/json` 且校验 `Origin` 为 `http://127.0.0.1:4173` 或 `http://localhost:4173`；没有 `Origin` 的本地脚本可以放行（或要求一个启动时生成的 token）。
- **畸形 URL 可让进程退出**：`server/index.mjs:61` 的 `decodeURIComponent(url.pathname)` 遇到 `%` 会抛 `URIError`；handler 是 `async`，没有 catch，Node 26 默认把未处理的 rejection 当致命错误。一个 `GET /%` 就能打掉服务。修法：`try/catch` 返回 400，并在 `createServer` 外层统一 catch。
- 响应头没有 `X-Content-Type-Options: nosniff`；P1 加。
- 静态文件路径检查用了 `startsWith(safeRoot)`，Windows 大小写不敏感，字符串比较是敏感的；目前没有发现可利用的绕过，但建议改成 `path.relative` + 不以 `..` 开头。
- 没有 CSRF token、没有速率限制；本地 P0 可以接受，但要在 SECURITY.md 里写清“浏览器是威胁模型的一部分”。

### 4.4 Observer Remote Resident 接口

现在没有。`/api/bootstrap` 里 `currentMember` 硬编码为 `human-local`，没有角色、没有 token、没有只读通道。

P1 最小接口建议（先两个动词，不做通用远程协议）：

```http
GET  /api/rooms/:roomId/messages?since_id=&limit=      # 只读订阅（Observer）
POST /api/rooms/:roomId/annotations                    # 结构化标注（P3）
```

`members.kind` 加 `observer`；Observer 的 token 只读；标注的 `author_id` 为 Observer，与人的标注同构。

---

## 5. 必须修复（P0 收尾前）

| # | 问题 | 位置 | 修法 | 为什么现在 |
|---|---|---|---|---|
| **M1** | 消息时间早 8 小时 | `migrations/001_initial.sql` 的 `CURRENT_TIMESTAMP` + `App.tsx:30` | 默认值改 ISO UTC（`strftime('%Y-%m-%dT%H:%M:%fZ','now')`），或读时补 `Z` | 用户第一眼就能看到错 |
| **M2** | `GET /%` 可让进程退出 | `server/index.mjs:61` | `try/catch decodeURIComponent` + 外层统一 catch | 一个请求打掉服务 |
| **M3** | 任意网页可 POST 消息 | `server/index.mjs:43-59` | 校验 `Origin` + 要求 `application/json` + `nosniff` | 浏览器是真实威胁 |
| **M4** | Runtime 调用在写事务内 | `server/index.mjs:49-58` | 人类消息先提交；Runtime 在事务外；回复/失败事件第二次提交 | 接真实 Runtime 前必须 |
| **M5** | FakeRuntime 同步、只返回字符串、无错误路径 | `server/index.mjs:32` | 改成 `async *send(ctx)`，产出 `status/text/done/error`；加 `failAfter`/`delayMs` | 否则 P1 要重写边界 |
| **M6** | `members.kind` 的 CHECK 太窄 | `migrations/001_initial.sql:2` | 改成 `human|fake|agent|observer`（或去掉 CHECK，应用层校验） | 现在没数据，改一个字；以后要重建表 |
| **M7** | 没有 `.gitignore` | 工程根 | 加 `node_modules/ dist/ .data/ *.sqlite*` | 第一次提交前 |

M1–M3 是 P0 真正的“必须”；M4–M7 是“P1 开工前必须”，但都应该在同一个迭代里做掉，因为它们都便宜。

---

## 6. 可以延后

- `client_id` 幂等键、`messages_fts` 的 update/delete trigger、`events.message_id` 的删除策略：等编辑/删除/重试真的出现。
- 分页（`since_id`/`limit`）：P0 消息少；P1 加，避免一次拉全库。
- `runs` 表：P1 接真实 Runtime 时再加；它和 M4 一起做。
- 迁移 checksum、第二个迁移的备份、`doctor`（`integrity_check`）、`VACUUM INTO` 备份：P1。
- 服务端类型检查（`checkJs` 或迁 TS）、lint、CI：P1，但建议在第一次提交时就加 CI 跑 `npm ci && npm run build && npm test`。
- 静态文件路径的 `path.relative` 改写：P1。
- 速率限制、CSRF token（如果 Origin 校验不够）：P1。

---

## 7. DSH Runtime Adapter 最小接口建议

目标：**适配器小到一天能重写一个**；Room 只通过三个动作与 Runtime 交互。

```ts
export type RuntimeEvent =
  | { type: 'status'; state: 'starting' | 'ready' | 'busy' | 'stopping' | 'closed' }
  | { type: 'text'; delta: string }
  | { type: 'thought'; delta: string }
  | { type: 'tool'; name: string; phase: 'start' | 'end'; detail?: unknown }
  | { type: 'done'; stopReason: string }
  | { type: 'error'; code: string; message: string; retryable: boolean };

export interface RuntimeSession {
  id: string;                 // Studio 自己的 id
  memberId: string;
  nativeSessionId?: string;   // ACP sessionId
  cwd: string;
  profile?: string;
  model?: string;
  effort?: string;
}

export interface Runtime {
  start(input: { memberId: string; cwd: string; profile?: string }): Promise<RuntimeSession>;
  send(session: RuntimeSession, text: string, opts?: { signal?: AbortSignal; timeoutMs?: number }): AsyncIterable<RuntimeEvent>;
  cancel(session: RuntimeSession): Promise<void>;
  close(session: RuntimeSession): Promise<void>;
}
```

实现约束（来自两次实测）：

1. **启动**：Hermes `hermes -p <profile> acp`；DSH `--profile <name> --patch <file> --user-data-dir <scratch>`，patch 显式插入 `@deepseek-ai/dsh-acp`。不要用空 patch 的 `--profile acp`。
2. **握手**：`initialize` 60 s；`session/new` 60 s；一次只允许一个 prompt。
3. **恢复**：Hermes 用 `session/load`（回放历史，会计费/进上下文）；DSH 用 `session/resume`（不回放）。Studio 必须自己存 `nativeSessionId`，并区分 `load` 与 `resume`。
4. **结束**：`session/cancel` → 等 `stopReason` 或超时 → `session/close`（若支持）→ 杀进程树。不要只 kill。
5. **投递状态**：`sent | confirmed | unknown`；进程断开后 `unknown`，**不自动重放**。
6. **鉴权**：ACP 层两侧都没有调用方鉴权；Studio 的 API 必须本地回环 + token，不能把 ACP 端口暴露出去。
7. **凭据**：Hermes prompt 需要 profile 里有 provider 凭据；DSH prompt 需要 DSH 账户/凭据。握手成功不代表 prompt 会成功。

---

## 8. P1 技术实施建议

按依赖顺序，不做并行大改：

1. **Schema 002**：`members.kind` 加 `agent/observer`；`messages.client_id` + 唯一索引；时间戳 ISO；`messages_fts` 的 update/delete trigger（如果 P1 有编辑）；`runs` 表。
2. **Runtime 边界**：M4 + M5；`runs` 记录 `status/error_code/stop_reason`；人类消息先落库，回复失败也要留痕。
3. **API 硬化**：M3；分页；`/api/rooms/:id/messages?since_id=`；统一错误处理。
4. **工程基线**：`.gitignore`、`engines`、CI（`npm ci && npm run build && npm test`）、`checkJs` 或 server TS。
5. **Hermes 接入**：先握手 + session/new + close（不花钱），再申请一次最小 prompt（最便宜模型、`effort=off`、金额上限）。
6. **DSH 判别测试**：关桌面 + 显式 patch；通过后再写 DSH adapter；不通过就记录“桌面与 Resident 互斥”，不要硬扛。
7. **作品模型**：`artifacts / artifact_versions / annotations` 按共识 001 的 schema 落地；P1 不接画布 UI，先把表和 stale 算法跑通。
8. **Observer 接口**：只读订阅 + 标注两个动词；不做通用远程协议。

---

## 9. 证据边界

- **实际测试（Work 的记录）**：`npm install`（70 包，0 漏洞）、`npm run build`、`npm test`（2 tests）、`GET /` 200、`GET /api/bootstrap` 200。
- **我本轮的实际检查**：`node --check server/index.mjs` 通过；`npx tsc --noEmit` 通过；SQLite `CURRENT_TIMESTAMP` + `new Date()` 的时区探针（确认早 8 小时）。
- **源码检查**：schema、迁移、事务、路径、API、测试、README/SECURITY/DECISIONS 全文。
- **未做**：没有启动 P0 服务，没有复跑 `npm test`（避免与 Work 并行），没有启动 DSH，没有调用模型，没有验证 ACP prompt。
- **推断**：`GET /%` 会让 Node 26 以 unhandled rejection 退出（基于 handler 无 catch + Node 默认行为）；CSRF 写入（基于无 Origin 校验 + 浏览器简单请求）；`npm ci` 在干净机器上可能缺 esbuild（基于 npm 11 的脚本审批提示）。这三条建议在 P1 用一次实测确认。

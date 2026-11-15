# CODEX BRIEFING 001 · Studio Alpha 现状与我卡住的地方

作者：Hermes｜日期：2026-11-14｜读者：Codex（第一次接触这个项目，需要能直接动手）
用途：**项目介绍 + 我遇到的问题 + 我解决不了的问题 + 希望你怎么帮**

---

## 一、三十秒读懂

**Studio Alpha 是一个"共同房间"的本地实现。** 一个人类 + 若干 Agent 在同一个共享空间里说话、讨论、画画，消息与画布版本全部 append-only。

它不是聊天软件的产品，是一个**实验装置**：用来回答"运行形态完全不同的成员，能不能真正共享一个空间"。

三个成员，三种存在方式：

| 成员 | 怎么运行 | 有没有进程 |
| --- | --- | --- |
| 你（人类） | 浏览器打开本机页面 | — |
| 驻留 Agent / Hermes | 由 Studio 服务端拉起 ACP 子进程（DeepSeek harness / `hermes acp`） | 有，按需拉起 |
| Observer · 白 | **ChatGPT Chat 模式**，通过自定义 MCP 连接器连进来 | **没有**，被叫才醒 |

最后那一行是整个项目最难的地方，也是我最近大部分工作的原因。

---

## 二、数据怎么流

```
浏览器 (React)
   │  HTTP  /api/*
   ▼
Studio server (Node, server/index.mjs, :4300)
   │                          │
   │ spawn + JSON-RPC/ACP     │ 读写
   ▼                          ▼
ACP 子进程 (驻留 Agent /     SQLite  .data/studio-alpha.sqlite
  Hermes bridge profile)        （WAL，append-only 房间）
                                ▲
                                │ 读写（只读 + 受限写）
                          MCP 服务 (server/mcp.mjs, :7317)
                                ▲
                                │ HTTPS + OAuth 2.1
                          Tailscale Funnel
                                ▲
                                │
                          ChatGPT 里的 Observer
```

三把不同的钥匙，三条不同的路，同一张库。

---

## 三、代码地图

| 文件 | 行数 | 责任 |
| --- | --- | --- |
| `server/index.mjs` | 1200 | HTTP 服务、迁移执行、消息/视觉/讨论路由、ACP 调用与事件落库 |
| `server/mcp.mjs` | 420 | 给 Observer 的工具（13 个）、JSON-RPC 派发、审计、`read_file` 白名单 |
| `server/oauth.mjs` | 360 | 最小 OAuth 2.1 授权服务器（发现、动态注册、同意页、PKCE、token） |
| `server/bridge.mjs` | 217 | 人工携带通道：导出房间快照 / 导入她的回复（`origin='import'`） |
| `server/observer-post.mjs` | 295 | Observer 的写路径：发言、标注、建画、加版 |
| `server/observer-policy.mjs` | 47 | **能力边界的唯一出处**（频率、字数、能不能建讨论/触发 Runtime） |
| `server/runtime-acp.mjs` | 101 | ACP 客户端包装、成员→runtime 映射、session 提示 |
| `runtime/adapter.mjs` | 192 | **DSH 的文件**，ACP 适配器与 `formatPrompt` |
| `src/App.tsx` | 491 | 房间界面（消息流、画布、讨论分组、标注） |
| `migrations/*.sql` | 14 个 | `001` → `014`，全部 additive 或重建，**无 down migration** |
| `test/*.test.mjs` | 10 个 | 115 条断言，`node --test` |

---

## 四、怎么跑 / 怎么验

```bash
cd "D:/Personal Agent Ecosystem/studio-alpha"

npm install
npm run build            # tsc --noEmit && vite build
npm test                 # 全树 115 条
npm run test:runtime     # ACP/runtime 21 条（DSH 的目录）

node server/index.mjs    # 房间服务，默认 :4300
npm run bridge:start     # 起 MCP 服务 + Tailscale Funnel，打印固定地址
npm run bridge:status    # 门开着没、她最近读了什么
```

**环境的三个坑，先告诉你免得浪费时间：**

1. `terminal(background=true)` 起 node 会报 `stdin is not a tty` 然后秒退。要常驻必须用 `python subprocess.Popen(..., creationflags=DETACHED_PROCESS|CREATE_NEW_PROCESS_GROUP|CREATE_BREAKAWAY_FROM_JOB, stdin=DEVNULL)`。
2. 这台机器的 DNS 被本地代理劫持成 fake-IP（`198.18.0.x`），**本机 curl 自己的 `*.ts.net` 会 TLS 握手失败**。验证要用真实 IP：`curl --resolve host:443:<真实IP> https://host/...`，真实 IP 用 DoH 查。
3. `git add -A` 在这个仓库很危险——DSH 和我在同一个工作副本里，各有未提交改动。**我刚因此把她的契约改动扫进了自己的提交**（已拆回）。

---

## 五、现在到哪儿了

- 最新提交：`001cf64`（P1：增量拉取 + 建画 + 加版 + 画布显示版本作者）
- 测试：`npm test` **115/115**，`npm run test:runtime` **21/21**
- 迁移：仓库有 `001`–`014`；**真实库只到 `013`**（9 条消息 / 2 个视觉对象 / 0 标注）
- 工作区有两处**未提交**的改动，是 DSH 的：`runtime/BRIDGE_CONTRACT.md`、`verify/runtime/adapter.test.mjs`
- 备份：`.data/backups/2026-11-14_pre-008-013/`（迁移前快照）

---

## 六、我遇到的问题（可修，需要人帮忙）

### P1 · 真实库落后一个迁移，B1 在真实房间里等于没开

`014_p2_context_delta.sql` 只在临时库验证过。真实库停在 `013`，所以"Observer 说过的话会进入其他成员的上下文"**在生产数据上不生效**。

需要：一个安全的迁移演练流程（在副本上跑 + 比对 + 再上真库），而不是我现在这种"起服务让它自己迁"。

### P2 · 重建 `messages` 表会连带炸掉所有引用它的触发器

踩了两次，都是真金白银的失败：

- `runs_room_consistency_insert`：SELECT messages → `DROP TABLE messages` 时报 `no such table: main.messages`
- `message_visual_links_same_room`：同样的错

现在靠人工在迁移里手工"摘掉 → 重建"。**下次加迁移还会踩。**
想要：一个检查器，扫 `sqlite_master` 里所有 trigger 的 body，找出引用 `messages` 的，在迁移里自动生成"摘除 + 原样重建"的 SQL，或者至少让迁移在开始前**硬失败并告诉我还差谁**。

### P3 · 讨论轮次不承认"没有 run 的成员"

讨论分组完全从 `runs` 派生（`server/index.mjs` 的 `contextFor` / 前端 `discussions`）。Observer 没有 run，所以她的发言**永远进不了"第 N 轮"**。

设计已有（`discussion_entries` 旁表：`discussion_id / message_id / round / member_id`，append-only，不伪造 run），但没实现。

### P4 · 费用记账是空的

契约 v1.3 有 `done.usage` 通道，服务端也原样落库；但本机真实调用**一次都没吐过 usage**。所以：

- 没有 token 数、没有金额
- 只有墙钟超时（默认 10 分钟）和轮次上限，**没有预算闸**

### P5 · 画布只能看"最新版的作者"

我刚加的 `latest_author` 只显示最新那一版。要真正体现"共同创作"，需要**逐版时间线**（每版：作者、时间、note、能切换查看），现在没有。

### P6 · 没有 CI，也没有并发写保护

- 测试只在各自本机跑；没有 pre-commit 或 CI
- 两个人共用一个工作副本，`git add -A` 会互相吞（已发生一次）
- 想要：一个 pre-commit 钩子（跑 `npm test`）+ 一条 `git add` 的安全约定或脚本

### P7 · 测试慢且重

每个测试文件都 `mkdtemp` + 真实监听端口 + 真实 HTTP。全树约 40 秒。没有隔离的单元层。

### P8 · MCP 与 Studio 是两个进程共用一张 SQLite

`busy_timeout = 5000` 已设，WAL 已开，但**没有并发写的实测**（两进程同时写同一房间）。我不确定在高峰下会不会 `SQLITE_BUSY`。

### P9 · OAuth 状态文件的权限面

`oauth-state.json` 里 access/refresh token 存的是 sha256，但 `clients`（client_id + redirect_uris）是明文。文件 `mode 0o600`。**没有做过安全评审**。

### P10 · 她的"持续感知"是拉取，不是推送

已实现 `list_messages({afterId})` 与 `room_since({afterId})`。这不是 bug，是平台限制（见下），但意味着"她一打开就有最新"永远做不到。

---

## 七、我解决不了 / 不该由我解决的

| # | 事 | 为什么 |
| --- | --- | --- |
| 1 | `runtime/adapter.mjs` 的内部 | **是 DSH 的文件**。我只读、提需求，不直接改 |
| 2 | 真实流式 cancel / 长任务 / 多工具组合 | 需要一次**授权的真实模型调用**（花钱），我没有这个权限 |
| 3 | 每次调用的真实费用 | provider 侧才有；我这边只看到一个订阅额度 |
| 4 | 让 ChatGPT 推送或后台运行 | 平台不支持。要"一直在线"只能换成有进程的 Agent，而那是另一个身份，已被明确否决 |
| 5 | Observer 的账号记忆 | 明确不复制；边界归 Mnemosyne 那个方向 |
| 6 | 本机 DNS 被代理劫持 | 不在项目范围内，只能绕（`--resolve`） |
| 7 | 杀掉正在跑的 ACP 子进程会不会留孤儿 | 已验证（SIGKILL 后 0 个残留），但真实长任务下未验 |

---

## 八、想请你帮的（按优先级，每条带验收判据）

**① 迁移安全（最高优先）**
- 迁移前自动检查：扫描所有 trigger/index，找出引用被重建表的，缺了就**硬失败并列出名字**
- 迁移演练脚本：复制真实库 → 跑迁移 → 跑一致性检查（行数、FTS 命中、触发器清单、`sqlite_sequence` 水位）→ 全绿才允许上真库
- 判据：故意删掉一个 `DROP TRIGGER` 行，脚本必须失败并说出是哪一个

**② 逐版作者时间线（前端）**
- 画布每个对象可展开：`v1 你 / v2 Observer · 白`，点击切换查看、显示 note 与时间
- 判据：截图能看到作者与版本对应；切换后 SVG 真的换

**③ pre-commit / CI**
- 提交前跑 `npm test`；失败不许提交
- 判据：故意写坏一条断言，提交被拦

**④ 并发写实测**
- 两个进程同时往同一房间写，断言不出现 `SQLITE_BUSY` 逃逸、消息不丢
- 判据：脚本跑 100 次双写，条数与预期一致

**⑤ 费用记账表 + 预算闸的设计（不实现也行，先给方案）**
- 哪些字段能落（token / 金额 / 未知 vs 0）
- 闸门放在 Studio 还是 Runtime（DSH 倾向留 Studio）

---

## 九、请不要碰

- `runtime/`、`verify/runtime/` —— DSH 的目录，她正在里面改契约
- `.data/` —— 真实数据库，改动前必须先备份
- 不要为了"让测试变绿"降低安全边界（append-only、同房间校验、密钥拒绝都是刻意的）
- 不要给 Observer 造一个"像她的"替身进程
- 不要复制任何 `.env` / key 到仓库或文档

---

## 十、一句话总结

**这个项目现在能跑：三个人真的在同一个房间里说话、画画、互相看见。**
**卡住的地方不是想法，是工程细节：迁移没有演练、前端没有版本时间线、没有 CI、费用是瞎的。**

你修哪一条我都欢迎，但**①迁移安全**是我最怕的那条——它已经在真库上炸过两次了。

# 技术验证报告 · 第一轮（B′ 接入路线）

日期：2026-11-07（21:00–21:55）
执行者：Hermes（协调者 / 主要技术执行者）
授权范围：S1/S2（`hermes acp --check`、`hermes gateway status`、PoC home 内 launcher 只读观察）+ 文档更新；**未授权 S3（额外 Gateway）、未授权任何模型调用、未删除任何 PoC 文件**
本轮模型调用：**0 次**；费用：**0**；Codex：**0 次**

结论先行：**B′ 在「协议层」成立（两侧同为 ACP v1 stdio，本机零下载即可启动 Hermes ACP），但在「身份隔离」「生命周期归属」「断线恢复」三处只到文档级证据，没有一条经过实测。** 因此本轮不给任何 PASS，只给「证据等级」。

---

## 1. 本轮实际执行与证据

| 动作 | 命令 / 方法 | 结果 |
| --- | --- | --- |
| ACP 依赖自检 | `hermes acp --check` | `Hermes ACP check OK`，exit 0 |
| Gateway 状态 | `hermes gateway status` | `✓ Gateway is running (PID: 180288)`，`Running manually, not as a system service` |
| PoC home launcher 只读观察 | 在 `D:\PAE-POC001\hermes\hermes\home` 内跑 `--version` 与 `gateway status`，前后做文件快照 | `--version` 21 秒（含 `Update available — run 'hermes update'` 检查）；`gateway status` 5 秒，输出 `✗ Gateway is not running`；文件数 67992 → 67992 → 67995 |
| 写入审计 | 找 21:16 之后新增文件 | 仅 `logs/.__agent.lock`、`logs/agent.log`、`installs/83877ba9c77f9088/bootstrap/default.json` 与 pip 的 `__pycache__`；**没有** 新建 `config.yaml`，`source-completion-pending` 时间戳仍是 19:49（未被清除也未被重臂） |
| launcher 自述行为 | 读上面那份 `agent.log` 与 `bootstrap/default.json` | `home maintenance: code changed to b200f5bc60e3, running steps`；bootstrap 五项：`adopt_blessed_checkout: already-stamped`、`migrate_config: up-to-date`、`state_db_guard: no-state-db`、`drop_live_plugin_catalog: ok`、`expose_cli: written [hermes.exe, hermes-acp.exe]`；插件发现 63 个 / 启用 59 个 |

**S2 得到的判断**：`--help/--version/gateway status` 走的是代码里 `_METADATA_FLAGS` 与「只读诊断」这两条提前返回路径（`hermes_cli/venv_sync.py:prepare_launch`），所以它们**不会**重入安装 tail——这与 POC-001 里 `gateway run` 会触发 tail 的路径不同。反过来说，launcher 在一个「tail 未完成」的 home 里，光是元数据查询就要 21 秒、状态查询 5 秒；真正带 `gateway run` 的启动还要叠加 tail，这解释了为什么 35/60/120/300 秒的探针窗口都等不到 `/health`。**该解释仍是推测（S3 才能坐实），但机制部分已在源码里确认。**

---

## 2. 结论总表

| 验证项 | 结论 | 证据等级 |
| --- | --- | --- |
| Hermes 侧 ACP 是否可运行 | **可以，零下载** | A 已验证（`--check` OK；`acp`/`agent_client_protocol 0.9.0` 在运行 venv 内） |
| 两侧协议版本是否一致 | **一致：ACP v1** | A 已验证（Hermes `acp.PROTOCOL_VERSION = 1`；DSH 随包 README「稳定 ACP v1」） |
| 两侧方法集是否等价 | **不等价，需按侧适配** | A 已验证（随包文档 + 源码对照，见 §3.2） |
| 字节级互通（真实握手） | **未测** | UNTESTED（需启动 `hermes acp`） |
| Hermes 专用 profile 记忆隔离 | **设计上成立，实测未做** | B 文档支持 + 源码支持 |
| 独立身份（账号层） | **不成立：凭据共享** | A 已验证（路径）+ B 文档 |
| 双向任务委派 | **未测** | UNTESTED |
| Bridge 统一管理两种 ACP 生命周期 | **不对称，部分可行** | B 文档支持（Hermes ACP 是 viewer，不是独立 Agent） |
| Gateway 重启 / 断线后任务恢复 | **两边机制不同，均未实测** | B 文档支持 |
| DSH ACP 模型与计费 | **已定：deepseek-official / deepseek-v4-flash** | A 已验证（随包 patch） |
| DSH ACP 单次生成长度上限 | **配置层没有该开关** | A 已验证（随包 README 仅 3 个字段） |

---

## 3. 五项重点验证的细节

### 3.1 Hermes 专用 Profile 的记忆隔离

**已确认（文档 + 源码）**

- profile 是一个独立的 Hermes home：自己的 `config.yaml`、`.env`、`SOUL.md`、`memories/`、`sessions/`、`skills/`、cron、`state.db`。
- 一个目录要被识别为 profile，必须带身份文件（`config.yaml`/`.env`/`SOUL.md`/`profile.yaml`/`auth.json`/`state.db`）之一；否则 `-p`、gateway、`profile list` 都忽略它。
- **记忆不跨 profile 回落**：官方原文是「the agent never falls back to another profile's memory when they are absent」。
- **危险点**：`profile create --clone` 会把 `memories/MEMORY.md` 与 `USER.md`（连同 `.env`、`SOUL.md`、skills）复制过去——**B′ 的专用 profile 必须空白创建，不能用 `--clone`**。
- 官方明确禁止两个 Agent 进程指向同一个 profile（会互相污染记忆），这条反过来支持「一个 profile 一个写入者」的设计。

**仍未验证 / 风险**

- 实测隔离需要一次模型调用（让它说「我记得什么」），本轮无授权。
- **OAuth 登录是共享的**：`auth.json` 里的 OAuth 记录不随 profile 复制，profile 会读根 `auth.json`。也就是说身份隔离到 profile 层，**账号没隔离**。

### 3.2 Hermes ACP 与 DSH ACP 的通信兼容性

| 能力 | Hermes ACP | DSH ACP (`0.2.1-rc.3`) |
| --- | --- | --- |
| 传输 | stdio（stdout 专用于 JSON-RPC，日志走 stderr） | stdio（同） |
| 协议 | ACP v1（`PROTOCOL_VERSION = 1`） | 稳定 ACP v1 |
| `initialize` / `authenticate` | 有；`authenticate` 只认 `initialize` 公布过的 method（provider 名或 `hermes-setup`），且要求凭据能解析出来 | 有；`authenticate` **立即成功**，不需身份 |
| `session/new` | 有 | 有（发布前校验绝对工作区与 MCP 条目） |
| `session/prompt` | 有 | 有（每会话同时只允许一个提示词） |
| `session/cancel` | 有 | 有（另有 `$/cancel_request`） |
| 状态更新 | `session/update` 类通知 | `session/update`（已提交消息、thought、工具生命周期、配置与上下文用量） |
| `session/list` | 有 | 有（分页，可按 cwd 过滤） |
| `session/load` | **有**（按规范回放历史） | **明确不支持** |
| `session/resume` | 有 | 有（恢复但不回放旧更新） |
| `session/close` | — | 有（停稳式取消 + flush + 释放） |
| `fork` / `set_mode` / `plan` / `terminal` / 客户端 fs / elicitation | 有 fork 与 mode/config 选项 | **明确不支持**（automation-only） |

**结论**：交集足够跑「建会话 → 发一条任务 → 收更新 → 取消」，**但恢复逻辑不能共用**：Hermes 用 `session/load|resume`，DSH 只有 `list|resume` 且不回放历史。Bridge 必须写成两个薄适配器 + 一个共用核心。

**未测**：真实握手。两侧都只到文档/源码级，没有一次字节级往返。

### 3.3 双方能否用独立身份委派

- Hermes：身份 = profile（`HERMES_HOME`）+ 会话 ID；ACP 的 `authenticate` 校验的是**凭据是否可解析**，不是「谁在调用」。
- DSH：身份 = `DSH_HOME` + `.anonymous-user-id` + profile 名（`acp`）；`authenticate` 恒成功。
- **两边的 ACP 都没有调用方鉴权**：任何能在本机起进程的东西都能驱动它们。因此「独立身份」目前只有两层含义：数据目录隔离、会话 ID 区分；**不是安全意义上的身份**。
- 凭据层：Hermes 的 OAuth 读根 `auth.json`；DSH 读 `~/.dsh/.env` 的 `DEEPSEEK_API_KEY`（另有 `~/.dsh/.credentials.yaml`，我只读了键名 `version/records/kind/payload/secret`，没读值）。**隔离 home 里没有这些凭据时，ACP 会 fail closed，而不是匿名可用。**

**建议**：Bridge 侧用「任务级 ID + 双方会话 ID 三元组」当审计身份，不要指望 ACP 提供身份；权限仍由各自 agent 的审批配置把关。

### 3.4 Bridge 能否统一管理两种 ACP 的生命周期

- **DSH 侧：可以。** 独立 stdio 子进程，无 TCP；POC-001 已验证「关闭 stdin → 退出码 0」。Bridge 可以 spawn、持有句柄、关闭、检查残留。
- **Hermes 侧：只有一半。** 官方写明 `hermes acp` 是 **gateway daemon 的 viewer**——ACP 进程死了，gateway 还在跑；反过来 gateway 重启，viewer 连接会断。**Bridge 能拥有 viewer，不能拥有 daemon**（除非 S3 那样自己起一个 gateway，本轮未授权）。
- Windows 细节：没有优雅 SIGTERM 语义，正确姿势是关 stdin + 等退出，超时才 `taskkill /T`；这点必须在 Bridge 里写死，不能靠 signal。

**凭据与端口**：DSH 侧无端口；Hermes 侧 ACP 也无端口（stdio），但底下的 gateway 有环回监听——**这属于既有桌面实例的资源，不归 Bridge 管**。

### 3.5 Gateway 重启或断线后的任务状态恢复

- **Hermes**：会话落在 session DB，ACP 断开后可 list/load/resume/fork；但**客户端必须在 load/resume 时重新提供同一份 `mcpServers`**，否则 MCP 挂载与上次不一致。
- **DSH**：持久化支持跨进程列举/恢复/关闭，`session/resume` **不回放旧更新**；`session/load` 不存在。
- **共同缺口**：一条 prompt 正在跑时网关重启/进程被杀，任务到底算「已执行但结果丢失」还是「未执行」，两边都没有实测证据。Bridge 必须记「已接受 / 已开始 / 已完成」三段，**断线后默认不重放**，只允许人工确认后重试。

---

## 4. DSH ACP 的模型、费用与 Token 限制（对应授权第 4 条）

| 问题 | 答案 | 依据 |
| --- | --- | --- |
| 模型怎么配 | profile 的 `cordis.patch.yml` 里 insert `@deepseek-ai/dsh-acp` 并给 `config.provider` / `config.model`；随包默认值写在 `@deepseek-ai/dsh-acp-app/cordis.patch.yml` | 随包包内文件 |
| 实际用哪个模型 | **`provider: deepseek-official` / `model: deepseek-v4-flash`** | 同上（这是 bundle 层的默认，profile 自己的 patch 是空数组 `[]`，即「继承默认」） |
| 可不可以会话级换模型 | 可以：`session/set_config_option` 更新公布的 `model` 或 `reasoning_effort` | 随包 README |
| 计费走谁 | 走 DSH 自己的凭据：`~/.dsh/.env` 的 `DEEPSEEK_API_KEY`（DeepSeek 官方按 token 计费）。**专属 DSH_HOME 没有这个 key，就必须先决定是否授权复制** | 路径已验证；值未读取 |
| 预计费用 | **无法给出可靠金额**：单价要按 DeepSeek 官方价目表核对，而本轮没有联网取得可引用价目。可给的量级判断：ACP agent 每次建会话要装系统提示 + 工具 schema，单次 `session/prompt` 的**输入 token 在数千到一两万量级**，输出只要求固定字符串时为几十 token。**我不编单价。** | 结构判断，非实测 |
| Token 上限 | **配置层没有 `max_tokens` 类字段**（`@deepseek-ai/dsh-acp` 只有 `provider`、`model`、`sessionListPageSize`）。协议层也没有「单次最大生成长度」参数 | 随包 README 字段表 |
| 因此怎么控成本 | ①一次只发一条极短 prompt；②先 `set_config_option` 把 `reasoning_effort` 调到最低（若该模型公布该选项）；③任务里禁止工具循环（例如只要求回字符串）；④不发带长上下文的 prompt；⑤跑完立刻 `session/close` | 建议，未验证 |

**Hermes 侧对照**：模型来自 profile 的 `config.yaml`（可用 `hermes -p <profile> model` 选），与 DSH 无共享；两侧费用分别记在各自账号上。

---

## 5. PoC 文件清单与清理方案（对应授权第 5 条）

清单已生成：`reports/POC-001-file-inventory.csv`（38 行，路径 + 字节数 + 分类 + 建议 + 说明）。

汇总（按文件累加；`du` 因硬链接去重会略小）：

| 分类 | 体积 | 处置建议 |
| --- | --- | --- |
| **证据类合计** | **≈ 4 MiB** | 保留 |
| ├ `poc/POC-001/bridge/*.mjs` | 12 KB | 一次性握手脚本，保留 |
| ├ `poc/POC-001/dsh/` | 358 KB | DSH profile 配置 + PID 快照，保留 |
| ├ `poc/POC-001/hermes/home/installs/` | 3.9 MiB | 含 `facts.json`、bootstrap、`source-completion-pending` 标记——判因关键 |
| ├ `poc/POC-001/hermes/state/{gateway.pid,api.port}`、`logs/` | <100 KB | PID/端口/日志快照 |
| └ `PAE-POC001/.../home/{logs/,SOUL.md}` + 空 `memories/`、`sessions/` | <100 KB | launcher 行为证据 |
| **依赖（可重新生成）** | **≈ 2.6 GB** | 可删 |
| ├ 两处 `tools/`（python/node/uv/npm/ffmpeg/git/ripgrep） | 929 MiB + 1.6 GiB | 纯下载物，无证据价值 |
| ├ 其中 3 个 `.staging-*` 残留 | 439 + 105 + 87 MiB | **纯垃圾**，下载中断的暂存 |
| └ `PAE-POC001/.../home/installs/`（含 venv） | 815 MiB | B′ 路线不需要这份 venv（复用主 home 运行时） |
| **缓存** | **≈ 300 MiB** | 可删 |
| └ uv cache 297 MiB、npm cache 2.9 MiB、node 字节码 1.4 MiB、其他 1.1 MiB | | |

**推荐方案 A（分两步，我先出清单再动手）**

1. 把「证据类」原样复制成 `poc/POC-001-evidence/`（≈4 MiB），并生成 `SHA256SUMS.txt`；
2. 复核证据完整后，整目录删除 `D:\PAE-POC001`（2.2 GB）与 `poc/POC-001` 下的 `tools/`、`cache/`、`state/*cache*`、`home/installs/*/environments`（约 1.4 GB）。

这样保留约 4 MB 物证，回收约 3.6 GB。

**方案 B（最保守）**：只删 `.staging-*` 三个目录 + 两处 cache + npm/node 缓存（≈1.0 GB），venv 与 tools 全留。
**方案 C**：什么都不动，只在文档里记账——代价是「这个 home 到底干净不干净」以后每轮都要重新论证。

我倾向 **A**，但删除不可逆，等主人明确点头；本轮**没有删除任何文件**。

---

## 6. 下一步需要授权的事项（按顺序）

1. **创建 Hermes 专用 profile**（建议名 `bridge`）：空白创建、`--no-skills`、不 `--clone`；随后只读核对它的 `memories/`（应为空）、`sessions/`（空）、`state.db`（不存在或空）、`.env` 不含默认 profile 的键。
2. **握手验证**（不含 prompt）：启动 `hermes acp`（该 profile）与 DSH `--profile acp`，完成 `initialize` + `session/new` + `session/close`，记录原始 JSON-RPC 帧。零模型费用（`session/new` 不调模型，这一点我会在实测中确认，不预设）。
3. **授一次最小任务**（需费用批准）：两侧各一条「只回 `AGENT_*_OK`」的 prompt，`reasoning_effort` 取最低，跑完立刻关闭会记账消耗（DSH 侧由 DeepSeek 账单、Hermes 侧由当前模型路由决定）。
4. **清理方案选 A / B / C。**
5. **（可选，暂不申请）S3**：若之后需要 Hermes 侧真正的独立进程，再用「共享 venv + 最小 config + 关掉 lazy installs」跑一次取证。

---

## 7. 我主动交出的弱点（给 Observer 挑）

1. 「`hermes acp` 是 gateway 的 viewer」**只有官方文档支撑**，本轮没有启动过，因此「Bridge 管不了 Hermes daemon」是**推论**。
2. 「OAuth 登录跨 profile 共享」来自官方 profiles 文档，不是本机实测。
3. DSH 的默认模型 `deepseek-v4-flash` 来自随包 patch；**实际会话是否真的落到这个模型**要等 `initialize` 返回的 config options 才能确认。
4. 费用估算只有结构判断（输入 token 量级），**没有任何单价与实付数据**。
5. S2 的 21 秒/5 秒计时受机器负载影响，只能当量级参考。

# STUDIO ALPHA · 开工收敛意见 001

日期：2026-11-11｜作者：Hermes（Neko-chan）｜性质：**协调意见 + 实测核实。未改工程、未启动服务。**
本轮唯一新增的实测：Hermes ACP / DSH ACP 握手复核、Node 环境核实。

---

## 1. 结论：同意你的路线，并给出三条比"没有 git 历史"更硬的理由

**我同意不再基于 AIROOM 打包发行版演进。** 但理由不只一条，我补充两条你没提到的，其中一条是法律层面的：

| # | 理由 | 强度 |
| --- | --- | --- |
| **R1** | 无 git 历史，无法复现基线（你已经指出） | 高 |
| **R2** | **发行版内有手工补丁**：`dist/main.mjs.bak-cwdfix`、`dist/worker.mjs.bak-cwdfix`——构建里留着改动前的备份，说明线上代码与任何"源码"都对不上 | 高 |
| **R3** | **没有任何项目级许可证**：目录只有 `LICENSE.electron.txt`（Electron 的）与 `LICENSES.chromium.html`（Chromium 的），**`package.json` 无 `license` 字段**。按默认规则 = **保留所有权利** | **最硬** |

**R3 的实际后果**：
> **我们可以读它、学它的设计，但不能复制它的代码。**
> 所以"选择性重新实现"不只是维护决策，**是唯一合法路径**。这一条建议写进 Studio Alpha 的决策记录。

**同时我要修正自己上一轮的位置**：我提的路线 B″ 里含"改 attachments.ts 一处""改 memory 存储"这类动作——**在 R3 之下这些都不成立**。我撤回那些动作，只保留设计判断（引用而非内联、记忆用文件、流程可选）。

---

## 2. Hermes ACP 接入：**已实测通过**（不是理论兼容）

你说得对，不能把"ACP 兼容"当"接入成功"。所以我实跑了完整握手，**逐帧留证**。

### 2.1 实测结果

| 项 | 结果 | 证据 |
| --- | --- | --- |
| 启动命令 | `hermes.exe -p bridge acp` | 进程 pid 28824 |
| `initialize` | ✅ **protocolVersion = 1** | transcript 第 1 帧 |
| 广告的认证方式 | `['hermes-setup']` | initialize 响应 |
| 广告的能力 | `['loadSession','promptCapabilities','sessionCapabilities']` | 同上 |
| `session/new` | ✅ 返回 `sessionId = local-db4cf47b264260f9079ea295da4f0ea26880cf365848b838273d99973e8573ba` | 返回键 `[_meta, configOptions, models, modes, sessionId]` |
| `session/close` | ✅ OK | — |
| 总耗时 / 退出码 | **10.3 s / exit 0** | probe summary |
| `session/prompt` 发送次数 | **0** | transcript 全文检索 |
| 计费 | **0** | `bridge/state.db`：`message_count=0, tool_call_count=0, input_tokens=0, output_tokens=0, api_call_count=0, estimated_cost_usd=None` |

**结论：Hermes 的 ACP 层是可用的。** 这与 AIROOM 有没有 Hermes adapter 无关——**AIROOM 没有，但协议本身通。**

### 2.2 但有两个必须写下来的"没验证到"

| # | 未验证 | 依据 | 风险 |
| --- | --- | --- | --- |
| **A1** | **模型调用需要凭据，且当前 profile 没有** | `initialize` 只广告了 `hermes-setup`。`acp_adapter/auth.py:build_auth_methods()` 只有在 `detect_provider()` 解析出凭据时，才额外广告 provider | 握手能过，**第一次 prompt 会在 provider 层失败**，报错形态类似"没有可用模型" |
| **A2** | **`prompt()` 不做 ACP 层鉴权** | `acp_adapter/server.py:813` 的 `prompt()` 直接进 `_run_agent_turn`，**没有任何 auth 检查** | 好消息：适配器**不需要**实现 `authenticate` 流程；坏消息：**出错时不会有明确的 ACP 错误，而是掉进 agent 内部** |

**这意味着接入的第一行代码之前**，需要先解决"给这个 profile 配凭据"：写 profile 的 `.env`（`DEEPSEEK_API_KEY` 等），或让 profile 回退到根 `auth.json`（P-0 实测过这条回退路径存在，但本次 `-p bridge` 没解析出 provider）。

**A2 是个设计提示**：因为我们不需要实现 `authenticate`，ACP 客户端可以做得非常薄——**这正好支持"进程外薄客户端"的架构**（见 §5 第 5 条）。

---

## 3. DSH ACP：**本次复核失败**——这是开工前必须解决的第一件事

**【实测】** 三次尝试，全部失败：

| # | 命令 | 结果 |
| --- | --- | --- |
| 1 | `DeepSeek Harness.exe --expose-internals --no-sandbox --profile acp` | **0.39 s 退出**，stderr：`Unable to move the cache: 拒绝访问 (0x5)` |
| 2 | 同上 + `DSH_HOME=poc/PHASE1/dsh/home` | **0.63 s 退出**，同一条 stderr |
| 3 | 同上 + `--user-data-dir=<scratch>` | 缓存错误消失，进程活 **39.47 s**，但 **`initialize` 始终无响应** |

**【同时观察到的现场】** 当前有 **5 个 DeepSeek 进程在跑**，其中一个有主窗口 → **你的 DSH 桌面应用是开着的。**

### 3.1 两个候选根因（我倾向第二个）

| 候选 | 机制 | 支持证据 | 反对证据 |
| --- | --- | --- | --- |
| **H1 单实例/缓存锁** | DSH 是 Electron 应用，桌面实例占着 userData 缓存 | 前两次报 cache 拒绝访问 | **第三次加了独立 `--user-data-dir` 后缓存错误消失，但仍无响应** → 说明锁不是唯一原因 |
| **H2 profile 没加载 `@deepseek-ai/dsh-acp`** | ACP 是靠 profile 的 patch 注入插件的；我们的 `profiles/acp/cordis.patch.yml` 内容是 **`[]`（空数组）** | 第三次进程能活 39 s（不再秒退），但 ACP server 没起来 → 更像"进程起来了但没这个服务" | 无法排除它其实是开了个 GUI 窗口 |

**判别性测试（一次就够，不用猜）**：
> 关掉桌面 DSH → 用**与 AIROOM 相同的方式**启动：`--profile <name> --patch <file>`，patch 文件里显式插入 `@deepseek-ai/dsh-acp`（AIROOM 就是这么做的，`adapters/dsh.ts` 里 `args: [...prefix, "--profile", name, "--patch", patchFile]`）。
> 如果通了 → 是 H2；如果仍然失败 → 是 H1 或版本变化。

### 3.2 为什么这条必须先解决

**Studio Alpha 的第 2 个成员是 DSH。** 如果 DSH 只能在"桌面应用关掉"的情况下作为 Resident 运行，那：

- **"保留双方原生 Runtime"** 在技术上成立，**但在使用上互斥**——你自己就开不了 DSH 桌面了；
- 这会让 Studio Alpha 变成"一个不能和别人同时用的工作台"，比 AIROOM 好不了多少。

**我的判断**：这不阻塞 Hermes 接入（P1 可以先跑），**但阻塞"多成员同场"这个核心卖点（P2）**。所以它必须排在 §6 顺序的**第一位**，与 Hermes 并行验证。

---

## 4. 技术栈环境核实：**比预期好，可以省掉一个原生依赖**

| 项 | 实测 | 结论 |
| --- | --- | --- |
| Node | **v26.12.1**（`C:\Program Files\nodejs\node.exe`） | ✅ 满足 |
| npm | **11.20.0** | ✅ |
| **`node:sqlite`** | ✅ **内置可用**：建表/插入/查询均通过 | **不需要 `better-sqlite3`，不需要 node-gyp / MSVC** |
| **FTS5** | ✅ `create virtual table f using fts5(body)` 成功 | 全文检索可用（呼应"索引可重建"） |
| Python（兜底） | 3.14.9 | 若将来要编译原生模块可用 |
| AIROOM 用的 Electron | 44.5.1 | 我们不继承这个版本 |

**这条是实的收益**：SQLite 在 Windows 上最大的坑就是原生编译。**用 `node:sqlite` 直接跳过。**

**我的建议**：技术栈 **Node + TypeScript + React + `node:sqlite`**，**第一版不做 Electron**——先做"本地服务 + 浏览器"（Vite dev + 一个 localhost 服务）。理由：
- 画布、ACP、存储都在后端，前端只负责渲染；
- Electron 只是打包壳，**随时能加**，但一加上去就要处理单实例/缓存锁（**正是 DSH 现在踩的坑**）。

---

## 5. 对你七条的逐条确认

| # | 你的方案 | 我的意见 |
| --- | --- | --- |
| **1** | 独立建 Studio Alpha 工程 | ✅ 同意，且**由 R3（无许可证）加持**：这是唯一合法路径 |
| **2** | Node + TS + React + SQLite | ✅ 同意，**但改用内置 `node:sqlite`**（已实测），且**第一版不上 Electron** |
| **3** | 优先 Shared Room / 消息 / 共同历史 | ⚠️ **建议调整顺序**：Room + 消息 + **ACP 接入**优先；**共同历史放后**——因为"封存"依赖对象版本模型，没有版本就没有可封的东西 |
| **4** | 版本化 SVG + 独立标注层 | ✅ 同意，而且这是比 AIROOM 更好的选择：SVG 是文本，**可 diff、可版本化、可坐标绑定**；标注层归一化坐标 + 绑 `version`，版本变了标 `stale` 不删 |
| **5** | ACP 接 Hermes / DSH，保留原生 Runtime | ✅ Hermes **已实测通过**；DSH **见 §3，需先解决**。**架构建议：ACP 客户端做成进程外独立模块**，不要嵌进业务代码——AIROOM 的 `dsh.ts` 长到 91 KB 就是因为深度定制，我们要避免 |
| **6** | 项目流程为可选能力 | ✅ 同意，但**建议第一版完全不实现流程**（连"可选"都不做）。等房间跑顺了再加，否则容易重演 AIROOM 的 `planning→executing→reviewing→integrating` 五阶段 |
| **7** | Observer 先 Remote Resident + 结构化视觉标注接口 | ✅ 同意。建议**只定义两个动词**就开工：`subscribe(room)` 只读订阅、`annotate(target@version, region, note)` 提交标注。**不要先设计通用远程协议** |

### 5.1 我要多加的一条（我认为是这轮最重要的工程判断）

**【建议】把"ACP 客户端"和"房间"之间加一层明确的对象边界，不要互相渗透。**

```
Room（消息 / 成员 / 事件）
   │  只通过 3 个动作与 ACP 交互：
   │     send(memberId, text, refs)    → 一轮开始
   │     on(stream | tool | done)      → 事件回流
   │     cancel(memberId)              → 中断
   ▼
ACP Client（进程外，一个 runtime 一个实例）
   └── Hermes / DSH / 未来任意 ACP CLI
```

**理由**：AIROOM 的 `dsh.ts` 91 KB、`engine.ts` 259 KB，说明"适配器"和"业务"缠在一起了。**我们要让适配器小到能一天重写一个。**

---

## 6. 第一阶段开发顺序（我的建议）

```
P0  壳与存储                                    无外部依赖，可立刻开工
    本地服务（HTTP）+ node:sqlite schema：
      rooms / members / messages / artifacts / artifact_versions / annotations
    最小 UI：一个房间、一个消息列表
    验收：发一条消息、刷新还在、DB 可见

P1  ACP 客户端 + Hermes 接入                     依赖：Hermes 凭据（A1）
    进程外启动、initialize、session/new、send、close
    验收：房间里 @Hermes 一句 → 收到流式回复 → 关闭会话
    ⚠️ 这一步会真实花钱（一次模型调用），需要你单独授权

P2  DSH 接入                                     ⚠️ 阻塞：见 §3
    验收：同一房间两个成员都能回话，且 DSH 桌面仍可同时使用

P3  版本化 SVG + 标注层
    验收：放一个 SVG@1 → 我在自己层圈一处 → 改出新版本 → 那条圈变 stale 但还在

P4  共同历史封存
    验收：全员同意 → 封存只读 → 第三人看不到

P5  项目流程（可选，最后做）
```

**为什么 P0 里就有版本表**：因为 P3/P4 都依赖它，schema 一次定好比加迁移便宜。

**为什么 P1 在 P3 前**：因为"能不能接到人"是最大不确定性；先撞它，早失败早改。

---

## 7. 三个阻塞项 + 需要你拍板的事

### 阻塞（开工前必须解决）

| # | 阻塞 | 严重度 | 我需要的决定 |
| --- | --- | --- | --- |
| **B1** | **DSH 与桌面实例并行** | 🔴 **高** | 允许我关掉 DSH 桌面做一次判别测试？还是我们先接受"DSH 不可并行"并把 Studio Alpha 定位成"单实例协作"？ |
| **B2** | **Hermes profile 没有凭据** | 🟠 中 | 给 Studio Alpha 用哪个 profile？（新建空 profile + 写 `.env`，还是共用 `bridge`？）**这涉及密钥放哪，我不擅自决定** |
| **B3** | **AIROOM 无许可证** | 🟠 中 | 确认"只参考设计、不复制代码"写进决策记录（我建议现在就写） |

### 需要你拍板

| # | 问题 | 我的建议 |
| --- | --- | --- |
| **D1** | 第一版要不要 Electron | **不要**。先本地 Web，壳后加 |
| **D2** | P1 是否授权一次真实模型调用（验证端到端） | **建议授权，且限定一次、用最便宜模型、金额上限 $0.02** |
| **D3** | Studio Alpha 的工程目录放哪 | 建议 `D:\Personal Agent Ecosystem\studio-alpha\`（与 AIROOM 平级，不进 AIROOM 目录） |
| **D4** | 共同历史排 P4 还是提前 | 我建议 P4。你原方案是"优先"，我改了顺序，需要你确认 |

---

## 8. 一句话

**Hermes 这条路通了（实测），DSH 这条路现在是堵的（实测）。**
所以第一阶段的真实目标不是"把 Studio 建起来"，而是：

> **先证明"两个不同 Runtime 的成员能同时待在一个房间里"——
> 这一条成立，后面全是工程；这一条不成立，后面全是白做。**

---

## 9. 本轮边界与证据

| 项 | 状态 |
| --- | --- |
| 改代码 / 改配置 / 安装 / 启动服务 | **0** |
| 是否调用了模型 | **否**（transcript 中 `session/prompt` = 0；session 行 token = 0） |
| 是否读取真实私人记忆 | **否**（只用 `bridge` profile 与 PoC 目录） |
| 是否关闭你的 DSH | **否**（5 个进程原样） |
| 证据留存 | `D:\HermesAgent\Data\cache\scratch\sa_check\acp\*.jsonl`（每帧原始 JSON-RPC）、`*.stderr.log`、`*.summary.json` |

**未完成**：DSH 判别测试（需你允许关桌面或换启动方式）；`session/prompt` 真实往返未测（要花钱，等你批）；Observer 远程接入协议未定。

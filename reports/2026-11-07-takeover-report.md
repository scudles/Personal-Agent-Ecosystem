# Personal Agent Ecosystem 项目接管报告

日期：2026-11-07（本机时间 21:0x）
作者：Hermes（接管协调者 / 主要技术执行者）
读入依据：README、ARCHITECTURE、DECISIONS、DEVELOPMENT_LOG、ENVIRONMENT、ROADMAP、SECURITY、reports/POC-001.md，以及本机只读复核（2026-11-07 21:00–21:15）
本报告未修改任何配置、未启动任何 Agent/服务进程、未调用 Codex、模型调用 0 次、费用 0。

---

## 1. 对项目目标的理解

目标不是「把两个软件连起来」，而是让三个角色各自保留身份地长期共存：

- Hermes：个人助理本体（记忆、Skills、自动化、长期项目）。
- DSH：外部执行体（插件、Workflow、多 Agent 跑批量活）。
- Observer：独立审查者，默认只读，可以反对前两者的方案。
- 用户：唯一决策者，所有付费/不可逆/对外动作的审批点。

由此得到一条我认为必须写死的判据：**隔离是为了「不让彼此污染记忆和权限」，进程数量本身不是目标。** 后文第 8 节因此建议调整原方案，理由来自这条判据，而不是来自「实现起来麻烦」。

## 2. 当前实际进度（只读复核后）

**已完成并可信**

- 项目文档体系建立，证据分级（已验证 / 文档支持 / 推测 / 待验证 / 实际失败）机制健全，这是这个项目最值钱的资产。
- DSH `0.2.1-rc.3` 独立 ACP stdio 进程启动 + `initialize` 握手成功（PID 187884，protocolVersion 1，退出码 0）。
- 本机环境：Windows 11 Build 26200；Hermes 桌面 `D:\HermesAgent\Source\apps\desktop\release\win-unpacked\Hermes.exe`；DSH 桌面 `0.2.1-rc.3`。

**本次复核新增的事实（本机文件/进程证据）**

| 事实 | 证据 | 级别 |
| --- | --- | --- |
| Hermes 运行中的 Backend 是 `python -m hermes_cli.main gateway run`，PID 180288 | `D:\HermesAgent\Data\gateway.pid` 内记录 `kind: hermes-gateway`、`hermes_home: D:\HermesAgent\Data`；进程列表匹配 | A 已验证 |
| 该 Backend 解释器是 `D:\HermesAgent\Data\tools\python-3.14.9+…\python.exe` | 进程命令行 | A 已验证 |
| 运行 home 已装有完整运行时：`Data\installs\83877ba9c77f9088\environments\5bc19e6f…\venv`，site-packages 248 项，含 `ruamel.yaml 0.18.16`、`hermes_agent` editable、`agent_client_protocol 0.9.0`、`acp` | 目录只读列举 | A 已验证 |
| 即：**`hermes acp` 在当前机器上不缺依赖**，无需下载 | 同上（`acp_adapter` 源码存在 + `agent_client_protocol` 已装） | A 已验证 |
| DSH 桌面进程在跑（PID 184456 主进程 + 子进程），另有 `billion-context` MCP 侧车监听 `127.0.0.1:18787` | 进程列表 | A 已验证 |
| PoC 遗留体积：`poc/POC-001` 956 MB、`D:\PAE-POC001` 2.2 GB（合计约 3.2 GB） | `du -sh` | A 已验证 |
| 两个 PoC home 里都**没有 config.yaml** | 目录列举 | A 已验证 |
| 两个 PoC home 都留有 `installs/83877ba9c77f9088/source-completion-pending`（内容 `source update tail not finished`），深路径还留了 attempts=`1` | 文件读取 | A 已验证 |
| 短 D: 路径 home 的 PM 同步回执是 **ok**：`kind: sync, outcome: ok, exit_code: 0, venv_rebuild.ok: true` | `logs/update_receipts/latest.json` | A 已验证 |
| 短路径 venv 内已装 `ruamel 0.18.16` 与 `hermes_agent` editable（244 个包） | 目录列举 | A 已验证 |

**未完成**

- Hermes 独立实例从未达到「能接受会话/任务」的状态（PASS 一次都没有）。
- 双向委派、任务 ID、状态、失败/超时/取消：全部 NOT TESTED。
- DSH ACP 只到握手，未验证模型可用性；其 `profiles/acp` 里只有 `cordis.yml`、`cordis.patch.yml`、`package.json`、`pnpm-workspace.yaml`，bundles 为 `dsh-base` + `dsh-acp-app`，**dependencies 为空、没有任何模型/凭据配置**。
- Bridge、Shared Knowledge、Observer 服务、Web Dashboard：规划中，无实现。

## 3. PoC-001 的成功与失败（重新归因）

**成功**：DSH ACP 独立 stdio 进程可启动、可握手、可干净退出。这一条成立，不受下面的结论影响。

**失败**：Hermes 侧「独立 Gateway 启动失败」。读源码后我认为这是**三个独立问题被合成了一个结论**。以下区分证据与推测：

1. **深路径确实缺依赖（已验证）**：`ModuleNotFoundError: ruamel` 发生在加载 `hermes_yaml.py`，退出码 1。这是真失败，但只针对那个 home。
2. **健康检查大概率测错了对象（强推测，证据链完整）**：PoC 轮询的是 `http://127.0.0.1:<port>/health`。按官方文档，`/health` 属于 **API Server 平台**，而 API Server 必须在 `config.yaml` 的 `platforms.api_server` 里显式启用、并提供 `API_SERVER_KEY`，「named profile 没有自己的 key 就 fail closed」。两个 PoC home 里**都没有 config.yaml**。也就是说：即使 Gateway 起来了，`/health` 也不会有应答——这是探针设计错误，不是 Gateway 故障。
3. **每次启动都被「安装收尾」吃掉（已验证机制 + 推测时序）**：
   - `hermes_cli/venv_sync.py` 的 `prepare_launch()` 会在 self-managed source 安装上先做完依赖同步（`arm_completion()` 先写 `source-completion-pending`），再跑 launchers/products/maintenance 的 tail；tail 没做完，标记就留着，**下次启动继续重试**，并且有退避与次数上限（2 次后 15 分钟退避，6 次后不再自启）。
   - 短路径的 PM 回执是 `ok/0`，`ruamel` 也在 venv 里，说明依赖其实同步完了；剩下的就是 tail（build launcher、产物、维护）。而 tail 是**分钟级**，PoC 的 35/60/120/300 秒窗口不足以跨过去，脚本就把它当成「无健康响应」并清理了进程。
   - 结论：短路径那几次很可能不是「Gateway 起不来」，而是「还没轮到 Gateway 起」。这条我标**推测**——只有真正跑一次并观察 tail 是否完成才能升级为已验证。

**派生判断**：PoC-001 报告的结论「Hermes 独立 Gateway FAIL」在**证据上过强**。准确说法应是：深路径 FAIL（缺依赖）；短路径 BLOCKED/UNKNOWN（安装 tail 未完成，且健康探针指向一个未启用的 API Server）。

## 4. Hermes Gateway 故障调查计划（按成本从低到高，全部零模型调用）

- S1（只读，0 风险）：`hermes acp --check`（官方非交互自检，只验证适配器与依赖，不发会话）；`hermes gateway status`（官方明确标注它是「不跑 update tail」的只读诊断路径）。目的：确认运行中 Backend 的真实版本、端口、健康口径。
- S2（只读）：在 PoC 短路径 home 里**不启动**，只用 `--help`/`status` 观察 launcher 是否会重入 tail（配合 `HERMES_DISABLE_LAZY_INSTALLS=1` 观察差异）。目的：验证第 2 节的「tail 吃掉启动窗口」推测，不改任何东西。
- S3（需授权，启动进程但不发 prompt）：**复用现有运行时**跑一次独立 Gateway——用 `Data\installs\...\venv\Scripts\python.exe -m hermes_cli.main gateway run`，环境为 `HERMES_HOME=<隔离 home>` + `HERMES_DISABLE_LAZY_INSTALLS=1`，home 内**预置一份最小 config.yaml**（只开 `platforms.api_server`、绑 127.0.0.1、随机 key 不落盘）。这样既不再触发 3 GB 级别的安装，也能把「/health 到底是探针问题还是真的起不来」一次问清。
  - 若 S3 通过 → 拓扑 B 在技术上有救，但它仍是第 8 节要讨论的「临时 shim」。
  - 若 S3 仍失败 → 拿到的是**第一次干净的、可复现的**失败，再去读 `hermes_bootstrap`/`prepare_launch` 的日志定位。

## 5. DSH ACP 后续验证计划

- D1（0 成本）：沿用已验证的握手脚本，把 `session/new` 也跑一遍（不 prompt）。ACP 的 `session/new` 只建会话，不产生模型费用——这一条要实测确认，不靠推断。
- D2（成本门槛）：`profiles/acp` 目前**没有任何模型配置**，直接发 prompt 不可能成功，也不该试。必须先决定：用哪个模型、由谁的额度付费。我的建议是先用已经付费且单价最低的 `opencode-go/dsv4.1-flash` 做一次「返回固定字符串」的最小任务，并显式设 `max_tokens` 上限。
- D3：D2 通过后再验状态/取消/超时。取消必须用 `session/cancel` 而不是杀进程，否则拿到的不是「任务取消」的证据。

## 6. Codex 额度使用策略

- 本次接管全程**未调用 Codex**，源码定位都由我自己读完成（`venv_sync.py`、`update_completion.py`、`gateway.py`、`subcommands/acp.py`、官方 docs）。事实证明这一步不需要外援。
- 后续只在一种情况下考虑 Codex：需要跨多个模块追一条真实失败链路，且我已经用只读手段缩小到具体函数。届时按「一次调用、一个交付物」提交：给完整栈回溯 + 目标函数 + 期望输出格式。
- 不为「看一眼系统级行为」调用 Codex；也不为省事调用。剩余额度未知，按「无法确认成本就不假设」处理。

## 7. 目前最值得优先解决的技术问题

排序（不是因为难，而是因为挡住后面所有事）：

1. **Hermes 侧的接入方式选错了**（不是「Gateway 修不好」）。只要继续按「独立 home + 独立 Gateway」走，每次都要面对数 GB 的运行时副本、分钟级的安装 tail、以及一个官方标注「未来会移除」的 shim。这是根问题。
2. **健康判据错误**：项目的通过/失败标准是「`/health` 有响应」，而这个口径依赖一个默认关闭、默认 fail-closed 的 API Server。判据不改，后面还会误判。
3. **DSH ACP 没有模型配置**：握手 PASS 掩盖了它现在根本跑不了任务。这是第二阶段真正的阻断点。
4. PoC 遗留 3.2 GB 未处置：不影响功能，但会持续占用磁盘并让「home 是否干净」的判断变模糊。

## 8. 我认为原有架构需要调整（这是本报告的核心判断）

**调整一：放弃「第二个 Hermes OS 进程」，改用「专用 profile + 官方 stdio/JSON-RPC 接口」。**

依据（全部来自本机源码与随包官方文档）：

- `multi-profile-gateways.md` 明确写着多路复用（one gateway per host）是方向，`gateway.standalone: true` 是**临时向后兼容 shim**，并且原话是「Do not build new setups on it: if you are starting fresh, run the host multiplexer」。
- `acp.md` 明确写着 `hermes acp` 是「gateway daemon 的 viewer」，并且它保留 Hermes 既有的 identity、provider、memory、skills、tools——也就是说，隔离的粒度是 **profile**，不是一个新进程。
- `acp_adapter` 与 `agent_client_protocol 0.9.0` 在本机 venv 里**已经装好**，零下载即可启动。
- DECISIONS 里的 D-002 要求的是「各自保留模型、记忆、工具、配置和运行环境；只共享授权资料」。专用 profile 满足记忆/配置隔离；进程分离从来不在这条决策的文字里。

因此我建议把拓扑改成 **B′**：

```
用户（决策者）
   │
Agent Bridge（先做最小脚本，不是服务）
   ├── Hermes：专用 profile（独立 memory/sessions/skills/config）
   │            └─ 走 hermes acp（stdio ACP，官方）或 Gateway JSON-RPC
   └── DSH：专属 DSH_HOME + acp profile（stdio ACP，已握手 PASS）
        ↑ 两侧协议同构，Bridge 只需一套 ACP 客户端
```

好处：不新增 3 GB 运行时、不需要额外端口和票据、不需要接管桌面进程生命周期、两侧协议对称（一套客户端代码），而且踩的是 Hermes 官方「正在维护」的那条路。

代价（要诚实写出来）：Hermes 侧的会话仍由 live gateway 进程承载；如果 profile 配错，理论上可能读到默认 profile 的上下文。所以 profile 必须由我显式创建、逐项核对，且第一轮只做 `initialize`/`session/new`，绝不 prompt 到个人会话里。

**调整二：把 PoC 的通过判据从「`/health` 200」改成「协议层握手 + 一次固定字符串任务往返」。** 前者的语义是「API Server 开着」，不是「Agent 能用」。

**调整三：Observer 与 Dashboard 往后放。** 现在连一条可用通道都没有，先有数据再看板；否则 Dashboard 只能展示两种状态：未知和失败。

## 9. 需要用户拍板的事（我攒在一起，不逐条打断）

1. **是否采纳 B′**（专用 profile + `hermes acp`，放弃第二个 Gateway 进程）。我推荐采纳。
2. **是否授权 S1/S2**（`hermes acp --check`、`hermes gateway status`、以及 PoC home 内的 launcher 只读观察）。零模型费用、不改配置。
3. **是否授权 S3**（复用现有 venv 在隔离 home 启一次独立 Gateway，仅用于取证，不含 prompt）。会启动一个新进程，故按 SECURITY.md 需要明确授权。
4. **测试用模型与付费额度**：DSH ACP 目前无模型配置。建议两侧都用 `opencode-go/dsv4.1-flash` 做一次「回固定字符串」的最小调用，各自 `max_tokens` 限死。
5. **3.2 GB PoC 产物怎么处置**：建议保留 `poc/POC-001`（证据），把 `D:\PAE-POC001` 打包成一份小体积日志/清单后删除；我不会擅自删。

## 10. 与现有文档的差异（不改文档，先报告）

| 文档 | 现记 | 本次复核 |
| --- | --- | --- |
| ENVIRONMENT.md | Hermes Backend 版本「待确认」 | 已可确认为 `gateway run`、PID 180288、`HERMES_HOME=D:\HermesAgent\Data`；版本号仍需 S1 一条命令坐实 |
| ARCHITECTURE.md | 「Hermes v0.22.7 独立 Gateway 启动失败，缺少 ruamel.yaml」 | 只对深路径成立；短路径依赖已 ok，失败原因是探针口径 + 安装 tail，须改成分级表述 |
| ARCHITECTURE.md / ROADMAP.md | 拓扑 B 为「有条件推荐」 | 建议改为 B′；`gateway.standalone` 被官方标注为将移除的 shim，不宜作为新方案基座 |
| POC-001.md | 「Hermes Gateway FAIL」 | 应拆分：深路径 FAIL（缺依赖）/ 短路径 BLOCKED-UNKNOWN（探针错、tail 未完成） |
| ROADMAP.md Phase 0.5 | 下一步是「定位 `source-completion-pending` 停点」 | 已定位其来源（`venv_sync.arm_completion` 的 tail 义务标记，会按退避重试）；下一步应改为「选接入方式」 |

以上差异我只是记录，**没有覆盖任何既有记录**。

---

## 附：本次只读操作清单

读文件：项目 8 份文档 + POC-001 报告；`D:\HermesAgent\Source\hermes_cli\{venv_sync.py,update_completion.py,update_receipt.py,gateway.py,profiles.py,subcommands/acp.py,main.py}`；`website/docs/{developer-guide/source-update-completion.md,user-guide/features/acp.md,user-guide/features/api-server.md,user-guide/multi-profile-gateways.md}`；PoC 的 `latest.json`、`facts.json`、`source-completion-pending`、DSH `profiles/acp` 四个小文件。
读环境：进程列表、`gateway.pid`、`gateway-starts.log`、目录体积、venv site-packages 清单。
未做：启动/停止任何 Agent 进程，写任何配置，读取任何凭据内容，发送任何 prompt，调用 Codex，向外部发送消息。

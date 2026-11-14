# TriReviewBridge 当前工程状态与未接通项审核报告

- 首次审计快照：2026-11-14 07:18:34 UTC（15:18:34 中国标准时间）
- 增量核验：2026-11-14 08:19:53 UTC（16:19:53 中国标准时间）
- 工程目录：D:\TriReviewBridge
- 用途：供项目状态、真实通道和下一步路线审核
- 范围：只读核对现有文档、候选交付、测试结果、运行状态与注册项；本次只新增本报告并更新文档索引
- 结论等级：以当前可见证据为准；模拟、候选包、Agent 自述、已提交和 UNKNOWN 分开标注

## 1. 结论摘要

TriReviewBridge 已具备可运行的**离线协作工作台候选**：消息、工程材料、治理、证据和模拟接收流程有实现及回归记录；离线完成报告记载 127 项回归和 3609.42 秒模拟耐久通过。

但“多个原生 Agent 持续在线收发、同包材料验证、真实原会话收件并回流”的完整产品目标**尚未通过验收**。现在可以演示和验证离线流程，不能据此宣称 Hermes、DSH、ChatGPT 三方真实常驻已打通。

当前最影响交付的不是重新设计架构，而是三类具体问题：

1. 收口任务 010 的回归汇总与底层日志相互矛盾，一小时耐久仍显示 RUNNING，最终交付文件缺失。
2. ChatGPT 原对话路径仍缺一条可复核的真实收发闭环；Edge Host 注册记录与候选包状态不一致。
3. Hermes 的生产连续性及 DSH 原生会话身份尚未分别证实，三方材料的独立字节校验也未完成。

## 2. 当前能力与真实状态

| 能力 | 当前判断 | 证据边界 |
|---|---|---|
| 离线工作台与治理流程 | 已有可运行候选 | 离线完成报告记载 127 项回归、3609.42 秒模拟耐久；这是隔离演示，不是生产 Agent 接入。 |
| UEC 工程快照和材料包 | 离线构建能力已有 | 快照、Manifest、文件哈希和版本化包可在本机流程中生成；真实三方收到同一字节材料的证据不完整。 |
| Hermes worker | 离线候选已审查 | 010 的盘点把 009 标为 ACCEPTED_OFFLINE；这不证明当前 Gateway 正在工作，也不证明生产原 Session 可持续收发。 |
| DSH 原生接入 | 真实通道受阻 | 010 的 DSH 身份调查指出桌面可观察信息没有提供可信、稳定的原生 Session ID；离线解析器通过测试不等于真实会话身份已绑定。 |
| ChatGPT Edge 原对话接入 | 离线包准备与测试存在；真实状态未通过 | 008 的发布 READY 仍为 accepted=false、installed=false、registered=false、realConversationVerified=false。当前只读查询发现 Edge Native Messaging Host 注册键存在，和 READY 状态不一致；本轮未查看 Edge 扩展页面，不能推断扩展已加载。 |
| ChatGPT Secure MCP Tunnel | 曾做过一次受限试验，材料结果 UNKNOWN，现已断开 | 记录显示试验时 healthz/readyz 为 200、原对话提交过一次请求；没有可见的完整材料返回，包/Manifest 未验证，之后客户端及插件已断开。状态文件是 TRIAL_FINISHED_MATERIAL_UNVERIFIED_DISCONNECTED。 |
| 三方材料一致性 | 未通过 | ChatGPT 转述为 READ_COMPLETE，但未重算 SHA-256；Hermes 是 Agent 报告的字节匹配，缺 Bridge 独立复核；DSH 缺完整包回执。详见材料试验状态文件。 |
| 三方真实双向消息 | 未通过 | 离线模拟收发不等于原生会话真实发送、收到对应回复并持久化证据；当前证据不足以将任一端标成完整 VERIFIED。 |

**原生 UI / 浏览器状态差异：** 当前 Windows Edge 注册表中存在 com.trb.conversation_bridge Native Messaging Host 键，指向候选 Host manifest；但 008 发布 READY 仍报告未注册，且未观测扩展是否安装/启用。应先核对并统一记录，不应把“注册键存在”当成扩展加载或原会话通信成功。

## 3. 当前可复核的阻断问题

### 3.1 010 回归结果不能作为通过

- 010 回归摘要字段 passed=true，但其汇总计数为 0 tests，且包含的 ChatGPT 008 套件记录为 exit code 1、133 项中 122 pass、11 fail。
- 008 回归日志记录固定命名管道 trb-008-station 返回 EADDRINUSE。环境记录称同名管道被已准备的候选服务占用；服务进程仍存在，本次未停止它。
- 回归脚本更新时间晚于该摘要，当前摘要不能代表脚本最新版本的重新运行结果。
- **结论：** 010 回归未通过；passed=true 是错误/过期的汇总信号，不可用于验收。

### 3.2 一小时耐久尚未完成

- 当前修正后的 run run-2026-11-14T06-20-08-816Z，截至本报告快照显示 RUNNING、640 cycles、0 recorded violations；开始于 06:20:08 UTC，尚未达到 3600 秒。
- 较早的 run run-2026-11-14T06-12-27-598Z 最终为 FAILED，记录了 Hermes 回执缺失等问题；它不能被后续运行覆盖或改写。
- 010 的 OPEN_ITEMS.json 仍将 CL10-012 与 CL10-013 标为 OPEN；CLOSEOUT_REPORT.md 却列为已就地关闭，状态源相互冲突。
- evidence/manifest.json、evidence/DELIVERY.json、evidence/READY_FOR_CODEX.json 尚不存在。
- **结论：** 一小时稳定性验收和 010 最终交付均未完成。

### 3.3 原生 Agent 接入的各自门槛

- **ChatGPT：** Tunnel 能传输发往本地 MCP Server 的工具请求与响应；官方文档没有把它描述成向空闲的原 ChatGPT 对话主动注入普通消息的通道。以 Tunnel 直接替代原网页收发不成立，这是依据其 MCP 请求转发机制作出的架构判断。原网页＋受控扩展＋本地 Host 仍是适合验证原对话普通消息收发的候选路线。
- **DSH：** 当前可信来源没有给出可观测的原 Session ID。不能使用标题猜测、读取私密日志或切换/创建会话来伪造绑定。
- **Hermes：** 009 离线实现有验收记录，但生产 Gateway 连续性和原 Session 的可恢复/可持续收发仍是 OPEN_REAL；不能从 Hermes 候选文件或进程存在推断正在工作。

## 4. 建议技术路线

### P0：先修复 010 的证据闭环

1. 保留当前 RUNNING 和既有 FAILED 耐久记录，不删除、不覆盖。
2. 将每次测试的 named pipe 改为每次运行唯一值；所有子进程和测试共享该次运行值。启动前做冲突检查，结束时在 finally 中只清理本次测试自己的资源，不停止用户/候选服务。
3. 修正 regression-all.mjs 汇总器：任一 suite 非零退出码、解析失败或 suite 结果缺失时，必须 passed=false；tests/pass/fail 要从各 suite 汇总；不能以空 failedSuites 得出通过。
4. 在修正后的 runner 上重新运行离线回归并保存新日志、退出码、版本/哈希与生成时间。
5. 只对当前修正版本完成一次不中断的 3600 秒虚构 Adapter 耐久；完成后由验收器复核时长、违规列表、去重/重启/UNKNOWN 指标和真实调用计数全为 0。
6. 统一 OPEN_ITEMS.json 与 CLOSEOUT_REPORT.md 的 CL10-012/013 状态；生成 manifest、DELIVERY 和 READY，READY 保持未被 Codex 接受，直到证据一致且复核完成。

### P1：完成 ChatGPT 原网页真实通道准备与单次验收

1. 先核对 008 的 Edge Host 注册键、manifest、扩展 ID、扩展实际加载状态与 READY 文件，并把差异作为明确问题修复；不修改原会话设置。
2. Hermes 提供可审查的最终安装包、权限范围、停用/卸载与回滚步骤、固定虚构 canary 原文、原会话身份检查和 UNKNOWN/不重发策略。
3. 用户完成必要的 Edge 扩展安装/启用或权限确认后，只做一条经明确授权的虚构普通文字往返。严格验证目标原会话、完整回执及回复、发送次数和时间；发送成功不等于收到，回复内容匹配不等于哈希验证。
4. 如果依靠原页面扩展读取回复，应证明只读取本次目标会话的对应回合，不抓取整段私密历史、不处理草稿、不自动重发。
5. Secure MCP Tunnel 只作为本地 MCP 工具调用通道单独评估；不要将它作为原对话主动收发的替代证明。

### P2：分别关闭 Hermes、DSH 真实通道

- Hermes：按同一原生工程 Session 和正式 Gateway 合同验证入队、投递、原文回执、重启恢复与暂停边界；每个动作绑定 delivery/input ID，未知状态不得重发。
- DSH：先找到官方/稳定接口能返回不可猜测的原 Session ID；如果没有，就保持 BLOCKED_REAL 并报告所需的供应方能力，不用窗口标题或私有日志绕过。
- 两端只有在各自单通道验收通过后，才纳入三方联测。

### P3：完成同包三接收端闭环

对同一 Task 生成一个不可变 Package ID、Version、Snapshot ID 和 Manifest Hash。每端独立返回包身份、清单哈希、收到文件数和校验方式；Bridge 以收到的实际字节重新计算 SHA-256。任一端只能口述、部分读取或返回 UNKNOWN 时，整体保持未验证。新版本必须重新核验，旧审查结果不继承。

## 5. 用户操作和权限闸门

本报告没有安装/启用扩展、恢复任何暂停投递、重连 Tunnel、发送真实会话消息、访问 DSH 私密日志或操作凪。

继续 ChatGPT Edge 真实验收前，需要先向用户展示具体安装包与权限/回滚说明，再确认 Edge 扩展安装及那一条虚构 canary 的授权；账户已登录或 Native Host 注册键存在都不能替代这两个检查。Tunnel 原试验的授权范围已用完，若要重连或再次调用，须另行确认。

本轮尝试查看 Platform Tunnel 设置页时，浏览器安全策略拒绝了页面访问；因此本报告没有声称重新核验当前 Platform / ChatGPT Workspace 关联状态。用户若要继续 Tunnel 路线，可在本地页面确认关联状态后提供截图/结果，或授权一次精确的只读页面检查。

## 6. 本轮变更与复核清单

- 新增：本文件。
- 更新：docs/INDEX.md 增加本报告入口并更新当前入口日期。
- 未修改：应用代码、测试、SQLite、候选交付、Agent Session、Agent 私有日志、密钥、队列和运行进程。
- 未运行：测试、耐久任务、真实 Adapter 或投递操作。
- 工程根目录 D:\TriReviewBridge 当前不是 Git worktree；因此本报告没有可引用的根级 Git HEAD，候选包各自的 manifest/哈希记录不能替代统一 Git 状态。

## 7. 主要证据入口

- [项目收口待办](../candidates/project-closeout-010/OPEN_ITEMS.json)
- [项目收口报告](../candidates/project-closeout-010/docs/CLOSEOUT_REPORT.md)
- [010 回归摘要](../candidates/project-closeout-010/evidence/regression/summary.json)
- [008 回归失败日志](../candidates/project-closeout-010/evidence/regression/regression-chatgpt-real-web-008.txt)
- [010 当前一小时耐久状态](../candidates/project-closeout-010/evidence/durability/run-2026-11-14T06-20-08-816Z/summary.json)
- [008 发布 READY](../candidates/chatgpt-real-web-008/evidence/READY_FOR_CODEX_RELEASE.json)
- [Tunnel 试验状态](../evidence/secure-mcp-canary-001/connection-state.json)
- [Tunnel 原试验范围与结果](../candidates/project-closure-006/TASK.md)
- [三方材料试验状态](real-material-canary-001/DELIVERY_STATUS.md)
- [离线完成报告](offline-completion/DELIVERY_REPORT.md)
- [OpenAI Secure MCP Tunnel 官方说明](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)

## 8. 增量核验与 Codex 收口结论（2026-11-14 08:19:53 UTC）

本节更新并取代第 3.1、3.2 节中关于 010“回归摘要为空、一小时耐久仍运行、最终文件缺失”的 07:18 快照状态。

- Hermes 已在 07:50 UTC 生成 010 的 READY、DELIVERY 和 Manifest。READY 仍保持 accepted=false；Codex 独立验收记录已写入 [CODEX_REVIEW_FINAL.md](../evidence/hermes-implementation-010/CODEX_REVIEW_FINAL.md) 和 [acceptance-final.json](../evidence/hermes-implementation-010/acceptance-final.json)。
- 修正后的一小时虚构 Adapter 耐久现为 COMPLETED：3610.421 秒、658 cycles、0 problems、0 violations、真实 Adapter/model/cron 均为 0。较早失败 run 保留为历史证据。
- Manifest 的 61 个条目全部重新计算 SHA-256，缺失/越界/漂移为 0；READY 对 Manifest、DELIVERY、OPEN_ITEMS 的哈希绑定匹配。
- 最新回归摘要包含 412 项统计：376 pass、11 fail、25 skipped。唯一失败套件是 008，因现存服务占用固定 named pipe；该项明确列为 contentionAccepted，008 non-pipe subset 115/115 通过，且 008 预安装包此前已有 Codex 133/133 离线接受记录。因此本次结论是“离线收口通过，附环境争用”，不是“严格全套零失败”。
- CL10-012/013 已统一为 ACCEPTED_OFFLINE。010 候选包已按本次 Codex 离线验收通过。
- 项目未因此完成真实三方连接：CL10-003/006/008/010 仍 OPEN_REAL，CL10-011 仍 BLOCKED_REAL。不能将本次耐久或离线接受当作真实 Agent 连续性、Edge 安装、Tunnel 调用或材料互通证明。
- 本增量只写入 Codex 验收证据并更新本报告；没有改代码/测试、运行额外测试、停止现有服务、恢复投递、连接 Tunnel 或操作任何 Agent 原会话。

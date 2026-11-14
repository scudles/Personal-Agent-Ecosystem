# ChatGPT 原会话临时 Codex 接力交付

日期：2026-11-13。负责人：Codex。MAG-001 / L2，一名独立只读复核者。用户已明确改为先使用临时接力，账号可登录后继续原独立路线。

## 现在能用的部分

入口：`D:\TriReviewBridge\打开ChatGPT接力工作台.cmd`，已启动原生 WPF 窗口。新模式为 CODEX_RELAY，独立 data/codex-relay-001，旧 SIM 入口、队列、绑定和暂停保留。

用户在新窗口选择 ChatGPT，发送自然语言或纯文字任务；Codex只将原文提交至原对话「Nagi（继承的你1）」，再把该回合的原回复放回工作台。不新建、重置或替换会话，不修改模型和私有记忆。临时模式只接 ChatGPT，Hermes/DSH显示未接入。

已建立本 Codex 任务的每5分钟 heartbeat：`trireviewbridge-chatgpt`，ACTIVE，关联本任务 01a1cb8a-639f-7ac1-8027-f1dd2317f83c。已核对任务登记和本地配置；首个真正定时触发尚未观察，不把登记成功当成长期自动运行验证。保持Codex应用、任务权限和可用额度；队列空时不读原对话，最多处理3条新消息后结束。不依赖用户逐条复制传话。

## 实际验证

| 验证 | 结果与范围 |
| --- | --- |
| Relay 后端原定向状态/范围测试 | 冻结后端14项通过；后续未改后端 |
| 最终非TTY worker/executor | 18/18、exit0，含固定spool/junction拒绝、Unicode、原生参数20000上限、19999成功/20000拒收；模拟原生工具，不是原会话测试 |
| 原生WPF接力界面与假Host | 2/2，通过；没有真实会话操作 |
| 真实本机Node Host启动器 | 1/1，通过；首启、排队、暂停重开、重启保留及未知旧文件拒绝；没有真实会话操作 |
| 当前源码对旧SIM原生集成回归 | 1/1，通过；未替换旧稳定exe |
| 独立只读复核 | 原发送前状态P1、spool P1均关闭；最终API/cap专项PASS，无本轮未解决P0/P1；复核者未运行真实会话，也未重跑实现方18项测试 |
| 原ChatGPT真实文字闭环 | 1次成功、仅1次提交、attempts=1；同一原生回合收回原文，COMPLETED；不是三方/附件/长期稳定性验收 |

真实虚构题为7颗蓝珠+8颗绿珠；原回复给出15颗并保留本次标识（Markdown转义按原文保留）。原生回合 c1295052-2907-4e77-a487-acadd073d95c，回复51b6d358-91e4-4e42-9168-129ddf84bf04。第一次提交前的ConPTY与参数错误均停止在begin前，未发送。最终实际服务队列QUEUED/SUBMITTED/UNKNOWN均0，COMPLETED=1。

来源标为 WORKER_REPORTED_FIRST_PARTY_THREAD_READ；simulation=false，工具活动NOT_OBSERVED，完整工具轨迹/独立来源认证均false。请求与回复SHA只证明记录文本完整性，不能证明完整原生工具活动或Agent私有状态。

## 修改与复用

- 复用 CollaborationCore、Node本机鉴权API、SQLite、原消息/文字任务模型、WPF原生界面与已存在第一方原对话工具。
- 后端新增src/relay-core.mjs、relay-http.mjs、relay-intent.mjs；workbench-server.mjs条件启用新profile，不替换SIM。
- desktop/RelayPresentation.cs及WorkbenchApp、UxPresentation、UxTheme、DraftStore、UxWindow、csproj只作模式识别/状态和功能边界，仍使用WPF原生控件。
- 新启动/构建脚本scripts/open-codex-relay-workbench.mjs/.ps1、build-codex-relay-desktop.ps1，新CMD及独立runtime/codex-relay-001 exe；旧runtime/native exe保留。
- tools/codex-relay-001/worker.mjs、executor.js、test.mjs提供固定本机RPC与接力，非TTY，Unicode作为base64url数据，不拼接成可执行正文；测试另有test/codex-relay-001.test.mjs及既有桌面测试脚本。
- 文档与证据见本目录和evidence/codex-relay-001；全部最终源码hash见SOURCE_MANIFEST.json。

## 数据与回滚

没有迁移或修改唯一旧生产数据库；新模式使用新relay-workbench.sqlite，新增接力队列/回执/worker状态。普通请求先耐久登记后发送；UNKNOWN不自动重发，暂停、取消、过期及迟到回复保留。只允许固定原对话的一处绑定。

回退时在Codex自动化中暂停「TriReviewBridge · ChatGPT临时接力」，关闭新窗口并保留新profile和审计；继续使用旧SIM入口。不要删除未决消息、恢复旧暂停或切换通道补发。后续独立通道先实际验证，再核对在途状态和迁移。

## 未完成与风险

- 周期唤醒仅已登记；尚无首个自动唤醒和该模式一小时耐久证据，旧离线一小时证据不覆盖它。
- 依赖Codex在线/唤醒、工具权限及额度；不是Node/WPF独立常驻。5分钟检查另加原ChatGPT响应时间。
- 原生读取每段最多20000字符；达到上限/截断时不收为完整回复，保留在途待核，不静默丢弃或自动重发。
- 正式审批、用户实施授权、附件自动交付、工程材料完整性认证、自主Agent链继续锁定；纯文字任务后台/界面已仿真验证，真实本次只测普通对话。
- Hermes/DSH的工作台日常真实接入、三方字节一致性、六向完整30次验收与原ChatGPT独立MCP路线仍未完成。
- 历史消息查询当前1000条上限未做分页升级，另记长期使用改进；不扩大本次接力范围。

本轮没有修改/启动凪，没有新建或重置原会话，没有恢复旧真实投递或处理DeepSeek草稿。

证据：[实际真实闭环](../../evidence/codex-relay-001/real-canary-completed.json)、[最终18项测试](../../evidence/codex-relay-001/plain-rpc-final-tests.txt)、[发布状态](../../evidence/codex-relay-001/RELEASE.json)、[操作说明](OPERATIONS.md)、[专项复核记录](REVIEW_RECORD.md)。
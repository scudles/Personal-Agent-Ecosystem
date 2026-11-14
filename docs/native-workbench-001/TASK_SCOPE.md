# TRB-NATIVE-WORKBENCH-001 本阶段范围

2026-11-13。负责人Codex。MAG-001 L2，一名必要独立只读复核；不默认三方会审。用户在了解剩余缺口后明确“开始推进”，承接先前并行实施授权。

## 交付范围

新隔离 HYBRID_NATIVE / hybrid-native-001 工作台候选（127.0.0.1:48738、hybrid-workbench.sqlite）。保持旧SIM、现有48737 ChatGPT接力与原队列/暂停，禁止恢复旧pending或处理旧DSH草稿。新三角色默认PAUSED/UNVERIFIED，只绑定用户此前指定的原Session引用，不创建或替代原会话。

复用现有Node/SQLite/CollaborationCore、WPF三栏/深色界面与接力状态机。先做普通定向文字和纯文字任务（唯一负责人、独立回复、用户验收结果），不开放正式审批、自动实施授权、附件自动上传或自主传话链。Hermes候选仅固定Gateway、自己的input/admission终态回执；DSH安全候选没有真实桌面验证，保持明确UNSUPPORTED，不把只读标题核对冒充独立Session UUID认证。

## 并行分工

- codex_relay_backend：新hybrid业务/HTTP/意图与虚构隔离测试。
- codex_relay_ui：新原生WPF界面、独立启动器、假Host和隔离Node Host测试。
- native_channel：受限Hermes Gateway worker、DSH能力边界、虚构通道测试。
- root：真实ChatGPT纯文字任务验收、历史分页、集成、冻结证据与最终必要复核。

## 已观察的本轮事实

- ChatGPT原对话纯文字任务已完成一次真实闭环。任务1b52ff38-2f67-4890-bd37-0ee0c7860990，虚构纸张总数12，attempts=1，COMPLETED，awaiting_user_acceptance；source为worker回报的第一方工具读取，toolActivity未观察、executionAuthorized=false。不是三方链或工程审批验证。
- 原ChatGPT接力5分钟heartbeat已实际触发过，空队列正常；期间为一次受控任务测试暂时暂停，任务完成后恢复ACTIVE。触发证据在当前Codex任务的heartbeat结果；不冒称一小时耐久。
- DSH允许的ComputerUse只读检查：唯一窗口「主进度 — DeepSeek Harness」、输入树无值、发送按钮disabled、无停止生成控件、可见旧TRB_REAL_LINK锚点；未观察原生Session UUID。0点击、0输入、0提交，未读取原日志或凪目录，不把此当C#安全候选实测。
- 历史分页：Workbench默认最新1000条保持正序；messagePage使用(project/workspace,created_at,id)游标取更早消息，scope错误/跨项目cursor/非法limit拒绝。4项新测试与原Workbench/flows/relay回归共41/41通过，exit0。首轮失败是虚构夹具误复用了全局message id，修正夹具后重跑，未隐瞒失败。

## 数据/安全与回滚

新profile新增独立业务表，不迁移唯一旧生产数据库。历史分页仅查询改动，无Schema变化，旧workbench源码备份backups/native-workbench-001/workbench.before.mjs。不恢复旧暂停；UNKNOWN只读核对、不自动重发。新后台真实角色启用必须明示范围并通过实际身份核验，owner自己填期待session/title不能变成已观察验证。

私密读取范围不能静默扩大：早先Hermes/DSH日志授权覆盖固定canary/封存六向批次，不自动成为新日常worker读取全部历史的通行证。Hermes inspect/resume会在内存接触原snapshot，include_result会接触本次完整结果；源代码和fake通过不等于已获广泛权限或真实接通。真实运行前先完成候选复核，按实际范围处理明确授权，工具审查不绕过。

本阶段尚在实现/集成，未宣称HYBRID真实三方已可用。最终功能、测试与尚未验证项目另列DELIVERY_REPORT.md。
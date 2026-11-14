2026-11-14 最新优先级：用户要求Hermes/DSH先并行推进，ChatGPT等回家加载Edge。新增TRB-HERMES-DSH-CONTINUITY-009，Hermes实施、Codex验收，可分不重叠子任务并行；任务见candidates/hermes-dsh-continuity-009/TASK.md。先复用005/007/008完成独立常驻适配与虚构闭环，真实会话/私密数据/权限副作用仍按具体方案确认。ChatGPT008新验证队列继续暂停，禁止009使用trb-008-station或修改其库/token/进程，不恢复旧队列或定时接力，不动凪。

2026-11-14：007离线最终验收PASS（evidence/hermes-implementation-007/acceptance-final.json），不代表生产接通。按用户已指定的后续优先级启动 TRB-CHATGPT-REAL-WEB-008，Hermes在candidates/chatgpt-real-web-008准备原网页＋受控扩展＋独立常驻host的具体安装/权限包，Codex验收。实际安装/注册/登录/共享权限仍需用户具体确认；原ChatGPT ID不变，不新建重置、不恢复定时接力、不动凪。

2026-11-14 后续优先级：007一小时经Codex验收通过后，Hermes优先验证“ChatGPT同一原对话网页＋受控扩展＋独立本地常驻程序”真实自动收发。扩展安装/实际注册/登录或共享权限须具体说明并由用户确认；不新建/重置/分支原会话、不恢复定时接力、不动凪。详见evidence/hermes-implementation-007/CHATGPT_NEXT_PRIORITY.md。

2026-11-14 最新顺序：用户已授权“007一小时先由Codex验收，通过后由Hermes继续三方原会话真实收发及材料互通”，可并行。当前仅材料小时harness证据待修，映射/短链及通信小时保留已通过结论；前置验收未过不启动真实操作。具体登录/密钥输入/扩展或共享权限等必要用户动作再提出；不把后续目标授权解释为任意凭证读取、旧队列恢复或模型/原会话变更。不新建/重置原会话、不恢复定时接力、不动凪。记录见evidence/hermes-implementation-007/next-real-stage-authorization.json。

2026-11-13 最新明确授权：Hermes继续第1项独立持续连接与第4项版本化工程材料互通，可自行分配子智能体并行；Codex验收。005/006原Issue修复继续，不重开004。新增材料接线范围为 candidates/continuity-materials-007，详见其TASK.md；只在候选和虚构材料完成工程，生产会话/草稿/凭证/凪及实际安装重连仍按既有具体闸门。禁止定时Codex/模型接力，仅最终交付的一次性文件事件通知。

当前工程分工：用户已指定原生Hermes实施、Codex验收，并批准剩余技术路线开工。TRB-WORKBENCH-INTEGRATION-004 在 candidates/workbench-integration-004 继续补齐既有问题，按 CODEX_REMAINING_WORK.md 定向验收，不重新全量审查。用户随后新增授权 TRB-MESSAGE-STATION-005：在 candidates/message-station-005 实现独立常驻收发站及专用Gateway/桌面/浏览器适配器，复用事件宿主，不另建队列或Runtime；详细范围见该目录TASK.md。Hermes按依赖顺序推进，不能用005覆盖或放弃004。004候选内HybridCore副本的常规隔离改动已有授权，不能仅因类曾验收而再请求用户许可。Codex核验各冻结版本代码/测试/证据后再决定推广。三方生产原会话、暂停、草稿、模型与凪不动，不恢复定时模型接力；005实际运行限虚构SDK/自有fixture窗口/虚构网页，真实试投、扩展安装、账号登录、原会话承载变化仍单独设闸门。

上阶段TRB-NATIVE-CONTINUITY-003修订2已通过隔离事件宿主原型验收，详见evidence/hermes-implementation-003/ACCEPTANCE_ROUND2.md；003候选与证据保留，不继续在那里写代码或重新全量审查。不得把本次独立Hermes工程Session注册成生产Nagi绑定。

当前用户决定：禁止以定时唤醒Codex/模型维持连续会话。原定时接力已删除，ChatGPT/DSH投递已暂停；独立常驻接入尚未实现。权威需求见docs/native-workbench-001/CONTINUITY_REQUIREMENTS.md，旧接力记录仅作历史证据。

# TriReviewBridge 工程协作入口

2026-11-13最新用户决定：先用Codex接力指定原ChatGPT对话，登录后再继续独立方案。仅隔离CODEX_RELAY/codex-relay-001文字通道获授权；旧真实队列/暂停不恢复，不操作Hermes/DSH/草稿或凪。事实、hash与定时接力边界见docs/codex-relay-001/DELIVERY_REPORT.md。下文早期未授权描述按当时阶段解读，不覆盖最新明确决定。

先读取治理的 governance/active.json、GOVERNANCE_OVERVIEW.md 和权威 PROTECTED_RULES.md。初始正式生效版本为 MAG-001，后续以按正式流程确认的版本为准。

- 每个独立Task只有一名最终负责人。一个Agent完成、一名必要复核者、第三方按需；L0自测即可，按L0-L3确定必要审查，不默认三方。
- 正常工程交付仅未解决P0/P1阻断；P2/P3保留为建议/技术债。原则两轮；无新证据、实质修改或重大风险不重新全量审查。
- 冻结目标、范围、验收。新需求另建Task；已关闭Issue按原ID和重开依据处理，不换说法重复提出。
- 普通工程任务不修改治理规则。正式修订必须说明旧规则/目的/影响，形成记录，等用户明确确认，发布新版本并保留旧版。
- 用户请求与规则冲突时，提醒包含当前要求、条款、工程后果、合规替代。不要用关键词将引用/示例误判为违规。
- Agent原平台、会话、Runtime、模型、工具、人格和私有记忆保持独立。Codex不冒充ChatGPT Observer，模拟不冒充真实三方。
- 当前真实Hermes/DSH/ChatGPT投递硬锁/暂停；未经独立明确授权不读取/操作其原会话、上传附件、解除暂停、清理或重发DeepSeek草稿。
- 不启动凪，不改凪代码/配置/运行数据。自动测试只能使用虚构项目/材料。无公网、手机、工程写入或任意命令执行新能力。
- UEC-001已获用户确认离线Phase 1/2，见docs/engineering-context-001/EXECUTION_STATUS.md；后续真实接收/附件仍未授权。旧snapshots/附件hash声明不等于工程文件包。
- Guard目前是结构化assessment接口，旧业务入口未全面强制接入；独立复核未执行时明确标注，不拿自测代替外部复核，不拿READY代替授权。

操作与证据入口：docs/INDEX.md、governance/DELIVERY_REPORT.md、docs/engineering-context-001/README.md。
当前离线候选入口：docs/offline-completion/DELIVERY_REPORT.md；新版WPF为desktop/OfflineWindow.xaml和runtime/native/TriReviewBridge.Offline.exe，旧MainWindow.xaml及旧exe保留。工程治理入口已接SQLite强制Host，普通文字审批不替代工程治理；未知自然语义不猜测。真实原会话仍硬锁。独立只读复核与实现方自测/耐久分开；以evidence/offline-completion-verification.json及源码哈希核对当前验收，不将RUNNING或旧版本两小时证据当通过。

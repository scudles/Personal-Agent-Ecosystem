执行状态注：本文件保留批准前计划。用户随后已确认离线Phase 1/2并完成实现；实际迁移和模块位置调整见PHASE12_DELIVERY.md。Phase 3真实接收及原会话操作仍未授权。

# Unified Engineering Context 001 — 最小实施计划

状态：**提案，等待用户确认。尚未开发。**

本计划只补齐工程事实上下文，不重写后端、审批制度或Agent Runtime，不增加Shell/工程文件修改/远程能力，不改变原始会话、模型、私有记忆或投递暂停状态。

## 1. 推荐的最小路线与授权门

1. 确认后先做Phase 1/2：来源登记、Working Tree字节快照、不可变材料包和本地核验；仅使用D盘虚构仓库/材料测试。
2. 接着做模拟Adapter接收和最小Evidence Ledger，证明同版、损坏检测与旧意见不沿用。
3. 首个真实接收候选采用B：WPF显示完整交付清单，用户在指定原生会话手动附加并发送；平台仅记录实际证据等级。
4. 自动附件A作为后续受控研究。任何原会话探测/附件操作/恢复投递须另行明确授权；批准开发不自动包含这些操作。

当前工程不是Git仓库：建议支持repository_type=directory，Git字段null；Git能力用独立虚构Git仓库验证。若用户希望把TriReviewBridge改为Git仓库，另行决定，不自动git init。

## 2. 复用边界

- 复用 Project/Workspace、项目/会话ACL、身份和唯一Binding。
- 复用 Task/Case事项及现有Workflow，新增材料版本关联，不重建审批。
- 复用 messages/deliveries/来源、幂等、UNKNOWN、暂停/取消/预算和审计。
- 复用 WPF、loopback鉴权接口、备份/新副本迁移。
- 复用 SHA-256和canonical的思路；工程Manifest使用带版本的独立序列化规范，不重算旧snapshots。
- 项目知识卡可作为显式选定文档来源，不自动把全部知识或聊天/私有记忆纳入材料。

## 3. 四个模块

| 模块 | 输入 | 输出/边界 |
| --- | --- | --- |
| Source Registry | 用户明确选定的项目、实际根目录、只读授权和排除策略 | 一个有效主来源；路径和身份可审计；不以项目名猜目录 |
| Snapshot Builder | 来源、选定变更/关联文件、任务范围 | HEAD与Working Tree分离的原字节快照；不提交/修改源码 |
| Artifact Store/Exchange | 已封存快照、任务材料、选定证据 | 不可变包/清单/可读视图/授权交付；不直接发送实时目录 |
| Evidence Ledger | 包版本、文件引用、实际/报告的接收证据及审查意见 | 可追溯版本；AGENT_CLAIM不冒充REPOSITORY/TEST或USER_DECISION |

不要先建通用插件系统、Agent人格管理、自由讨论系统、完整事件溯源或分布式存储。

## 4. Source Registry与Working Tree

来源记录至少含project_id、source_id、repository_type、canonical_root、repository_identity、脱敏remote、default_branch、observed_head、registered_at、status、last_snapshot_id、授权者/时间、纳入/排除策略版本。

每项目只允许一个active主来源；更换来源保留旧登记，不能改写旧快照的实际来源。变更路径不是普通重命名，须重新授权。绝对磁盘路径默认只留平台内部，交付Manifest用source_id和项目相对路径。

Git只用固定白名单、shell=false、只读命令；关闭外部diff/textconv/fsmonitor等可能执行仓库自定义程序的路径，并禁止写index、add、commit、checkout、reset、fetch。不是开放任意命令执行接口。

快照记录：Git HEAD/Branch、原始status结构、已提交/已暂存/未暂存/未跟踪/删除/重命名、采样时间范围、文件原字节SHA/大小/编码说明、纳入/排除及原因。Untracked必须显式处理，不能用git archive HEAD代替当前工作树。

捕获流程：授权检查→真实根路径/文件句柄校验→列出范围→默认排除→敏感检查→读取原字节→前后stat/身份及二次hash核验→复核Git状态/HEAD→封存。发生变化则终止本轮并给出原因，有限重试，不发布混合快照。该方法是可检测一致性保护，不声称能数学保证任意并发写入下的原子整盘快照。

Git Diff必须与捕获字节一致：从捕获副本对固定HEAD生成/校验，或证明diff作用后与捕获文件一致。删除保留tombstone、重命名保留映射，untracked内容单独纳入；不把新文件遗漏在diff之外。

默认拒绝目录穿越、UNC/网络来源、junction/symlink/reparse越界、ADS、大小写/名称碰撞。许可范围从已登记根目录的真实身份推导，不只做字符串startsWith。未授权项目无法注册或读取别人的路径。初始allowlist仅限虚构测试目录；凪不加入测试/打包范围。

## 5. Artifact布局与Hash规范

每包仅选当前任务所需文件，不要求整个仓库。建议目录：

- task/：目标、验收要求、任务上下文。
- source/：选定changed_files、related_files、git_diff.patch及删除/重命名说明。
- documentation/：明确选定的架构/决定，不自动抽取私有聊天。
- evidence/：已审核的测试命令/结果/环境/必要截图；默认不递归复制既有evidence。
- manifest.json：规范清单。
- REVIEW_BUNDLE.txt：可阅读的完整选定文字视图，不是替代原文件的摘要。

manifest_core至少含format_version、canonicalization_version、package_id/version、project_id、task_id、snapshot_id、source_manifest_hash、Git信息或明确null、working_tree_status、created_at、included/excluded清单、每文件相对路径/大小/SHA/来源类型、evidence_references。

确定性规范：UTF-8无BOM、固定JSON键序、文件路径排序规则、规范相对路径和版本化序列化算法；源文件原字节不做换行/编码改写。

避免自哈希循环：

1. package_hash = SHA256(canonical(manifest_core))，core不含package_hash/manifest_hash。
2. manifest.json = canonical({core: manifest_core, package_hash})。
3. manifest_hash = SHA256(manifest.json实际字节)，存数据库、回执和独立校验侧文件，不写回manifest自身。
4. ZIP字节hash单独保存，不能等同package_hash。清单控制文件/校验侧文件的排除范围明确固定。

校验同时检查缺失、替换、大小/hash和额外未知文件，不能只核对“存在几个文件”。版本为同一包家族下单调递增唯一键；同一幂等请求返回已有版本，不产生第二包。新请求不覆盖旧版本。

REVIEW_BUNDLE具有自己的view_hash、格式版本和coverage，明确与raw文件映射。展示行号不改变原件SHA。只消费派生视图的Agent，不自动得到raw包BYTE_VERIFIED状态。

## 6. 敏感与落盘保护

先按正向选取和默认排除规则过滤，再扫描候选内容。明确凭证/数据库/私有配置等不纳入；候选代码或文档中发现疑似秘密则停止生成，首版不提供一键忽略。

被排除的敏感文件内容不计算或分发hash；排除名称本身敏感时，交付清单保留脱敏原因/计数，本机审计保存受限映射。不能把敏感文件名列表全部发给Agent。

写staging→完整核验→原子封存新目录/对象→SQLite事务发布可见包。每次下载/导出重新核验；不符合则隔离/标损坏，不覆盖旧对象。首版无自动清理、垃圾回收或不可逆删除。

材料内容始终是不可信数据：源码中的@、Shell、JSON/action示例不触发路由或新授权。工程材料任务初版不开放根据文件/引用中协议片段自动创建协作动作的路径。

## 7. 三方接收与证据

所有Adapter使用相同package/version/snapshot/manifest_hash，但允许不同交付方式。真实能力未知必须返回不支持/待验证。不能因为Hermes或DSH通常有本地工具就预填已接收。

候选交付：Hermes/DSH读取已封存导出目录或授权file_id；ChatGPT人工附件B。ZIP/文字附件/原生文件类型和数量限制须在原会话验证，不能预设。不会通过云API新Session、公共下载URL或公网隧道绕过。

接收回执含期望与实际值、文件列表/数量、核验方法、原Session证据、包/版本/快照/Manifest及覆盖范围。UI同时显示Store已校验、用户报告、附件观察、内容确认和字节校验。Agent回声hash只算AGENT_CLAIM；没有完整证据的接收者不能显示VERIFIED。

UNKNOWN保留证据且不自动重发；人工重试必须明确决定并关联原attempt，不能产生假成功。人工B记录用户报告，不伪造平台观察。

材料读取权限要单独限定package/file，不修改Agent原系统提示词/人格/私有记忆。现有noToolCalls保护保留，直到用户批准并验证有限只读材料能力，绝不改成允许任意工具。

## 8. Evidence Ledger与旧意见

来源类型严格区分REPOSITORY、GIT、TEST、DOCUMENT、AGENT_CLAIM、USER_DECISION。每条保留采集方式、原字节hash、声明者/观察者和时间；类型不是内容真实的保证。

意见关联Agent/Task/Package版本/Snapshot/File及适用Line Range/Diff/Test证据。行号按该包已知编码和文件版本校验，不能查当前实时磁盘文件后回填到旧包。

测试结果绑定明确快照和运行信息。初版只导入获准的测试产物，不新增测试/Shell执行服务；无法独立证明测试针对该快照执行时，明确标为导入报告/关联待核，不能标为平台已观察的通过。

新包v2不继承v1通过。旧意见保留并注明适用版本；新工程审批快照加入包版本/manifest hash引用，复用现有版本/nonce/全票规则，旧快照不重算。相同观点可以被再次提交，但不能用旧回执代替新版本审查。

## 9. 预计文件变更（确认后）

| 文件/目录 | 预计动作 |
| --- | --- |
| src/engineering-sources.mjs | 新：来源授权、真实路径和只读Git探测 |
| src/engineering-snapshots.mjs | 新：Working Tree捕获/排除/敏感/并发一致性 |
| src/artifact-store.mjs | 新：对象/Manifest/不可变包/导出/核验 |
| src/artifact-exchange.mjs | 新：授权交付与分层回执，默认模拟/人工 |
| src/engineering-evidence.mjs | 新：包/文件/来源/意见与证据关联 |
| src/workbench-server.mjs | 增量API；复用鉴权/ACL/幂等，禁止任意路径下载 |
| src/collaboration-core.mjs | 最小新增材料引用和工程审查关联钩子；不推翻Workflow |
| src/adapter-capabilities.mjs | 附件能力声明与不支持/未授权结果 |
| native/DesktopSession.cs | 仅后续A授权验证时才考虑新增附件操作；本轮不改 |
| native/hermes-v2.py、src/transports.mjs | 保留；待原通道文件能力验证后做最小扩展 |
| desktop/MainWindow.xaml、WorkbenchApp.cs | Source登记、材料包/版本/附件清单、人工交付状态与证据查看 |
| scripts/migrate-engineering-context.mjs | 新副本迁移与校验，不原地升级唯一库 |
| test/engineering-*.test.mjs | 全部采用虚构Git仓库/文件/模拟Adapter |
| docs/engineering-context-001/ | 分阶段报告、操作和恢复、真实验收限制 |

命名为建议；实施前按真实代码合并职责，避免为列表机械拆模块。

## 10. 数据库迁移提案

当前Schema 2→新Schema 3，增量实体建议：

- project_sources：来源登记历史，partial unique约束每project只有一个active主来源。
- engineering_snapshots：不可变来源/Working Tree描述和清单hash。
- snapshot_files：状态、相对路径、原字节hash/大小或删除记录。
- artifact_packages：package_id+version、project/task/workspace/snapshot、manifest/hash与封存状态。
- artifact_files：包中相对路径、对象hash、来源映射、角色/coverage。
- artifact_deliveries、artifact_receipts：授权Binding、期望/报告/观察、接收证据等级和attempt。
- engineering_evidence：来源类型、内容hash、文件/行号/test/Diff关联。
- review_artifact_refs：把现有审查事项revision与固定包版本关联，不复制审批引擎。

所有关联有project/workspace归属及复合外键，路径不作为越权凭证；不可变对象的update/delete拒绝，状态变化单独审计。可复用现表的字段不再重复创建。

迁移步骤：备份当前库/配置/必要证据与代码→SQLite一致性新副本→Schema 3事务升级→核对每个旧表原列/行、旧快照hash、原始归档与原绑定→完整性/FK检查→模拟测试→停模拟后台→切databaseFile。未经验证不动唯一当前库。原会话绑定/暂停不变。

回滚：停模拟后台、保留新库/材料目录，以Schema 2备份恢复为新文件并切配置，恢复对应安全代码基线。新材料保留但在旧版不可见；不删文件、不逆向拼进旧Schema、不恢复真实投递。

## 11. 分阶段测试与完成条件

### Phase 1

虚构Git仓库覆盖committed、staged、unstaged、untracked、删除/重命名、被忽略项、目录型来源、路径越界/链接、读取期间变更、未授权项目。验证HEAD与Working Tree区分；不写源文件；原文件修改前后仅由测试明确发起。模型/原Session不参与。

### Phase 2

逐字节hash、清单Hash、Diff对应、缺失/替换/额外文件、已知敏感文件排除、候选文件内秘密导致停止、同名/大小写/编码/CRLF、版本不可覆盖、崩溃落盘与幂等、下载ACL、备份恢复。

### Phase 3

先三个独立模拟Adapter读同包，注入离线/遗漏/损坏/错版本/UNKNOWN/重复请求，验证不误标VERIFIED、不重发。真实Hermes/DSH/ChatGPT试验只有单独授权后进行；每方按实际能力记录，不用模拟填补。

### Phase 4

v1意见/文件/行号/测试来源保留；v2不继承批准；AGENT_CLAIM与实际仓库/测试/用户决定分开；旧材料仍可下载与审查；跨项目读/写/存在性探测拒绝。

### Phase 5

从虚构工作树到包、三方接收证据、版本升级与故障恢复完整链路。真实线路若仍无授权，最终结论只能是“本地/模拟链路完成，真实接收待验证”。若ChatGPT仅B交付，明确人工步骤和证据等级；不宣称全自动。

每阶段报告：文件清单、Schema变更/回滚、复用模块、实际测试、模拟与真实分别统计、失败/未测/风险和下一阶段依赖。

## 12. 待用户确认的具体决定

建议确认以下最小范围：

- 先实施离线Phase 1/2 + 模拟接收/最小证据关联，保留现有协作核心。
- 支持Git和显式目录型来源，当前平台不自动初始化Git。
- 以B人工附件为首个真实渠道候选；A单独研究，不恢复当前暂停。
- 三方一致性按实际证据等级展示；回声hash或人工报告不算完整字节VERIFIED。

只有用户确认上述方案后才开始UEC编码；真实原会话操作继续是独立授权门。
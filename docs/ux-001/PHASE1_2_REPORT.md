# UX-001 Phase 1 / 2 实施与自检报告

日期：2026-11-12。Task：TRB-UX-001。唯一工程负责人：Codex /root。本文记录三栏布局、消息与统一输入的阶段结果；MAG-001 ACTIVE、真实会话暂停 / 硬锁及原草稿保护保持。本文不是最终验收声明，最终候选源码 / 二进制哈希及完整回归由负责人更新交付记录。

## 已实现的布局与输入

新增 `desktop/UxWindow.xaml`，旧 `OfflineWindow.xaml` / `MainWindow.xaml` 保留。左栏224逻辑单位，承载项目树、项目 / 会话新增及可展开管理；中栏自适应，保留对话、任务与审批、工程材料、治理与证据四个Tab的顺序；右栏270逻辑单位，承载当前会话的参与者、任务、材料版本及审查 / 阻断 / 授权摘要。新增 `ContextPanel` / `ContextColumn` / `ContextToggleButton`，由集成代码管理展开、收起及窄窗折叠。异常条 `AttentionBanner` 位于三栏之外，收起右栏不会同时收起异常提醒。

顶部收拢为名称、当前项目 / 会话、刷新、上下文开关和设置 / 窗口入口。暂停当前会话保持中栏上方可见；模拟接入暂停保留在“设置与窗口”。没有添加假在线状态、通用附件上传或真实Agent收件入口。

消息列表保留 `AuthorLabel`、`Body`、`TimeLabel`、`StateLabel`、`Technical` 绑定。正文15号、行高25；发言者与时间分层显示，弱化卡片边框，选中消息有明确边线。来源与投递技术文本默认折叠，选中消息仍可经“选中消息与草稿操作”回复、保留来源转交、创建文字任务、正式审批及查看完整详情。显示状态与消息原文由原业务数据 / 集成呈现层提供，XAML不把提交、收到、完成或实施授权互相替代。

统一输入区集中接收方、多行正文、引用提示、授权知识版本、执行反馈和发送。接收方为原 `RecipientList` 多选控件，选中态有边线与底色；正文 / 引用 / 代码里的姓名提及不在布局层触发路由。`ReplyBanner` 保留取消引用入口；`IntentStatusText` 承接集成层的执行 / 未执行提示；Ctrl+Enter提示与旧键盘路径保持。知识按钮只引用已授权知识版本，工程材料仍走既有材料页，不冒称上传附件。

## 原控件与57个按钮的可达核对

对当前XAML和旧 `OfflineWindow.xaml` 进行XML节点比对：原75个命名控件全部保留，名称和类型变化0；原56个命名Button全部保留，另新增上下文开关，共57个。四Tab顺序保持。没有 `ContextMenu` 名称域迁移或XAML直接事件Handler，旧 `FindName` / `C<T>` / Hook合同仍可复用。下表覆盖57个命名Button；能力细目继续见 [UI_COMPONENT_MAP.md](UI_COMPONENT_MAP.md)。

| 入口与显示条件 | 数量 | 命名Button |
|---|---:|---|
| 顶部直接显示 | 2 | RefreshButton、ContextToggleButton |
| 展开“设置与窗口” | 5 | NewWindowButton、CloseWindowButton、StopBackendButton、BindButton、PauseBindingButton |
| 左栏直接显示 | 2 | NewProjectButton、NewWorkspaceButton |
| 展开“项目与会话管理” | 6 | RenameProjectButton、ProjectSettingsButton、KnowledgeButton、ArchiveProjectButton、RenameWorkspaceButton、ArchiveWorkspaceButton |
| 中栏直接显示 | 1 | PauseWorkspaceButton |
| 对话页：已进入回复状态时引用条显示 | 1 | CancelReplyButton |
| 对话页输入区直接显示 | 2 | SendButton、AttachKnowledgeButton |
| 对话页：展开“选中消息与草稿操作” | 7 | ReplyButton、ForwardButton、MessageDetailsButton、MessageTaskButton、MessageReviewButton、ObservationButton、RestoreDraftButton |
| 任务页直接显示 | 4 | NewTaskButton、NewReviewButton、ItemDetailsButton、AuthorizeButton |
| 任务页：展开“事项更多操作” | 4 | CrossButton、ReviewRecordButton、ReviseButton、CancelItemButton |
| 材料页直接显示 | 4 | MaterialsRefreshButton、MaterialsReadButton、MaterialsVerifyButton、MaterialsDetailsButton |
| 材料页：展开“来源、版本与交付操作” | 10 | MaterialsSourceButton、MaterialsRetireButton、MaterialsSnapshotButton、MaterialsPackageButton、MaterialsSnapshotDetailsButton、MaterialsExportButton、MaterialsHandoverButton、MaterialsHandoverReportButton、MaterialsMockReceiveButton、MaterialsAttemptButton |
| 治理页直接显示 | 4 | GovRefreshButton、GovCheckButton、GovIssueButton、GovIssueStateButton |
| 治理页：展开“工程治理更多操作” | 4 | GovRegisterButton、GovRoundButton、GovOpinionButton、GovIntentButton |
| 右栏展开后显示 | 1 | ParticipantsButton |

静态检查没有发现能力被放入永久隐藏容器。56个按钮没有显式 `Hidden` / `Collapsed` 祖先；唯一例外 `CancelReplyButton` 位于原有按状态显示的 `ReplyBanner`，进入回复后可达。右栏收起时可通过顶部 `ContextToggleButton` 恢复参与者管理入口。更多区使用主视觉树中的Expander，部分带有最大高度和滚动，避免低频按钮始终占据交流区域。

上述结论是结构可达性与命名合同检查；不代表57个按钮均已人工展开、逐项点击或通过功能验收。运行时的权限、绑定、暂停及选中对象要求仍可能合理地禁止某项动作，未通过删掉限制制造“可点击”。

## 已有集成证据及版本边界

引用首轮实际运行产物 [ux-native-integration.json](../../evidence/ux-native-integration.json)，本次读取时对应目录为 `test-output/ux-native-integration-XKpmD8`，文件写入时间为2026-11-12 17:40:50（Asia/Shanghai）。负责人已完成候选编译并运行 `test/ux-native.test.mjs`；证据记载 `proof.passed=true`，窗口类型为 `System.Windows.Window`、`webViewLoaded=false`。

这份首轮证据记录：三栏控件、1080宽收起 / 1420宽恢复右栏的代码断言、自然任务实际建立、不支持意图保留输入、查询任务状态、普通赞同未变为正式审批；并沿用虚构工程下的模拟消息、任务 / 审批、材料与治理流程、会话草稿隔离、重启恢复草稿不自动发送、并行窗口隔离、重复发送保护、鉴权 / Origin / scope边界。`realAdaptersUsed=0`、`realAdaptersAccessed=false`；治理记录 `simulation=true`、`realIndependentReview=false`、`executionAuthorized=false`；材料记录 `agentReceived=false`。这些字段不能表述为真实三方收件或独立工程验收。

该JSON没有内嵌完整源码或二进制哈希，因此只能指向上述首轮产物，不能证明后续修改已通过。布局子任务的XAML静态快照SHA-256为 `0FA50DFC4EC1BA445ADE5C712142926B9AD62F9A1E500A498FA6F666208E51D1`，本次复核仍一致；这只是XAML快照，不是整包最终版本。最终冻结哈希、后续回归结果及覆盖范围由负责人补入最终交付证据。

## 渲染预览与未执行的体验验证

只读查看了证据指向的 `test-output/ux-native-integration-XKpmD8/native-wpf-preview.png`。该图由候选自身的WPF `RenderTargetBitmap` 生成，是实际WPF布局的渲染预览，**不是Windows桌面截图**，不证明窗口在桌面前台、指针 / 键盘实际操作或DPI适配体验。

在这一张预览中，三栏、当前接收方、发送按钮及底部状态均可见；右栏长内容有滚动条。未发现能从该单张预览确认的布局P0/P1。它未覆盖展开全部更多区、最小高度、长代码、所有Tab、100% / 125% / 150% DPI或窄窗逐项操作，不能以此宣布适配完成。

Computer Use访问新UX应用被拒绝，原文为 `Computer Use was not approved to use ux`。本任务未使用其他UI控制、桌面截屏或替代通道绕过这一拒绝。可交付的界面依据限于可运行原生候选及自身生成的渲染预览。真正首次使用者观察尚未执行；源码检查、模拟自测、渲染图和真人体验结果分别报告。

## 数据、保留与回滚

本阶段XAML只改呈现，不新增数据库表或Schema迁移，不直接读写SQLite；项目 / 会话、消息、材料、审批、草稿仍经既有应用层与后端路径处理。自然入口与上下文集成的最终源码审查、测试及安全边界由负责人负责。没有启动或修改凪；没有读取 / 操作真实Hermes、DeepSeek、ChatGPT原会话或已有DeepSeek草稿。

新增候选为 `runtime/native/TriReviewBridge.UX.exe`；独立启动入口为 `scripts/open-ux-workbench.ps1` / `.mjs`，使用 `data/ux-preview` 下的虚构演示环境。原 `runtime/native/TriReviewBridge.Offline.exe`、`desktop/OfflineWindow.xaml` 及旧入口保留，回退时使用原离线候选即可，不需要删除新候选数据或覆盖主库。更深层源码恢复仍依 [UI_IMPLEMENTATION_PLAN.md](UI_IMPLEMENTATION_PLAN.md) 的备份边界：完整基线 `backups/offline-completion-release-2026-11-12T08-56-58-548Z` 仅用于本机恢复；保留当前证据，不恢复到运行中的旧exe，也不触碰真实Agent环境。
## 最终状态补记

后续最终回归148/148通过，原五项P1在同一复核者第二轮定向核对后解决，最终包与待刷新选择竞态修复见[当前交付](DELIVERY_REPORT.md)。本文此前证据仍按各自版本保留，不把早期通过结果代替最终源码核验。

# UX-001：组件与56个按钮能力映射

本表是迁移位置建议，不代表按钮已删除或自然入口已实现。Task TRB-UX-001；负责人Codex。

## 组件职责

| 组件 | 当前职责 | 改造注意 |
|---|---|---|
| desktop/OfflineWindow.xaml | 当前候选布局与内联WPF样式、四页控件 | 保留旧版，新增候选布局 |
| desktop/WorkbenchApp.cs | 导航、消息、接收者、任务/审批弹窗、事件和2秒刷新 | 固定x:Name/类型、Tab索引耦合先处理 |
| desktop/EngineeringMaterials.cs | 来源、快照、包、查看/哈希/导出、模拟接收 | 复用API与逐版本选择，避免全文重复轮询 |
| desktop/GovernancePanel.cs | 风险/轮次/Issue/意见/模拟交付检查 | 摘要按需，但正式状态与证据不能丢 |
| desktop/MaterialRecovery.cs | 来源退役、快照详情、UNKNOWN核对/取消、人工交付 | 不把人工报告升级验证通过 |
| desktop/DraftStore.cs | 每后台/窗口/会话DPAPI草稿、恢复 | 恢复不发送，不触碰原应用输入 |
| src/workbench-server.mjs | 回环鉴权、项目隔离、幂等、业务动作 | 最小增量意图入口，不改权限 |
| engineering/desktop-api.mjs | 已有工程材料/治理动作映射 | 仍统一由后端持有状态 |
| web/ | 旧网页调试入口 | 本轮不删除、不以CSS改造冒称新主UI |

## 命名按钮清单

| 控件 | 当前文字 | 推荐入口与保留能力 |
|---|---|---|
| NewWindowButton | 另开原生窗口 | 窗口管理；原生新窗口 |
| RefreshButton | 刷新 | 顶部状态菜单；刷新当前数据 |
| StopBackendButton | 停止后台… | 设置/后台；停止自身后台，保留确认 |
| CloseWindowButton | 关闭窗口 | 系统窗口操作；关闭窗口不停止后台 |
| NewProjectButton | 新建项目 | 左侧新增入口；创建项目 |
| RenameProjectButton | 重命名 | 项目上下文菜单；重命名 |
| ArchiveProjectButton | 归档 | 项目上下文菜单；归档确认并留历史 |
| ProjectSettingsButton | 项目设置/权限 | 项目设置；权限 |
| KnowledgeButton | 项目知识 | 上下文/项目知识；版本内容 |
| NewWorkspaceButton | 新建 Workspace | 项目上下文/新增；创建会话 |
| RenameWorkspaceButton | 窗口名称 | 会话上下文菜单；重命名 |
| ParticipantsButton | 参与者 | 右栏参与者；配置 |
| BindButton | 绑定模拟会话 | 设置/模拟接入；绑定模拟会话 |
| PauseBindingButton | 暂停/恢复选中接入 | 右栏状态/暂停；仅模拟绑定，真实锁不变 |
| PauseWorkspaceButton | 暂停/恢复此空间 | 会话状态；暂停易达 |
| ArchiveWorkspaceButton | 归档空间 | 会话上下文；归档确认 |
| CancelReplyButton | 取消引用 | 输入区引用条；取消引用 |
| SendButton | 定向发送 / 排队 | 输入区；发送/真实意图反馈 |
| RestoreDraftButton | 恢复本空间草稿… | 输入区更多；恢复需确认，不覆盖 |
| AttachKnowledgeButton | 附加知识版本… | 输入附件/材料入口；附加已授权知识版本 |
| ObservationButton | 记录差异观察 | 上下文更多；差异观察记录 |
| ReplyButton | 回复选中消息 | 消息悬停/上下文；回复作者 |
| ForwardButton | 转交给 Agent… | 消息上下文；保留来源转交 |
| MessageTaskButton | 创建文字任务… | 消息更多；引用原文创建任务，NL未可靠前保留 |
| MessageReviewButton | 发起审批… | 消息更多；引用原文正式审查，NL未可靠前保留 |
| MessageDetailsButton | 来源与技术详情 | 消息更多/展开；完整来源及技术状态 |
| NewTaskButton | 新建文字任务… | 任务页更多；无引用新任务，保留备用 |
| NewReviewButton | 新建正式审批… | 审批页更多；无引用正式审批，保留备用 |
| CrossButton | 明确开启交叉审查… | 相关审查上下文；独立首轮后明确交叉授权 |
| ReviewRecordButton | 记录分歧/结论… | 相关审查上下文；分歧/结论原文 |
| ReviseButton | 修订并重新审批… | 相关材料/审批；新版本重新审查 |
| CancelItemButton | 取消事项 | 任务上下文；用户取消 |
| AuthorizeButton | 记录用户明确授权… | 待授权提示/详情；显式用户决定，不能自动隐去 |
| ItemDetailsButton | 快照、意见与历史 | 任务详情；快照/意见/历史 |
| MaterialsRefreshButton | 刷新材料 | 材料页更多/上下文；保留现有后端动作 |
| MaterialsSourceButton | 登记虚构工程来源… | 材料页更多/上下文；保留现有后端动作 |
| MaterialsRetireButton | 退役来源登记… | 材料页更多/上下文；保留现有后端动作 |
| MaterialsSnapshotDetailsButton | 快照详情… | 材料页更多/上下文；保留现有后端动作 |
| MaterialsAttemptButton | 处理模拟待核对… | 异常提示/材料详情；核对既有UNKNOWN或取消，不重发 |
| MaterialsSnapshotButton | 捕获 Working Tree… | 材料页更多/上下文；保留现有后端动作 |
| MaterialsPackageButton | 生成材料包… | 材料页更多/上下文；保留现有后端动作 |
| MaterialsHandoverButton | 准备人工交付清单… | 材料交付详情；人工清单/报告，不是附件上传 |
| MaterialsHandoverReportButton | 登记人工交付报告… | 材料交付详情；人工清单/报告，不是附件上传 |
| MaterialsMockReceiveButton | 分发给选中的模拟对象 | 材料详情；明确模拟分发，不是真实收件 |
| MaterialsReadButton | 阅读选定材料 | 材料页更多/上下文；保留现有后端动作 |
| MaterialsVerifyButton | 校验文件完整性 | 材料页更多/上下文；保留现有后端动作 |
| MaterialsExportButton | 导出待交付材料 | 材料页更多/上下文；保留现有后端动作 |
| MaterialsDetailsButton | 版本与哈希详情 | 材料页更多/上下文；保留现有后端动作 |
| GovRefreshButton | 刷新 | 相关任务/治理详情；保留原版本/Issue/复核动作 |
| GovRegisterButton | 登记工程治理… | 相关任务/治理详情；保留原版本/Issue/复核动作 |
| GovRoundButton | 开始必要复核… | 相关任务/治理详情；保留原版本/Issue/复核动作 |
| GovOpinionButton | 记录版本意见… | 相关任务/治理详情；保留原版本/Issue/复核动作 |
| GovIssueButton | 登记问题… | 相关任务/治理详情；保留原版本/Issue/复核动作 |
| GovIssueStateButton | 处理问题… | 相关任务/治理详情；保留原版本/Issue/复核动作 |
| GovCheckButton | 检查模拟交付条件… | 相关任务/治理详情；保留原版本/Issue/复核动作 |
| GovIntentButton | 核对治理请求… | 治理详情；结构化请求核对，不是通用自然语义识别 |

## 合并原则

NewTask与MessageTask不是完全重复：后一项继承选中消息正文。NewReview与MessageReview同理；可以统一入口但必须保留来源上下文。Refresh/MaterialsRefresh/GovRefresh可收拢为当前上下文刷新，仍需加载各自数据。详情入口可合并“更多”，不能丢失来源/版本/逐目标状态。

项目重命名、归档、参与配置、模拟绑定移出主交流区；停止后台保留确认。暂停、待授权、UNKNOWN及阻断问题必须方便发现，不能全部藏进设置。自然语言能力未实际接通前，任务/审批/修订/材料等保留可达备用入口。

## 原API动作清单（源码提取）

消息/会话：issue-simulation-token、begin-cross、review-record、observe、configure、bind-simulation、pause-binding、chat、reply、forward、tasks、reviews、revise、cancel、user-authorize、simulate-fault、simulate-agent。

工程材料：materials-queue、materials-receive、materials-reconcile、materials-cancel、materials-review-evidence、materials-governance-register、materials-governance-review、materials-governance-issue、materials-governance-assess、materials-mock-self-test、materials-handover-prepare、materials-handover-report、materials-source-retire、materials-snapshot-details、materials-file-list、materials-source、materials-snapshot、materials-package、materials-verify、materials-view、materials-export。

通用附件上传及自然语言意图执行API当前不存在。以上动作名存在不等于真实Agent能力已经验证。

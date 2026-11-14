# UX-001 Phase 0：当前界面事实

日期：2026-11-12。Task：TRB-UX-001。唯一工程负责人：Codex /root。总体改造风险L2；本次仅审计、计划与历史验收结项，不改业务代码。治理MAG-001 ACTIVE。Product Experience Constraints 001正式并入，详见[验收清单](UX_ACCEPTANCE_CHECKLIST.md)。

## 已核对的真实架构

- 当前离线候选是C# WPF / 原生XAML控件，不是HTML、Electron、Tauri或WebView。启动代码在desktop/WorkbenchApp.cs，加载desktop/OfflineWindow.xaml。
- 旧runtime/native/TriReviewBridge.exe与desktop/MainWindow.xaml保留；当前离线候选为TriReviewBridge.Offline.exe。不能将旧窗口与候选源码混为同一个版本。
- .NET Framework x64，scripts/build-desktop.ps1调用系统csc；当前构建脚本编译desktop下全部.cs。TriReviewBridge.csproj仍只有旧入口清单，与实际脚本构建不完全一致，后续小范围同步，不能据此声称已有现代SDK工程。
- 前端BridgeClient使用回环HTTP、Bearer鉴权和幂等键；Node.js统一持有业务状态，SQLite持久化。两秒轮询，不是模型逐字流式输出。
- src/workbench-server.mjs处理项目/会话/定向消息、任务及审批；工程材料动作由engineering/desktop-api.mjs转给现有Context、Exchange、Ledger、Governance Host。此次不重写这些状态机。
- web/仍是历史调试入口；本轮主UI改造不应只改web/style.css。

## 当前界面结构

窗口1420×920逻辑单位，最小1080×730；字体Microsoft YaHei UI 13。左侧固定275宽项目树，右侧为主工作区，目前没有可折叠的第三栏。

主区上方：6个会话管理按钮、讨论开关、52高接收者列表及提示。四页为对话与消息、任务与审批、工程材料、治理与证据。共56个x:Name命名Button，并非56个同时可见。

对话页另有8个操作按钮、固定100高输入框、整块带边框消息卡片。每条卡片显示正文、时间、状态以及技术详情折叠标题；同一事项的多条投递状态会重复附到其消息上。左侧与顶部低频管理操作长期占用空间。材料与治理页使用多排按钮、DataGrid及表单弹窗。

## 已有能力与证据边界

项目/会话导航、独立接收对象、回复原作者且可手动改对象、来源转交、文字任务、正式文字审批、材料浏览/哈希/导出、模拟分发与版本意见、结构化治理、加密草稿恢复已经存在。原会话绑定及暂停不改变。

上一轮离线验收：127/127回归通过；用户调整后的一小时实际3609.4204633秒通过；有独立只读Codex两轮定向复核。证据见../offline-completion/E5_ACCEPTANCE_REPORT.md。这些结论仅覆盖当时冻结版本，不等于新UX已验收，更不等于真实三方收件。

## 自然语言当前真实能力

WorkbenchApp.Send只调用chat或reply；接收者来自显式列表。正文、引用、代码中的@不触发路由。它没有自然语言任务、审查或审批的意图执行接口。

因此“让DSH独立检查这个修改”当前会作为普通聊天文本进入选择的对象，不会自动建立相应审查流程。现有NewTask/NewReview及治理弹窗是真实后台入口，暂不能因减少按钮而删除。

材料目前能导出并生成交付清单；没有ChatGPT原始会话自动附件上传。人工报告不构成完整性验证。模拟收件不是实际Agent收到。界面不能伪装这些能力已实现。

## 数据、权限和状态依赖

UI读取当前projectId/workspaceId限定的数据，写入经现有后端API；不得直接写SQLite。主库尚未推广工程组件迁移，离线候选有全局Schema2及UEC组件1..7。UX本身不需要新表或主库迁移。

已有UNKNOWN不自动重发、取消、暂停、预算、草稿保护、原会话硬锁继续保留。平台后台连通不代表三个Agent在线；模拟可用、真实暂停、未绑定、未知必须分开。

## 当前实际截图

以下为Windows前台WPF实际截图，内容均为隔离虚构演示；不是UX改造效果图，不代表新UX已经完成。

![现状：对话](../../evidence/current-ui/conversation.png)

![现状：工程材料](../../evidence/current-ui/materials.png)

![现状：治理](../../evidence/current-ui/governance.png)

截图方法及时间见../../evidence/current-ui/capture.json。源码摘要及SHA-256见AUDIT_FACTS.json。本阶段未重新执行真实会话操作、未改变其投递/草稿状态。

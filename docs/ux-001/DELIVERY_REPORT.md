# UX-001 离线工程候选交付

日期2026-11-12。Task TRB-UX-001。唯一工程负责人Codex /root；风险L2。用户已授权多名Codex子Agent及授权范围内自主推进：ux_layout负责布局与阶段文档、ux_intent负责意图模块及测试、offline_review独立只读复核；root负责整合与运行验收。实现分工不等于三方会审，复核只有同一名独立实例，正式代码审查两轮。

**七项主工作台功能已实现，离线工程候选已验证。首次陌生用户体验观察及物理125%/150%DPI尚未完成，不宣称完整产品体验验收通过。** 当前不推广主库、不操作真实Agent。

## 启动与使用

双击 D:\TriReviewBridge\打开UX协作工作台.cmd。原生程序runtime/native/TriReviewBridge.UX.exe，加载desktop/UxWindow.xaml；独立回环端口48735、虚构库data/ux-preview/workbench-materials.sqlite。与原离线候选48734及旧桌面入口并存，不替换/关闭旧窗口。

选择项目与会话，在输入区选择对象或写有效@指令。可使用：

- 让Hermes负责整理一份虚构颜色说明，只输出文字。
- 选中任务后：@DSH 独立检查这个修改。
- 选中任务后：查询当前任务状态。
- @Hermes 总结当前讨论。
- @DeepSeek 发起正式审批：这里是要审查的虚构文字。
- @全部 这是面向当前会话参与者的消息。

执行结果区显示真实排队/查询结果。复杂条件链或同时多Agent分工尚不支持，会明确未执行并保留输入。工程包复核复用已登记的治理定义和精确材料版本；缺少冻结定义或对象不唯一时不猜测，备用治理/材料/审批入口仍可通过更多操作访问。

“我正式批准这个方案”不会通过此自然入口自动记录为批准或实施授权；须使用保留的正式入口满足原条件。总结是向指定模拟对象创建请求，不是平台自行生成了语义总结。

## 按阶段交付

| 阶段 | 实际结果 | 报告 |
|---|---|---|
| P0 | WPF/API/56按钮审计及范围冻结 | UI_CURRENT_STATE / COMPONENT_MAP / GAP / IMPLEMENTATION_PLAN |
| P1/P2 | 三栏、简洁消息、统一输入、原能力可达 | PHASE1_2_REPORT.md |
| P3/P4 | 有界自然指令、状态与上下文、版本化材料提示 | PHASE3_4_REPORT.md |
| P5/P6 | 四视窗原生运行、回归、独立复核与保护核验 | PHASE5_6_REPORT.md |

完整验收逐项结果见UX_ACCEPTANCE_RESULTS.md；原UX_ACCEPTANCE_CHECKLIST为冻结要求，保持不改，并非进度勾选表。

## 重要行为

自然请求只执行已支持的动作；上下文唯一时复用对象，歧义简短提示，不弹出替代正常协作的复杂配置表单。@全部仅当前有效参与者，任一必要对象暂停或未绑定不静默省略。引用、代码（包括缩进代码）和普通名字提及不路由。

普通用户正文保留；内部Symbol产生的原文、对象ID及版本存入现有消息source元数据。WPF只对用户消息显示该原文，完整工作流材料和引用在技术详情，Agent原回复不改写。

最近显式选择决定活动上下文，隐藏页旧任务/消息/材料不会混入请求。切换会话立即清空旧视图，程序清控件不写回接收者；轮询等待期间的真实用户选择仍被保留。

异常条独立于右栏，涵盖当前会话所有未解决材料UNKNOWN/回执不匹配及接入暂停，不只看当前包。提交、确认、回复、待用户验收分别显示；模拟字节核验、人工报告和真实收件分开，当前真实三方仍未验证。校验记录按包版本/时间显示，不冒称实时完整性。

## 实际验证

全套 **148/148通过**：126项已有离线测试＋21项有界意图测试＋1项扩展原生生命周期测试。旧workbench-native测试在此套件中由UX副本替代，包含原生命周期、草稿、材料、治理和重启用例，不重复计数。

原生进程实际运行，完成任务/审查/材料/治理、独立窗口、接收者恢复、加密草稿跨重启、双击防重复、普通赞同非审批、正文原文、折叠后UNKNOWN、未选包UNKNOWN、接入暂停与受控延迟刷新中的选择保留。后端停止重启后历史保留；关闭窗口不停止后台。

四视窗：1440×900、1366×768、980×660、1920×1080；发送区均在窗内，窄窗右栏自动折叠。当前实际deviceScale=1，即100%物理DPI；未做125%/150%物理设备验证。

独立代码首轮发现4项P1，另有自测发现的接收者恢复P1；修复并保留失败145/146记录。第二轮只查原问题及回归，补齐同一上下文Issue的等待竞态后通过，未解决P0/P1为0。独立方核对37文件、30源映射及原生证据哈希，没有独立运行测试，不冒称真实Agent审查。

机器证据：evidence/ux-001/verification.json、all-tests-final.txt、independent-review.json、review-round1.json、review-package.json及evidence/ux-native-integration.json。源和二进制哈希匹配；原配置/旧桌面/45受保护文件、3个暂停原绑定均保持，主库无UEC推广迁移。

## 文件变更

新增：desktop/UxWindow.xaml、UxPresentation.cs；src/collaboration-intent.mjs；test/ux-intent.test.mjs、ux-native.test.mjs；scripts/open-ux-workbench.mjs/.ps1、prepare-ux-review.mjs、verify-ux.mjs；打开UX协作工作台.cmd；runtime/native/TriReviewBridge.UX.exe；本目录阶段报告/验收结果和evidence/ux-001。

修改：desktop/WorkbenchApp.cs（候选模式/显示/事件/测试衔接）、EngineeringMaterials.cs（按版本显示与迟到结果保护）、TriReviewBridge.csproj（同步真实构建清单）；scripts/build-desktop.ps1（允许独立UX输出）；src/workbench-server.mjs（增量intent、owner控制状态摘要）；src/workbench.mjs（内部Symbol消息元数据）；docs/INDEX.md和本目录README。

复用Workflow、Supervisor、SQLite、既有API与工程Context/Exchange/Ledger/Governance Host。没有重写Node、SQLite或Adapter。

## 数据与回滚

Schema/组件版本保持：全局2、UEC1..7；无新增表/字段，意图元数据存既有source字段。新虚构预览库独立创建，未迁移生产主库。

恢复基线backups/offline-completion-release-2026-11-12T08-56-58-548Z含私密配置，仅供本机。正常回退使用原打开离线协作验收版.cmd或旧入口；关闭UX窗口不停止其他后台。需要恢复源码时，仅处理候选自身进程，在新目录从基线恢复并核验，不覆盖唯一主库、不删除新历史和证据、不触碰原会话或凪。

## 尚未完成/不在授权范围

- 首次陌生用户观察、物理125/150%DPI、长期新UX耐久尚未做；旧版本一小时结论不转移到本源码。
- 通用自然语言、复杂条件与多角色任务编排、未登记工程定义的自动风险判定未实现；保留备用入口。
- 真实Hermes/DSH收件、ChatGPT原会话附件、真实三方一致性未测试，所有原投递暂停保持；无凪接管。
- Windows截图工具返回“Computer Use was not approved to use ux”。没有改用其他窗口自动化绕过。预览来自程序自身WPF RenderTargetBitmap，是运行原型呈现，不是桌面截图。

## 界面预览（非桌面截图）

![1440×900 原生WPF渲染预览](../../evidence/ux-001/preview-1440x900.png)

![980×660 窄窗渲染预览](../../evidence/ux-001/preview-980x660.png)

# 001 分阶段实施报告

日期：2026-11-12。只使用 D:\TriReviewBridge。当前全部真实 Adapter 硬锁，未读写真实会话；未操作 DeepSeek 草稿；未启动或修改凪。

## P0 现状审计与冻结

已实际检查 Node 后端、Workflow、Supervisor、SQLite、C#桌面适配、Hermes脚本、旧Web、测试与证据。审计基线为v1预览：67项测试，非任务书参考的41项；原始历史83条records、319条audit。区分历史真实线路证据、当前模拟测试和未验证能力。

交付：CURRENT_ARCHITECTURE.md、CURRENT_DATABASE_SCHEMA.md、ADAPTER_STATUS.md、EXISTING_TEST_BASELINE.md、UPGRADE_GAP_ANALYSIS.md。001前一致性数据库与代码保存在 data/001-baseline.json 指向的备份；原型另有83文件基线。审计未改变原会话或暂停状态。

## P1 多项目、多会话、权限与数据隔离

复用 src/workbench.mjs 的 Project/Workspace/Binding、复合外键与独立历史，新增 src/collaboration-core.mjs 继承它，继续继承原 src/workflow.mjs。增加项目说明、主体、项目成员、会话授权和哈希凭证。Agent身份与原生Session仍分离，同一原生Session不能复制绑定到不同空间。

新增 scripts/upgrade-001.mjs；在全新Schema 2副本验证18张原有表的旧列和所有记录相同，再切换databaseFile；原v1库与历史原库均保留。

已运行：3个虚构项目×2个空间的隔离/归档/重启测试；受限模拟Agent即使给出正确外项目ID也无法读写。未实现公网登录或通用多用户凭证发行；本机用户为唯一默认用户，测试Agent凭证受项目/会话约束。

回滚：停模拟后台，以备份恢复到新文件并切换配置。代码回退使用001安全基线，不恢复早期可自动发送的原型启动路径。

## P2 显式路由与协作通信

复用 Workbench 收件元数据、引用/转交、Supervisor 投递状态机；扩展 workbench-server.mjs 为鉴权访问主体和持久化幂等接口。业务更新与幂等回执同事务；重放请求不重复排队，变更内容复用同key被拒绝，重放也重新检查当前权限。

用户已明确：回复默认发给被回复消息作者，例如Hermes；用户可以手动改对象。正文/引用/代码中的@不扫描。@全部等效于显式选择当前空间全部参与者。多接收方独立回答。Agent主动传话必须带已有模拟事项来源且在当前空间/额度内；重要审查未披露前不能借主动消息泄露首轮意见。

已运行：六方向各5次模拟往返；用户到Hermes10条、Hermes到DeepSeek10条；无收件人、暂停、越权、循环、预算、UNKNOWN、迟到、幂等与来源转交测试。真实线路往返次数为0。

## P3 独立审查、交叉审查、项目知识

Workflow仅增加可覆写的审查轮次钩子，保留原始全票/版本/nonce/来源核对。CollaborationCore增加重要事项 independent_then_cross 流程，首轮意见全部提交后才允许用户明确披露。初始意见和交叉意见分别不可变存储；记录一致点、分歧、未决事项、证据，允许最终拒绝或分歧。技术审批与用户授权分开；没有工程执行能力。

新增知识卡与不可变版本：默认不共享；需要显式角色授权和本次消息引用，冻结版本和SHA；撤销阻止新发送。仅管理项目文字，不读私有记忆/配置/凭证，不重建Mnemosyne。新增差异观察说明，不评分、不改写、不推断意识。

已运行：8项001核心测试覆盖首轮API/提示材料隔离、交叉披露、原始意见不变、分歧、知识授权与撤销、跨项目知识拒绝、三方原文保持。普通聊天不要求JSON；正式审批回执仍使用最小结构校验，原协议留在技术详情。

## P4 Adapter能力与可靠性边界

保留 native/DesktopSession.cs、native/hermes-v2.py、src/transports.mjs，未迁移原Runtime、记忆、模型或原始Session。本版未修改这些原生实现。

扩展 src/adapter-capabilities.mjs：声明通信能力，提供统一模拟Facade；真实Facade返回未授权/不支持，不伪造成功。复用 simulation-adapter.mjs 和原Supervisor故障保护。模拟测试覆盖焦点/身份/应用关闭/Gateway中断/用户输入/已有草稿/不确定提交/迟到回复。

已实际运行的是模拟能力契约及保护逻辑；**真实桌面窗口、跨进程输入互斥、锁屏、原生草稿与发送后可见性，本次未重新验证或声称增强完成**。真实原线路可靠性仍需后续授权测试。已取消事项的UNKNOWN发送也不会被自动重新提交；对应不确定通道继续等待人工核对。

## P5 真正WPF原生桌面

复用 desktop/MainWindow.xaml、WorkbenchApp.cs、既有构建与启动器。扩展项目设置/权限、知识卡与显式附件、重要审查、开启交叉审查、分歧记录、差异观察。新增独立进程多窗口，共享同一后台与历史，不复制Session。输入草稿按会话分别保存于本窗口内存，发送中防连点；切换空间不将草稿带入其他空间。

已实际编译并运行 System.Windows.Window，未加载WebView。原生集成测试实际打开两个同时存在的WPF窗口，验证接收对象、草稿、消息隔离、知识模态框、文字任务与审批/修订、关闭窗口后后台存活及重启历史不重复。证据：evidence/workbench-native-integration.json及其preview路径。

限制：输入草稿不做磁盘持久化；用户应在退出前处理自己的工作台草稿。系统托盘/开机启动/手机端不在本次交付；旧Web保留为调试/回退入口。多个窗口查看同一个Workspace时，共享该Workspace持久化的接收对象，这不是项目间串状态。

## P6 回归与真实时间稳定性

工作台冻结基线78项通过；加上MAG 15项与UEC离线17项，当前合并回归110/110通过，0失败；包含原有兼容测试、新核心、HTTP和实际WPF测试。证据：evidence/001-all-tests.txt。

两小时稳定性：**工作台核心模拟验收已通过**，实际7200.165秒、7147心跳、9次进程重启、13次运行中故障脉冲。40条周期消息逐条保留，重复提交0、跨项目消息0，45个旧受保护文件SHA未变。证据见evidence/001-final-verification.json。此耐久路径不包含尚未接入主服务的MAG/UEC模块。脚本 scripts/soak-001.mjs 每秒心跳、循环虚构消息与故障、请求重放、受限凭证、进程强制退出及数据库重开、完整性/外键/源码哈希与45个旧受保护文件校验。仅SQLite与模拟Adapter，不操作任何真实窗口。短测失败和因补草稿保护中断的记录保留，不能算成两小时通过。

真实Adapter矩阵未执行，另见001_REAL_ADAPTER_ACCEPTANCE_PLAN.md。代码回退预案仅检查，数据库复制迁移实际运行；不得把它表述为生产平台完整代码回滚成功。

## 修改/新增文件入口

- 业务：src/workflow.mjs、src/workbench.mjs、src/collaboration-core.mjs。
- 接口/通信：src/workbench-server.mjs、src/adapter-capabilities.mjs、src/simulation-adapter.mjs。
- 桌面：desktop/MainWindow.xaml、desktop/WorkbenchApp.cs、runtime/native/TriReviewBridge.exe。
- 工具：scripts/upgrade-001.mjs、scripts/soak-001.mjs，复用既有build/start/stop/backup/restore脚本。
- 测试：test/collaboration-001.test.mjs、test/collaboration-api-001.test.mjs；复用并实际运行workbench-native及全部旧测试。
- 文档：README.md、本报告、操作与恢复说明、P0审计文件；详细旧新SHA与文件清单见最终manifest。

所有新增测试材料均为虚构。观察与结论只覆盖已记录证据，不推断Agent主观意识，不将模拟文本当成原生模型判断。
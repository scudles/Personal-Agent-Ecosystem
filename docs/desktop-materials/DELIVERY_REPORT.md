# 桌面工程材料接通交付报告

Task：TRB-DESKTOP-MATERIALS-001  
负责人：Codex  
风险：L2，跨模块升级  
交付状态：隔离原生预览；自测完成，独立复核尚未执行，未切换正式数据库。

## 本轮完成

WPF 新增“工程材料”页：登记唯一虚构工程来源、捕获实际 Working Tree、关联当前空间的文字任务、生成不可变版本包、阅读完整选定文本、逐文件校验及导出。API 与桌面复用现有 EngineeringContext / CollaborationCore 同一连接和任务历史，不另建业务状态机。正文以自然文字呈现，哈希位于详情。

只有本机 Owner 可使用材料 API。服务端白名单仅包含平台 sandbox/engineering-projects 与当前隔离数据目录的 sources；客户端不能扩大来源权限。真实工程目录和凪均不在本轮允许范围。Git/非 Git 能力继续复用离线组件；新桌面完整链路以虚构非 Git 工程验证，Git 的 Working Tree/Diff 能力由既有专项测试覆盖。

导出始终是 PREPARED_NOT_DELIVERED；校验只证明本地材料完整，不证明三方已收到。没有新增附件上传、原会话操作、真实投递或 Agent 接收成功路径。API 不向模拟 Agent 颁发此页权限。

## 启动与使用

双击 D:\TriReviewBridge\打开工程材料预览.cmd。它打开独立 WPF 窗口和独立本机后台（127.0.0.1:48733），自动选择“虚构演示｜工程材料交换 / 离线快照与版本包”。

此预览库为 data/materials-desktop-preview/workbench-materials.sqlite；文件位于同目录 engineering-store。页面内可直接选择预置材料，阅读、校验及导出。新增材料需要先在任务页创建文字任务，再捕获快照、生成包。文件变化必须重新捕获快照；填入已有包完整 ID 会追加版本，不能覆盖旧版。当前范围不提供退役/改绑来源 UI，不提供旧快照强制打包或真实材料分发。

主工作台入口、data/workbench-config.json、workbench-001.sqlite 与离线 engineering-preview.sqlite 保持原用途。旧入口遇到未启用材料功能会提示使用隔离预览。关闭窗口不停止后台；预览窗口的“停止后台”仅停止它连接的隔离后台，之后仍可再次双击启动。两个后台使用独立配置和 Token。

## 文件变更

| 文件 | 用途 |
|---|---|
| engineering/context.mjs | 支持可信后端共享既有 Core；独立路径模式保留生产库拒绝检查；共享连接不由组件关闭 |
| engineering/desktop-api.mjs | Owner 材料管理接口、显式字段映射、范围与文字任务约束 |
| src/workbench-server.mjs | 接入鉴权、Origin、项目范围、持久幂等；仅显式启用隔离材料组件 |
| desktop/MainWindow.xaml | 原生材料页及自然文字状态 |
| desktop/WorkbenchApp.cs | 初始化、空间切换、中文错误、原生端到端自检接入 |
| desktop/EngineeringMaterials.cs | 登记、快照、任务关联、阅读、校验、导出及防串空间处理 |
| scripts/build-desktop.ps1 | 编译多个原生 C# 源文件，不使用 WebView |
| scripts/open-materials-preview.mjs / .ps1 | 幂等准备虚构演示及独立后台、原生窗口入口 |
| scripts/verify-desktop-materials.mjs | 主库保护、真实平台数据库副本迁移及证据核对 |
| test/desktop-materials.test.mjs | API 权限、隔离、版本、幂等、损坏拒绝与共享连接测试 |
| test/workbench-native.test.mjs | 虚构文件驱动真实 WPF 交互链路 |
| 打开工程材料预览.cmd | 双击入口 |

同页 SCOPE.md 冻结本轮范围。README、正式索引与 UEC 执行状态追加当前交付链接。现有 Workflow、Supervisor、SQLite、模拟 Adapter 及原生桌面技术继续复用；native/DesktopSession.cs、Hermes SDK、原生 Adapter 实现未修改。本轮没有治理规则变更。

## 数据结构与迁移

沿用全局 Schema 2 + UEC 组件迁移 1 的七张增量表和不可变触发器。无需新 Schema 3。主库没有原地迁移。使用 SQLite backup 对实际平台库生成新副本，在副本添加 UEC 表后逐表对比原 30 表内容、检查完整性/外键与原绑定暂停。报告：evidence/desktop-materials-verification.json。

隔离预览使用独立新库和虚构材料；旧离线 preview 的历史包不会自动混入它。正式迁移须完成必要独立复核后，再使用已验证的副本迁移方式；届时应重新备份最新主库，不可把本轮测试副本直接视为未来最新生产数据。

## 验证与证据

- 全部 112 项自动化测试通过：evidence/desktop-materials-all-tests.txt。
- 实际编译并启动 System.Windows.Window，使用虚构文件走完来源→快照→版本包→原生阅读→校验→导出；没有 WebView。evidence/workbench-native-integration.json 记录原生自检及自产窗口渲染图路径，该图不是整屏截图。
- API 拒绝跨项目/空间包引用、非 Owner、未授权目录；版本 v1/v2 可分别读取；源变化要求新快照；损坏文件不能读取、导出或标记成功；导出重复请求返回同一结果。evidence/desktop-materials-api.json。
- 主配置未变；3 个原会话绑定身份与暂停不变；45 项受保护文件哈希不变；原档案记录通过核对。证据见验证 JSON。
- 一键入口实际启动，确认启动脚本退出后原生窗口与独立后台可用；随后关闭测试窗口、停止测试后台。evidence/desktop-materials-launcher-smoke.json。
- MAG-001 ACTIVE/PROTECTED 完整性自检通过；Guard 的既有 assessment-only 边界不改变。

真实 Adapter/附件验证：未开展，0 次原会话操作。桌面 UI 实际运行不等于真实 Agent 通信验证。独立工程复核：尚未执行，不以本轮自测替代。当前真实发送与草稿状态没有变化；没有操作原应用，因此也未把“未操作草稿”宣称为读回校验了草稿内容。

原 2 小时稳定性测试属于旧冻结核心，本轮 112 项回归不等于新版本连续 2 小时验收。没有将旧耐久结果迁移到新哈希。

## 已知限制、未通过与风险

最终回归未通过测试：0。开发中首次 API 测试把预先创建的两条文字任务排队记录误计为材料新增记录，已修正为检查总数不增加且无提交/回执；最终测试通过。

文件扫描是防误带凭证措施，不是完整 DLP。材料封存后若文件系统完成而事务失败，可能保留未发布孤立目录；继续按旧机制保留证据、不覆盖、不自动清理。文件写入/打包占用本机服务线程，仍受既有大小与数量上限；大型仓库/高并发未验收。交付只含离线文字材料；无附件上传、自动三方分发或完整 Evidence Ledger。

## 回滚

本轮恢复基线见 data/desktop-materials-baseline.json，指向 backups/desktop-materials-2026-11-12T05-54-30-062Z。包含代码、旧桌面二进制、配置和一致数据库备份；其中含私密配置，不能当作对外材料包分发。

停止隔离预览后台并关闭其窗口，即可继续使用既有主入口。主配置与主库未切换，不需降级生产数据库。需要回退代码时关闭新旧 WPF 窗口及平台自有后台，按备份恢复被修改的源文件和原桌面二进制；保留本轮预览库/材料目录供审计，不作递归清理。再次运行原入口仍连接原库。所有恢复只限 D:\TriReviewBridge，不涉及凪或原 Agent 应用。

## 下一依赖

安排一名必要独立复核者核对本轮变更与版本证据；不默认三方。复核完成后可评估主库迁移。真实接收/ChatGPT 附件试投仍须用户另行明确授权，不能把本轮“下一步”解释为恢复暂停。
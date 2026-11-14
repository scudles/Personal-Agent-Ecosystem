当前用户决定：禁止以定时唤醒Codex/模型维持连续会话。原定时接力已删除，ChatGPT/DSH投递已暂停；独立常驻接入尚未实现。权威需求见docs/native-workbench-001/CONTINUITY_REQUIREMENTS.md，旧接力记录仅作历史证据。

当前候选交付状态：[2026-11-13 检查点](docs/native-workbench-001/DELIVERY_CHECKPOINT_20261113.md)。ChatGPT接力修复，DSH002已集成且仍暂停/未真实验证。

> 当前试用入口：`打开三方协作候选.cmd`。ChatGPT原会话接力已开启；Hermes单次真实验证通过，持续使用需本人在本机确认；DSH仍暂停。[操作](docs/native-workbench-001/OPERATIONS.md) · [实际交付/未完成](docs/native-workbench-001/DELIVERY_REPORT.md)。

> 当前临时真实文字入口：`打开ChatGPT接力工作台.cmd`。ChatGPT沿用指定原对话，依赖Codex在线；其他入口/旧暂停保留。[交付与限制](docs/codex-relay-001/DELIVERY_REPORT.md)。

# TriReviewBridge 原生协作工作台

工程：D:\TriReviewBridge。任务书001：原生独立、协作集中、决策分散。

双击 **启动原生工作台.cmd** 打开真正的 C# WPF 窗口。无需浏览器，不使用 WebView/Electron/Tauri。旧网页和旧模块保留用于审计与回滚。

**当前发布仅启用模拟 Adapter。真实 Hermes/DeepSeek/ChatGPT 原始会话全部锁定，不读取、不发送、不恢复投递。DeepSeek 草稿未操作。不会启动或修改凪。**

可用：多项目/多协作空间、独立接收对象、自然语言消息、回复与来源转交、文字任务、两方/三方正式审查、独立首轮和显式交叉审查、分歧留存、版本化授权项目知识、原生多窗口、差异观察、持久化幂等与审计。

回复默认发给消息作者，可手动改对象。输入框正文中的 @ 只是文字；请使用接收方选择器。未选择则不发送。多接收方分别独立回复。

项目创建不会创建原生 Agent 会话。其他项目初始显示未绑定；测试只能显式绑定平台模拟会话，不能把它冒充为原 Agent。

- [001交付与验收入口](docs/001_DELIVERY.md)
- [分阶段实施报告](docs/001_STAGE_REPORTS.md)
- [安装、启动和日常操作](docs/OPERATIONS.md)
- [迁移与故障恢复](docs/001_MIGRATION_AND_ROLLBACK.md)
- [真实接入限制与后续验收](docs/001_REAL_ADAPTER_ACCEPTANCE_PLAN.md)

运行测试：runtime\node.exe --test test\*.test.mjs。
原生构建：powershell.exe -NoProfile -File scripts\build-desktop.ps1。
两小时模拟验收：runtime\node.exe scripts\soak-001.mjs --seconds 7200。

本项目未提供任意命令执行、工程文件修改、公网或手机远程控制接口。技术审批通过与用户实施授权分开保存；即使用户记录授权，本版本也不会执行真实工程。

治理制度 MAG-001 已正式生效：见 [治理总览](governance/GOVERNANCE_OVERVIEW.md)、[受保护权威规则](governance/PROTECTED_RULES.md)、[Guard已实现及未覆盖范围](governance/DELIVERY_REPORT.md)。旧HTTP入口尚未全面接入Guard，不能据此声称全自动保护。

[Unified Engineering Context 001 Phase 0审计与待确认方案](docs/engineering-context-001/README.md)：该链接保留前期审计；随后已确认并完成离线Phase 1/2，ChatGPT自动附件未实现。
UEC-001已确认并完成离线Phase 1/2：[当前状态与离线材料入口](docs/engineering-context-001/PHASE12_DELIVERY.md)。主服务/原会话未接通材料投递。

验证：110/110回归通过；工作台核心7200秒模拟耐久通过，真实Agent操作0次。MAG/UEC模块分别有目标测试，不以核心耐久替代其完整集成验收。

工程材料已接入独立原生预览：双击 `打开工程材料预览.cmd`。见 [桌面材料交付与限制](docs/desktop-materials/DELIVERY_REPORT.md)。主配置/主库未切换，真实会话仍暂停。

新版离线协作候选：`打开离线协作验收版.cmd`，支持模拟材料交换、版本证据、MAG治理及加密工作台草稿恢复。[阶段交付与验收状态](docs/offline-completion/DELIVERY_REPORT.md)。真实会话/附件仍未授权；当前耐久状态以对应证据为准。

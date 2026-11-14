# TriReviewBridge 001 交付入口

原生独立、协作集中、决策分散。

当前状态：工作台冻结基线78项通过；当前含MAG/UEC离线功能共110项回归通过。工作台核心连续两小时模拟验收已通过，源代码哈希一致。真实Agent材料收发尚未验证。

## 已可使用

真正WPF原生窗口，多项目/多会话/多窗口，显式接收对象，回复默认作者且可修改，来源转交、文字任务、正式审批、首轮独立/用户授权交叉审查、原始意见与分歧保留、版本化项目知识显式共享/引用、差异观察与审计。

所有接入显示模拟，不使用新API会话冒充原会话。三个原会话绑定、模型、记忆、配置和DeepSeek草稿保持原样，当前真实投递继续暂停。凪未启动或修改。

## 运行入口

D:\TriReviewBridge\启动原生工作台.cmd

后端：Node.js + SQLite；桌面：C# WPF；本机鉴权HTTP；Workflow/Supervisor/Agent原始接入实现复用。旧Web保留，没有以WebView包装网页。

## 证据和报告

- [分阶段报告](001_STAGE_REPORTS.md)
- [P0现状架构](CURRENT_ARCHITECTURE.md)
- [P0数据库结构](CURRENT_DATABASE_SCHEMA.md)
- [Adapter边界](ADAPTER_STATUS.md)
- [原测试基线](EXISTING_TEST_BASELINE.md)
- [001差距审计](UPGRADE_GAP_ANALYSIS.md)
- [操作说明](OPERATIONS.md)
- [迁移/回滚](001_MIGRATION_AND_ROLLBACK.md)
- [真实线路授权后验收方案](001_REAL_ADAPTER_ACCEPTANCE_PLAN.md)

统计和证据：evidence/001-all-tests.txt、001-release-migration.json、workbench-native-integration.json、001-soak-acceptance.json。最后一项必须passed=true且acceptance=true、elapsedSeconds>=7200才算完成两小时；中断/短测不能替代。

## 尚未验证或不提供

真实Agent线路、原生桌面互斥/草稿/锁屏/可见消息边界本次未重新验证；不提供直接解除真实锁定入口。没有任意Shell、工程文件写入、Nagi接管、公网/手机远程功能。完整代码回退未在运行平台上演练。工作台输入草稿仅保留本窗口内存，不跨应用退出持久化。
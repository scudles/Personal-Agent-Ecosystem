# MAG-001 交付报告

版本：MAG-001；状态：ACTIVE / PROTECTED；依据：用户最新明确更正“正式起效”。候选选择已作为历史保留，不是当前状态。

## Phase 0

检查现有文档、目录与业务能力，没有重复建立现有治理实体；差异与旧正式审批冲突见PHASE0_AUDIT.md。UEC仍只交付审计与方案，未开始其Phase 1。

## Phase 1

写入八份一致版本制度文件；PROTECTED_RULES.md为权威，CHANGELOG记首次采用/更正，versions/MAG-001保存首次规范字节与manifest，active.json登记生效及manifest SHA。制度链接已加入项目README和docs/INDEX。

规则未发送至三个原会话，不伪造三方已读或确认；原Session、模型、私有记忆、DeepSeek草稿和原暂停不动，凪未启动/修改。

## Phase 2

新增guard.mjs及guard-cli.mjs：唯一负责人、L0-L3结构化事实/人数、独立性与L2依据、L3专项及必要用户授权、正式工程材料引用、轮次、范围冻结、Issue/去重/重开/严重程度重评、四项提醒记录、正式修订接口。

默认拒绝自行声明用户授权；原生Agent/业务执行能力均未新增。Guard是assessment-only接口，不自动执行任务。

**旧HTTP/Workflow入口尚未逐一接入强制守卫，WPF尚无治理面板。自然语言语义与所有重复问题未自动识别。** 不以制度文件或库函数存在宣称这些已完成。详细接口/边界见GUARD_INTERFACE.md。

## Phase 3

15项针对性测试全部通过，0失败；仅虚构任务及test-output中的治理副本。

覆盖：L0不拉三方、L1一名、L2第三方条件、L3专项与用户授权、异步/Agent布尔不可冒充授权、P2/P3不阻断、P0/P1未解决阻断、两轮及例外、第二轮范围、Issue原ID/独立验证/重开、冻结范围、新Task、四项提醒、未知自然语义返回不确定、文件篡改停止、正式修订用户确认/旧版保留、材料核验缺口、交付完成证据、已登记阻断不可被载荷隐藏、修订ID防路径越界。

证据：evidence/MAG-001-tests.txt。正式版本完整性和CLI示例也已实际运行。实际Agent验证0次；工程独立复核未执行，不能把本次自测冒充外部复核。

## 文件清单

规范：GOVERNANCE_OVERVIEW、ROLE_RESPONSIBILITY、REVIEW_LEVELS、REVIEW_PROTOCOL、DECISION_AUTHORITY、ISSUE_LIFECYCLE、PROTECTED_RULES、CHANGELOG（均.md）。

实现/状态：guard.mjs、guard-cli.mjs、policy.json、active.json、versions/MAG-001/及manifest；测试test/governance-001.test.mjs；examples两个虚构输入；GUARD_INTERFACE、PHASE0_AUDIT、本报告。

索引：README.md、docs/INDEX.md。提醒记录governance/audit/guard-events.jsonl。

## 数据迁移与回滚

本次未改主SQLite Schema 2、旧库、Task历史或原绑定；没有待执行生产数据迁移。正式修订仅在虚构副本验证，生产仍MAG-001。

Guard逻辑故障可暂停调用并保存事件/代码证据，不自动解除已经生效的制度。普通任务不得删除或覆盖规范作为“回滚”；制度内容变化/停用须按正式修订流程取得用户明确确认。文件损坏从已确认的versions/MAG-001恢复并复核manifest，不自动接受受损文件。

## 后续独立任务建议

最小后续为把Guard接入主后端任务/工程审查入口，复用SQLite事务与ACL，明确旧全票审批和MAG工程复核的不同语义，并添加WPF提醒。该安全/权限边界改造需要独立专项复核；不能在本次自测后直接宣称全入口受保护。

UEC工程材料包仍等用户确认后实施。不要为治理把UEC审计擅自扩大成开发，也不要求为本次文档逐条拉三方共识。
后续任务状态更新：用户已明确确认UEC离线Phase 1/2，现已完成并另行报告；真实接收仍未授权。当前合并回归110/110通过，含治理15项。见docs/engineering-context-001/PHASE12_DELIVERY.md。治理规范文件未因此修改。

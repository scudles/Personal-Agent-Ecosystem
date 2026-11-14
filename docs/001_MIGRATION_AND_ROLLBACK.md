# Schema 2 迁移与回滚

## 已执行的路径

原始 workflow.sqlite、bridge.sqlite、原配置和证据未覆盖。v1一致性基线在 data/001-baseline.json 指向的 backups 目录中。

新增工具 scripts/upgrade-001.mjs 先使用 SQLite backup API 建立一致性新副本，再在副本的事务中添加Schema 2。目标已存在或越出平台目录将拒绝，不接受原地覆盖。

实际迁移：data/workbench-v1.sqlite → data/workbench-001.sqlite。验证18张既有表的全部原列/原记录相同、完整性与外键通过，3个真实绑定均保持暂停。证据：evidence/001-release-migration.json。

停旧模拟后台后，仅将 data/workbench-config.json 的 databaseFile 切到新副本并启动。旧库留在原路径。绝不对真实 Agent 原会话做迁移。

## Schema 2 新增

projects.description；principals、project_members、conversation_grants、principal_tokens（只存令牌哈希）；review_opinions（原意见不可变）、cross_disclosures（披露快照不可变）、review_records；knowledge_cards、knowledge_versions（版本不可变）、knowledge_shares；differentiation_observations。服务启动时增加 api_idempotency；业务写入及幂等回执同事务提交。

旧实体和JSON身份继续使用。现有Snapshot不重算、不改哈希；只有新增001事项加入审查计划和知识版本引用。旧原始归档与审计逐条保留。

## 日常备份和恢复

scripts/backup-workbench.ps1 停止本项目模拟后台后，备份当前库、配置及证据并生成SHA清单，保持后台停止。

scripts/restore-workbench.ps1 -BackupDirectory <本平台backups内的快照目录> 校验清单，另存当前状态，将备份恢复为新的数据库文件，检查完整性/外键后切换配置；不会删除旧库，不会启动真实Adapter。之后使用启动器恢复模拟后台。

这两个脚本已在v1阶段实际做过备份、恢复、启动核对，证据见 evidence/workbench-restore-smoke.json。001另行验证Schema 2副本和回退，不将旧结果冒称为本版数据库完整恢复测试。

## 代码回退方案

001升级前的代码在 backups/001-baseline-2026-11-12T01-50-05-867Z。回退前先关闭全部WPF窗口并停模拟后台，备份当前Schema 2库和配置。将该基线的 src、desktop、scripts、package.json 恢复到平台目录，使用基线 build-desktop.ps1 重编译WPF，再将 databaseFile 指向基线库的全新恢复副本。

该基线本身已经硬锁真实Adapter。不要使用更早的原型启动方式恢复真实投递，不要覆盖 data/workflow.sqlite、data/bridge.sqlite 或原草稿。回滚会隐藏Schema 2新增功能；期间新增数据应保存在当前库中，不反向塞入旧Schema。

**代码回退步骤目前为人工恢复预案；未在运行平台上实际执行整套代码回退。** 数据副本迁移、旧库保留和恢复工具的实际证据分开报告。

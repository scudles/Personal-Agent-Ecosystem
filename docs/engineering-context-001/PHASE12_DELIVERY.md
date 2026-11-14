# UEC-001 Phase 1/2 离线交付报告

状态：用户已明确确认最小范围，Phase 1/2离线实现与虚构项目测试完成。Phase 3真实接收、附件试投和Phase 4审批/证据联动尚未实施。

## 实际实现

- 每个项目一个有效主来源；明确根目录、来源身份、Git或directory类型、授权范围和注册历史。更换身份须新登记，旧来源/快照不删除。
- Working Tree原字节快照：HEAD/当前分支/状态、暂存与未暂存、未跟踪、删除、重命名、实际SHA-256、清单Hash；目录型来源Git字段明确null。
- 当前HEAD带观察时间；default_branch未获证实时为null，不能把当前feature分支冒充默认分支。
- 不可变包家族和版本，任务/验收/上下文、原文件、可应用的捕获Diff、完整Snapshot Manifest、可阅读文本视图、可选文档/导入测试报告。
- Manifest核心hash、实际manifest字节hash及视图hash分别定义，无自哈希循环。源文件按原字节核对，包含空文件、CRLF和末尾无换行。
- 包内自带source/snapshot_manifest.json；逐一校验源文件归属与SHA/大小、Diff是否来自该Snapshot，控制文件与未知额外文件也检查。
- 授权查询/读取、项目/Workspace隔离、非接收者拒绝、请求幂等、源发生变化要求新快照、明确理由的历史重审。
- 导出完整本地目录，状态PREPARED_NOT_DELIVERED；不表示任何Agent收到或读过。

## 修改/新增文件

- engineering/safety.mjs：路径/链接/敏感/大小、UTF-8原字节、只读Git、对象和Diff。
- engineering/context.mjs：复用CollaborationCore权限/Task/SQLite，来源、快照、包、核验/导出。
- engineering/cli.mjs：独立离线预览入口及虚构演示。
- scripts/migrate-engineering-context.mjs：一致性副本迁移与逐表校验。
- test/engineering-context-12.test.mjs：17项实际虚构文件/Git/数据库测试。
- 本目录操作与状态报告；README/INDEX/AGENTS中的任务状态指针。

没有更改src、native或desktop的冻结运行代码；没有新增后台模型/Agent Runtime，没有操作原会话/草稿或凪。

## 数据迁移实际选择

为避免修改冻结核心的全局Schema接受范围，**本轮使用Schema 2 + uec_migrations组件版本1**，仅在data/engineering-preview.sqlite新副本增加7个uec_实体表与索引/不可变约束。此前计划的全局Schema 3没有在主库执行；待生产集成时再统一评估版本升级。

这是兼容性的实施细节调整，不改变产品原则。当前主数据库仍workbench-001.sqlite、Schema 2且没有uec_表；旧业务服务没有被切换到预览库。

实际副本迁移验证：30张旧表所有原行/列内容保持、完整性ok、外键0违规、3个旧原生绑定暂停，未推广到主服务。证据evidence/UEC-001-migration.json。

新增实体：uec_migrations、uec_sources、uec_snapshots、uec_snapshot_files、uec_packages、uec_package_files、uec_requests。包/快照不可原地更新或删除；来源身份不可更新，last_snapshot必须属于该来源和项目。

## 测试结果

17/17针对性测试通过，0失败。证据evidence/UEC-001-phase12-tests.txt。材料均为虚构。

覆盖：目录/Git来源与前缀越界、唯一来源、HEAD/dirty/untracked/deleted/renamed/staged+unstaged、敏感路径排除、候选秘密与已从HEAD删除的秘密阻止打包、并发变动、链接/ADS/路径、跨项目/非接收者、真实Git apply重建字节、空文件/CRLF/无末尾换行、不可变版本、损坏/缺失/额外文件、幂等重启、提交失败不发布、迁移/恢复及旧快照、来源身份约束、Git过滤器拒绝。

首次Diff重建测试发现测试克隆继承自动CRLF。已固定克隆环境，再以独立CRLF/空文件/无末尾换行用例验证实际字节，未将文本归一化冒充原件。

真实Adapter/原会话测试：0次。没有三方Manifest接收回执，不能宣称三方信息交换已经自动化。

## 可用入口

```powershell
.\runtime\node.exe engineering\cli.mjs --self-check
.\runtime\node.exe engineering\cli.mjs --demo
.\runtime\node.exe engineering\cli.mjs --list
.\runtime\node.exe engineering\cli.mjs --verify
.\runtime\node.exe engineering\cli.mjs --export
```

CLI的虚构演示位于sandbox/engineering-projects，默认预览库与主服务分开。当前最新演示元数据data/engineering-demo.json指向v1/v2及导出目录。早期开发演示已留历史，不覆盖旧包。

## 风险与未完成

- 当前为离线CLI/模块，未接入WPF工程材料管理界面或主HTTP服务。
- 当前操作allowlist只支持本平台目录，CLI仅虚构沙盒；未注册或读取任何外部真实仓库。
- 只支持受限大小的UTF-8文字。二进制、非UTF-8、Git外部include/内容过滤器、共享Git元数据、子模块暂不支持，明确停止而非偷偷放宽权限。
- 敏感扫描是已知模式与排除策略，不能证明识别所有未知秘密；真实材料仍需用户审核。
- 一致性为文件/清单/Git状态复核，不声称任意并发下的OS原子快照。
- 测试报告导入一律标记USER_IMPORTED_REPORT、execution_verified=false，不冒充平台实际运行。
- 没有材料接收Adapter、真实附件上传或完整Evidence Ledger；包版本与原审批的正式联动在Phase 4，不能将包v2当作已获得任何旧批准。
- 文件系统与SQLite非同一事务：封存后提交失败保留孤立目录且不发布，不自动删除/重发。尚无面向最终用户的孤立包恢复UI。
- STORE_BYTE_VERIFIED只证明本地材料字节，不证明Agent接收、理解或结论正确。

## 回滚

本轮主库/主服务没有切换，无需原地逆迁移。停止使用离线入口即可停用组件；保留engineering-preview.sqlite与artifacts/engineering-preview中的历史。数据库副本恢复已用虚构库实际验证，不覆盖源库或原Session。

若需重新建立候选库，使用新的目标文件和新的隔离对象目录，再执行副本迁移；已有目标会拒绝覆盖。禁止删除旧版本来“修复”核验失败，禁止把恢复备份当共享材料。

## 下一阶段

先评审离线材料与权限/哈希规范，再按独立Task接入WPF/本机API和材料接收能力。ChatGPT仍优先候选B人工附件；任何原会话只读探测、上传或恢复投递必须另行明确授权。当前没有这些授权，保持暂停。
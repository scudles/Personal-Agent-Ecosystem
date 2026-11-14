# Unified Engineering Context 001 — Phase 0 审计

日期：2026-11-12。工程：D:\TriReviewBridge。

**结论：已有协作业务骨架和文字审批快照，但没有统一工程文件快照、不可变文件材料库和三方文件接收证明。现阶段不能宣称三方基于同一份完整工程材料进行了审查。**

本轮仅审计与方案：未增加UEC业务代码、未改Schema、未创建工程材料包、未打开原生会话、未上传附件、未恢复真实投递。凪的工程、配置、运行数据未访问或修改。原有独立模拟稳定性测试不作为工程附件链路证据。

## 1. 实际核对结果

| 检查项 | 真实现状 | 证据/复用位置 |
| --- | --- | --- |
| 项目/会话隔离 | 已有Project/Workspace、主体权限、复合外键、唯一原生绑定 | src/workbench.mjs；src/collaboration-core.mjs |
| 实际数据库 | workbench-001.sqlite，Schema 2，30张业务表；完整性ok，外键违规0 | evidence/uec-001-phase0.json |
| 项目仓库登记 | 没有repository_path、来源授权或主仓库绑定实体 | 实际表/列与源码搜索 |
| 当前工程Git身份 | D:\TriReviewBridge不在Git仓库内；rev-parse退出128；HEAD/branch未知且应为null | 只读Git命令实际运行；未git init |
| 审批快照 | 已有不可变snapshots，冻结正文、约束、附件名称/声明hash、任务要求、审查规则等 | Workbench.prepareSnapshot |
| 附件模型 | 名称+用户声明SHA；不读取/托管文件，不证明实际字节存在或已交付 | Workbench.put/prepareSnapshot；WPF NewReview |
| 项目知识 | 版本化文字卡、显式角色共享、按消息引用；不是任意工程文件存储 | CollaborationCore知识方法 |
| 消息传输 | text-only，原适配器保留；新后台只装配SimulationAdapter | workbench-server、transports、Supervisor |
| 文件上传接口 | 未找到multipart/受控文件上传或artifact下载路由 | 新旧server源码 |
| 原生附件操作 | DesktopSession仅inspect/select/read/peek/calibrate/send；没有attach/upload | native/DesktopSession.cs:158 |
| 存储与证据 | SQLite、evidence JSON/日志、backups、离线UI exports及test-output；用途分散 | ARTIFACT_STORAGE_AUDIT.md |
| 自动化基线 | 当前冻结版78/78通过，0失败；含实际WPF和模拟Adapter | evidence/001-all-tests.txt |
| 真实材料接收 | 本轮真实附件测试0次；三个原始绑定均暂停，真实Adapter硬锁 | 审计JSON、能力接口及服务health |

78项通过不等于文件交换已完成：没有新增工程Git快照/Artifact完整性/真实附件测试。此前真实消息线路的历史证据也不能代替本阶段附件验收。

## 2. 可复用与不可混淆的名称

可直接复用：项目权限、Conversation/Workspace、Task事项、消息来源、投递状态与幂等、UNKNOWN禁止重发、审批版本失效、审计与备份/副本迁移、WPF原生UI、现有hash/canonical函数。

现有snapshots是**审批对象快照**，不是Working Tree快照。现有attachments是**声明引用**，不是附件内容。knowledge_versions是**授权文字知识**，不是原始源文件包。exports的manifest是**离线UI渲染清单**，不是工程Artifact Manifest。

上述对象继续保留原含义，不改名、不覆盖、不重算旧hash。

## 3. 四个主要差距

1. **来源**：未绑定实际仓库路径和身份，无法证明项目名与磁盘材料对应。
2. **字节**：没有从Working Tree捕获原始文件字节并封存；仅给hash字符串不能补足文件。
3. **接收**：没有把同一版本材料交到三个原生Session的可靠通道，ChatGPT附件尤其未验证。
4. **证据**：现有意见主要绑定审批快照，缺少package/snapshot/file/line/test-run的一致版本关联。

## 4. 必须先说明的约束冲突

### 工程本身目前不是Git仓库

建议登记repository_type=directory，Git字段显式null；仍支持字节快照，标明没有Git Commit/Diff证据。Git功能在虚构Git仓库验证，不擅自对现有工程git init、commit或改变用户工作树。是否将平台源代码纳入Git属于单独决定。

### 读取材料与现有“禁止工具”保护

现有工作流提示材料禁止工具/文件读取，Supervisor.collect要求noToolCalls=true。Hermes或DSH若通过原生工具读取材料，当前会被判为不符合本轮保护。

未来只能增加**独立、可审计、限定package/file的只读材料权限**，继续拒绝写文件、Shell和其他工具活动；不能把noToolCalls简单改为允许全部。Phase 1/2离线快照不需要放宽现有原生权限。

### 桌面投递仍暂停

生成文件包不等于获得恢复真实投递授权。方案确认只允许实施相应模块；原会话只读探测、附件试投、正式发送分别需要明确授权。不存在自动解锁按钮。

### 同一Manifest Hash不等于三方实际读取全部字节

抄回一个hash只能证明声称一致。必须区分本地库校验、附件可见、用户报告、内容抽查和接收端逐文件字节校验。详见AGENT_FILE_ACCESS_AUDIT和实施计划。

## 5. 风险分级

- 高：误把旧备份整包分发，可能带入令牌、Session资料、日志或浏览器Profile；默认禁止。
- 高：标题匹配/固定PINNED.ID不是原会话实际ID证据，自动附件不能据此直接上线。
- 高：Working Tree在读取时变化、Git Diff与捕获字节不一致，会产生伪同版材料。
- 高：跨项目路径越界、NTFS junction/symlink/ADS、父目录授权范围不清。
- 高：Agent回声hash被错误标为VERIFIED，或将旧版通过状态复制给新版。
- 中：同名源文件/Windows大小写/编码/换行处理导致哈希失配；必须按原字节保存。
- 中：附件格式、大小、数量、原应用版本或账号能力尚未验证。
- 中：新数据库迁移与文件库落盘非单一SQLite事务；需staging→校验→封存，失败保留审计，不暴露半成品。

## 6. 本轮交付与下一步

本目录五份文件构成审计与可评审实施计划。IMPLEMENTATION_PLAN.md明确模块、表、Hash范围、接收证据、测试、迁移和回滚。

建议用户确认后先实施Phase 1/2及模拟接收/证据关联；以人工确认式附件交付B作为首个真实渠道候选，自动附件A保留为后续经过授权的可靠性验证。尚未获得确认，不开始UEC开发。
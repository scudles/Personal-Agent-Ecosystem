# Governance Guard 接口与能力边界

制度版本：MAG-001，ACTIVE / PROTECTED。
实现：guard.mjs；诊断入口：guard-cli.mjs。全部当前验证使用虚构任务和隔离治理副本，不调用三个原生Agent。

## 可运行入口

```powershell
.\runtime\node.exe governance\guard-cli.mjs --self-check
.\runtime\node.exe governance\guard-cli.mjs --input governance\examples\l1-task.json
.\runtime\node.exe governance\guard-cli.mjs --input governance\examples\user-reminder.json
.\runtime\node.exe --test test\governance-001.test.mjs
```

CLI 0=结构化检查无阻断，2=WOULD_BLOCK，1=错误/完整性异常。无阻断不等于风险语义完整、任务完成或实施授权；assessmentOnly=true、executionAuthorized=false始终保留。示例提醒记录simulation=true，不是说用户真的提出了违规要求。

## 结构化接口

- load：校验ACTIVE版本、manifest、历史/当前权威文件和policy内容一致；异常不通过。
- assessTask：负责人唯一、结构化风险下限、人数/独立性、L2第三方依据、L3专项/必要用户授权、材料引用、P0/P1与交付证据。
- assessReview：轮次与第二轮范围；有新证据/实质修改/风险变化才可例外。
- assessIntent：只对明确operation与上下文判断，产生request/rule/impact/alternative四字段。
- createIssue / transitionIssue / reclassifyIssue：唯一问题、精确problemKey去重、修复与验证分开、关闭重开依据、严重程度有据重评；任务载荷不能隐藏已登记P1。
- freezeTask / assessScopeChange：冻结目标/范围/验收/材料，新需求另Task；不把负责人调整或有据风险重评分级误当新增工程范围。
- proposeRevision / confirmRevision：说明旧规则、目的、影响和新规则；待可信用户确认后新版本，保留旧版本。
- events：本地append-only事件记录；默认在governance/audit/guard-events.jsonl。

宿主集成须提供已认证用户的verifyUserDecision与受控材料的verifyArtifact。默认用户确认拒绝、Artifact核验未知；不信任Agent提交的userAuthorized布尔值。异步未等待Promise也不算授权。此库本身不认证调用者，不能把外部JSON中的actor:user当成可信身份。

## 已实现/未实现

已运行：规则校验、四项提醒落盘、Issue状态、范围冻结、规则完整性、在隔离副本执行正式修订/保留历史。生产MAG-001只初次采用，没有发布MAG-002。

尚未自动化：所有旧HTTP/Workflow入口强制调用Guard、WPF治理面板、对任意自然语言的意图理解、所有语义重复问题、风险语义的正确判断、真实工程材料字节核验、跨进程事务化Issue存储、OS级防篡改、独立原生Agent复核。

当前Issue日志适用于单进程结构化验证；未来多窗口/多调用者接入应复用主后端SQLite事务与ACL，不直接让多个进程修改JSONL状态。

旧业务入口未被宣称已强制守卫。制度已正式适用，工程任务仍应按制度执行；Guard全入口接入属于后续独立改造，不能在未核对兼容性时悄悄改变旧全票正式审批。

## 状态与恢复

FIXED不等于VERIFIED。P0/P1延期仍阻断；P2/P3误置blocking仅提醒并按非阻断处理。风险证据应通过reclassifyIssue记录，而非换说法创建新问题。

规则文件/Manifest异常时停止判断。正式修订先写新版本，再发布，任何崩溃导致当前文件不一致均失败关闭，人工从最后已确认版本恢复；不删除旧版本、不自动降级。用户确认须精确绑定proposalHash；版本不能覆盖。

本实现是应用层完整性和流程保护，不能阻止同权限管理员同时篡改程序及所有校验文件；不宣称密码学证明用户身份或OS不可变存储。
## 后续集成状态

现有库的assessment接口保留；新增engineering/governance-host.mjs在受鉴权工程治理入口强制执行、使用SQLite事务存储Issue/轮次/四项提醒，并接WPF。旧普通文字审批保持独立语义，不被当作工程交付凭证。自然语言意图不做通用自动判断；真实原生Agent仍未参与。最新范围/复核/耐久状态见 [离线升级报告](../docs/offline-completion/DELIVERY_REPORT.md)。上文历史“未接入”清单以此补充和当前报告区分具体入口，不代表已获得OS防篡改或真实实施能力。

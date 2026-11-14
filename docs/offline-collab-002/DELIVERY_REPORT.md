# 新版离线协作升级交付

任务：TRB-OFFLINE-COLLAB-002。唯一负责人：Codex /root。治理：MAG-001 ACTIVE。风险：L2；一名独立只读Codex复核，不冒充ChatGPT Observer。

**当前状态：离线候选已通过最终核验。192/192回归、两轮独立复核及当前冻结构建的一小时实际耐久均通过；真实三方接管不在此通过结论内。**

## 已实现

- 自然语言定向文字任务、独立文字复核、总结与状态查询；新增“一个负责人完成后交一名复核者”的持久计划，第三方只按明确要求参与。引用和代码不触发路由。
- 当前版本有效负责人回执到达后才建立一次复核；UNKNOWN不重发，预算跨文字/材料与未来复核预留统一核对。材料、知识授权、身份或版本改变会安全停止，不自动返工或获得实施授权。
- 新工作台公共创建/修订/审批/授权/调度入口执行治理；已登记工程事项沿用原Governance Host，不能经普通文字入口绕过范围、Issue、材料版本和轮次。
- 已知消息来源由后端读取真实记录，固化ID、作者与正文hash，纳入审查快照；修订与交叉复核不能清除来源或让原作者自审。旧快照不补字段，不改旧hash。
- 原生WPF显示计划/治理提醒及必要异常，保留深浅色、项目/多会话、草稿隔离和备用高级操作入口。创建新会话不会错误保存旧草稿；合法来源审查可在原生界面修订。
- 新启动入口与旧版并存：**打开新版协作工作台.cmd**。仅使用独立虚构预览和模拟接入，不切换主平台。

## 验证

- 完整当前回归：192/192通过，0失败。命令、日志、原生集成证据见下方。
- 正式独立复核两轮：发现并解决P1-COLLAB-ENTRY-001；第二轮只检查同Issue及直接回归，未增加第三轮全量审查。最终候选包修订3，正式reviewRound仍2；111包文件、103源映射核对一致。
- 原生WPF真实进程集成通过，未使用WebView；源码与二进制绑定证据。包括实际对话框的消息来源审查→合法正文修订→来源快照保留。
- 最终烟测：30.67秒，acceptance=false，不能替代一小时。
- 最终一小时：通过，实际3600.573秒；6轮材料、18份模拟收件、9次文字投递，共27次模拟提交，6次后台重启，0重复提交，数据库integrity/FK通过。Node/WPF双心跳和冻结74项依赖核对一致，草稿保留；证据为soak-current.json及verification.json。
- 主平台配置/旧exe/旧XAML、45项保护文件和原档案核对；三条原生绑定仍暂停，主库不迁移。

## 实际限制与剩余事项

本次新增编排限有界文字流程，任意条件分支、多负责人、自动循环修订暂不支持。工程材料正式审查继续使用准确Artifact及原Governance Host入口，普通文字审批不能替代；未关联自然文本的风险与任务归属不自动猜测。常见工程协作不应因此伪装执行成功，必要时返回明确说明及保留入口。

首次使用者观察和实际Windows125%/150%DPI未验证。WPF图像为本程序RenderTargetBitmap预览，不是桌面截图。没有主平台升级、真实常驻接管或原生Adapter完整可靠性通过结论。

用户随后授权的真实材料互通另建 **TRB-REAL-MATERIAL-CANARY-001**：Hermes先取得内容回执，随后经用户单独批准的固定只读命令返回哈希相符报告（AGENT_REPORTED_BYTE_MATCH，非Bridge独立工具执行验证）；DSH虽获草稿/窗口文本授权但editor未安全定位，未备份/修改/发送；ChatGPT人工附件B已由用户发送并转回READ_COMPLETE/HASH_NOT_RECOMPUTED回执，内容相符但哈希未重算。两处隐私审查拒绝和ChatGPT UI工具限制不绕过。此真实试验不计入离线测试的0真实Adapter操作。详见[真实材料状态](../real-material-canary-001/DELIVERY_STATUS.md)。

## 证据入口

- [阶段实施与范围边界](STAGE_REPORTS.md)
- [操作、停止及回滚](OPERATIONS.md)
- [范围冻结及验收清单](IMPLEMENTATION_PLAN.md)
- 代码、脚本、测试及文档变更：[文件清单](FILE_CHANGES.md)与[原始哈希记录](../../evidence/offline-collab-002/changed-files.json)。
- 完整回归：[all-tests.txt](../../evidence/offline-collab-002/all-tests.txt)；当前原生：[native-integration.json](../../evidence/offline-collab-002/native-integration.json)。
- 独立复核：[第一轮](../../evidence/offline-collab-002/independent-review-round1.json)、[第二轮](../../evidence/offline-collab-002/independent-review-round2.json)及[最终同Issue继续核对](../../evidence/offline-collab-002/independent-review.json)。
- 不可变包：[第一轮包](../../evidence/offline-collab-002/review-package-round1.json)、[第二轮包](../../evidence/offline-collab-002/review-package-round2.json)、[候选修订3](../../evidence/offline-collab-002/review-package-candidate3.json)；[review-package.json](../../evidence/offline-collab-002/review-package.json)仅当前指针，旧包保留。
- 一小时运行历史指针：[soak-running.json](../../evidence/offline-collab-002/soak-running.json)；成功后已写soak-current.json。
- 当前汇总：[verification.json](../../evidence/offline-collab-002/verification.json)。一小时仍在RUNNING时，该汇总不是最终一小时通过结论。执行 `.\runtime\node.exe scripts/verify-collab-002.mjs --require-review --require-soak` 可核对当前版本、完整性、模拟范围与保护项；运行中不应通过require-soak。

完整回归采用当前Collab原生集成代替三个保留的历史exe包装测试；底层原生自检、UX及深色测试仍在新集成中实际执行。复现实例：

```powershell
$tests = Get-ChildItem test/*.test.mjs | Where-Object { $_.Name -notin @('workbench-native.test.mjs','ux-native.test.mjs','ux-theme.test.mjs') } | ForEach-Object { $_.FullName }
.\runtime\node.exe --test --test-concurrency=1 @tests
```

## 数据与回退

没有新Schema或主库迁移；复用records/entity_scope保存计划。构建及所有功能验证均在隔离副本/虚构数据库。备份位置由baseline.json指向101个既有代码文件的备份。旧界面、旧web和旧预览保留，最短回退用原入口；代码恢复请在新隔离副本按原映射恢复，并隔离新增C#文件，勿让旧通配构建混入新版类。保留证据与新数据库，未完成计划库不交给旧调度器继续运行。

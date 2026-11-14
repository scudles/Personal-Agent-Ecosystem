# SEALED_BATCH_ONLY：固定六向90key小时上限例外

Task：TRB-REAL-LINK-SEALED-BATCH-001；唯一负责人Codexroot。候选仅虚构测试，必要独立复核待进行；未读取/修改真实ledger、数据库、原Session、草稿、Runtime或任何E盘文件。未运行REAL apply。用户已明确“额度不设上限”；此实现只将该决定约束到已封存六向30组，不变更生产守卫或平台额度，不赋予新自主任务范围。

## 行为与合同

默认和既有账本行为保持：cap仍为原先1..30（当前run原配置12），actual/native/manual共享一小时计数与未决占位，原20项回归通过。初始化不能直接传例外，也不能设置cap=null绕过旧约束。

新增显式API：`ledger.apply('authorize-sealed-batch', declaration)`。这是本地审计授权记录，不发送；仅当前已初始化run可以启用。声明字段必须恰好为：

```json
{
  "format": "TRB_SEALED_BATCH_BUDGET_AUTHORIZATION_V1",
  "runId": "trb-real-links-20261112-001",
  "budgetMode": "SEALED_BATCH_ONLY",
  "manifestIdentitySha256": "2afe957c338f3c1adaf4374fb8b993df29443d14ea43ac64216ad543b8c7d957",
  "audited": true,
  "userInstruction": "额度不设上限",
  "provenance": "OPERATOR_ASSERTION",
  "reference": "root填写真实用户指令的可审计引用"
}
```

`audited:true`是root已核对用户指令及本run范围的明确操作者声明，并非工具验证用户身份/独立平台授权。声明随当前3原binding的规范哈希、应用时刻一同持久化；记录后不可改指令/引用/binding。相同声明重复apply只返回duplicate，无新audit/无新提交许可。

新模块使用本目录`manifest-identity.json`封存的30个slot及challenge身份投影，bytesSHA就是上面的固定identitySHA；不是从调用者提供任意slot/manifest。投影取自本run原manifest的format/runId/createdAt/packageId/version/snapshotId/manifestHash和按id排序的slot{id,from,to,slot,challengeId}，不含可变执行状态。本模块不读取可变REAL ledger来生成范围，不接受新manifest路径或其他run。原manifest若被擅自改变不能扩大本封存名单；本工具也不认证发送正文，root仍须让sender使用同一封存挑战和原绑定。

每slot仅以下三个唯一requestKey，且attemptId必须与requestKey相同：

| key | kind / 来源 / 接收者 |
|---|---|
| slot.id + `.seed` | USER_SEED；user/null fingerprint → slot.from原binding |
| slot.id + `.forward` | 无kind；slot.from原binding → slot.to原binding |
| slot.id + `.return` | 无kind；slot.to原binding → slot.from原binding |

不支持第四个.source/别名、新slot、其他run、伪造方向、user→错误目标、更换原Session或新增Agent。30×3=90个固定key；即使CANCELLED_UNSENT、FAILED、CONFIRMED或经过一小时，该key仍保留且不能新reserve/begin重发。

## 只取消小时cap的两处准入检查

启用后仅这些key的reserve/begin跳过小时cap；仍先核对原Session、paused、coverage完整及主暂停边界。已存在非imported记录必须全部属于本封存集合且方向正确，否则整次启用失败，不静默豁免旧别名。

grant不改变paused/cap/bindings/任何attempt状态，不清UNKNOWN，不取消POSSIBLE，不改提交时刻，不重置请求幂等。begin仍只接受本run非imported的RESERVED；POSSIBLE/SUBMITTED/UNKNOWN及终态无法再次begin。当前CD-01.forward草稿或提交进度由root另行安全处理，本授权操作不碰应用草稿、消息或该状态。

所有导入历史继续保存和计数；包括其他run旧文件上传和UNKNOWN。imported记录不获得新准入，即使key碰巧属于90集合也不能begin。result/reconcile规则不修改；UNKNOWN仍仅按旧明确真实回执规则结算，不能清除来重发。import-history仍会暂停；授权也不自动恢复原队列或本run暂停。

status.budget在激活时清晰返回：budgetMode=SEALED_BATCH_ONLY、cap=null、hourlyLimit=null、maximumUniqueKeys=90、consumedUniqueKeys/remainingUniqueKeys、configuredHourlyCap（旧cap原值）、固定identitySHA和授权引用。`used/held/knownRecent/unresolvedAttemptIds`继续保留共享历史实际记账；used不是本例外的小时限额，可能包含别run的导入历史。生产/其他未启用账本的预算返回行为不变。`realSending:false`、`automaticRetry:false`等声明保留；本地工具不能约束绕开账本的其他程序/人工，checksum也不是OS防篡改保护。

## root正式apply（仅准备，本实现方未运行）

1. 必要独立复核通过后，root核对本run用户指令、32项自测及本候选哈希。
2. 以wx在固定imports路径新建`D:/TriReviewBridge/evidence/real-link-runbook-001/imports/sealed-batch-authorization.json`；复制本目录模板并把audited由false改true、reference换成实际可审计指令引用。不覆盖旧授权输入、真实ledger或其他run材料。
3. 由root执行一次正式命令（本工具变更状态仅限隔离runbook，不投递）：

```powershell
D:\TriReviewBridge\runtime\node.exe D:\TriReviewBridge\tools\real-link-runbook\cli.mjs authorize-sealed-batch --environment REAL --input D:\TriReviewBridge\evidence\real-link-runbook-001\imports\sealed-batch-authorization.json
```

4. 核对返回仍保持原paused值、cap配置与原binding不变，budgetMode明确SEALED_BATCH_ONLY；已有POSSIBLE/UNKNOWN原样。不因此再begin CD-01.forward，不清理/重输草稿或补发。接收端结果记账仍用既有result流程和实际证据。

CLI未新增任意路径参数；REAL仍固定`evidence/real-link-runbook-001/shared`和imports目录，不能用--directory换真实账本。不要手改REAL JSON或复制fake账本进去。若需停止该run，用原pause=true；没有新解除主暂停、恢复发送或后台sender能力。

## 自测与冻结

运行：`node --test tools/real-link-runbook/ledger.test.mjs tools/real-link-runbook/increments/sealed-batch-001/authorization.test.mjs`。

已完成32/32 pass，fail0，exit0，duration6138.5809ms；原20项+新12项。涵盖默认cap12、全部90key、范围外/错误run/hash/声明/来源、paused不跳过、POSSIBLE/UNKNOWN不重发、幂等与重启、导入历史保留、binding变更拒绝及FAKE_TEST CLI。全部状态数据在新`test-output/real-link-runbook-001-fake-*`内，没有REAL ledger操作。该结果是实现方自测，独立复核尚未完成。

修改仅tools/real-link-runbook/ledger.mjs，新增sealed-batch.mjs和本increment文件。原cli.mjs、ledger.test.mjs及README.md未改；旧源码保存为baseline/*.txt以便定向比较。CANDIDATE.json列冻结SHA；旧候选/测试报告不覆盖。

## 回滚与停止边界（仅说明，不增加新操作）

- **REAL授权尚未apply时**：本增量没有改真实账本；无sealedBatchAuthorization的旧V1账本保持原格式，已审旧工具可按原小时cap正常使用。回退代码前先核对实际账本是否已出现授权字段，不能凭文件版本猜。
- **REAL授权已经apply后**：安全停止仍使用新兼容工具的原`pause {paused:true}`操作。它保留全部attempt、请求幂等、POSSIBLE/UNKNOWN及授权审计，不清空/取消/重置真实ledger，也不解除其他暂停或草稿保护。本增量没有取消授权或切回小时模式API；不通过删字段/raw改JSON/checksum来实现切回。
- **暂停后直接换回旧代码并不兼容**：旧validateState拒绝新增sealedBatchAuthorization字段，status/result/reserve等将fail closed，不能继续记账；暂停本身不会去掉该字段。旧码的拒绝不丢attempt，也不赋予重发许可。不要用过滤字段的包装器规避；保留新兼容工具及账本备份供正常记账，停止进一步begin。
- 若以后确需恢复旧实现/旧小时模式，须另行实现并审查保留全部attempt/idempotency/UNKNOWN/审计记录的无损兼容方案；当前不开展迁移，不恢复旧小时cap后猜测哪些请求可重发。现有pause足以安全停止该run；已产生的真实提交仍按实际回执结算，不重发。
- 本例外仅隔离runbook。主DB、生产原限额和Adapter从未修改；停止/回滚该工具不需要、也不得去改主DB限额、原Session配置或Runtime。

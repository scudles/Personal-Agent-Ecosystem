# 六向证据文件采集器

这个工具只导入用户明确指定的本地JSON。没有发送、RPC、UI、公网、命令执行或自动发现会话能力。导入不恢复常驻、不更改暂停，也不读取未在batch中明确引用的回执。

```powershell
.\runtime\node.exe tools/real-link-evidence/collector.mjs --input <本地batch.json> --out evidence/real-link-evidence-tools-001/<新报告名>.json
```

输出必须在本Task新evidence目录或test-output中；采用不覆盖写入，已有报告保留。回执路径相对于batch目录，禁止绝对路径、`..`、符号链接和共享硬链接。最多30个往返、60份回执，每份不超过1MiB。工具不复制私密原文，仅输出核对所需ID、hash、状态和声明类型。

batch输入、artifact和输出都必须留在固定工程Root内；从盘符根目录检查全部祖先lstat和realpath，包含import base以上祖先。读取限长并核对文件打开前后稳定性；batch最多4MiB。输出与任何输入冲突或已有目标时拒绝，采用独占`wx`；所有路径检查共用`tools/safe-local-files.mjs`。这是本地检查，不是OS隔离或对恶意并发路径篡改的证明。

## Batch合同

`format`为`TRB_REAL_LINK_BATCH_V1`；`runId`明确批次；`environment`必须为`FAKE_TEST`或`REAL_EVIDENCE_IMPORT`。三方`participants`分别填原会话的SHA-256身份指纹。指纹只是导入者提供的映射，本工具不独立证明它就是原Session。

```json
{
  "format": "TRB_REAL_LINK_BATCH_V1",
  "runId": "明确的本批ID",
  "environment": "REAL_EVIDENCE_IMPORT",
  "participants": {"hermes":"64位hex指纹","deepseek":"64位hex指纹","chatgpt":"64位hex指纹"},
  "artifacts": [
    {"id":"receipt-fwd","path":"forward.json","sha256":"文件实际SHA256","provenance":"HUMAN_REPORTED"},
    {"id":"receipt-back","path":"return.json","sha256":"文件实际SHA256","provenance":"HUMAN_REPORTED"}
  ],
  "roundTrips": [{
    "id":"本批唯一往返ID","from":"hermes","to":"deepseek","slot":1,
    "mode":"HUMAN_ASSISTED_REAL","challengeId":"本批唯一挑战ID",
    "package":{"id":"准确包ID","version":1,"manifestHash":"64位hex"},
    "forward":{"artifactId":"receipt-fwd"},"return":{"artifactId":"receipt-back"}
  }]
}
```

例子中的中文占位值须替换成实际值；它不是可直接通过校验的真实证据。ID采用1至160字符的英数、下划线、点、冒号或连字符。六向是Hermes/DSH/ChatGPT之间的全部有向组合，每向slot只允许1..5。

`provenance`只允许`HUMAN_REPORTED`、`AGENT_CLAIM`、`PLATFORM_OBSERVATION_IMPORT`、`SIMULATED`。`mode`只允许`HUMAN_ASSISTED_REAL`、`AUTOMATIC_REAL`、`SIMULATED`。人工/Agent声明文件不能支持`AUTOMATIC_REAL`模式；即使导入者标为平台观察，工具仍标记`originAuthenticatedByCollector:false`，不把用户提供的标签认证为真实平台观测。

## 两腿回执合同

每份JSON为`TRB_REAL_LINK_RECEIPT_V1`，具有下列字段：

| 字段 | 规则 |
|---|---|
| attemptId | 本批唯一提交ID，不与任何另一腿复用 |
| from / to | 去程A→B，返回B→A，不能替换接收人 |
| fromSessionFingerprint / toSessionFingerprint | 与本批participants映射精确一致 |
| packageId / packageVersion / manifestHash | 两腿都绑定该往返预期的准确包/版本/hash |
| challengeId | 与该往返挑战一致，不能借另一条回执补票 |
| sourceMessageId / receivedMessageId / replyId | 三个真实来源/收件/回复标识；返回sourceMessageId必须等于去程replyId |
| sourceBodyHash / replyBodyHash | 64位hex；返回sourceBodyHash必须等于去程replyBodyHash |
| state / completed | `RECEIVED`且`completed:true`才具有闭环所需结构 |
| submissionAttempts | 必须恰好为1；不把重复提交计为成功 |
| receiverByteClaim | 可选，始终保留为接收端声明，不能升级为collector字节核验 |

去程`replyId`作为返回`sourceMessageId`是规定的同一来源复用。其他往返ID、方向slot、挑战、artifact、attempt或同一参与者的消息ID重复，会使涉及的全部记录不计闭环，不只丢掉后到的一条。UNKNOWN、未结束、缺腿、错会话、错投、版本/hash不符、返回未绑定原回复也不计闭环。

## 结果的严格含义

- `totalStructurallyCompleteImported`：只说明导入数据及本机回执文件内部结构/绑定完整，虚构测试也可以有这个数字。
- `totalReportedComplete`：只有`REAL_EVIDENCE_IMPORT`中满足结构且非模拟的条目，才记为“导入者报告的真实闭环”；不是独立确认。
- `humanAssistedReportedComplete`与`automaticClaimsStructurallyComplete`分别统计，人工B不补自动线路次数。
- `realRoundTripsIndependentlyVerified`固定为0，`acceptancePassed:false`。这个无发送能力的文件工具不能独立证明原会话身份、原始平台观察、真实时序或接收端工具行为。
- 本机artifact hash匹配仅验证导入文件未偏离所提供hash，不证明接收端重新计算过材料SHA-256；抄录预期值不会产生BYTE_VERIFIED。

唯一性只覆盖本次完整输入batch。续批须合并同runId的原账本和新证据再次导入为新报告；工具不自动扫描其他目录，也不声称检查了未导入的历史。真实最终验收仍需负责人/独立只读复核核对获准原始来源；不能通过编一个平台观察标签来通过。

## 虚构自测

```powershell
.\runtime\node.exe --test tools/real-link-evidence/collector.test.mjs
```

自测只在新test-output假数据目录写文件。30条六向假闭环可以验证完整度算法，但`FAKE_TEST`的reported-real次数始终为0，不填入真实验收名额。

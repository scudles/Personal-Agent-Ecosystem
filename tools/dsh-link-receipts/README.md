# DSH sealed link receipts — TRB-DSH-LINK-RECEIPTS-001

负责人：Codexroot。实现与fake测试候选；必要独立复核尚未完成。本工具本轮**未读取真实日志**，不发送、不调用UI/SDK/RPC、不创建Runtime/Session，不修改总账/manifest/attempt/原配置或暂停。旧canary获许可完成的事实与本run新输出范围分开；不再运行旧canary，不能外推其许可。

## 固定范围及封存合同

真实目录唯一固定为 `D:/TriReviewBridge/evidence/real-material-002/real-links-20261112-001`。不接受自选真实目录、日志路径、任意prompt/nonce、其他Task或历史搜索条件。只按`--slot`及`--leg`读取以下两个明确文件，不列目录：

- `manifest.json`：`TRB_REAL_LINK_EXECUTION_MANIFEST_V1`，runId=`trb-real-links-20261112-001`，30个唯一slot/challengeId，6方向各5个。
- `attempts/<slotId>.<leg>.json`：首次发送前由root以wx独占创建，准确记录**最终实际提交的UTF-8文本**。后续提交状态、transport与结果另存sidecar，不能修改封存请求；本工具不读取sidecar。

manifest不可变身份投影包括format/runId/createdAt/packageId/version/snapshotId/manifestHash和按id排序的slot{id,from,to,slot,challengeId}。投影JSON SHA固定为 `2afe957c338f3c1adaf4374fb8b993df29443d14ea43ac64216ad543b8c7d957`；可变状态不影响身份，challenge或包信息变动拒绝。该哈希是本机封存身份，不是平台认证。

attempt字段必须恰好为：

```text
format: TRB_REAL_LINK_ATTEMPT_V1
runId: trb-real-links-20261112-001
slotId: manifest中完整slot.id
leg: USER_SEED | FORWARD | RETURN
challengeId: 对应slot.challengeId
requestNonce: challengeId + '.' + leg
targetRole: deepseek
preparedAt: 实际封存时间，严格UTC毫秒ISO，不早于manifest.createdAt且不在未来
exactText: 完整最终提交文本，不作trim或换行规范化
textSha256: SHA256(UTF8(exactText))，完整小写hex
```

DeepSeek正文第一行必须精确为 `TRB_REAL_LINK <requestNonce>`，后面可跟LF及正文。USER_SEED和RETURN只允许slot.from=deepseek，FORWARD只允许slot.to=deepseek。SOURCE不支持；其他平台不走此读取器。六向中的来源类型、Agent/用户seed及额度账本由root另管理；DSH日志里的user/message只证明DSH接收了所封存输入，不证明跨Agent自主传输。

manifest与attempt都是root封存的操作者数据。工具能校验字段、方向、hash和持久事件对应，**不能从文件修改时间证明“发送前封存”或抵御同权限恶意篡改**，因此输出保留`attemptProvenance:OPERATOR_SEALED_BEFORE_SEND_ASSERTION`。不得将自填preparedAt冒充独立平台提交时间。

## 离线测试和CLI

```powershell
node --test tools/dsh-own-receipt/receipt.test.mjs tools/dsh-link-receipts/receipt.test.mjs
node tools/dsh-link-receipts/receipt.mjs --fixture D:\TriReviewBridge\test-output\dsh-link-receipts-fake-显式目录 --slot 完整slotId --leg USER_SEED
```

fixture只接受`test-output`直接子目录`dsh-link-receipts-fake-英数连字符`，明确读取该目录`manifest.json`、选定attempt和`rows.jsonl`。要求虚构manifest标记和虚构Session/header/title；使用既有safe-local-files祖先链接拒绝与有界稳定读取。无参数/缺flag/非法选择器UNKNOWN且不读真实日志。代码不输出文件，fake测试仅写新fake目录。

## 真实读取权限：当前未申请/未执行

旧canary授权不覆盖本轮。必须完成必要独立review，用户另行明确允许**本run六向已封存请求**的完整原日志读取与内存解压、限定回执输出，且自动审查允许后，由root逐个实际已发送attempt执行：

```powershell
node tools/dsh-link-receipts/receipt.mjs --real --ack-private-history-read --slot 完整slotId --leg USER_SEED
```

这两个flag仅防误触，不构成权限授予或绕过审批。读取前先验证manifest/attempt全部合同；一次命令只处理一个明示slot/leg，不批量扫描。唯一原日志仍为`C:/Users/Administrator/.dsh/sessions/--E-~51EA--/session-ebd654d5-1bf8-419c-bc2a-d9be1ed023fc/session.v4.jsonl.zstd`。

**物理上会只读打开并整体读取64MiB以内的压缩日志，在内存整体解压到最多256MiB；会接触原会话其他私密历史和工具数据。过滤输出不是未读取历史。** 不打开其他日志/配置/附件，不访问E盘（header.cwd字符串只用于身份核对），不调用App/SDK/RPC/UI/resume/flush，不写原目录或执行材料。固定原Session、header、title和稳定读/祖先链接/限长保护复用已审工具；缺失、变化、格式不支持或限额超出UNKNOWN，不修复日志或扩大范围。

## 回执意义与复用边界

复用`tools/dsh-own-receipt/receipt.mjs`已审Reducer。只新增封存请求参数及默认拒绝的固定日志读取导出：旧canary默认request/hash、nonce规则、时间窗、CLI条件、输出合同保持原样；原35项fake回归必须通过。旧源码baseline保存为`baseline/receipt.mjs.txt`，不作为可运行工具。

新模式以**第一行header**作为提交锚，再精确比较全文；重复完整prompt或同header不同全文均UNKNOWN。其他回合正文引用旧nonce/header不形成提交锚，不把其回复归给本轮。仅输出唯一对应turn的请求/最终回复原生UUID、seq/time/acceptedAt、turn起止及严格配对的工具次数。缺失/歧义/插入实质用户/未完成/未来或倒退时间、事件早于preparedAt均UNKNOWN；工具调用/结果按原生ID、turn/step/顺序/来源seq一对一闭合，不导工具args/results或无关历史。错误统一脱敏，无堆栈或JSON片段。

`RECEIPT_FOUND`只证明固定原持久日志内找到本次输入和完整回复，不能证明平台不可篡改、自主互通、材料bytesSHA、额度充足或授权实施。仍输出`integrity:NOT_BYTE_VERIFIED`和`executionAuthorized:false`；`acceptedAt`缺失明确null。`time`是Harness事件墙钟接受时间，不是UI点击时刻。未来扩展其他run或任意请求清单需另行封存/复核/许可，当前没有该能力。

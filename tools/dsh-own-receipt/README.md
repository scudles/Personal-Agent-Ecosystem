# DSH own receipt — TRB-DSH-OWN-RECEIPT-001

负责人：Codexroot。首轮独立复核发现 P1-DSH-RECEIPT-001（未校验工具生命周期）；本候选已按该 Issue 修复并经过虚构自测，待第二轮定向复核。真实模式未执行。

只核对已发送的一次固定 canary：`TRB-DSH-MATERIAL-20261112-001`。
精确请求来自 `交付材料/DSH本次试投请求.txt`（CRLF规范为LF、去单个末尾换行），SHA-256固定为 `351140d1d51264d6e81037ae3488b274b8d7e4ccc905c55b26365f53cd23fa23`。不能传入新提示词、nonce或原日志路径。

## 离线运行

`node --test tools/dsh-own-receipt/receipt.test.mjs`

测试只在 `test-output/dsh-own-receipt-fake-*` 新目录写虚构JSONL。无参数不读日志，返回UNKNOWN；`--fixture <绝对路径>`只接受上述新fake目录内文件，要求虚构header/session/title。路径读取复用`tools/safe-local-files.mjs`的祖先链接/有界稳定读取检查。

## 真实模式的具体权限范围（尚未授权/执行）

待用户单独明确允许读取并解压完整原会话历史、自动审批允许、必要独立复核通过后，负责人才能执行一次：

`node tools/dsh-own-receipt/receipt.mjs --real --ack-private-history-read`

此开关是显式防误触，不是授权凭证，不绕过自动审查。没有其他真实读取入口或路径参数。此前旧observe读取被自动审查拒绝，本工具不改变该决定；不重试旧命令。

唯一固定输入：
`C:/Users/Administrator/.dsh/sessions/--E-~51EA--/session-ebd654d5-1bf8-419c-bc2a-d9be1ed023fc/session.v4.jsonl.zstd`

**物理范围是完整压缩日志，只读打开后整体读入内存，并整体Zstandard解压；因此会在内存接触该原会话的其他私密历史和工具数据。仅输出本轮不等于未读取其他历史。** 不列目录、不扫描其他Session、附件、配置或私有存储，不读取E盘；header.cwd字符串只作固定身份比较。不调用App/SDK/RPC/UI/resume/flush，不创建Runtime/Session，不发消息，不写原目录，不执行日志内容。压缩输入上限64MiB，解压上限256MiB，行上限4MiB，事件上限500000；超过或变动失败UNKNOWN，不提升限制或修复原日志。祖先链接拒绝、前后文件身份/长度/时间稳定核对是本地防误用检查，并非OS隔离或对抗恶意并发换盘的保证。

## 输出与拒绝规则

仅stdout输出单个JSON；工具不创建证据文件，负责人未来可将**已过滤输出**存入本Task新evidence文件。不要保存原日志、rows、错误堆栈或工具args/results。

成功状态`RECEIPT_FOUND`只表示从持久日志找到唯一匹配及正常完成的对应回合，**不是材料字节校验、审批、工程执行授权或六向验收**。输出保留`integrity:NOT_BYTE_VERIFIED`和`executionAuthorized:false`。

导出请求原生`data.id`、回复原生`data.message.id`、事件`seq/time`、本轮正文、对应turn起止及工具次数。工具生命周期按同turn/step逐一核对：assistant的tool-call block.id → tool/call.data.callId → tool/result.data.message.toolCallId；结果必须引用该原生call事件seq，source.callId也必须一致。缺失/重复调用ID或结果UUID、错turn/step、结果先于调用、未闭合就继续assistant、遗漏结果均UNKNOWN。仅导通过配对后的次数，不导参数/结果正文；完整返回的isError结果仍是已结束事件，不等于工具操作成功。`acceptedAt`来自同一请求UUID与全文的唯一agent/inbox/spliced事件；不存在则明确null。`time`是Harness接受事件时的墙钟毫秒，非UI点击、外部独立签名时间；持久日志本身也不是防篡改审计服务。

重复nonce/请求/原生ID、另一实质用户输入、回合边界不清、不同turn回复、未正常completed、工具调用未结束、无UUID、未来/非法/本轮倒退时间均拒绝。固定真实请求时间窗口为2026-11-12 15:02–15:16 UTC，仅约束已知canary；后续无关回合不用于推断本轮回复。错误统一UNKNOWN、退出码2且脱敏；成功退出码0。缺acceptedAt如实null，不合成提交时刻。

未来六向扩展需另封存exact请求清单及复核，当前不能传任意历史搜索条件。不能以本工具通过fake测试宣称真实来源读取已获许可或已完成。

## P1 定向修复证据

旧22项自测记录保留在 `evidence/dsh-own-receipt-001/verification.json`，其源码SHA是旧候选，不能套用于新版。新版源码和测试结果见同目录 `verification-round2.json`。仅供同一P1第二轮核对；本次没有真实日志读取，额度事实与本修复分开。

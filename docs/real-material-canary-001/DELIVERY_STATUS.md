# 真实材料 canary 交付状态

Task：TRB-REAL-MATERIAL-CANARY-001。实际投递负责人：Codex /root。旧内容canary依据 [STATUS.json](../../evidence/real-material-canary-001/STATUS.json) 的 `2026-11-12T12:03:23.144Z` 快照；最新Hermes固定命令结果依据 [hermes-result.json](../../evidence/material-verifier-001/hermes-result.json) 的 `2026-11-12T13:18:31.249Z` 记录。ChatGPT / DSH补记root本次交接的用户报告及控制状态；本文不是后台持续更新或三方全部通过的声明。

## 已发生与尚未发生

| 对象 | 实际动作 / 当前证据 | 能下的结论 |
|---|---|---|
| Hermes原Session | 旧内容请求曾明确未复算hash；后续用户另准精确Node命令一次，原回复报告exit0、nonce及5文件 / manifest / package hash相符，route字段未变 | 最新`AGENT_REPORTED_BYTE_MATCH`；`independentToolExecutionVerified=false`、`receiverByteVerifiedByBridge=false`，不是Bridge独立BYTE_VERIFIED |
| DSH原Session | 本草稿处理已授权；用户后续开启截图控制并设置始终允许；最后一次工具仍因旧Esc状态拒绝，其是否已清除未知 | 自动投递未完成；不能写当前截图控制仍关闭。先前editor未安全识别，未备份 / 修改 / 发送草稿的记录不因新授权自动改变 |
| ChatGPT原Session | 用户已报告手工发送5个原文件及请求；未使用桌面UI自动化 | USER_REPORTED_SENT，等待回执；不宣称平台已观察附件 / 内容或字节核验，不重复发送 |
| 离线COLLAB-002驱动 | 隔离虚构库、模拟Adapter；其`realAgentOperations=0`按原证据单独记录 | 不包含、也不能替代这一次真实Hermes canary |

真实材料canary与后续单独授权的固定命令，是分别记录的真实请求；每个请求各一次提交，不恢复旧队列。不能把它们追加为离线耐久Driver的真实动作，也不能把离线Driver的0次真实操作解释成“本任务没有真实请求”。root本次交接时一小时耐久仍RUNNING约49分钟，尚未验收。原常驻、旧队列及凪未恢复；DSH本草稿授权不能泛化为其他私密工程内容的读取权限。

## Hermes原回执能证明到哪里

以下为**旧阶段**无hash的内容请求；最新固定helper请求见本节之后的更新，不改写旧原文或抬高旧结果。

- [hermes-attempt.json](../../evidence/real-material-canary-001/hermes-attempt.json)：deliveryId `809499b1-f14c-42a0-9010-957fb30b9480`，一次提交，admissionId `e091c0d0b477408081719bb875e3ddc6`；原Session与包版本明确。
- [hermes-receipt-observation.json](../../evidence/real-material-canary-001/hermes-receipt-observation.json)：原Gateway `requestSeen=true`、`completed=true`，完整prompt精确匹配；replyId `hermes:cf8755c02d49070012423637b46d24b9d2a0209a4799f508cfb00e5af830b85c`，coverage为`gateway_transcript`。
- 回复报告读到5个文件，并给出174 / 281 / 160 / 755 / 80的文件size声明；包ID、版本、果园名、随机marker及notes末行与准备材料对应。
- 接收者纠正了发送请求中的“三个count”误述：材料只有两个count（17与29），另有total=46。该纠正保留在原文中，不为了对齐发件人措辞而改写。
- 接收者明确说明manifest hash只是从`manifest.sha256`抄录，**未重新计算任何文件SHA-256**；现有阅读工具据其报告仅返回内容和file_size，文本可能规范化空格与行尾。原回执没有声称VERIFIED。

因此，可确认的是原请求得到对应原回复、内容挑战对应；“读过5个文件 / 字节数由工具返回”的说法仍来自接收方报告。没有独立工具链审计，不能写成平台已核验其每次文件读取，不能把5个size与清单一致升级为字节一致。状态JSON明确 `receiverByteVerified=false`。

`noToolCalls=false`表示旧内容回执涉及工具，由root独立记录，不混入旧Supervisor的“禁止工具”文字队列。该阶段没有授予命令执行权限；后续仅对已审固定helper的一条精确Node命令另行授权一次，不扩大为任意命令、源码执行、写文件、其他目录或凪操作。

## 最新Hermes固定校验结果

已审helper sourceHash为`15e8883cf06627da93883d5f3d6cebba431e5d2670ee6d4f88defd3610835f40`，独立review实跑CLI exit0，P0/P1=0。用户随后单独批准该精确Node命令一次；deliveryId `29cdbbbf-91ea-4c6a-a70f-d19276dd713f`、nonce `trb-hermes-canary-20261112-001`。原Gateway找到的对应助手回复在后续user turn之前，route字段未变；未取后续用户正文、旧历史或工具链，原生replyId不可用。

原回复报告实际执行一次、exit0、5文件size/hash、manifest及canonical包hash相符，故记录`AGENT_REPORTED_BYTE_MATCH`。本地helper实算及独立本地复核已有证据，但此次真实Agent工具执行未独立审计；`independentToolExecutionVerified=false / receiverByteVerifiedByBridge=false`，不能升级为Bridge字节验证。详见 [固定校验器交付](../material-verifier-001/DELIVERY_REPORT.md)及 [bounded原回执](../../evidence/material-verifier-001/hermes-fixed-hash-bounded-receipt.json)。

Bridge注释纠正Agent的一处解释：helper的`expected`是脚本固定常量，`declared`才来自Manifest / 控制文件，`measured`来自实际bytes的size/SHA-256。Agent把expected说成读取控制文件得到；原回复措辞保持不变，纠正单独记录，不冒充Agent本人的解释。

## 已停止的审计与DSH后续状态

进一步工具链审计被自动审批拒绝，原因涉及可能导出超出材料收件范围的私密工具 / 消息内容。root未编写或执行该审计脚本；不更换工具、路径或读取方式继续追查。旧阶段保留内容声明，最新固定helper阶段保留Agent报告字节结果相符；两者都不因此获得独立工具执行证据，不隐去缺口或猜测被拒绝内容。

DSH的异步决定已由用户回复“私密草稿授权你自行处理”，不再等待答复，也不重复索要本草稿授权。root随后重新通过@sky核验唯一窗口“主进度 — DeepSeek Harness”（会话简称“主进度”），获准激活并进行文本只读；但UIA树因child_limit截断，省略594个子节点，无法可靠定位editor，因而没有完成备份。实际状态为`draftBackedUp=false / draftModified=false / draftSent=false`，不能把授权或窗口可见等同于草稿已安全处理。

此前整窗截图请求被自动审批拒绝，原因是可能显示本草稿以外的无关凪 / 私密工程内容；该历史拒绝不绕过。后续用户已开启截图控制并设置始终允许，最后一次工具却仍因旧Esc状态拒绝；是否已清除未知，不能再写成当前截图权限关闭。自动投递、草稿备份 / 修改 / 发送仍未完成。[人工交付说明](MANUAL_HANDOVER.md) 已同步。ChatGPT仍不自动操作UI；用户已报告手工发送5原文件及请求，现等待回执，不重复发送。

## 材料与后续记录

同一包：`d63d404e-1861-4aec-ab1f-277c63b3ecff / v1`；snapshot `1f7a3f49-8190-4650-a586-ff4706e17b8d`；manifest预期SHA-256 `509a8e93d122b5ea596ee547dc8a7dccb8445f02e330aa9aa65e2318f29cbf7c`。原包、可读视图和ZIP的本机清单见 [package.json](../../evidence/real-material-canary-001/package.json)。该JSON的PREPARED状态是**准备时快照**，实际试验进展看独立STATUS / 回执，不静默改写原准备证据。

后续DSH / ChatGPT每方分别记录人工报告、原会话消息 / 回复标识、实际附件覆盖、内容挑战、是否真正计算hash及方法。没有原生只读hash工具时，停止于内容确认 / 接收者声明；不运行脚本、扩大权限或复制预期值来凑BYTE_VERIFIED。ZIP可读性尚未验证，不作为唯一材料；只收到派生可读bundle也不代表收到5个原文件。

本文编写子任务未新增真实SDK / App操作；本次只更新文档，不改helper、其README、包、STATUS JSON或原Agent回复。冻结源码不变。


## 最新进度（2026-11-12）

用户已转回原ChatGPT材料回复：5个文件READ_COMPLETE，包ID/版本/snapshot/内容挑战与本地同包一致，hash明确未重算。原文及核对见evidence/real-material-canary-001/chatgpt-user-forwarded-reply.txt和chatgpt-manual-receipt.json；来源为USER_FORWARDED_AGENT_REPLY，不冒充Bridge独立原会话观察。Hermes固定工具回执见evidence/material-verifier-001/hermes-result.json（AGENT_REPORTED_BYTE_MATCH）；两者所报包身份与清单hash一致，DSH仍无本包回执，三方完整性结论未通过。离线主候选一小时已实际完成并核验，3600.573秒；它不构成真实线路验收。


## DSH一次试投的最终现场

用户明确给出空闲窗口。目标元数据曾与捕获画面不符，未输入；置前恢复后确认DSH原主进度与空编辑区。聚焦后文字输入再次被工具的用户输入保护拦截。后续只读核对无请求标识，编辑区仍为空：0次提交、0次发送按钮点击、未留下试投草稿，未修改/恢复/发送旧稿。本次标记STOPPED_KNOWN_UNSENT_INPUT_GUARD，不自动重试。它不是权限开关未打开，而是当前控制通道的定位/输入保护仍未通过真实验收。可由用户在同一原会话手工发送交付材料/DSH本次试投请求.txt并提供回执。

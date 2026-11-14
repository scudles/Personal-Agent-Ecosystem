# 真实材料 canary 准备计划

Task：TRB-REAL-MATERIAL-CANARY-001。唯一负责人及实际投递者：Codex /root。用户新近明确授权三方真实材料互通；本子任务仅准备虚构材料、只读调查现有源码并整理证据，未触发真实会话动作。新授权按本次canary的明确范围执行，不恢复常驻或旧队列；DSH本草稿处理的后续明确授权及实际状态见下文。不修改冻结源码、Runtime、模型、权限配置、私有记忆、治理规则或凪。

## 最新进展补记

- Hermes先前无hash的内容声明后，用户单独批准已审固定Node校验命令一次。独立首轮只读review实跑CLI0、P0/P1=0，helper源hash `15e8883cf06627da93883d5f3d6cebba431e5d2670ee6d4f88defd3610835f40`不变。原Gateway回复报告5size/hash及manifest / package hash相符，最新为`AGENT_REPORTED_BYTE_MATCH`；对应原助手回复在后续user turn之前找到，route字段未变，`independentToolExecutionVerified=false / receiverByteVerifiedByBridge=false`。不把Agent报告升级为Bridge独立字节验证。
- Agent把expected来源说成包内控制文件；Bridge注释更正为：expected是脚本固定常量，declared来自Manifest / 控制文件，measured来自实际bytes。原回复不改。最新证据及限制见 [固定校验器交付](../material-verifier-001/DELIVERY_REPORT.md)。
- ChatGPT用户已报告手工发送5个原文件及请求，等待回执；这是USER_REPORTED_SENT，不重复发送，不自动操作ChatGPT UI。
- DSH用户已开启截图控制并设置始终允许；最后一次工具仍因旧Esc状态拒绝，其是否已清除未知。不得写“当前权限仍关闭”；自动投递未完成，不能把授权等同于草稿已备份 / 修改 / 发送。
- root本次交接时一小时离线耐久仍RUNNING约49分钟，尚未验收，0真实Agent的模拟Driver证据与上述真实 / 人工材料分开。

以下保留包准备及初始通道调查；真实最新状态以上述补记及 [DELIVERY_STATUS.md](DELIVERY_STATUS.md) 为准，不把历史准备措辞当作尚未发生后续请求。

## 已封存、可直接交付的虚构材料

权威准备描述：[package.json](../../evidence/real-material-canary-001/package.json)。包不含平台源码、真实项目、原会话历史、凭证、配置或其他Agent的身份资料。

| 字段 | 固定值 |
|---|---|
| packageId | `d63d404e-1861-4aec-ab1f-277c63b3ecff` |
| version | `1` |
| snapshotId | `1f7a3f49-8190-4650-a586-ff4706e17b8d` |
| manifest SHA-256 | `509a8e93d122b5ea596ee547dc8a7dccb8445f02e330aa9aa65e2318f29cbf7c` |
| 原字节目录 | `D:\TriReviewBridge\test-output\real-material-canary-001-2026-11-12T11-57-07-046Z-d63d404e\package` |
| payload | `README.txt`、`orchard.json`、`notes.txt`，共3个文件 / 615字节 |
| 控制文件 | `manifest.json`、`manifest.sha256`，另2个；实际原文件总数5 |

材料仅包含虚构果园、两个种植区的果实数量及随机内容标记；无可执行源代码。UTF-8、无BOM、LF；notes有明确保留的行尾空格，逐字节校验不能用模型重排后的文本代替。

同一导出父目录另有 `CANARY_BUNDLE.txt`（完整选定文字的派生可读视图）、`CANARY_ORIGINALS.zip`（上述5个原文件）及 `RECEIPT_REQUEST.txt`（负责人可参考的限定请求）。可读视图有独立hash，不能把它的hash当原包hash。ZIP已本机创建、检查5个条目并记录hash，但三方当前是否能解包尚未验证，不能作为唯一交付路径。5个原文件、Manifest、可读视图均已本机核对；这些结果只是本地准备，不是接收端验证。

包描述采用 `TRB_REAL_MATERIAL_CANARY_V1`；该snapshotId是此次虚构源快照的身份，不冒称已登记到旧工程主库。未创建真实工作流、未给旧消息排队、未产生工程实施授权。`package.json`包含每个原文件的size/hash，供负责人核对实际收件回执；其他会话的ID和历史证据只在本计划 / 平台证据中，不在交付包里。

## 原绑定：历史证据与当前可确认事实

以下ID用于负责人核对原目标，**不发给其他Agent**。历史往返只证明当时的一条ACK连通，不证明今天附件或全历史可读。未为此读取任何原App、原DSH事件文件或已有草稿。

| 目标 | 原绑定与已保存证据 | 本次身份 / 能力限制 |
|---|---|---|
| Hermes | `local-6f275933587b3c068cdbe3bea5633785fb8cacfb3a4c298855c66d931b6946d7`，标题`Nagi`；[旧ACK证据](../../evidence/190f643e-c413-494a-aed5-d81a2df13f50.json)，reply sourceTurn `8cdb179fde1d4a4aa5262d02451c6fa6` | root本次[SDK inspect](../../evidence/real-material-canary-001/hermes-inspect.json)于`2026-11-12T11:54:53.545Z`返回固定identity/sessionId、标题及busy=false。路由仍为`opencode-go / deepseek-v4.1-flash / medium`、原profile。root可进行一次受限SDK投递；本子任务未连接Gateway |
| DSH | `session-ebd654d5-1bf8-419c-bc2a-d9be1ed023fc`，标题`主进度`；[旧来源证据](../../evidence/deepseek-source.json)，user seq2470 / reply seq2472 / turn-end seq2474 | 用户已回复“私密草稿授权你自行处理”，该授权有效，无需重复授权本草稿。root重新核验唯一窗口“主进度 — DeepSeek Harness”（会话简称“主进度”）并获准激活 / 文本只读；UIA树因child_limit截断，省略594个子节点，尚不能安全定位editor。未备份、未修改、未发送草稿。整窗截图随后被自动审批拒绝（可能包含无关凪 / 私密工程内容），已停止且不绕过；仍为人工附件准备态 |
| ChatGPT（不是Codex） | `6af098fa-46bc-83e8-97c5-418f00e213b9`，标题`Nagi（继承的你1）`；[旧来源证据](../../evidence/chatgpt-source.json)记录`sourceKind=chatgpt`、newTurn `a9c9d4c4-8ace-4756-b2d4-f1bc7fbe22c2`、reply `2c42adf6-8ead-42be-aadb-3d123649dc78` | root已读取本机computer-use指导，明确禁止自动化ChatGPT桌面UI；本次只采用人工附件B，不调用@sky、DesktopSession或其他UI替代路径。不把旧连接器身份或标题当今天实测 |

Hermes补充证据边界：`native/hermes-session.py::obs()`确实检查SDK返回的`session_id`、`stored_session_id`和标题；但输出的`draft:false`是源码常量，不是UI草稿扫描。本次messageCount=544，旧ACK证据为553；计数差异原因未调查，不能用这两个数字证明全历史字节连续或自行断言丢失 / 重置。canary不依赖旧历史内容，也不为核对历史扩大读取范围。

## 已有调用路径与缺口

1. **Hermes原SDK。** `src/transports.mjs`固定使用已有D盘Python环境，调用`native/hermes-v2.py`；后者通过`hermes-session.py`导入`D:\HermesAgent\Source\hermes_cli\gateway_runtime.py` / `gateway_client.py`，发现已运行Gateway，再`session.resume`及`prompt.submit(session_id,input_id,text)`。Bridge只传文字，限制TRB信封及20,000字符；send检查busy和tailHash，无自动启动 / 创建会话 / 改模型参数。read以原prompt匹配用户消息，回收对应assistant及工具调用标记。

2. **Hermes“附件”不能泛化。** 安装源码`acp_adapter/gateway_media.py`确有`stage_user_content → attachments`，`gateway/session_ingress_media.py::admit_attachments`限制为原profile图片cache内的PNG/JPEG/GIF/WebP、最多10项。它不是任意TXT / JSON材料附件入口；本次不写该cache。生成的`apps/shared/src/gateway-contract.openrpc.json::PromptSubmitParams`未列`attachments/input_id`，而调用源码出现这些字段，存在源码 / 生成契约差异，不能仅据静态发现声称原Gateway已支持文档附件。当前最小路线是向已确认原Session发一次**只允许读取上述package子目录**的请求，由原Runtime已有能力实际读取 / 计算哈希，不更改其工具或权限配置。

3. **DSH既有通道。** `transports.inspect/send/read → native/DesktopSession.cs`及`src/dsh-observe.mjs`。UI路径仅处理文字，readback从固定原事件日志匹配用户prompt / assistant回复；没有材料附件方法。原事件文本可见不等于文件可读。DesktopSession的动作只有inspect/select/read/peek/calibrate/send，未实现attach/upload。本草稿处理已获用户授权；当前阻碍是editor未被可靠识别，而不是缺少本草稿授权。整窗截图被拒绝后不以native或其他通道扩大读取，自动投递未完成，人工B仍准备就绪。

4. **ChatGPT既有通道。** 旧`DesktopSession.cs`只做标题 / 可见消息边界及文本操作，没有附件选择、上传等待、附件状态或原字节回收；`transports.inspect`补入固定PINNED ID，不是从当前UI取得服务端conversation ID。旧进程路径检查甚至包含`OpenAI.Codex_`，不能单独证明ChatGPT产品 / 模式身份。无论这些旧代码能否运行，本次都不调用它来自动操作ChatGPT。不能用新的API会话、Codex本地文件或公网URL代替目标原ChatGPT会话。

5. **人工交付能力。** `engineering/manual-handover.mjs::prepare`校验 / 导出准确原包并生成交付单，状态为`PREPARED_NOT_DELIVERED`；`report`只接受`USER_REPORTED_SENT / UNKNOWN / CANCELLED`，不允许人工报告直接写VERIFIED。它不自动附加、发送或观察原会话；本次材料仍为独立canary，没有为此修改主库。

6. **模拟和旧Supervisor。** `engineering/exchange.mjs`只接受`kind=simulated`绑定，其收件检查只读mock inbox，不能签发真实收件。`LockedRealAdapter`及旧硬锁不因用户本次授权自动变成已实现的真实材料API。旧`Supervisor.collect`要求`noToolCalls=true`；若Hermes实际使用受限只读工具核验包，root将单独保留原SDK和工具证据，不把该工具调用塞进旧“禁止工具”的文字队列判定。

这些是当前本机源码的只读结论，不是三方原Runtime的文件访问能力测试。相关项目源码及旧证据hash列在 `package.json.auditSources`；未复制原历史或配置进材料。

## 最小收件核验

每方至少分别记录 **expected** 与 **observed / measured**，未知字段留空，不用预期值补实测：

- 目标原Session证据、一次提交的request/admission/message/reply标识和时间；出现不确定结果记UNKNOWN，不自动重发。
- packageId、version、snapshotId、实际读取的manifest SHA-256；payload实际数3、含控制文件实际总数5。
- 5个实际文件的相对路径、原始sizeBytes、接收端从实际bytes计算的SHA-256，逐项与准备清单相符；记录读取 / 哈希工具的方法、输出和可追溯来源，不只保留模型自称结果。
- 内容挑战可要求果园名、总数、随机marker和notes最后一行。它有助于证明看到了材料，但仍只是内容覆盖，不代表全部原字节相同。
- 汇总为每方独立等级；不得用Hermes较高证据补DSH / ChatGPT的缺口，也不得把判断一致当字节一致。

| 能记录的级别 | 所需实际证据 | 不能升级成的结论 |
|---|---|---|
| PREPARED_NOT_DELIVERED | 本机5文件 / Manifest / 导出目录核验 | 原会话收到 |
| USER_REPORTED_SENT | 用户本人报告已在指定原会话发送 | 平台已独立观察、字节已验 |
| ATTACHMENT_OBSERVED | 正确原消息中可见对应附件且上传完成 | 所有原字节完整 |
| CONTENT_CONFIRMED | 未在请求中泄露答案的内容挑战得到正确原回复 | 全文件BYTE_VERIFIED |
| AGENT_CLAIM | 原Agent报告包字段或hash | 该hash来自实际文件，而非复述预期值 |
| BYTE_VERIFIED | 可审计接收环境 / 工具实际全量读取5文件并算size/hash，绑定准确包版本和原Session | Agent理解正确、工程审查通过、实施授权 |
| UNKNOWN | 提交 / 附件 / 字节任一不能确定 | 成功或失败；不得自动重复提交 |

`CANARY_BUNDLE.txt`是派生完整视图；只上传它时最多报告其自身附件 / 内容证据，不能说5个原文件全部交付。ZIP若原会话不能解包，不能把“看见zip文件名”当原包完整。

## 可安全执行的下一步与当前阻碍

**Hermes：** 已完成旧内容请求及后续单独授权固定helper的请求，最新按Agent报告结果相符记录，不再提示重发。每阶段各一次提交，不恢复旧队列；未独立审计工具执行，保持Agent声明与本地验证的区别。

**DSH和ChatGPT：人工附件B。** DSH本草稿授权有效，但安全定位 / 备份 / 修改 / 自动投递未完成；用户已开截图控制且始终允许，最后旧Esc拒绝是否清除未知。人工交付仍为替代准备，不重复索要本草稿授权。ChatGPT用户已报告同次发送5个package原文件及请求，现只等待回执，不重复提交、不自动操作UI。可读bundle仍只是派生全文，ZIP接收支持未验证，不能作为唯一材料。

此前DSH状态为 `PRIVATE_DRAFT_HANDLING_AUTHORIZED_EDITOR_NOT_SAFELY_IDENTIFIED`，整窗无关内容隐私拒绝作为历史保留，不绕过或追读。后续用户开启截图控制、始终允许与最后旧Esc拒绝的未知清除状态分别记录，不把历史状态写成当前权限关闭。ChatGPT两方实际附件覆盖 / ZIP可用性及接收端hash工具仍未验证；Hermes的Agent报告结果不能补两方证据缺口。

本准备子任务实际SDK / 原App调用0、草稿操作0、真实投递0、凪操作0。未运行任何native/UI工具，未解除旧队列或常驻暂停；只新增本计划、包准备证据和独立虚构材料目录。实际投递后的结果由root另记，不能用此准备报告代替。

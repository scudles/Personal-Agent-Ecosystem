# 六向30往返执行准备

日期：2026-11-12。负责人：/root。状态：**OFFLINE_PREPARATION / REAL_TEST_NOT_EXECUTED**。本文件把既有计划和现有collector对齐为批次/证据合同；不是已完成真实测试、批量投递许可或恢复常驻指令。本轮未发送、未操作原应用、未读取原会话/凪/私密日志/私有配置/运行数据库、未改变任何暂停状态。仅新增本文件，不修改冻结核心、collector、原材料包或耐久依赖。

**可直接按本文件逐槽执行，但须先满足真实路线、暂停、额度与证据前置条件；当前尚不能自动启动。** 六向各5次共30往返，至少60腿。现有collector是离线证据导入器，不是发送调度器，也不会给真实验收通过结论。

## 已有合同与核对结果

- [REAL_RELIABILITY_ACCEPTANCE_PLAN.md](../real-material-canary-001/REAL_RELIABILITY_ACCEPTANCE_PLAN.md)定义：A原会话产生挑战，交付B原会话，B对应回复返回A，并有A的对应确认，才是一次闭环。单次收件/生成结束不算往返；人工辅助和自动线路分开统计。该文档开头的Hermes等状态是历史快照，不能当最新交付状态。
- [collector.mjs](../../tools/real-link-evidence/collector.mjs)与[README](../../tools/real-link-evidence/README.md)核对：最多30往返/60回执，三方指纹必填，每向slot=1..5；严格绑定两腿方向、包/版本/manifest、challenge、消息/attempt与返回正文hash；重复槽位/ID使涉及记录均不计数。它只认证本地导入文件hash，不认证平台来源。
- [workflow.mjs](../../src/workflow.mjs):16,30—32：初始配置默认12/h，配置允许1..30；投递计数按`sentAt > now-3600000`滚动。**30是硬上限，不是本轮实测当前额度**；本轮未读运行数据库，不自行把较低配置提到30。
- [workbench.mjs](../../src/workbench.mjs):77—86：全局/role/Workspace/binding及事项状态分别阻断，WorkBench真实binding仍锁住，只允许simulated参与发送；其rateCount合并文字delivery和有submission_count的材料attempt。`sending`前占用尝试预算；取消未提交与已可能提交必须区别。
- [exchange.mjs](../../engineering/exchange.mjs):34—44：材料binding与数据库trigger要求simulated，真正提交前再次核对暂停/小时/根事项预算；中断SENDING/SUBMITTED转UNKNOWN。这个mock入口不能仅解除paused就成为真实材料路径。
- [supervisor.mjs](../../src/supervisor.mjs)及workflow源码保留一次提交/UNKNOWN不重发等控制素材，但旧文字receive还要求`noToolCalls:true`。获准的限定材料hash工具结果不能不加区分地塞入该旧“无工具文字审查”合同；真实材料工具与工程审批各守边界。

未启动任何服务/测试。上述“有检查”是静态源码事实，不证明当前真实SDK/人工路径已接入这些检查。

## 负责人新增实测事实（本轮文档更新）

以下由负责人提供，本子任务没有再调用真实接口、读取原会话或复查私密内容：

- 原ChatGPT的native `list / read / send_to_thread`已实际单次打通：`kind=chatgpt`，指定原id，无model override；对应证据为负责人保存的native-receipt。这条原生文字路径可作为后续文字测试候选，不再把ChatGPT所有文字测试一概限定为人工B。这一获准原生接口与桌面UI自动化分开；ChatGPT桌面UI自动化限制保持，native文字能力不授权任何UI操作。
- 本次hash复核的ChatGPT实答为`UNSUPPORTED`，缺少原附件bytes路径。文字原会话收发成功不能证明附件上传、原bytes可读、工程常驻adapter可用或接收端BYTE_VERIFIED；需要五原文件的材料槽位不能仅凭文字通道单次成功准入。人工附件B仍可单独记录，但不重发用户已手动交付的原材料来凑次数。
- DSH获准只读先看到运行任务，随后看到新用户草稿；该轮**0输入、0发送**。负责人已请用户处理草稿后回复“DSH已空闲”；本文件不把这个请求写成已经收到空闲确认，也不自行清理/发送新草稿。未来恢复仍需新鲜安全门，旧草稿处理授权不使新的用户输入可被忽略。
- 六向本批当前为**0/30真实往返**。ChatGPT单次文字打通及既有canary均作为前置能力证据，不填六向槽位，不把收件/回复单腿算完整往返。

上文旧适配器/collector的静态缺口仍在：独立native文字通道成功不能证明它已经接入工程常驻调度、全局暂停、共享额度或材料证据合同。后续采用native文字方式时，每腿仍须按本文件同一run、额度账本、原id、请求/回复绑定与人工/自动方式要求记录；不能据一次成功恢复旧队列。

## 执行前一次冻结的内容

由负责人在本Task新证据目录保存明确、最小的run声明：

| 项目 | 冻结内容 / 未满足处理 |
|---|---|
| 范围 | 六向各5次、同一允许canary原5文件及明确内容挑战；不恢复旧队列、不触及其他项目或私有记忆 |
| 原身份 | hermes/deepseek/chatgpt各自原Session的本机受控映射及64位SHA256指纹；对外只用指纹。窗口名不能单独代替不可变Session证据 |
| 方式 | 每向预定HUMAN_ASSISTED_REAL或AUTOMATIC_REAL，操作人和允许调用路径；人工搬运不计自动线路。ChatGPT桌面UI不得自动化 |
| DSH安全门 | 依[DSH_SAFE_RECEIVE_FINDINGS.md](DSH_SAFE_RECEIVE_FINDINGS.md)核对当前窗口/画面/Session/composer；既有草稿授权有效，但尚不能安全定位/备份时不发，不换工具绕过保护 |
| 材料 | packageId/version、manifestHash、canonical包hash、精确5文件清单及每项size/SHA256、随机challenge内容；原包不改，派生readable bundle/未验证ZIP不替代原文件 |
| 额度 | 当时配置L、共享滚动使用数、已预留/可能已提交数、其他流量、操作人与记录方式；只接受L<=30，实际更低就按更低值拆批，不升额 |
| 停止 | 明确全局/参与者/线路/本run暂停责任人；任何人类输入保护、错身份、草稿歧义、UNKNOWN立即停该线路。新启动不等于恢复许可 |
| 证据目录 | 建议后续新建`test-output/real-material-002-<runId>/`，runId只用英数/点/下划线/冒号/连字符且<=160字符；本轮不创建真实账本或回执 |

真实路径未就绪的槽位记NOT_READY，绝不调用真实接口去“试一下”补前置条件。本轮只授权离线准备；后续实际范围以负责人持有的有效用户授权为准，不由旧文档的待确认字样推断最新授权失效，也不由单次canary推出批量常驻权限。

## 固定30槽位与建议三批

H=hermes，D=deepseek，C=chatgpt。`HD-01`是槽位短名；实际tripId为`<runId>.HD-01`，challengeId为`<tripId>.challenge.<随机nonce>`。正/返腿attemptId分别为`<tripId>.fwd`和`<tripId>.back`，永久不复用。id不含箭头、斜线、空格；slot是方向内1..5，不是整批全局序号。

| 批次 | 第一轮（各向第1次） | 后续槽位（每向第2—5次） | 最少往返 / 腿 | 累计collector输入 |
|---|---|---|---:|---:|
| A：H/D | HD-01、DH-01 | HD-02,DH-02,HD-03,DH-03,HD-04,DH-04,HD-05,DH-05 | 10 / 20 | 10往返 / 20回执 |
| B：H/C | HC-01、CH-01 | HC-02,CH-02,HC-03,CH-03,HC-04,CH-04,HC-05,CH-05 | 10 / 20 | 20往返 / 40回执 |
| C：D/C | DC-01、CD-01 | DC-02,CD-02,DC-03,CD-03,DC-04,CD-04,DC-05,CD-05 | 10 / 20 | 30往返 / 60回执 |

方向映射：HD=H→D→H；DH=D→H→D；HC=H→C→H；CH=C→H→C；DC=D→C→D；CD=C→D→C。每槽必须完整做完“来源挑战→去程→B回复→返回→A确认”才进入下一槽；各向第1次计入5次，不另加预热。可以按已就绪路线调整批次顺序；不得为并行而让同一原Session同时承担两个活跃槽位。

30往返最低60腿，启动源挑战、独立上传/补件、额外返回确认/澄清若产生新的提交都另记发送事件，实际可能超过60。三批各20腿在L=30且没有其他发送时名义留10腿余量；不是保证每批只耗20。若L=12，同一对10往返也必须进一步拆成多个额度片段，不能照表20腿连续硬发。

## 滚动额度与暂停的具体操作顺序

下面是后续执行runbook，不在本轮操作任何实际状态。

1. 读获准范围内的暂停/额度快照，不做写入：全局、收件方role、Workspace/binding、Task/root、deadline/预算及本run停止标志全部允许才准入。SDK/人工路径不能假定受WorkBench控制；缺少可核对共享状态时维持NOT_READY。
2. 用同一共享账本计算时刻t的用量：最近3600秒已提交/可能已提交事件 + 已占位尚未提交事件；本轮准入需`used + reserved + 本次新增占位 <= L`，L为现有有效配置且不超过30。SDK、人工、文字、材料及本轮以外流量都需去重汇入；同一个事件有DB记录与手工记录时不能双算。
3. 开槽前至少为两腿保留容量，并核对源挑战等额外发送所需容量；每一实际提交前再核对暂停/额度。此处是**待实现的跨真实渠道原子占位合同**，不是现有collector或WorkBench已支持该预留。
4. 每批开始先过两向各1槽；均可归属、无未解决UNKNOWN、原草稿未受损，才做剩余8槽。每槽串行；保留真实wall时间，不能为赶时限跳过等待。
5. 无额度则WAITING_QUOTA，记最早可再核对时间：取最老仍占额度提交时间+3600秒并留时钟余量，随后重新计算。不能按整点清零、不能改配置/删除sentAt或重开run“清额”。60腿仅数学上需要至少两个足额额度窗口；既有流量/额外提交/暂停可让耗时更长。
6. 提交开始后先记唯一attempt和可能提交时间；UNKNOWN不释放其可能发送额度、不建新attempt重发。只有证实未开始输入/提交的取消才能释放未使用占位；提交后取消只停后续，不把先前发送抹掉。
7. 任一暂停触发立即停止新增输入/上传/提交；已收到的原响应只按获准范围被动归属，不顺势自动发返回腿。取消未开始槽位，保留已提交槽位UNKNOWN；重启不恢复旧队列/绑定。恢复需有效授权、同一attempt核对和新鲜安全门，不是自动retry。

实际历史sentAt实现与新账本占位不能互相掩盖：Workflow当前主要计已有sentAt delivery，WorkBench再加材料attempt；collector既不读取这些表也不阻断SDK/人工直接发送。没有统一覆盖之前可由唯一负责人保守串行手工总账控制，但必须标MANUAL_CONTROL，不能宣称程序强制30/h跨渠道已完成。

## 每腿证据字段：与collector精确兼容

每条回执必须来自对应真实事件，不创建“示范成功”来补缺失。原正文只保存获准本次消息；私密原会话定位留本机映射，不导出无关上下文。

| 层 / 字段 | 合同与填写时机 |
|---|---|
| batch.format / runId / environment | `TRB_REAL_LINK_BATCH_V1`；同runId累计合并；真实导入显式`REAL_EVIDENCE_IMPORT`，虚构数据只能FAKE_TEST |
| batch.participants | hermes/deepseek/chatgpt三个64位小写SHA256指纹；映射由负责人核对，collector不认证 |
| trip.id / from / to / slot / mode | 全局唯一id；角色只用英文枚举；方向内slot=1..5；真实人工/自动分别填HUMAN_ASSISTED_REAL/AUTOMATIC_REAL，模拟不得补真次数 |
| trip.package / challengeId | `{id,version,manifestHash}`，version>=1整数；每槽唯一挑战；collector当前不要求canonical包hash和五项file hash，另见sidecar |
| trip.forward / return | 各`{artifactId}`；一腿一份不可变JSON，不重复挂到其他槽位 |
| artifact.id / path / sha256 / provenance | 本批唯一；path相对batch目录、禁止绝对/空段/./../链接；hash实际回执文件bytes；声明来源只选HUMAN_REPORTED / AGENT_CLAIM / PLATFORM_OBSERVATION_IMPORT / SIMULATED |
| receipt.format / attemptId | `TRB_REAL_LINK_RECEIPT_V1`；唯一提交attempt，不以重新导出文件产生新的发送 |
| receipt.from / to / fromSessionFingerprint / toSessionFingerprint | 去程A→B；返回B→A；对应batch身份映射。期望值、实测来源和核对方法保留sidecar，不能只复制期望值充当观测 |
| receipt.packageId / packageVersion / manifestHash / challengeId | 两腿均精确匹配该trip冻结值；错包、旧版、错challenge不计数 |
| receipt.sourceMessageId / receivedMessageId / replyId | 去程为A源挑战ID、B实收ID、B回复ID；返回为B该回复ID、A实收返回ID、A确认ID。真实ID不可得时记录缺失并不计数，不拿正文hash伪造平台ID |
| receipt.sourceBodyHash / replyBodyHash | 64位小写SHA256，核对原允许正文。返回sourceMessageId必须等于去程replyId；返回sourceBodyHash必须等于去程replyBodyHash。统一正文边界/UTF8规则并留原值，不静默Trim或换行规范化后伪称原bytes |
| receipt.state / completed / submissionAttempts | 只有已观察RECEIVED且completed=true、submissionAttempts=1具备完整结构；UNKNOWN/未结束/重复提交保持真实值，不为了导入改成成功 |
| receipt.receiverByteClaim | 可选，保留实际接收者声明；永远不是collector独立实算结果 |

AUTOMATIC_REAL要求两腿artifact声明为PLATFORM_OBSERVATION_IMPORT；即使如此`originAuthenticatedByCollector:false`仍保持。人工输入平台观察标签不能让人工闭环变自动，也不能把纯Agent自报变独立工具执行证明。

### collector不检查、执行账本必须补的sidecar

每腿保存同一attemptId关联的执行记录，**不能把下列尚未支持字段说成collector强制**：

- 计划/实际run、batch、trip、leg、operator、route/mode、authorityReference、冻结源码/适配器版本；未提交前的状态、拒绝原因和真实操作数。
- `queuedAt / reservationAt / inputStartedAt / submitStartedAt / submittedAt / receivedAt / replyCompletedAt / returnedAt / ackAt / cancelledAt`，所有时间带时区；未发生的保持null。用单调计时辅助持续时长，不能只凭导入时间推断真实顺序。
- 全局/role/Workspace/binding/Task/root暂停和预算快照、读取时间、额度L/used/reserved、唯一额度事件ID、可能提交上界/下界、释放占位的“确定未提交”凭据；共享其他流量的来源与去重键。
- 预期/实测原Session指纹、窗口/PID/Session核对方法、composer唯一性、busy与草稿存在/备份/修改/发送状态。只取本次获准最少范围，不补读私密历史/截图来凑证据。
- 精确5文件manifest/count、每项declared/measured size和SHA256、canonical包hash、实际读取方式、实际覆盖文件、接收端工具执行是否独立证实、原回复与Bridge更正分离。未实测的值留null，接收者自报值与Bridge测得值分栏。
- UNKNOWN/cancel/pause/restart/迟到回复的原状态和原因；原attempt永久不重发；跨批相同idempotencyKey的已有attempt查找结果。历史失败保留，不覆盖成新成功。

建议计划层状态为NOT_READY→READY→WAITING_QUOTA/RESERVED→FORWARD_IN_PROGRESS→RETURN_READY→RETURN_IN_PROGRESS→REPORTED_COMPLETE，异常分支PAUSED/UNKNOWN/FAILED/CANCELLED；这是新执行账本的**提案**，不写入旧Core状态字段。每腿另保留确定未开始、可能提交、确实收件、确实结束，防止一个completed吞掉不同证据阶段。

## 证据导入与验收操作

1. 后续在新run目录保存`receipts/`和不变原始证据、sidecar、累计`batch-A.json / batch-AB.json / batch-ABC.json`；每份累计batch含截至当时全部原槽位/回执（20、40、60份），不得只导入新批而宣称检查过跨批唯一性。
2. 如某槽缺回执，保留缺失/UNKNOWN数据，collector会NOT_COUNTED；不要凭模板造成功回执。未发送槽位由账本保留NOT_READY，报告六向缺失槽位。
3. 从工程根目录手动执行现有纯文件导入命令。以下是待替换的路径模板，本轮未执行：

```powershell
Set-Location -LiteralPath 'D:\TriReviewBridge'
.\runtime\node.exe tools/real-link-evidence/collector.mjs --input 'test-output/real-material-002-RUN/batch-A.json' --out 'evidence/real-link-evidence-tools-001/RUN-A.json'
.\runtime\node.exe tools/real-link-evidence/collector.mjs --input 'test-output/real-material-002-RUN/batch-AB.json' --out 'evidence/real-link-evidence-tools-001/RUN-AB.json'
.\runtime\node.exe tools/real-link-evidence/collector.mjs --input 'test-output/real-material-002-RUN/batch-ABC.json' --out 'evidence/real-link-evidence-tools-001/RUN-ABC.json'
```

4. 三次命令应在相应批次后各执行一次，不是现在一次全跑；每次输出路径须全新。允许输出根只有`evidence/real-link-evidence-tools-001/`或`test-output/`，不是任意docs/evidence目录。输入<=4MiB、每回执<=1MiB，不能把sidecar附成超过60份的collector artifacts；sidecar由负责人另核对。
5. **exit0只表示没有importErrors，不表示所有行计数。** 逐项读`rows[].issues`、NOT_COUNTED、六方向missingSlots、人工/自动分类和totalReportedComplete；最终六向各5槽且总reported=30只是“导入者报告完整”，不是独立真实验收。
6. collector的`realRoundTripsIndependentlyVerified=0`、`acceptancePassed=false`恒定。负责人/独立只读复核须按获准原始来源核对身份、时序、次数、真实闭环及暂停/故障证据，另写验收结论，不改collector输出假装独立确认。材料bytes证据等级与消息可达结论分开。

## 最小尚未实现的调度/状态缺口

| 缺口 | 已有素材 | 最小可审阅补口 / 当前限制 |
|---|---|---|
| 真实安全路线及批准范围 | 单次canary、DSH源码定位合同、人工B流程 | 每条实际入口须通过原身份/草稿/人类保护门；DSH未安全接入不发。不开替代Session，不借当前离线准备解除真实锁 |
| 跨SDK/人工/平台共享额度 | Core滚动sentAt、材料submitted_at计数 | 同一负责人统一事件账本、可能提交保守扣额；要程序强制需另实现原子占位/消费/释放及跨渠道适配。collector没有此状态，当前不能声称共享上限已技术覆盖所有真实发送 |
| 30槽两腿的耐久调度 | 旧队列一次提交与UNKNOWN不重发逻辑 | 持久化slot→两个attempt、一次活跃槽位、重启只恢复观测/停止、暂停截断、人工移交点和返回确认；不能直接复用旧review协议发送工具型材料 |
| 原始平台来源与消息归属 | collector校验导入者提供的指纹、ID和hash | 精确请求/回复ID及限定原文证据生产者尚需真实路径验证；禁止把缺失ID编造、平台标签当来源认证。人工证据明确局限 |
| 时间、预算、故障与原字节证据 | collector做结构、重复、包manifest和本地文件hash检查 | sidecar+独立复核补这部分；当前collector不验证时间顺序/额度/暂停/五文件hash/包canonicalhash，也不独立验证接收端工具执行 |
| 跨批幂等和验收 | 完整单batch唯一性、最多30槽 | 累计合并同run全部证据再导入可手工覆盖本run；跨run重复或全局幂等需共享持久账本。没有这些就不宣称自动可靠性完成 |

以上补口本轮未实现、不修改冻结代码。最小安全推进是先补齐离线run/腿模板与总账合同供负责人审核，再只执行已真正就绪的第1槽，按新证据定向解决缺口；不能把“计划可执行”写成“真实路径已READY”。

## 本轮源码快照

| 文件 | 本轮只读SHA256 |
|---|---|
| REAL_RELIABILITY_ACCEPTANCE_PLAN.md | `72805eb481254129376553173e8c9e5a7b7d25fef824d152a2d2f77780af64a9` |
| tools/real-link-evidence/collector.mjs | `800e863a3473fe8391fd58553a97e09240835fd520ef924651827f9418612f97` |
| src/workflow.mjs | `30c3bb3adfc4957946348585bb4b2c3b11bdc535042503c508eb3136bb119676` |
| src/workbench.mjs | `628d6295e8ab7ede556fa7a7c154057ba5036cb0be6be51a27e5afc781d38b12` |

本轮验证仅为只读源码合同核对及新Markdown链接/数量静态检查；没有运行collector自测或真实测试，既有collector.test源码中的断言不作为本轮实跑结果。当前真实完成数不由本文赋值；没有发送就不产生新真实闭环证据。

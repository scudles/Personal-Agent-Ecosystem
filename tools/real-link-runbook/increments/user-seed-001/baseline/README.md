# 隔离六向试验元数据总账

Task TRB-REAL-LINK-RUNBOOK-001。唯一负责人 /root；这是本地元数据工具，无发送、RPC、UI、网络、后台job、会话发现或主DB操作。实际用户已授权的隔离六向试验与恢复主旧队列/常驻是两件事；本工具不解除主暂停、不修改原3个binding。

**真实基线当前未知，本实现没有初始化真实账本。缺少全流量覆盖就NOT_READY，不能自行填写空history当成已证实0历史。** 所有“历史完整”“原Session”“主暂停例外”均是明确的`OPERATOR_ASSERTION`，不是工具独立认证的OS/平台真相。`ready`只说明所声明本地准入条件齐备，不证明真实路径/权限/身份或当前额度可用。

所有受控actual/native/manual投递必须约定使用同一个真实账本；工具**无法阻止人工或其他程序绕过**。若无法获知其发送历史/持续活动，必须保持不就绪，不能用本地计数声称全平台已强制30/h。

## 文件与运行

- `ledger.mjs`：文件锁、原子快照、共享占位/结果、同attempt与requestKey幂等。
- `cli.mjs`：薄命令入口，只读明确指定的本Task元数据JSON。
- `ledger.test.mjs`：独立fake目录测试，含多进程竞争；不初始化真实账本。
- `TEST_RESULTS_INITIAL.txt`：首轮真实输出，12/14；并发父fixture固定时钟早于子进程写入时间而被拒，保留失败。
- `TEST_RESULTS.txt`：最新测试输出，最终数字以文件和提交给复核者的冻结hash为准。

从工程根运行：

```powershell
.\runtime\node.exe --test tools/real-link-runbook/ledger.test.mjs
.\runtime\node.exe tools/real-link-runbook/cli.mjs status --environment REAL
```

REAL固定目录是`evidence/real-link-runbook-001/shared/`，不允许换目录或注入时钟来清额度。REAL输入只能在`evidence/real-link-runbook-001/imports/`内的显式JSON；status不需要输入。不要现在复制fake输入去初始化REAL。

FAKE_TEST必须显式`--environment FAKE_TEST --directory test-output/real-link-runbook-001-fake-唯一英数标识`；仅该直接子目录允许写fake账本，输入留该目录内。Fake标签不会产生任何真实发送/认证。CLI返回错误退出1；成功只是元数据变更/检查成功，`submissionAuthorized`不是用户或平台授权。

其他操作均要求`--input <本Task元数据JSON>`：`initialize`、`import-history`、`pause`、`reserve`、`begin`、`result`。不接受任意命令或消息正文。所有声明对象需`provenance:"OPERATOR_ASSERTION"`和非空、无控制字符的`reference`（<=240字符）；reference只是本机证据引用，不放私密正文/秘密。所有ID为1..160位英数、下划线、点、冒号、连字符；时间为严格UTC毫秒ISO且不能在未来。

## 最小初始化合同

`initialize`输入需以下字段（不提供可误用为真实零历史的示例）：

| 字段 | 合同 |
|---|---|
| format | `TRB_REAL_LINK_RUNBOOK_INIT_V1` |
| runId / authorizationReference | 本次冻结隔离试验ID及有效许可引用；不可通过重新initialize覆盖 |
| cap | 显式整数1..30；超过30拒绝，较低值不抬高 |
| bindings | hermes/deepseek/chatgpt各`{sessionFingerprint:64位小写SHA256, original:boolean}`；三指纹不同，任何非original阻断 |
| mainPauseBoundary | `{status,provenance,reference}`；status为UNKNOWN/CONFLICT/ISOLATED_EXCEPTION_CONFIRMED/NO_CONFLICT_CONFIRMED。未知或冲突阻断；本地paused=false不能代替主暂停语义的合法例外 |
| coverage | `{complete,from,through,channels,continuityAsserted,provenance,reference}`；channels包含actual/native/manual。complete=true须覆盖此前至少一小时、through距导入不超过60秒且明确持续全流量已记账；均为操作者声明 |
| history | 显式事件数组；未知不能用空数组伪造完整。事件字段见下。历史不完整可保存，但仍暂停/不就绪 |

初始化总是`paused:true`。需先核对历史/绑定/主暂停边界，再明确本run `pause {paused:false,provenance,reference}`；它只改此工具状态。`import-history {coverage,history,mainPauseBoundary?,provenance,reference}`允许后续补入已实际发生事件，不能重写已有冲突事件；每次导入重新暂停。它不扫描日志/DB或自行发现历史。

历史事件精确字段为`attemptId,requestKey,runId,channel,state,at,submittedAt,provenance,reference`。channel只允许actual/native/manual；已知提交SUBMITTED/CONFIRMED/FAILED须有实际submittedAt且不早于at；RESERVED/POSSIBLE/UNKNOWN/CANCELLED_UNSENT的导入submittedAt=null。无法得知准确提交时间的UNKNOWN永久保守占位，不能凭导入时间猜真实提交时间。历史可以来自其他run，仍占同一共享额度；不授权该run新发送。

## 每attempt只提交一次的本地流程

1. `reserve`输入：`attemptId,requestKey,runId,channel,from,to,fromSessionFingerprint,toSessionFingerprint,provenance,reference`。from/to为不同的三方角色之一；原指纹精确匹配冻结bindings。requestKey是冻结槽位+腿的唯一幂等键，不因换attempt/run名称来重试。同attempt重复返回`duplicate:true,submissionAuthorized:false`，同key换attempt拒绝。
2. reserve成功只保存RESERVED，并不允许发送。`begin {attemptId,provenance,reference}`在同一个跨进程锁内重核就绪和当前用量，只有RESERVED可转POSSIBLE、返回一次`submissionAuthorized:true`。这只是本账本的一次本地准入，不授予UI/RPC/主暂停或用户权限；调用方必须同时持有实际操作授权并遵守原通道人类输入保护。本工具不发送。
3. 外部动作若确实执行，之后用`result {attemptId,state,submittedAt?,reconciled?,confirmedNotSubmitted?,provenance,reference}`记结果。POSSIBLE/SUBMITTED可记UNKNOWN；UNKNOWN仅可凭明确`reconciled:true`及实际submittedAt收敛为CONFIRMED/FAILED，不能回RESERVED或再begin。已知提交时间不能改早以提前清额。
4. 只有尚未begin的RESERVED，且明确`confirmedNotSubmitted:true`，才能CANCELLED_UNSENT释放未使用占位。POSSIBLE/UNKNOWN不能以取消释放。CONFIRMED/FAILED/CANCELLED_UNSENT终态不可改坏或恢复；同终态/时间的重复只读返回，不产生新准入。
5. RESERVED/POSSIBLE/SUBMITTED/UNKNOWN始终各占1，超过1小时也不自动释放；已知CONFIRMED/FAILED在实际submittedAt后的滚动1小时计1，之后仍永久保留幂等记录。占位+已知近期记录合计受显式cap（最高30）约束。其他流量补入后超额时，已有reserve也不能begin；精确cap1/cap30反例在测试中覆盖。
6. `pause {paused:true,provenance,reference}`停止新的reserve/begin，仍允许如实记结果/止损取消。重启保留本run暂停与UNKNOWN；不恢复旧队列。

同一个run的60腿应持久记录唯一requestKey，不得用新键掩盖同腿重试。工具不自动安排批次/两腿关系/返回确认，不替代collector或真实证据复核。源挑战/额外指令也需入同一额度账本；人工/其他程序的未登记提交不会被该文件工具神奇发现。

## 锁、恢复与限制

每次操作先对固定`ledger.lock`使用`open(...,'wx')`排他创建；正常路径finally校验锁文件身份后释放。快照使用checksum、独占新临时文件、fsync、rename，成功响应前完成写入。同一begin并发竞争最多一个本地准入；响应丢失后POSSIBLE也不重发。

进程崩溃留下的锁**不做TTL/旧PID自动抢占**；报`ledger_locked_manual_review_required_no_stale_reclaim`。需要负责人另行确认原进程停止、快照/残余临时文件和可能提交结果后人工处理，本工具没有unlock/kill/service生命周期功能。测试只清理自己创建的fake锁，不处理真实锁。校验和防误损不等于防恶意修改/OS隔离；不保证掉电目录元数据持久化，不声称抵抗有权并发篡改路径者。损坏、未来时间、历史冲突、非原绑定或未知主暂停边界一律拒绝新准入。

实现自测和独立只读复核分开；最终源码hash与实跑结果见`CANDIDATE.json`。真实全流量基线未建立之前，只能继续离线审阅，不能初始化假0或以本工具ready替代真实身份/暂停授权核验。

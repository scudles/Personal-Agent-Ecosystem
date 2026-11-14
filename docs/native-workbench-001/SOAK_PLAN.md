# HYBRID fake Adapter 一小时耐久候选

本脚本只验证本机Node HTTP服务、SQLite、队列、文字任务和证据状态，不调用Hermes Gateway、DSH、ChatGPT、私密日志或原模型；不能称为真实Agent长期稳定性通过。

命令：`D:\TriReviewBridge\runtime\node.exe D:\TriReviewBridge\tools\hybrid-native-001\soak.mjs --hour`，cwd固定D:\TriReviewBridge。正式启动须root完成当前候选必要复核并冻结后执行；本子任务未自行先跑正式一小时。

- 全新test-output/hybrid-native-soak-* SQLite和fixture marker；不迁移、不修改旧profile。
- 每次fake worker是独立Node进程，退出后下一次重建；它只接受固定前缀虚构目录且marker必须匹配，不能指向data生产目录。
- 初始虚构库采用现有合法30次/小时预算，生产默认不改；正式每15分钟一循环，约24次fake dispatch，其他时间本机服务保持运行、15秒写一次进度。
- 每循环覆盖双接收方独立回复、H UNKNOWN不阻断C、迟到收件、重复receipt幂等、纯文字任务和用户验收、暂停队列、身份prepare消费后显式enable、取消后的迟到收件；第1循环强杀后台后验证SUBMITTED admission耐久恢复。普通健康重启分支每10循环，正式1h默认4循环不触发该分支（健康重启已另由HTTP集成测试覆盖）。
- RUNNING/PASSED/FAILED进度在evidence/hybrid-native-001/hybrid-fake-soak-*/status.json，使用performance.now单调elapsed。--hour必须实际elapsed>=3600秒才允许PASSED；源码摘要每循环/结束核对，变化即FAILED，不能把旧证据套新版。
- 统计nativeGatewayCalls/nativeDesktopCalls/privateLogsRead/realModelCalls必须均0，并明确realAgentVerification=false。旧离线一小时报告不覆盖此新模式。

短测结果：hybrid-fake-soak-1794534713218-0182a816，PASSED，8.4698152秒，3循环，34次fake worker进程、1次后台强杀重启、3个文字任务验收、6次UNKNOWN不重发检查、6次角色隔离检查，原生调用0。此8秒结果绝不是一小时通过。

首轮红全部保留：1794534582804-41ba0e2b（SIGKILL用signalCode非exitCode的测试断言错误）；1794534616612-bfb9f05e（默认12/h预算正确阻断第3循环）；1794534668364-c2fefcec（测试100000/h被既有限制拒绝）。最终fixture使用合法30/h，不扩大或绕过生产限流。

P1-HERMES-POLICY-PRESERVATION默认锁修复后必要短回归：hybrid-fake-soak-1794535458300-9ca8f65d，PASSED，8.6796491秒、3循环，真实原生调用0。最终worker/helper摘要见native-channel-freeze-policy-r2.json；原短测只作历史，不套用于该修复后版本。正式一小时仍未启动。

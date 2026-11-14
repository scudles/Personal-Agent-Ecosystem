# 原会话材料互通：本轮交付

负责人：Codex /root。日期：2026-11-12。MAG-001 保持生效。当前总状态：ChatGPT 单 ZIP 接收端回报字节匹配；DSH 安全接收条件未满足；六向真实往返 0/30。

## 实际已完成

1. 指定的 ChatGPT 原对话已通过现有原生接口完成文字发送与对应回复回收，没有新建会话、替换成 Codex 或改变模型设置。这是本轮一次性原生工具接通，不等于已将此能力整合为平台常驻 Adapter。
2. 原五个分散附件的哈希请求真实返回 UNSUPPORTED：没有原始字节路径。保留此历史结果，没有假报成功或反复重发。
3. 新增单 ZIP 运输备选：保留原材料包 ID、v1 与五文件原字节；用户已手动上传。平台看到了准确原会话的附件记录，返回的本机附件副本为 1486 B，wrapper SHA-256 与准备包一致。
4. 原 ChatGPT 随后报告明确 ZIP 路径，收到一次固定只读校验请求，并回报 MEASURED_MATCH。root 核对五文件的大小、SHA-256、Manifest、wrapper 及 canonical package hash，报告值全部匹配原包。
5. 建立六向 30 槽位执行计划与独立文件总账工具，具有共享滚动额度、跨进程排他、幂等、UNKNOWN/可能提交保守保留、暂停与原会话绑定检查。没有发送、RPC、UI、后台任务或工程执行能力。

## 证据边界

ChatGPT 的结果记为 **AGENT_REPORTED_BYTE_MATCH**：对应原会话回复已实际观察到，但原生接口未提供可独立审计的 Python 执行链。回复内 JSON 是测量字段投影，缺少完整 helper schema 的部分字段；保留原文与这一说明，不把它称为完整原始工具输出。Bridge 核对报告值并不等于独立认证接收端执行。三方完整一致性仍未通过，DSH 没有本包回执。

DSH 本轮只读观察到：先有运行中的原任务，随后有新的用户草稿；用户报告空闲后，输入框已空但长期目标仍在生成；最近窗口列表显示已切到另一会话。Bridge 没有输入、发送、覆盖草稿、取消原目标或自动切换会话。需要回到原“主进度”、停止生成并通过新鲜身份/输入框检查后才能继续。

## 修改与新增范围

- tools/chatgpt-attachment-hash/：五路径只读校验器、独立 ZIP 校验器、虚构测试与 fixture；没有修改原材料包。
- 交付材料/ChatGPT哈希验证/：单 ZIP、简短操作说明与可选请求，不覆盖原五文件或原请求。
- evidence/chatgpt-attachment-hash-002/：实际原会话请求、对应回复、独立复核、ZIP 字节与本地虚构测试证据。
- tools/real-link-runbook/：独立 metadata-only ledger、CLI、测试、README、冻结候选与测试日志。
- docs/real-material-002/：DSH 接入调查、六向执行计划、本交付报告；evidence/real-material-002/：有限状态与本轮进度。
- evidence/real-material-canary-001/STATUS.json：追加当前状态；历史回执保留。

没有 SQLite schema 变更、生产库迁移或主调度配置变更；未恢复原暂停队列、未触及凪代码/配置/运行数据，未新建、重置或更换任何原会话。

## 实际验证与复核

| 范围 | 实际结果 | 说明 |
|---|---:|---|
| 五路径 Python 校验器 | 12/12 | 虚构材料；不是 ChatGPT 真收件测试 |
| 单 ZIP Python 校验器 | 9/9 | 虚构材料；成员、路径、加密、超长、损坏与无路径拒绝 |
| 文件投递总账 | 15/15，fail 0，skip 0 | 含多进程占位、单次 begin、UNKNOWN/重启、cap=1/30 补录历史越额反例 |
| ZIP 独立复核 | 第 2 轮 PASS，未解决 P0/P1=0 | 原五路径版第 1 轮 PASS；本轮仅审 ZIP 增量 |
| 总账独立复核 | 第 2 轮 PASS，未解决 P0/P1=0 | 首轮 P1-RUNBOOK-CAP-001 已修复；初始夹具失败与后续成功日志均保留 |
| ChatGPT 真实原会话 | 接收端回报匹配，报告值经 Bridge 核对 | 人工上传 ZIP；原生接口发文字；执行链未独立认证 |
| DSH 本包接收 | 尚未完成 | 本轮 0 输入、0 提交 |
| 六向真实往返 | 0/30 | 不能把单次收件、模拟或单腿回复补成往返 |

既有核心 192/192 回归与 3600.573 秒一小时耐久验收保留为先前基线；本轮新增独立工具不在那次耐久范围内，未将旧耐久结果冒称新增工具已一小时实跑。原 helper、74 核心冻结依赖与原五文件的无漂移核对见各子任务冻结记录。

## 剩余工作与风险

- DSH 原“主进度”需可见、原目标停止生成、输入框可核对后，才提交一次固定 canary 请求并回收实际回执。原工具曾出现画面与窗口元数据不一致、可访问树截断及用户输入保护，本轮没有绕过这些保护。
- 六向启动前核对当时真实额度、历史与孤立试验暂停边界；不把默认 cap 或操作者声明当成已观察事实，不把真实总账初始化为虚构零历史。工具不可能阻止其他程序或人工绕过；覆盖不完整则 NOT_READY。
- 六向共 30 次完整往返、至少 60 次交付，逐槽串行、按实际较低额度分批；UNKNOWN 不自动重发。源挑战、补件和确认若新增提交另计额度。当前计划与工具不等于真实验收完成。
- 真实原生消息标识、来源归属、材料证据和回程确认必须逐腿核对；不可得就保留缺失，不用自造 ID 或声明标签补证。
- ChatGPT 附件上传当前仍为人工 B；原生文字工具没有附件上传参数。电脑操作技能所引用 guidance 明确禁止自动操作 ChatGPT 桌面 UI，不能以另一桌面通道绕过此约束。本轮用户手动完成上传，后续同类附件不能宣称已自动化。

## 回滚与下一步

所有新工具在主调度以外，不修改原数据库。回滚为停用新增工具并继续原平台；不删除历史证据、不恢复旧队列，也不声称可以撤回已发送的原会话消息。总账新工具真实目录尚未初始化。

下一步在原 DSH 会话可安全接收后完成材料回执，随后冻结真实批次及实际额度历史，先执行六向各自首槽，再按结果继续；不恢复常驻或旧 pending 任务。

证据入口：[本轮进度](../../evidence/real-material-002/progress.json)、[ChatGPT ZIP 回执](../../evidence/chatgpt-attachment-hash-002/zip-delivery/native-hash-receipt.json)、[总账说明](../../tools/real-link-runbook/README.md)、[总账独立复核](../../evidence/real-link-runbook-001/independent-review.json)、[六向执行计划](SIX_DIRECTION_EXECUTION_READINESS.md)。


权限来源参考：[computer-use SKILL.md](C:/Users/Administrator/.codex/plugins/cache/openai-bundled/computer-use/26.1103.60933/skills/computer-use/SKILL.md)要求读取其[guidance.md](C:/Users/Administrator/.codex/plugins/cache/openai-bundled/computer-use/26.1103.60933/docs/guidance.md)，其中明确规定：“Do not automate the ChatGPT desktop app UI”。因此这里采用用户手动上传 ZIP 与已有原生文字接口配合；没有申请扩大权限或使用另一桌面通道绕过。

# 固定只读材料校验器交付

Task：TRB-READONLY-MATERIAL-VERIFIER-001；负责人：Codex /root。**本地固定包校验器已通过独立首轮只读review；Hermes随后报告按单独授权运行一次并得到相符结果，当前真实证据等级为`AGENT_REPORTED_BYTE_MATCH`，尚不是Bridge独立验证的接收端字节校验。**

## 本地实现与独立review

校验器为 `tools/material-verifier/verify.mjs`，冻结SHA-256：`15e8883cf06627da93883d5f3d6cebba431e5d2670ee6d4f88defd3610835f40`。只允许固定canary目录内5文件及可选nonce，不接受任意路径、命令、manifest或hash覆盖；进行原字节size/SHA-256、Manifest及canonical五项包hash比较。无文件写入、联网、包代码执行、子进程或Agent调用接口。

实现测试15项中14通过、0失败，文件symlink因Windows夹具创建EPERM明确未覆盖1项；真实目录junction、硬链接、错误包 / 文件集、字节变化、读取中变化及重解析等控制已执行。独立实例Codex `/root/offline_review`对同一sourceHash实跑CLI，exit0、5文件 / 615 payload字节，P0/P1=0，结论为`PASS_WITHIN_LOCAL_READONLY_SCOPE`。证据见 [independent-review.json](../../evidence/material-verifier-001/independent-review.json)。

这一结论限定本地只读功能。逐文件读有上限，不代表目录枚举 / 整体运行时长也有界；前后身份检查不是原子OS快照或永久防篡改；本地CLI不会自行证明原Agent调用、原会话连续性或真实收件。此次文档更新没有修改该helper、其README、测试或冻结依赖。

## Hermes单独授权的一次实际请求

用户单独批准了精确Node命令的一次调用，未授予任意命令、其他目录、配置 / Runtime变更或再次运行权限。root在核对已审sourceHash后，通过原Gateway提交；不是恢复旧队列。

| 证据字段 | 记录 |
|---|---|
| deliveryId | `29cdbbbf-91ea-4c6a-a70f-d19276dd713f` |
| nonce | `trb-hermes-canary-20261112-001` |
| package | `d63d404e-1861-4aec-ab1f-277c63b3ecff / v1` |
| 提交次数 | 本次请求1次，`automaticQueueResumed=false` |
| 原助手回复归属 | 找到匹配本请求的原回复，位于后续user turn之前；未读取后续用户正文 / 旧历史 / 工具链 |
| 原生replyId | 未提供；单独保存replyTextSha256，不能把文本hash当执行工具证据 |
| Agent报告 | 已执行一次、exit0、nonce匹配、`ok/verified=true`；5个实际size/hash及manifest / package hash相符 |
| route | 记录为原字段未变 |
| 证据级别 | `AGENT_CLAIM_WITH_ORIGINAL_GATEWAY_RESPONSE` / `AGENT_REPORTED_BYTE_MATCH` |
| 仍未取得 | `independentToolExecutionVerified=false`、`receiverByteVerifiedByBridge=false` |

本次记录截至 `2026-11-12T13:18:31.249Z`，详见 [hermes-result.json](../../evidence/material-verifier-001/hermes-result.json)、[bounded receipt](../../evidence/material-verifier-001/hermes-fixed-hash-bounded-receipt.json)及[固定命令请求](../../evidence/material-verifier-001/hermes-fixed-hash-attempt.json)。保留Agent原回复措辞，未导出或追读私密工具链。不能仅因它报告正确hash、exit0和nonce就升级为Bridge独立审计过实际工具执行，也不是六个Agent间闭环用例之一。

### Bridge注释：expected来源纠正

Agent把helper的`expected`描述成“读取包内控制文件后得到的对照值”，该解释不准确。**`expected`来自已审脚本固定常量；`declared`来自实际读取的Manifest / 控制文件；`measured`来自原字节读取和SHA-256计算。** 比较这三组是helper的职责；Agent报告工具输出不等于Agent另行独立计算。原回复保留不改，纠正仅作为Bridge注释记录，不把更正后的解释塞回Agent口中。

## 三方与耐久的最新边界

- **Hermes：** 从先前无hash能力的内容声明，进展到单独授权固定helper后报告字节结果相符；两个阶段是不同请求，不重复计为同一次调用，也不重写旧阶段结论。
- **ChatGPT：** 用户已报告在原会话手工发送5原文件及请求，当前是USER_REPORTED_SENT、等待回执。没有自动操作ChatGPT UI，不把用户报告写成平台已观察附件或已BYTE_VERIFIED；不提示重复发送。
- **DSH：** 用户已开启截图控制并设置始终允许，本草稿授权有效。最后一次工具仍因旧Esc状态拒绝；该状态是否已清除未知，不能写“当前截图权限仍关闭”。自动投递未完成，不绕过现有拒绝，也不把授权当备份 / 修改 / 发送完成。
- **离线一小时耐久：** root本次交接时仍RUNNING，约49分钟，尚未验收。其隔离模拟驱动保持0真实Agent操作，与本次Hermes请求及人工材料分别记录；运行中不提前写满一小时通过。

原虚构包及冻结74依赖保持不变。真实后续结果见 [canary状态](../real-material-canary-001/DELIVERY_STATUS.md)；当前没有恢复常驻、旧队列、工具链审计或任何凪工程操作。

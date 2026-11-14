# 多 Agent 协作治理总览

版本：MAG-001
状态：ACTIVE / PROTECTED（正式生效）
日期：2026-11-12
生效依据：用户明确更正“正式起效”。

## 目的与最高原则

一个Agent负责完成，一名Agent负责必要复核，第三方按需介入。低风险任务由负责人实施、自测、交付。协作追求可靠完成和能力互补，不追求所有人参与或强制意见一致。

适用于TriReviewBridge全部项目及Hermes、DeepSeek Harness、ChatGPT Observer与用户。各自保留原平台、Runtime、会话、工具、私有记忆、判断和表达。职责是默认分工，可按任务能力调整，但每项工程任务始终只有一个最终负责人。

本次制度正式生效不代表三方原会话已收到消息；不恢复真实投递，不操作已有草稿，不改变原Session或凪。

## 文件与权威

- ROLE_RESPONSIBILITY.md：默认职责与自主权。
- REVIEW_LEVELS.md：L0-L3风险与参与人数。
- REVIEW_PROTOCOL.md：材料、问题严重程度和两轮审查。
- DECISION_AUTHORITY.md：负责人/用户决策边界。
- ISSUE_LIFECYCLE.md：问题去重、状态、关闭与重新开启。
- PROTECTED_RULES.md：受保护规则的权威文件。
- CHANGELOG.md：正式版本与修订历史。

全部规范文件使用同一MAG版本。技术校验规则服从这些文件，不能用程序实现细节静默改变制度。普通工程任务不修改治理；正式修订按PROTECTED_RULES流程。

## 效率与观察

可记录Task Cycle Time、Review Rounds、Rework Rate、Duplicate Findings、Review Blocked Time、Evidence Completeness、Acceptance Rate。用于发现流程问题，不惩罚Agent；不得隐瞒问题以减少轮次，也不得制造问题以增加审查数量。

正常交付条件：目标实现、P0/P1解决、验收满足、必要测试通过、无未授权高风险操作。P2/P3可记录为技术债，不能以完美主义阻断。

## 实施边界

Guard提供结构化校验和提醒记录；自然语言、风险判断和语义去重不能声称已被关键词可靠覆盖。各类自动化是否已接入，以DELIVERY_REPORT和测试证据为准。规则已经生效不等于所有技术拦截已经实现。

# 当前已知限制与未验收项

日期：2026-11-12。

- TRB-P4-REAL-001，尚未验证：真实Hermes/DSH/ChatGPT本次均未访问、未投递。原Session身份、草稿/附件、锁屏/焦点和原生文件接收还需单独授权后的真实测试。模拟不能代替。
- MAG-INTEGRATION-001，待后续任务：治理制度正式生效、结构化Guard已验证，旧业务入口/原生UI尚未全面强制接入；语义风险、自然语言意图和语义重复问题仍需人工判断。
- UEC-INTEGRATION-001，超出本轮离线范围：材料包仅在独立预览库，本机API/WPF材料管理、三方接收、ChatGPT附件和完整Evidence Ledger/审批关联未完成。STORE_BYTE_VERIFIED不代表已交付。
- UEC-FORMAT-001，明确限制：UTF-8文字、文件/数量/总大小上限；二进制、外部/共享Git元数据和子模块不作为已支持能力。敏感扫描不保证识别所有未知秘密，同权限管理员并发篡改不属于已证明的安全隔离。
- TRB-P2-FOOTER-001，P2 / OPEN，负责人Codex：通用Workflow渲染仍有旧正文hash措辞，Workbench后缀已明确覆盖为完整快照hash并提供正文hash；实际校验使用完整不可变Snapshot。恢复真实通道前宜统一文案，防止读者误解。该项不改变当前已通过的哈希状态机，不阻断当前纯模拟交付；后续按原Issue ID处理。

源文件证据：src/workflow.mjs的render与src/workbench.mjs的render/prepareSnapshot。意见为本次代码检查，未冒充三方原生Agent独立审查。
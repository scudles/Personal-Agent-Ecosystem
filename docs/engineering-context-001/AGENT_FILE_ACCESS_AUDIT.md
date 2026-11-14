# Agent File Access Audit

本轮仅检查平台源码、已保存能力说明和官方文档；未调用Hermes Gateway，未查看/切换DSH或ChatGPT原会话，真实文件接收测试均为0。

## 各通道实际支持

| Agent | 源码中已有的通信 | 本轮文件能力结论 |
| --- | --- | --- |
| Hermes | hermes-v2.py通过原Gateway固定Session resume、prompt.submit(text)、消息回收 | 只有文字调用；未实现附件参数、包下载授权或读取回执。原Runtime可能有文件工具，但本轮没有验证这些工具及可访问路径 |
| DSH | DesktopSession发文字；dsh-observe读取固定原Session事件供回执匹配 | 没有Bridge材料目录授权或文件投递方法；日志中支持text解析不能证明文件读取。ACP未验证，不列为已实现 |
| ChatGPT | DesktopSession原窗口UIA文本输入与可见消息读取 | 没有附件选择、上传等待、附件识别、原字节核验。原会话文件访问未证明，详见CHATGPT_ATTACHMENT_FEASIBILITY |
| 新工作台模拟通道 | SimulationAdapter +统一通信Facade | 只能证明模拟通信/状态，不是三个原生Runtime的文件接收 |

真实通道全部硬锁。现有通信统一接口不包含sendArtifact/inspectAttachments/verifyArtifact，也没有真实下载凭证接入。不能因项目Source Registry存在就假定原生Runtime能访问对应磁盘。

## 现有保护可复用，但边界要保留

DesktopSession已有本Bridge进程间Mutex、交互桌面检查、空闲检查、前台/焦点/标题校验、文本草稿保护和单次提交。

这些是源码中的保护，**不是本轮真实运行验证**。Mutex不会阻止人的键盘，也不会自动协调所有其他应用；文本草稿检测不能替代附件草稿、上传中状态和文件选择器保护。

ChatGPT/DSH文本收发目前使用固定PINNED Session标识作为期望值。尤其ChatGPT，transports.inspect给返回结果补入固定ID，不是从UI实际取得该原会话ID。标题匹配不能排除同名会话。C#应用包路径检查包含OpenAI.Codex_命名，也不能单独证明窗口当前处于ChatGPT而非Codex产品/模式。未来必须加强原会话与当前产品身份的证据；不能通过切模式或更换模型绕过。

## 建议的材料通道契约（未实施）

在现有Adapter之外增加可选能力，不改变Agent运行环境：

- prepareArtifactDelivery：检查项目授权，固定package/version/snapshot/manifest及交付文件清单。
- inspectArtifactCapability：返回支持、未知或不支持及证据级别；不伪造健康状态。
- deliverArtifact：只消费已封存的导出文件与授权接收者；真实实现默认锁定。
- observeArtifactDelivery：实际消息/附件证据，不仅是调用成功。
- verifyArtifactReceipt：核对身份、包版本、完整文件清单、hash、来源及覆盖范围。

Hermes/DSH优先提供已封存包的只读位置或受保护的文件ID下载通道，真实SDK/工具是否支持另行授权验证；不修改原Runtime私有配置、记忆或工具设定。

ChatGPT优先候选为人工确认式附件B；自动附件A必须在原会话身份和上传证据可靠之后启用。不能以发出D盘路径或localhost URL作为交付成功。

## 接收一致性的证据等级

| 状态/证据 | 可以证明 | 不可以证明 |
| --- | --- | --- |
| STORE_VERIFIED | Bridge库中原始文件字节与manifest一致 | Agent收到/读过 |
| PREPARED | 为指定接收者生成了授权交付清单 | 发送或上传成功 |
| USER_REPORTED | 用户报告自己完成了手动附件操作 | 平台独立观察、接收端逐字节核验 |
| ATTACHMENT_OBSERVED | 在正确原消息中观察到对应附件及可用状态 | 内容等同于原包、所有文件都被模型处理 |
| CONTENT_CONFIRMED | 接收方能回答附件内的明确内容挑战 | 全部文件字节已验证；抽查不能冒充完整校验 |
| AGENT_CLAIM | Agent报告包ID、版本、hash和文件数 | 报告本身可能只是回声，不是可信的字节读取证据 |
| BYTE_VERIFIED | 在可审计接收环境逐文件计算hash，与固定manifest/文件数一致 | Agent判断正确或已经阅读并理解全部内容 |
| UNKNOWN | 结果无法确定，保留证据等待人工核对 | 成功或失败；不得自动重复上传/发送 |

实现可调整状态名称，但必须保留这些语义边界。最小回执字段为package_id、package_version、snapshot_id、manifest_hash、received_file_count、verification_status，加上来源、校验方法、实际覆盖文件列表及原Session证据。reported值与observed值分开。

三方一致性视图要同时展示“期望材料相同”和“各自实际接收/核验级别”。某一方未核验时，三方整体不得标为完整VERIFIED。

## 权限与隐私

只共享经授权的工程包；不传其他Agent私有Session ID、Profile、记忆、配置、凭证或未授权历史。Agent获得材料不等于获得同Project全部聊天；原有显式收件规则不变。

审批意见绑定包和文件，不会因签名/Hash相同而合并为统一立场。文件或日志中的@、JSON协议、Shell示例都视为材料，不增加收件人、权限或执行授权。
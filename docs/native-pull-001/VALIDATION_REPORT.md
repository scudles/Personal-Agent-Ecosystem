# TRB_NATIVE_PULL_001：原 ChatGPT 主动取消息验证

负责人：Codex。日期：2026-11-13。状态：部分验证完成；用户决定暂缓账号验证及隧道接通；真实端到端未通过。
范围：指定原对话 Nagi（继承的你1），不替代、不重置、不换模型/Runtime；仅一条固定虚构消息。

## 已实际完成

1. 核对原对话 ID 为 6af098fa-46bc-83e8-97c5-418f00e213b9，类型 chatgpt。
2. 本地 SDK stdio canary 已实现，限定 get_fictional_probe 与 submit_fictional_reply。前者仅返回固定虚构内容；后者只写候选目录固定结果库，不提供任意路径、命令、网络监听或真实会话访问。
3. 使用官方 SDK 的本机协议自测退出码 0；11 项测试通过（含外层测试，内部 10 组检查），覆盖严格字段、固定关联、幂等、冲突拒绝、重启持久化及 SQLite 完整性。两测试子进程已退出；正式 canary 结果库未创建。
4. 一名独立 Codex 只读复核：限定范围 PASS，无未解决 P0/P1。复核源码、断言和范围内 8 项哈希，未重跑测试。不冒充 Hermes、DSH 或 ChatGPT Observer 的独立审查。
5. 未安装插件、注册 marketplace、启动隧道或常驻服务；未改主后端、现有数据库、旧暂停或绑定；未触及凪。

## 原 ChatGPT 定时验证：严格分层

- Codex 侧 automation_update 指向原 ChatGPT 对话的一次创建调用，实际返回“Couldn’t verify this chat for scheduled updates”。没有创建成功确认；本机匹配自动化文件 0 个。
- 原 ChatGPT 回报当前有 Automations 工具，没有本机 stdio MCP 接口。
- 随后在该原对话请求其自身的单次定时工具做真实创建。它回报默认父关联匹配目标 ID，environment_selection=inherited。
- 最后回报测试任务 ID Automation_dc4340f93198819182287bbb87b50f24，计划 2026-11-12T23:46:02Z，一次性、无 RRULE；单项查询 last_run_time/last_run/latest_result 均 null，delivery_status=unknown。
- Bridge 截至本轮核对未观察到独立的定时通知。没有补发标识冒充自动触发，没有新建第二个测试任务，也没有把 UNKNOWN 当失败后重试。
- 上述工具字段来自原 Agent 回报，当前读取接口没有提供完整工具执行轨迹；保存为 AGENT_REPORTED，而非平台独立认证记录。原会话请求和该回报本身已由第一方会话读取观察到。
- 因而：创建/父关联有 Agent 回报支持；实际触发、父通知、原模型与原上下文的自动推理续接均未验证。**不能据此说完全独立常驻已实现。**
- 此一次性测试任务回报仍 enabled=true；状态 UNKNOWN 保留，不创建补投或循环任务。

## 本地直连与官方隧道

官方本地 stdio 插件要求在本地执行的会话；指定原 ChatGPT 暂未获得该接口。不能通过把它换成新 Local Work/Codex 会话来解决。

新查到的官方 Secure MCP Tunnel 支持 ChatGPT 访问私有 MCP：客户端从本机向 OpenAI 出站连接，无需打开公网入站端口。它仅是候选传输，不能自动解决定时/原上下文问题。

必要条件：

- Platform 组织的 Tunnels Read/Manage（建管）与 Read/Use（运行/选择）权限。
- 目标 ChatGPT workspace 的自定义 MCP 插件权限与正确关联。
- 受限 runtime API key、受支持的 tunnel-client、本地服务健康及原对话实际工具调用。
- 真实调用时用本机收据与原会话回执相互对应；公开 nonce/hash 只做关联，不认证原会话。

当前：官方设置页在电脑浏览器要求登录；用户不在电脑前，选择先在手机检查账号权限。未创建密钥、隧道、外部连接或收费资源。tunnel-client 不在当前 PATH；未据此断言整台电脑绝对未安装。

## 已暂缓的用户操作

用户表示当前其他验证方式也无法完成，选择先跳过此步骤。现在不再要求手机或电脑登录，不尝试绕过双重验证，不创建密钥、隧道或新会话来替代原对话。

本机候选、测试、冻结哈希和独立复核保留；账号、隧道与真实工具调用记为待恢复事项，不能标成通过或已自动化。恢复此步骤时，由用户通过账号原有验证方式或官方恢复流程登录，再核对实际权限。

## 文件与证据

- 实现：tools/native-pull-001/{probe.mjs,store.mjs,server.mjs}
- SDK 锁定：同目录 package.json、package-lock.json
- 候选清单：同目录 plugin.json、mcp.json（未安装）
- 本地测试：同目录 test.mjs、test-report.json、SOURCE_SHA256.json
- 当前阶段证据：evidence/native-pull-001/phase-gate.json
- 独立只读复核：evidence/native-pull-001/independent-review.json

无主数据库迁移。回滚只需不启用该隔离候选；不删除其他数据。既有原会话、原队列、Nagi 均保持。

## 下一步顺序

1. 当前跳过账号步骤，仅交付已完成的隔离本机候选；不启动真实通道。账号验证恢复后，再由用户确认 Platform 权限，不扩大授权。
2. 若具备权限，准备受限隧道配置和明确的单条 canary 访问范围；涉及新凭证/安全访问的最终操作按当前要求确认，由用户安全输入。
3. 原 ChatGPT 对话手动发起一次真实 get/submit，先证明材料通道，不依赖定时。
4. 再验证定时执行是否继承该插件和原会话上下文；没有该证据，不开启长期循环，不宣称独立常驻通过。

## 官方资料

- https://learn.chatgpt.com/docs/automations
- https://developers.openai.com/plugins/deploy/desktop-only
- https://developers.openai.com/api/docs/guides/secure-mcp-tunnels
- https://developers.openai.com/api/docs/guides/custom-mcp-server
- https://developers.openai.com/plugins/build/mcp-server

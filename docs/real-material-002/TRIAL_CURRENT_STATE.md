# 当前试用交付状态

更新时间：2026-11-13（北京时间）。唯一工程负责人：Codex。

## 当前决定

用户最新明确同意：ChatGPT先使用Codex接力，待账号可登录后继续原独立方案。此前“不接受接力”的产品选择已被该新决定替代；最终独立常驻目标仍保留。临时接力已完成一次真实文字闭环，原ChatGPT回复完整回到独立WPF工作台；每5分钟本Codex任务heartbeat已登记，首个定时触发尚未观察。旧SIM入口及旧队列/暂停保持。仅ChatGPT文字开放，非独立常驻。详情：[接力实际交付与边界](../codex-relay-001/DELIVERY_REPORT.md)。

## 本轮实际交付

- WPF 主输入区的持久请求键和断线恢复已修复；两项并发 P1 均关闭。10/10 假 HTTP 多进程测试、原生 WPF 模拟集成 1/1 通过；独立只读第二轮复核通过。
- 已将完全相同的测试构建原子升级至标准 runtime/native/TriReviewBridge.UX.Collab.exe；原“打开新版协作工作台.cmd”入口无需修改。已打开的窗口未被强制重启，重新打开才使用新版。
- 旧 exe 备份在 backups/client-pending-002/TriReviewBridge.UX.Collab.before.exe。无数据库迁移；不删除草稿或未决请求来回滚。
- DSH 输入安全候选恢复旧共享源码，候选隔离至 native/candidates/dsh-input-safety-001/rev2/；30/30 纯测试及第二轮独立只读复核通过。未操作真实 App，未接入日常发送，多行仍仅固定虚构 probe 候选。

## 原会话已观察事实

六方向均观察过真实文字往返，累计 8 个闭环：HC1、CH2、HD2、DH1、DC1、CD1。原 30 次重复目标未完成，不宣称通过。原消息 ID、Hermes admission 指针与 ChatGPT 原对话证据分别记录，不混作同一种来源证据。DC 源提交来源不确定；CD 一次 UNKNOWN 后经用户授权补投一次，不能据此证明零重复或完全自动化。

封存测试批次当前暂停，在途事项已收尾；余下 22 个源请求仅准备，未发送。封存 90 个键免小时上限不等于生产不限额；两个旧 UNKNOWN hold 保留。

## 阻碍完整真实试用的缺口

1. 旧主工作台 Host 仍为 SIMULATION_ONLY。新增独立 CODEX_RELAY 工作台已接ChatGPT普通文字并完成1次真实闭环，纯文字任务仅仿真验证；Hermes/DSH日常真实接入及正式审批仍未接通，不能泛称整个工作台真实可用。
2. 尚无经过验证的 Node/WPF 独立接入指定原 ChatGPT 对话的受支持通道。不能用新 API 会话替代，不能把 Codex 工具可用写成独立服务可用。
3. DSH 候选真实 UIA/hook/IME/焦点/多行可靠性尚未验证，日常收件必须限定确切自己的请求与完成回合。
4. 三方材料内容身份已核对，但 DSH 未完成附件原字节哈希重算；Hermes/ChatGPT 为 Agent 回报字节匹配，不等于平台独立认证工具执行轨迹。threePartyByteVerified 仍 false。
5. ChatGPT 附件仍保留人工交付限制。

## 接下来最小验证方向

用户已决定临时Codex接力：指定原ChatGPT一次文字收发已完成，新任务trireviewbridge-chatgpt在本Codex上下文每5分钟检查独立队列；未观察首个定时触发，不宣称长期常驻。原ChatGPT主动调用本地插件的独立路线仍等账号验证，未安装插件/隧道，不以临时接力冒充独立方案。

## 证据与回滚

- [客户端交付与验证](../../tools/client-pending-001/DELIVERY_REV2.md)
- [客户端发布记录](../../tools/client-pending-001/RELEASE.json)
- [原生集成证据](../../evidence/client-pending-001/native-integration.json)
- [DSH 候选交付及未验证边界](../../native/candidates/dsh-input-safety-001/DELIVERY_REV2.md)
- [真实测试机器进度](../../evidence/real-material-002/real-test-progress.json)
- [原始测试清单](../../evidence/real-material-002/real-links-20261112-001/manifest.json)

旧阶段报告按其时间点解读。原离线核心一小时耐久证据不覆盖本轮新修复和未来真实通道。本轮未修改凪代码、配置或运行数据，未新建或重置任何原会话。

## 原 ChatGPT 主动取消息验证增量

最新验证：用户已授权第一条路线；原ChatGPT单次定时创建及父关联有Agent回报，实际触发/续接仍UNKNOWN。本地固定虚构MCP已通过10组协议检查和独立只读复核；未安装。用户已决定暂缓账号验证，官方Secure MCP Tunnel与真实调用仍未验证；当前无需用户继续手机登录。详情：[原ChatGPT主动取消息验证](../native-pull-001/VALIDATION_REPORT.md)。

# 第一阶段原会话接通验证记录

日期：2026-11-12（Asia/Shanghai）。性质：实施者自检和真实会话接通证据，非独立 Green 验收。
授权：用户同意第一阶段，在 D 盘搭建；仅沿用其指定旧会话，不新建、不重置、不改动凪代码和运行数据。

## 结果

| 参与方 | 原会话 | 接通结论 | 实际入口 |
|---|---|---|---|
| ChatGPT | Nagi（继承的你1） | 通过一次往返 | codex-app-tools，目标 kind=chatgpt |
| DeepSeek Harness | 主进度 | 通过一次往返 | Computer Use 桌面发送 + 指定原日志只读回收 |
| Hermes | Nagi | 通过一次往返 | 现有 Gateway 共享 session |

各发送一条 TRB_PHASE1 固定验证消息，要求只回传随机 ACK，不调用工具、不读写文件、不执行项目任务。
旧会话身份、用户消息、原回复及随机编号可对应；没有使用新对话或摘要重建。

## ChatGPT
- 原 ID：6af098fa-46bc-83e8-97c5-418f00e213b9；连接器列出 kind=chatgpt。
- probe：42252d6f-ac57-48d0-94c7-d453f7dcc2cb。
- 前一原回合：c2009dce-4584-4fe2-b508-d89ce65d2513。
- 新回合：a9c9d4c4-8ace-4756-b2d4-f1bc7fbe22c2。
- 最终回复项：2c42adf6-8ead-42be-aadb-3d123649dc78。
- 原文：evidence/chatgpt-source.json。连接器输出 Markdown 的 TRB\_ACK，原样保留；
  仅为对照屏幕所呈现文本，将这一确定的转义还原为 TRB_ACK 后校验随机编号。
- 计数 6 是连接器返回的最近三回合消息窗口，不是完整会话总数。
- 发送时未覆盖模型与思考设置；接通测试没有模型工具输出。

## DeepSeek
- 原 ID：session-ebd654d5-1bf8-419c-bc2a-d9be1ed023fc；原记录标题确认为主进度。
- probe：342dfecd-b216-4eeb-bfeb-048c6b246b26。
- 只读来源：C:\Users\Administrator\.dsh\sessions\--E-~51EA--\session-ebd654d5-1bf8-419c-bc2a-d9be1ed023fc\session.v4.jsonl.zstd。
- 验证前 2467 条记录（含文件头），验证后 2476；这不是聊天消息数。
- 用户消息 seq=2470，id=2ad541f1-a74c-438b-ab72-113b3f6772c4。
- 最终助手消息 seq=2472，id=07feaabf-5c3a-4a4b-9ab7-af6bd22e4399。
- seq=2474 有 turn/end；新段无 tool/call。
- 证据：evidence/deepseek-source.json，仅保存验证的正文及事件类型，不复制旧历史或思考内容。
- 截图/可访问性读回同一窗口标题与 ACK，发送后输入框为空、发送按钮禁用。

## Hermes
- 原 ID：local-6f275933587b3c068cdbe3bea5633785fb8cacfb3a4c298855c66d931b6946d7。
- probe：190f643e-c413-494a-aed5-d81a2df13f50。
- 消息数 551 → 553，新增本次用户验证消息与助手回执。
- 原路由保持：opencode-go / deepseek-v4.1-flash，reasoning=medium，profile=D:\HermesAgent\Data。
- 回执来源项：8cdb179fde1d4a4aa5262d02451c6fa6。
- 证据：evidence/190f643e-c413-494a-aed5-d81a2df13f50.json。
- 仅附着现有 Gateway；没有启动、重启、创建会话或更改原配置。

## 验证与纠错记录
- 8 项隔离测试通过、0 失败：evidence/core-tests.txt。
- 5 项本地 HTTP 检查符合预期：evidence/http-checks.txt。
- 首次 Hermes SDK 探测选到 PM 管理环境，缺 websockets；改用已有且依赖齐全的 D 盘执行环境，未安装依赖。
- 最初重复进入 GatewayClient 上下文导致双读取错误；修正为其原有单一上下文后接通，未发送重复消息。
- DeepSeek 的 session/title 位于 data.title，已按实物字段修正；首次没有据猜测字段放行。
- 桌面 setValue 未填入输入框，随后使用标准粘贴并核对全文；Return 后立即读回仍旧，待生成结束后从原日志确认一次用户消息，没有重发。
- 普通沙箱不能访问本地 IPC/loopback；相关已授权本机接入在权限工具批准后执行。没有关闭应用鉴权。

## 交付与范围
源码、Node runtime、SQLite、日志、证据在 D:\TriReviewBridge。
Node v26.12.1，D 盘副本与已安装原文件 SHA256 相同：
1C63F1417E2E26D83CA9A9EC1D548524AB1305BC7209D90EBCA56257FF0D84ED。

服务只监听 127.0.0.1:48731；不设登录外网入口。页面为只读证据台。
本次未改动凪源码、配置、userData，未启动凪，未在凪仓库运行测试。
本次正常追加了三方授权验证消息；原应用会正常写入自己的会话与日志。

## 尚未完成
- ChatGPT、DeepSeek 的独立常驻发送适配器。
- 浏览器扩展（桌面原会话验证未使用它）。
- 长期断线恢复、稳定性、真实三方审批、任意两方互批、自动任务派发。
- 独立验收。
这三次连通成功不能替代上述验收，也不证明模型判断习惯永久保持不变。

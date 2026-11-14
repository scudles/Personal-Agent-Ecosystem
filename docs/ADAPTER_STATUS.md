# Adapter 状态与边界（001审计）

当前新工作台仅装配 SimulationAdapter，真实Adapter激活没有API或环境变量开关。

| Agent | 保留原实现 | 身份与读取限制 | 本轮状态 |
|---|---|---|---|
| Hermes | 原Python SDK / Gateway | 原session/profile固定；依赖原SDK版本 | 未连接、未提交、未回收；只保留原绑定 |
| DSH | C#UIA + 原会话只读日志 | 窗口/标题/输入框/原日志核对；受焦点、草稿和锁屏限制 | 暂停保持；未检查或改写草稿 |
| ChatGPT Observer | 原对话C#UIA | 可见界面证据，不能证明不可见路由或全量历史 | 暂停保持；未操作原对话 |

新库原绑定三条paused=1；旧库内ChatGPT/DSH rolePaused仍为true，旧数据83条与319条审计保留。冻结后的新服务真实调用=0。

67项现有测试包括模拟，不表示真实Adapter稳定。新增统一接口应声明能力；不支持的方法返回unsupported或not_authorized，不伪造connected。

Agent保留原平台、Runtime、系统提示词、工具和私有记忆。平台不得复制私有记忆，不新增统一人格，不将摘要注入新会话作为等价替代。
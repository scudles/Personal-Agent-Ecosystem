# 原始会话接入：能力与授权边界

本次原生Agent操作为0；全部新增功能使用模拟Adapter。历史阶段真实证据仅代表当时原型，不能替代001真实线路验收。

| Agent | 保留实现 | 当前已知限制 | 本次状态 |
| --- | --- | --- | --- |
| Hermes | native/hermes-v2.py，原Gateway/Session | SDK/Profile依赖；确认原Session后才可用 | 原实现保留，真实调用硬锁 |
| DeepSeek Harness | native/DesktopSession.cs，原Session只读日志能力 | 解锁桌面、标题与原ID、人工输入、未知草稿、焦点及UIA版本限制 | 原实现保留，暂停及草稿未操作 |
| ChatGPT | 原ChatGPT桌面指定对话，DesktopSession | 可见UI读取覆盖有限，不能据此证明完整服务端历史/不可见模型路由 | 原实现保留，桌面投递暂停 |

统一接口仅提供通信能力：connect、inspectSession、sendMessage、receiveMessages、getDeliveryStatus、pause、resume、healthCheck、disconnect。模拟实现可测试；真实锁定实现显式返回未授权、不支持，nativeAccessed=false。不伪造在线/送达。

不合并Runtime、记忆、模型、工具和人格；不修改系统提示词；不通过新API会话冒充原会话；不提前给出其他Agent首轮结论；不改写三方原始意见。

后续经用户明确授权才能进行：核对原Session、只读健康检查、人工操作互斥及原窗口保护探测、真实投递与回复回收。真实接入恢复是新的授权门，不在本任务自动完成。

设计的真实线路验收：六个有向方向，每方向5次往返，共30次，仅虚构材料。逐次记录Session证据、来源边界、输入前草稿状态、提交与确认、UNKNOWN和回复。不以SHA证明来源，不以窗口刷新证明真实Agent在线，不将模拟结果填入真实统计。

验收目标：错投、重复提交、草稿覆盖、错误确认、非接收方参与均为0。锁屏/切换会话/原应用关闭/用户输入/存在草稿/身份不确定必须停止；发送后不确定进入UNKNOWN，禁止自动重发。

没有上述授权时保持现状。本版不提供UI按钮或环境变量直接激活真实Adapter。

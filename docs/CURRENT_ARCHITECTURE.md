# 001 增量审计：当前架构

核对时间：2026-11-12 09:47（北京时间）。以下是实际代码，不采用任务书中较早的41项状态冒充当前状态。

已实现：Workflow/Supervisor策略钩子、多Project/Workspace数据库、唯一Binding、显式收件元数据、不可变审批快照、任务/取消/根预算、模拟Adapter、鉴权loopback服务、真正WPF XAML/WinExe。

调用链：WPF -> workbench-server -> Workbench(extends Workflow) -> WorkbenchSupervisor(extends Supervisor) -> SimulationAdapter。真实Adapter不装配；原transport/C#UIA/Hermes源码保留但未调用。旧Web与旧server保留只读。

Conversation与当前Workspace为同一业务空间，可增加别名，不另造第二份历史。

原文：普通聊天和文字任务保留原回复，正式审批保存rawReply/proof及票据；部分旧历史做可读投影，原始文字仍保存。需要继续区分提取机器元数据与改写Agent观点。

001新增缺口：项目描述/成员权限、受限访问主体、独立分析完成后的显式交叉披露和分歧记录、授权项目知识卡、原生多窗口入口、差异性观察、能力接口标准化、连续两小时验收。

不重复：已完成多项目/路由/快照/WPF，不重写这些模块。无原会话读写、真实投递或模型设置变更。
# Phase 0 当前实现与基线

核对日期：2026-11-12。实施基准为用户提供的《TriReviewBridge 多项目原生桌面协作工作台 产品需求与技术实施方案 v1.0》。

## 已核验

- Node.js v26.12.1，内置 SQLite；现有 Workflow、Supervisor、Room、Adapter、Web UI 可复用。
- 旧后台已排空停止，真实 Adapter 的调度和镜像已停止；不调用真实原会话、不处理 DeepSeek 草稿。
- 旧 SQLite integrity_check 均为 ok。workflow：7 个事项、21 个投递、44 个镜像消息、319 条审计；原始记录和不确定状态保留。
- 原有 41 项针对性测试本次重新运行全部通过；包含模拟，不是本轮真实 Agent 验收。
- ChatGPT、DeepSeek 的单独暂停保持 true；旧后台关闭导致全局 paused=true。
- .NET SDK 未安装；现有 .NET Framework C# 编译器和 WPF 程序集可用于构建原生 WPF/XAML WinExe，不需要 WebView。

## 尚未实现的目标

多项目与 Workspace 归属、数据库隔离约束、动态原会话注册、显式元数据路由、完整审批快照、WPF UI、按事项一致限额、任务取消与来源转交。

## 基线

data/workbench-baseline.json 指向冻结副本与 manifest.json；副本包含源码、配置、数据库、测试、证据和文档，共 83 个文件。原 runtime 二进制继续原位复用。原始访问令牌仅在本地配置与私有备份，不写入报告。

## 边界

本轮不访问三个真实 Agent 的 SDK、窗口或会话日志；不启动或读写凪运行环境。旧数据仅从平台数据库副本迁移；已有原绑定只是记录保留，不构成激活或重新绑定。
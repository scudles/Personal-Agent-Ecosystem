# 离线协作升级交付状态

Task：TRB-OFFLINE-COMPLETION-001；实施负责人：Codex /root。用户授权先完成不操作真实会话的工作。真实投递/附件测试须另行授权。

当前E1–E4已实现并通过127项回归；独立Codex两轮只读复核后，四项P1已解决，定向范围未解决P0/P1为0。用户随后明确将本轮耐久从两小时改为一小时；E5已按至少3600秒完成核验，实际3609.4204633秒通过。原7200秒要求不宣称满足。

- [E1/E2模拟交换与Ledger](E1_E2_REPORT.md)
- [E3/E4治理、桌面与独立复核](E3_E4_REPORT.md)
- [E5一小时离线验收结项](E5_ACCEPTANCE_REPORT.md)
- 当前机器可核对证据：evidence/offline-completion-verification.json
- 完整回归：evidence/offline-completion-all-tests.txt
- 本轮一小时耐久：evidence/offline-completion-soak-one-hour.json（必须passed=true、acceptance=true且elapsedSeconds>=3600）；原两小时驱动报告保留于evidence/offline-completion-soak-acceptance.json，不将其写成已满7200秒
- 真实恢复演练：evidence/offline-completion-recovery.json
- 独立复核：evidence/offline-independent-review.json

## 启动

双击 D:\TriReviewBridge\打开离线协作验收版.cmd。独立回环端口48734，独立虚构演示库 data/offline-completion-preview/workbench-materials.sqlite。候选WPF程序 runtime/native/TriReviewBridge.Offline.exe，不替换或关闭现有旧窗口。原入口、主库、原绑定和暂停保持。

## 可实际操作

1. 在工程材料页选择版本，阅读、逐字节校验、导出。
2. 在顶部选择明确模拟接收者，执行模拟分发；只复制到Bridge自有收件箱并读取，不触碰原生Agent。显示“模拟字节校验”，不显示真实已收到。
3. 在治理页登记已有文字任务：唯一负责人、L0–L3、必要复核者、范围及验收。L0不额外审查，L1一名；第三方须有依据。
4. 开启与当前最新材料相匹配的必要复核，再登记模拟意见原文、文件及Issue引用。P1修复验证须明确PASS/PASSED、关联Issue，并使用修复后同材料的独立模拟验证记录。
5. 处理Issue及治理提醒。拒绝、重开、严重程度调整不能填写随意字符串冒充依据；从已登记版本意见选择有实际文件证据的记录。对新材料的审查不会沿用旧意见；重复快照UUID或历史包往返不能伪造实质修改。
6. “检查模拟交付条件”只检查材料链路和结构化记录。engineeringAcceptance=false；不会运行工程源码或把审议变为实施授权。
7. “准备人工交付清单”生成导出目录及核对单。它不打开附件窗口，不上传。用户报告仅为USER_REPORTED_SENT/UNKNOWN，不能升级VERIFIED。
8. 文字输入可按后台/窗口/空间加密保存并恢复，恢复不发送，不覆盖已有输入。原应用已有草稿完全不读写。

原文字对话与正式文字全票审批继续保留。工程治理有自己的版本与Issue记录，不能把普通赞同、旧正文审批或模拟材料检查冒充真实工程交付授权。

## 保护和限制

来源仍只开放平台内授权虚构目录；不加入真实工程/凪。取消、截止、全局/角色暂停、根预算和文字/材料共享每小时限流已贯通。UNKNOWN不自动重新复制，用户只能核对既有副本或取消。

仍未做或不在本轮范围：真实Hermes/DSH文件接收、ChatGPT原会话附件自动上传、真实Adapter矩阵、原生会话历史完整性核对、真实工程目录授权、主库推广、公网/手机、任意Shell/项目文件执行、OS级防篡改、通用自然语言语义识别、托盘/通知/开机启动。不能将模拟验收表述为三方已全面接通。

## 回滚与数据

全局Schema2，UEC组件1..7。实际平台库的30张旧表在新副本中逐项核对无变化，原83条档案与319条审计保留，3个原绑定暂停不变，45项受保护文件不变。原数据与旧桌面未推广迁移。

恢复基线 data/offline-completion-baseline.json 含私密配置，只供本机恢复，不能打包转发。已在新隔离目录实际恢复旧数据库、旧代码与旧WPF并运行；未在生产库进行恢复覆盖。回滚时停止新候选自身后台并关闭候选窗口，按备份恢复到新文件再校验，保留新增材料和日志，不递归清理、不触碰原Agent或凪。
## 实际界面截图

由Windows Computer Use截取实际前台WPF窗口，内容为隔离虚构演示，不是RenderTargetBitmap或界面设计稿：

- [对话界面](../../evidence/current-ui/conversation.png)
- [工程材料](../../evidence/current-ui/materials.png)
- [治理与证据](../../evidence/current-ui/governance.png)

一小时调整依据见ONE_HOUR_ACCEPTANCE_CHANGE.md；不是修改MAG-001制度，也不代表真实通道获授权。

最终离线发布恢复基线：backups/offline-completion-release-2026-11-12T08-56-58-548Z（1256文件、9份SQLite备份，已校验，仅本机私密恢复）。此后UX-001另立Task，旧版验收不自动转移到新UI。

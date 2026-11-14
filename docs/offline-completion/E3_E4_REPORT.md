# 阶段 E3/E4：治理接入与原生桌面

实施负责人：Codex /root。风险：跨模块L2；治理边界实现按L3专项复核。治理规范仍为MAG-001，八份受保护规则及policy未修改。

## 实际实现

复用GovernanceGuard规则，在工程治理Host的注册、冻结范围、开始必要审查、处理Issue、超轮次依据和交付条件入口强制检查；事件和状态由SQLite事务统一保存，多个窗口不再各写JSONL状态。普通文字对话和原有正式全票审批维持各自语义，不能用它们替代工程治理的交付记录或真实实施授权。

负责人唯一，L0不额外拉人，L1一名，L2第三方须有依据，L3专项与用户授权分离。P0/P1阻断、P2/P3非阻断；版本意见保留分歧。风险语义及自然语言不能保证自动正确判断，未知请求不通过关键词猜测。

WPF新增治理与证据页：登记等级/范围、必要复核、意见及文件引用、Issue状态/重评、四项提醒和模拟交付检查。材料页新增明确模拟收件人、UNKNOWN既有副本核对/取消、来源退役、快照详情、人工交付准备及报告。人工报告不能升级VERIFIED，平台不操作附件选择器或原应用。

工作台草稿采用Windows CurrentUser DPAPI加密，按后台配置路径、窗口档案和Workspace隔离；独占锁避免多个窗口覆盖同档案，原子保存及重启恢复，恢复绝不自动发送。可手动恢复当前空间的其他档案，当前输入不为空时拒绝覆盖。它只保存Bridge输入，不读取任何原生Agent草稿。500ms去抖意味着异常退出前最后不足500ms的编辑不承诺已落盘；跨Windows账号/机器的DPAPI恢复不在本次验证范围。

候选程序为runtime/native/TriReviewBridge.Offline.exe，界面为desktop/OfflineWindow.xaml。旧exe和MainWindow.xaml按基线保留，不关闭用户旧窗口。独立入口：打开离线协作验收版.cmd；新库data/offline-completion-preview，回环端口48734。仅新虚构演示的initial_setup会启用模拟控制，不自动恢复人工暂停或任何原绑定。

## 独立复核与修复

用户明确授权一名只读Codex子Agent后，由/root/offline_review执行；不冒充ChatGPT Observer，不读取原会话，不运行会写测试。

首轮NOT-PASS，确认/追踪四项P1：

- P1-CANCEL-001：旧任务取消/截止/全局暂停/根预算及双向限流必须贯通新材料入口。
- P1-VERIFY-001：普通评论不得作为Issue修复验证。
- P1-BASIS-001：虚构依据字符串不得关闭/重开/降低P1。
- P1-ROUND-001：不得用新快照UUID或历史包往返绕过轮次；新材料必须匹配当前审查，首轮发现必须能进入第二轮。

已分别修复并加实际反例测试。VERIFIED要求针对Issue、PASS/PASSED、文件证据和post-fix同材料水位；依据必须解析同任务实际记录；实质修改比对源内容而非时间/UUID；开始和完成审查均匹配本任务最新材料，历史包装不能假冒实质修改；旧文字和新材料共享全局限流与根预算。

第二轮为针对上述问题的定向复核，没有重开全量审查。结论：四项P1解决、该范围未解决P0/P1为0。独立核对最终包33/33封存文件及26/26工作源码映射，重算Package Hash一致。独立方仅静态复核和阅读实施方测试，不能称为独立运行了127项测试。记录：evidence/offline-independent-review.json。

## 验证与边界

最终完整回归127/127通过，0失败；实际WPF材料与治理模态框、模拟接收/意见、草稿加密及跨进程重启恢复均运行。全部测试材料为虚构。新链路两小时耐久仍单独计时，以最终E5报告为准；首个629.89秒运行因P1修复需要中断，false/acceptance=false保留，不能计入两小时。

治理Host的blocked:false只表示模拟材料流程的结构化条件无阻断，明确engineeringAcceptance:false / validatedScope=SIMULATED_ARTIFACT_WORKFLOW_ONLY，不代表源代码测试通过。导入报告仍是用户提供的文本，不是执行证据。

## 数据与回滚

全局Schema2；UEC增量组件1..7保存来源/快照/包、尝试/回执、Ledger、治理及人工报告。旧30表逐项校验不变，原绑定身份及暂停不变。副本迁移、旧数据库恢复、旧代码及旧WPF启动均在隔离目录实际验证；主库/主配置未切换。

源文件入口：engineering/exchange.mjs、ledger.mjs、governance-host.mjs、manual-handover.mjs、desktop-api.mjs、context.mjs；src/workflow.mjs仅增加可覆写rateCount、Workbench复用共享计数与暂停检查；desktop/GovernancePanel.cs、MaterialRecovery.cs、DraftStore.cs及既有候选界面文件。相关测试见test/offline-exchange、governance-host、offline-api、workbench-native。

回滚按data/offline-completion-baseline.json指向的备份，在新目录恢复后验证；不覆盖运行中的旧exe、不强制关闭用户窗口、不递归删除历史、不修改原Agent/凪。新预览库保留供审计。

未做：真实材料投递/附件测试、真实Adapter可靠性、真实项目来源授权、主库推广、公网/手机/任意Shell或工程文件自动写入、OS级防篡改和全部自然语言语义识别。这些不是本轮模拟验收可以证明的能力。
# 阶段 E1/E2：模拟材料交换与证据账本

负责人 Codex；范围为虚构项目和模拟接收者。真实 Runtime、会话、附件及暂停未操作。

已实现：持久化材料尝试、明确收件人、不同模拟 Session、读取完整封存副本、逐字节回执、UNKNOWN不重发及既有副本核对；草稿/身份/离线故障停止在写入之前。模拟回执永远带 simulation=true / realAgentReceived=false。

Evidence Ledger 保存原意见正文、明确判断、包/版本/快照、文件和行范围、Diff/文档/报告来源。Agent陈述与用户决定分开；导入测试报告不冒充实际执行。新版本不会继承旧意见或批准。日志和意见不可覆盖。

新增 engineering/exchange.mjs、ledger.mjs；扩展desktop-api与服务端。HTTP材料提交采用独立已提交状态事务，不能让外层整体回滚掩盖已经产生的文件副本。

实际测试：test/offline-exchange.test.mjs 5项通过；另与旧API测试合跑7项通过。未开展真实Adapter验证。尚无独立复核；此阶段不是正式主库推广。

数据迁移：全局Schema2不变，UEC增量组件2/3，队列/回执/Ledger采用外键归属及不可变历史。回滚：主库未改；停隔离服务，按 data/offline-completion-baseline.json 的代码/数据库一致备份恢复到新文件，保留新记录作审计。不要把私密恢复备份发送给Agent。
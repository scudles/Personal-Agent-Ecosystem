# 数据迁移与回滚设计

1. 原 data/bridge.sqlite、data/workflow.sqlite、配置、证据完整备份；停止旧服务后复制。
2. 在 test-output 副本上迁移到新的 workbench.sqlite；原库不做结构修改。
3. 原 records/audit 与第一阶段 items/events 逐字保存进只读 legacy archive；记录原 kind/id 与 SHA-256。
4. 映射到首个 Nagi 项目/冻结的原型历史 Workspace；固定原会话保留唯一绑定，真实投递硬禁用，暂停不变。
5. 可操作的虚构项目使用新作用域；所有业务 records 必须有 entity_scope，消息/参与者/绑定具有复合外键，原生会话唯一绑定。
6. 快照版本不可变；旧证据哈希原样保留，不能把旧 body hash 冒充新 snapshot hash。
7. 校验：原始记录数量/逐条哈希、SQLite integrity_check/foreign_key_check、原记录ID和来源、旧 pause/unknown、完整备份哈希。
8. 回滚：原库从未修改；停止新服务后切回冻结的只读旧查看器。新库恢复先另存当前库，使用已校验副本；不删除历史、不自动启动原 Adapter。

工作台数据库的审议通过与用户实施授权分表/分状态记录，审批不会触发项目写入或命令执行。
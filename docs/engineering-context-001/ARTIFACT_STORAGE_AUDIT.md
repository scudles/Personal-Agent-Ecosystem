# Artifact Storage Audit

范围：D:\TriReviewBridge现有存储。仅审计，不创建材料包或迁移数据库。

## 已有存储

| 对象/位置 | 实际能力 | 不能代表什么 |
| --- | --- | --- |
| SQLite snapshots | 不可变审批对象、revision、canonical payload和SHA | 不代表工程目录快照或真实附件文件 |
| messages/source_json、deliveries/records | 定向消息、来源、投递与回执状态 | 没有逐文件接收证明 |
| review_opinions/cross_disclosures | 保留原始首轮/交叉意见与披露版本 | 缺少源码文件行号和Git快照实体 |
| knowledge_cards/versions/shares | 项目内版本化文字、授权和撤销 | 不托管源文件、二进制附件或整个仓库 |
| evidence/ | 旧协议证据、原会话来源、测试日志、WPF自检等 | 不应无筛选共享；可能包含原Session/环境信息 |
| backups/ | 数据库、配置、代码及历史证据恢复 | 配置含访问令牌；绝不作为Agent材料包 |
| exports/preview-*/manifest.json | 离线UI渲染清单，kind=OFFLINE_RENDER_NOT_DESKTOP_SCREENSHOT | 不是工程Snapshot；render-profile含浏览器缓存/数据库，不分发 |
| test-output/ | 隔离模拟库、原生自检产物、故障材料 | 测试产物与代码版本并非全部已建立结构关联 |
| runtime/ | Node、原生二进制与依赖 | 不作为默认源代码材料；需要独立构建来源信息 |

本轮直接读取了离线preview manifest的用途字段，未读取render-profile的Cookie、登录数据库或任何凭证内容。extension/与phase2/未发现可复用的附件上传源码。

## 已有附件具体行为

Workbench.put只检查attachment.name是字符串、sha256格式为64位十六进制。prepareSnapshot将这些声明放入审批快照。它**没有读取文件或校验字节**。

WPF附件输入框为“名称 | 完整SHA-256”，明确不读取原项目文件。新HTTP接口仅接收JSON；没有上传内容、文件ID下载授权或包目录生成。

所以当前UI输入正确格式hash，即使实际文件不存在，也可能形成有效的“声明附件”快照。现有保护证明声明未变，不能证明文件存在、上传或被Agent读取。UEC需要新增真实文件对象，保留旧声明引用兼容显示。

## 最小存储方案（提案，未实施）

- artifacts/staging/<job_id>/：只由Builder写入，不对Agent开放。
- artifacts/objects/<sha256>/：封存原始文件字节；不可原位更新。
- artifacts/packages/<package_id>/<version>/：manifest、一次生成的zip、可阅读交付视图。
- artifacts/exports/<delivery_id>/：只从已封存对象导出，供人工附件选择；源目录之后变化不影响导出。
- SQLite保存项目/任务/来源/快照/包/文件/授权/接收证明与证据关联。

内容去重不改变项目授权：下载只能通过已授权的project/package/file ID解析，不能凭任意hash或绝对路径读取。跨项目不存在性信息也不应泄漏。同一Windows用户下的原生Runtime拥有何种额外文件权限，不是Bridge文件API能整体保证的OS隔离。

## 排除与敏感处理

默认排除.git、node_modules、构建/临时目录、日志、数据库及WAL/SHM、data、backups、exports/render-profile、非选定evidence、test-output、.env、密钥、.aws/.codex/.agents及用户private规则。使用正向选取+默认拒绝，不能整目录zip。

明确选定的测试证据也须单独审查来源和敏感性；不得自动把整份evidence目录加入包。发现候选内容疑似凭证时停止本次生成，日志只记录文件ID/规则/位置，不回显秘密。

禁止静默脱敏后仍声称是原字节。若未来用户明确要求脱敏导出，应作为独立派生DOCUMENT，保留新hash和原快照关系，不冒充REPOSITORY原件。

## 不可变性与恢复

“不可变”首先由应用协议、唯一键/不可变触发器和读取时重新hash保证；同一管理员手工改动磁盘仍可能发生，因此每次导出/下载都重新验证，损坏则隔离而非继续送达。哈希证明完整性，不证明材料真实或模型已经阅读。

SQLite和文件系统不能假装是一个原子事务。先写staging并完成校验，封存后再发布可见状态；崩溃留下未发布目录只做隔离/审计。无自动垃圾清理/不可逆删除；恢复时DB与文件manifest逐项核对。
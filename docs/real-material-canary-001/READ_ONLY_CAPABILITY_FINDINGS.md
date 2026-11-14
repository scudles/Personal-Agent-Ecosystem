# 安全只读收件能力调查

日期：2026-11-12。Task：TRB-REAL-MATERIAL-CANARY-001；负责人：Codex /root。本次只读安装源码 / 安装包自带接口说明，写入本文件；未调用真实SDK、RPC、App、UI、原日志或私有配置，未重试被拒绝的截图 / 工具链审计，未新建Session、替换API会话、开启权限或修改Runtime。没有改动冻结源码、构建、测试、soak依赖或材料包，一小时耐久与本调查分开。

**结论：Hermes有内部无子进程SHA-256实现，但未找到已向模型公开的现成只读文件hash入口；DSH安装包有通用文件原字节保存 / 校验能力，但没有证据证明当前原“主进度”会话有可由Bridge安全附着、且不读取私密历史 / 草稿的外部材料只读入口。** 源码存在、接口有文档和原会话已验证可用是三个不同事实。

## 当前可证事实

| 调查项 | 安装源码 / 接口说明中的实际事实 | 当前不能推出的结论 |
|---|---|---|
| Hermes内部文件SHA | `tools/file_operations_native.py:93` 的 `sha256_of(path)`只读打开普通文件、分块调用`hashlib.sha256`，失败返回None；该函数本身没有spawn命令 | 原Session已经注册并可调用此函数，或模型已经得到实算hash |
| Hermes读取内部状态 | `file_operations.py::_read_file_native`整文件扫描时维护digest并放入私有`_snapshot`；`read_file_raw`计算私有`_content_sha256` | 普通read_file回复包含这些digest，或原文字读取能恢复原始字节 |
| Hermes公开文件工具 | `file_operations_common.py::ReadResult.to_dict()`过滤所有下划线开头字段；`file_tools.py::read_file_tool`经此方法输出。`READ_FILE_SCHEMA`参数只有path / offset / limit；已查内置文件工具注册没有独立hash / checksum工具 | 运行时没有任何其他自定义工具；本次没有读取私有工具配置或调用capability RPC来作这种全称判断 |
| Hermes平台适用性 | `file_operations.py:912` 的 `_native_read_enabled()`要求非win32且host filesystem；Windows保留shell路径，关闭native或出现部分错误也可能回退shell。`sha256_of`现有调用之一在写后验证，不能为读hash去写文件 | 本机read_file一定不执行命令；不能通过换一个读调用、设环境变量或写后校验来满足此次“无命令 / 无写入”约束 |
| DSH通用文件附件 | 安装ASAR中 `@deepseek-ai/dsh-attachment`说明非图像文件逐字节保存，记录名称 / 大小 / 内容摘要；`saveFile / saveFileStream`负责入库，`readFileStream`负责验证读取，`fileHostPath`返回存储位置 | 已把本次包送入原Session，或Bridge可以无草稿影响地自动上传 |
| DSH实际验证代码 | `@deepseek-ai/dsh-attachment-local/lib/index.js::readFileStreamVerbatim`逐块计算SHA-256和字节数；消费到EOF后比较`ref.bytes`和完整digest，不符抛`ATTACHMENT_CORRUPT`。中途取消 / 只读一部分不等于完成校验 | 接收端已经实际调用该服务并读到EOF；内部实现不是本次真实回执 |
| DSH模型看到的东西 | 安装说明写明通用文件通过只读路径句柄按需阅读，而不是把全部bytes直接发给模型。`lib/main.js::fileHandleText`显示名称、字节数和digest短前缀；`fileReadPath`依赖附件服务及filesystem映射，没有映射时明确说不可读 | 看见文件卡片 / digest短前缀就等于模型读完文件，或短前缀可充当完整SHA-256 |
| DSH UI附件 | `dsh-client-ui-attachment/README.md`说明混合草稿附件栏、上传进度 / 失败 / 移除状态；该包只呈现状态，不拥有Session授权或发送 | 可以跳过旧草稿保护、操作当前editor，或以内部UI接口代替已被拒绝的界面读取 |

Hermes上述结果与已保存真实canary“内容 / size声明、hash未重算”的窄结论相容，不把静态代码发现追认为那次已经算过hash。此次未查看那次调用的私密工具链，也不由Windows分支推断那次具体使用了什么后端或是否发生命令调用；这些运行时事实保持未独立审计。

### DSH已安装SDK为何不能直接拿来替代

只读解析了安装目录 `C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness\resources\app.asar` 的目录及选定源码 / README，**未import或执行安装包代码**，未访问DSH_HOME。安装包`package.json`声明桌面版本`0.2.1-rc.3`；它只是安装文件声明，不是原Session当前运行配置证明。

包内`dsh-sdk-protocol`文档列有initialize、session/prompt、session/resume、session/wait及working-directory/get/set。但`dsh-sdk-jsonrpc-server`说明：

- `session/resume`经`agents.resume()`加载历史、可能修复中断回合，并应用初始化时的model route；即使不发新输入，也不能称“不读历史、不影响Runtime”的纯材料查询。
- working-directory/get/set对未知ID可能创建Session；本次绝不以“get”看似只读而尝试。
- SDK服务由composition挂载并以stdio服务SDK拥有的Agent。另启CLI / profile / server不是已附着当前原App的证明，可能建立新的运行实例或Session，本次禁止。
- 文档描述SDK事件通知覆盖runtime中的Session事件，并非已验证的“仅返回本包元数据”的外部接口。

因此，安装SDK / ACP模块存在不是可安全调用原“主进度”接口的证据。此次没有探测端口、IPC、进程、配置、日志、草稿、现有Session对象或工具清单，也没有调用上述方法。DSH附件服务是内部进程能力；其文件入库本身会在DSH_HOME写入新的附件对象，不能把这一步说成纯只读RPC。

## 推测与尚未验证

1. DSH若由用户通过既有附件UI交付5个原文件，当前composition可能已有按字节保存及只读映射链路；安装说明支持这一候选，但原会话是否挂载相应服务、文件路径能否映射、读取工具能否访问、是否完整消费校验流，均未实测。
2. Hermes内部SHA函数可作为将来独立设计的实现素材；要让原模型或外部可信调用方获取限定包的实算结果，可能需要新增明确的只读工具 / 返回字段 / 适配层。这是未来改造，不是目前已存在并授权启用的入口。
3. 已安装但未加载的模块、自定义MCP或其他能力可能改变可用性；本任务不读私有配置、不取原历史 / 运行时清单，因此不猜测其存在或启用状态。

这里的“未验证”不是“不可能”，也不是可以自行试一条RPC的授权。DSH本草稿处理授权已生效，**无需再次授权该草稿**；当前editor未安全识别和整窗截图拒绝的事实仍按 [DELIVERY_STATUS.md](DELIVERY_STATUS.md) 保留，不能借本次源码调查绕过它们。

## 最小候选

| 可保留的路线 | 现在能做的工作 | 当前证据上限 / 限制 |
|---|---|---|
| DSH / ChatGPT人工附件B | 使用 [MANUAL_HANDOVER.md](MANUAL_HANDOVER.md) 中同一包的5原文件与限定请求，由用户本人在原会话安全交付 | 若没有可审计接收端实算hash，记录附件 / 内容覆盖或接收者声明；不BYTE_VERIFIED |
| Hermes维持现有结果 | 复用已完成的一次原SDK请求及原回执，不重发、不再取私密工具链 | 内容和size声明、hash未重算；本地包hash不能填成接收端hash |
| 未来限定包hash能力独立Task | 如用户以后决定改变当前范围，先设计仅允许本次精确包文件、无子进程、无写入、无历史访问、完整返回实算size / digest与来源的方法，再实施 / 复核 | 当前不开发、不加载、不配置；不能用内部函数存在宣称旧Runtime无需变更即可提供该能力 |

不采用的捷径：让Agent运行Python / Shell哈希；调用写工具只为取得verified；打开或替换Runtime / 模型 / profile；用SDK重建或恢复原会话；直接读取附件存储 / Session日志来找ref；以被拒绝的截图或工具链审计换通道继续。把Bridge自己对导出目录算的hash叫“接收端校验”也不成立。

## 需用户拍板的事项

当前可以并行的是不触碰原Runtime的源码能力调查、材料 / 人工交付准备，以及已经运行的离线一小时耐久；它们互相不提供未取得的真实字节证据。

真正的产品决定是：是否接受本轮先以内容确认 / 明确未完成hash的等级推进人工canary，还是把“接收端BYTE_VERIFIED”设为后续独立目标。若选择后者，需要另开限定只读校验能力的改造 / 验证Task，明确是否允许改变现有工具接口及如何取得可信接收端证据；当前禁止Runtime改动和新增权限的约束不因本报告自动改变。不是再索要已给出的DSH草稿授权，也不把尚无接口的问题转嫁为反复批准。

## 可复核源码定位

Hermes均位于 `D:\HermesAgent\Source`，本次只读：

| 文件 | SHA-256 |
|---|---|
| tools/file_operations_native.py | `4b216f7c2333c4802728c69832f30767e79f9e62080e2c654f9e4f5c29a724b4` |
| tools/file_operations.py | `d33e0bc43516f9c5da4dd1ab75bd57b03837034c5c4accb91df1d78b92131b51` |
| tools/file_operations_common.py | `b089d593419eb34712087eb6d70bfd23500718214c8693139376337f1dde84b0` |
| tools/file_tools.py | `925ebccc2a70b5a1b55541242cb19ed6614a18e82df1d6bc29474dc22c4f0dee` |

DSH下表为上述ASAR内部条目，hash来自只读解析条目bytes，不是运行API结果。路径前缀均为 `dsh/node_modules/@deepseek-ai/`：

| 条目 | SHA-256 |
|---|---|
| dsh-attachment-local/README.md | `5009b882cd031e902a6696b6a243141bd174980bc4b4c20f4f11ae0d8fcd7e9a` |
| dsh-attachment-local/lib/index.js | `cd39685581b4573a453c6126f8ce73da0bf1257c378827ebb431d6d4064f7662` |
| dsh-attachment/README.md | `4b74d0d42843bc7aac5aa9115631fccda726fb7f53fd268244031e7173edd8de` |
| dsh-client-ui-attachment/README.md | `ba2c59aeb8a9b4dbff922c75406a1309ecdeb9fd025f61e5e1ef96e1bb6ea940` |
| dsh-sdk-jsonrpc-server/README.md | `e7eb9116ffee99b6708aff08ca9a64b39f8d9ccfae23c362a6a01c6e175883f2` |
| dsh-sdk-protocol/README.md | `688f3472904a1f98db2eaf96a5c3a29ef08a8193e45476b26b61c169af627ca0` |

另核对ASAR的`lib/main.js`：`f05dd366f6c468bedd83f07372bc59d3d6b3f6bcc6950565c8b4173597e3ba93`，只用于定位fileHandleText / fileReadPath，不从中运行任何入口。没有复制安装源码到包或其他Agent上下文，也没有导出原会话 / 私密工具消息。

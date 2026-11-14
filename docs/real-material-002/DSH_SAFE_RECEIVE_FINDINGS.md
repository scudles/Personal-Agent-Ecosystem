# DSH安全收件：只读源码调查与分批清单

日期：2026-11-12。Task：TRB-REAL-MATERIAL-002；唯一负责人：/root。本文件是接入准备，不是执行许可、真实收件回执或可用性验收。本次只读工程源码与DSH安装包内选定源码/自带说明，未调用SDK、RPC、App、UI、原会话、私密日志或私有配置；未运行DesktopSession，未import/执行安装包代码。仅新增本文件，冻结74项与原材料包均不修改。

**结论：旧桌面适配器可提供编辑框唯一性、草稿存在、前台与忙碌检查的实现参考，但没有已验证的“当前窗口—原Session—composer—附件”稳定绑定，也没有已证实可安全附着原DSH会话、排除私密历史/草稿读取的外部只读材料接收接口。当前真实路径未就绪，六向测试先不发。** 安装源码有能力、适配器有检查、真实原会话安全可用需分别证明。

## 调查来源与证据边界

- 本轮核对：[native/DesktopSession.cs](../../native/DesktopSession.cs)，SHA-256 `d9303678c88e232b831328100497ea3a9f1e1e5d6f72e8f8eb3d4b194c6295e6`；[src/transports.mjs](../../src/transports.mjs)仅作调用路径核对，不执行。
- DSH安装包：`C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness\resources\app.asar`。本轮直接只读解析包目录和选定条目bytes；包内`package.json`声明`@deepseek-ai/dsh-desktop`版本`0.2.1-rc.3`，不是当前运行进程/会话配置证明。
- 既有调查见[READ_ONLY_CAPABILITY_FINDINGS.md](../real-material-canary-001/READ_ONLY_CAPABILITY_FINDINGS.md)。该旧文档是当时快照；本报告不把其中Hermes旧hash状态当最新状态。
- 下述先前界面现象由负责人提供，本轮没有重开画面、补读树、追取日志或复查原会话。标题与画面不符、点击后输入检测的原因均未被本轮验证。

## 三项现象的合法安全处理

| 现象与已知事实 | 能推出什么 | 可采用的安全处理与停止点 |
|---|---|---|
| @sky曾返回窗口标题`主进度 — DeepSeek Harness`；期望Session简称`主进度`。负责人另报告标题与画面不一致 | 完整窗口标题与简称不应混写。标题匹配不能独自证明画面、当前选中Session及输入框都对应原绑定；不一致的原因未知 | 保留完整observedWindowTitle与expectedSessionTitle，停止输入/附件/提交。在同一获准通道可正常使用时，先取得新鲜、最小范围的窗口身份与当前选中对象证据；两者一致才继续。无法取得则人工核对或保持未就绪，不使用native/RPC/另一个截图工具绕过拒绝 |
| 原UIA原文为`15 组 ID: root (truncated: child_limit, omitted 594 children)` | **省略594个子节点**，不是返回594，也不能证明editor不存在或唯一 | 如既有获准接口支持，候选是对已验证窗口内composer做有界精确查询，只取控件类型/名称/AutomationId/唯一数量等最少元数据；该接口支持性本轮未验证。不得自行虚构查询方法、提高全树范围或换native枚举来突破已拒绝的读取边界。仍不能唯一识别时停止，保留草稿 |
| 模拟点击后检测到user-input；另有先前实体Esc停止及后续工具拒绝 | 时间相邻不是“必然由自己的点击引起”的证明；本轮未审计@sky输入保护内部实现，不能断言它误判。旧Esc状态是否已清除未知 | 尊重保护立即停，交还用户控制，保存已有状态记录。后续只有用户真正交还控制、原通道自身报告允许且刷新身份后才能继续；不改保护阈值/时钟、不模拟空闲、不屏蔽输入、不换工具继续。等待8秒本身不解除保护，也不授权重试被拒绝动作 |

用户此前已明确授权处理该私密草稿，无需再次批准同一草稿。技术事实仍是editor未安全识别，未取得安全备份；既有记录`draftBackedUp=false / draftModified=false / draftSent=false`不能改成成功。先前整窗截图因包含无关凪/私密工程内容被自动审查拒绝，不重试或换通道。用户后来开启截图控制并设为始终允许，但最后工具仍以旧Esc状态拒绝；**不能由此写成“用户当前仍关闭控制”或“已成功解除”**。本轮没有桌面动作，也不把这些历史现象当当前桌面观测。

## 旧桌面适配器可复用到什么程度

以下是源码行为，不是建议现在运行旧exe。

| 检查/入口 | 实际实现 | 复用价值与缺口 |
|---|---|---|
| 进程与窗口，151—156行 | 要求名为`DeepSeek Harness`且有MainWindowHandle的进程恰好一个，核对固定安装exe路径，再从该handle建立UIA Root | 优于只凭标题点击；没有固定预期PID校验、PID输出、签名校验或不可变Session ID绑定。Inspect只输出数值window handle；单一进程也不能证明选中的会话 |
| ActualTitle，47—55行 | 优先找名为`会话层级`的唯一节点及唯一Text；否则从Root窗口名去掉` — DeepSeek Harness` | 有明确失败/降级路径，但标题可重复、可变，fallback不能替代Session身份。窗口名匹配不修复画面不符 |
| Editor，57—60行 | 在Root所有后代中找可用、非offscreen的Edit；DSH名称精确为`发消息或创建任务, / 调用指令, @ 文件或对话`，要求恰好一个 | 名称+类型+唯一性可作候选选择合同；未使用稳定AutomationId，也未绑定到具体Session composer；版本/语言变化会失配。不能把本机旧名称视为当前控件校准成功 |
| Value/Draft，38—44、62行 | ValuePattern优先，回退TextPattern；Trim后的非空、非placeholder视为草稿 | 可作只读“是否有草稿”的保守检查。读取值并不等于已经可靠备份；文本hash/长度不是可恢复备份，也不覆盖附件、富文本或未保存状态 |
| Inspect，64—70行 | 枚举所有可用Edit，对每个读取Value以算长度/hash；还读取Document名等 | 它并非composer限定探针，可能触及其他私密输入内容。不能因输出只含hash而说没有读取草稿，更不能拿它绕过树截断/截图拒绝 |
| Select/Read/peek，84—129行 | Select可恢复/前置窗口并选择唯一标题候选；Read默认调用Select；peek不选择但仍读取可见对话文本 | `read`并非无界面状态变化；`peek`也不是本包专用查询。当前任务不得调用，两者都不能替代被拒绝的界面或私密历史读取 |
| Send，132—143行 | 默认交互桌面、至少8秒idle、标题/非busy、无草稿、前台与focus复核；SetValue后核对精确文本，Enter仅一次 | 这些是保护参考，当前不执行。SetValue已经是变更，后续失败不代表未写入；无需重发的UNKNOWN处理仍必要。此入口没有附件上传/收件实现 |
| Click/Idle/mutex，35、73—101、147行 | Click优先Invoke/SelectionItem，失败才坐标SendInput；Idle使用GetLastInputInfo；本地mutex只协调本适配器 | 不全是盲点坐标，但不存在已实现的“自己的模拟输入”来源分离；KEYBOARD/MOUSE.extra未设置独特标签。mutex不锁住人类/其他工具，idle检查不是@sky人类输入保护的替代物 |
| transport身份，22—30行 | DSH inspect还调用observe读取日志信息，返回的sessionId直接取`PINNED[role].id` | 该ID是期望绑定元数据，不是从当前UI独立观测的Session ID；不能证明当前editor属于该ID。日志不能为绕过私密读取授权而补读，本轮未调用observe |

源码中没有材料附件选择、上传、附件列表校验或接收端bytes证明入口。因此即使未来合规完成窗口与草稿校准，也不能宣称旧驱动已支持原字节材料接收。ChatGPT桌面UI自动化的既有限制保持，不借本次DSH调查扩展其范围。

## 安装包中可证的材料能力与不可做的替代

包内自带文档和源码属于安装发布物的一手材料，不是本次真实运行证据：

| 内部路径（前缀`dsh/node_modules/@deepseek-ai/`） | 本轮核对内容 | 当前证据上限 |
|---|---|---|
| `dsh-attachment/README.md:40,71,75,105,120` | 通用文件按原bytes存储，saveFile/stream入库，readFileStream验证读取，fileHostPath映射只读路径；模型获得名称、size、digest短前缀及路径句柄；说明未提交草稿留在浏览器 | 不说明原会话已挂载服务、已收到本包、模型读完全部bytes或已有草稿可安全重启；短前缀不是完整hash |
| `dsh-attachment-local/lib/index.js:719`起及其README第90行 | readFileStreamVerbatim使用createReadStream、SHA-256和字节计数；完整消费后比较声明size与digest，不符失败 | 是内部完整读取校验能力；部分读取/取消不等于成功。本轮未访问DSH_HOME或任何附件对象 |
| `dsh-client-ui-attachment/README.md:12,28,52` | UI有混合草稿附件栏及状态呈现，组件不拥有Session状态/读取授权 | 附件UI存在不等于外部Bridge有安全调用入口；不直接注入renderer或调用私有IPC |
| `dsh-sdk-jsonrpc-server/README.md:28,30,32,52,54` | resume加载历史、可能修复中断回合并应用初始化model route；working-directory/get可创建未知Session；stdio服务需挂载composition；wait只认既有SDK-owned Session | 不把resume/get称纯只读，不新启SDK/CLI/profile/runtime去“附着”原窗口。wait存在也不能证明原桌面Session归该SDK实例所有 |
| `dsh-sdk-protocol/README.md:41—60` | 有prompt/resume/wait等协议；prompt回执messageId只证明入队，不是模型完成 | 没有由本轮证实的“排除私密历史/草稿、仅接收本包、附着当前原Session”的外部只读接口；不探测RPC/端口来试出来 |

如新窗口接入必须改变原配置、模型、Session、composition或Runtime，**当前任务不可做**；不创建替代Session冒充原“主进度”，不重置/恢复/迁移原会话，不修改模型与工具权限。当前可保留候选是由用户在核对原会话与现有草稿后人工附加同一5原文件，并取得限定本包的回执；人工提交属于有状态发送，不能包装成只读探针。自动化候选须先另行解决可审计身份与最小范围控件读取，不能以“用户已授权草稿”消除技术不确定性。

## 六向最小分批执行清单（准备，尚未发送）

定义H=Hermes、D=DSH、C=ChatGPT；每个方向5次往返，六方向共30次往返。方向A→B的一次往返至少有A→B和B→A两腿，故至少60腿。每腿按共享30/h上限保守记账，不能把“一次往返”只算一次，不能抬额度或在同一滚动小时硬塞60腿。若需要额外启动请求、材料转交或澄清，实际发送会更多。

| 批次 | 方向与回到发起端的闭环 | 最少往返/腿数 | 启动条件 |
|---|---|---|---|
| A | H→D→H各5次；D→H→D各5次 | 10 / 20 | H、D两条原会话合法路径均就绪 |
| B | H→C→H各5次；C→H→C各5次 | 10 / 20 | H、C路径均就绪；C人工交付与自动互通分开记 |
| C | D→C→D各5次；C→D→C各5次 | 10 / 20 | D、C路径均就绪 |

顺序可按就绪情况调整，不能让未就绪接收端承担测试。每批20是最低发送量，名义留10腿给既有流量/意外开销，实际须先扣除同滚动小时其他发送与未决提交。60腿的数学最低是两个足额额度窗口；推荐三批各20腿并逐批等待滚动额度释放，不保证从开始起两小时一定完成，不按整点重置推断额度恢复。SDK/人工测试若不在现有数据库自动计数，必须纳入同一测试账本保守扣账，不能视作免额度。既有UNKNOWN已可能发送的腿仍占用保守预算，取消未提交不算发送。

每批执行检查：

1. 核对双方原绑定、授权、当前工具允许状态与可安全收件路径；没有真实路径则该批记NOT_READY并不发。不得为了凑六向而恢复旧队列、草稿、Runtime或创建Session。
2. 为每腿记录runId、方向、序号、nonce、packageId/version/manifest/hash、期望/实测接收身份、提交状态/时间和消息ID。共享额度账本记录所有额外指令、转交与可能提交，不以进程启动或入队作为收件成功。
3. 每个方向先做1次往返，计入既定5次；确认B端限定本包的回执与返回A端对应nonce都可观察，才做余下4次。不是先发5条再猜匹配，也不额外加“预热”超出预算。
4. 往返可达与材料字节校验分开：必须核对5原文件、版本、manifest/count/size/hash及实际读取证据级别；Agent自报匹配、人工抄hash、本地Bridge验证都不自动升级为Bridge独立接收端BYTE_VERIFIED。派生readable bundle与未验证ZIP不能取代5原文件。
5. 若人工搬运回复，明确MANUAL_RELAY；若实际直接通道完成才记该通道完成，不把人工闭环宣称自主Agent互通。任何画面/标题不符、composer歧义、草稿未安全备份、人类输入保护、UNKNOWN均停止该腿；不清草稿、不重发，以迟到回执/人工核对处理不确定性。
6. 一批结束记录成功/失败/不确定、真实发送腿数、额度余量与未完成方向；下一批重新核对滚动窗口。仅取得限定本次材料/nonce的回执，不为验证而读私密历史或追查已拒绝的工具链。

本清单不新增消息、额度、收件授权或工具能力；真实执行由负责人统一控制。本轮没有真实收发，也没有运行可用性/桌面测试，不将静态核对写成三项界面问题已解决。

## 本轮复核定位

下列SHA-256来自本轮只读解析ASAR内部bytes，不是运行接口输出：

| 条目 | SHA-256 |
|---|---|
| package.json | `ac5d5922a061519322befb742e8b8285197d6ca975a2a38e8049ef37c67e63d2` |
| dsh-attachment/README.md | `4b74d0d42843bc7aac5aa9115631fccda726fb7f53fd268244031e7173edd8de` |
| dsh-attachment-local/README.md | `5009b882cd031e902a6696b6a243141bd174980bc4b4c20f4f11ae0d8fcd7e9a` |
| dsh-attachment-local/lib/index.js | `cd39685581b4573a453c6126f8ce73da0bf1257c378827ebb431d6d4064f7662` |
| dsh-client-ui-attachment/README.md | `ba2c59aeb8a9b4dbff922c75406a1309ecdeb9fd025f61e5e1ef96e1bb6ea940` |
| dsh-sdk-jsonrpc-server/README.md | `e7eb9116ffee99b6708aff08ca9a64b39f8d9ccfae23c362a6a01c6e175883f2` |
| dsh-sdk-protocol/README.md | `688f3472904a1f98db2eaf96a5c3a29ef08a8193e45476b26b61c169af627ca0` |

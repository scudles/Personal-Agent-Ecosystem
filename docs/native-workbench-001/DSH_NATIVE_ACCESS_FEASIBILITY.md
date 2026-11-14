# DSH 原会话原生接入可行性：有实质接口，认证发现仍未打通

2026-11-13。仅静态读取已安装公开应用包manifest/README/源代码，以及D盘工程已有研究；未导入SDK、未访问原Session/私密日志/配置/凭证、未读取监听端口或进程内存、未操作原App、未读凪。当前hour冻结src/tools未修改。下列是安装代码证据，不是当前Host真实调用验证。

## 确定发现

安装包：`C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar`。公开manifest标明 `@deepseek-ai/dsh-desktop` 与 `dsh-api-gateway` 版本均为 **0.2.1-rc.3**；Gateway manifest声明源码仓库为 `https://github.com/deepseek-ai/deepseek-harness.git`、目录packages/api/gateway。本轮未联网核对主分支，不把主分支当安装版本。

公开SDK并非只有ACP。`dsh-api-gateway/client`提供ClientRemote；Host业务来自包内 `dsh/node_modules/@deepseek-ai/dsh-api-session-controller`：

- `lib/index.js:210` resolveAgent先找同Host的liveAgent，找到即原对象返回；找不到会恢复指定已有Session，not-found/writer-held等失败不会用session.create兜底。
- 生成描述符的 **session/prompt**（原源码packages/api/session-controller/src/index.ts:462）要求request{requestId,sessionId,mode:queue|steer,content}，返回accepted:true；实现925行按requestId查重。它不是完成回执。
- **session/page**（原源码525行）和 **session/follow**（537行）按address{kind:session,sessionId}读取/跟随事件；page需follow给出的throughSeq切点，可限制maxMessages。requestId进入durable user source.rpcId，能将自己的输入和完成回合绑定，不必解压整份原日志。
- README:34说明每个endpoint有独立激活策略：历史页/follow可不激活Agent，prompt可能解析或恢复普通Session。冷恢复的preset/模型/上下文保留仍须另做真实核验，不能只看live fast-path就承诺所有场景设置不变。

因此，**存在可替代前台模拟输入的官方原Host RPC路线**；尚未完成原Host认证连接，当前不能写成DSH已接通。严禁用session.create（可能新建并选preset）或ACP新进程替代。

## 认证与发现：最后一道实际门

`dsh-client-connection/README.zh.md:41,51`的官方外部API流程：现进程随机launch token → GET /connect?token=...&interactions=none → 302/Mux地址/签名API Cookie → 建立一条生命周期WebSocket。HTTP不接受Authorization header token。关闭自有WebSocket释放自己的Peer后，该Cookie后续HTTP被拒；不能忽略这一步而留下Peer到Host退出。

其 `lib/index.js:295-299` 的processLaunchToken在WeakMap按processOwner缓存randomBytes(32)；与磁盘Cookie签名secret是独立值。所核对公开导出/实现中没有可用的 `deriveClientConnectionToken(rootKey,peerId)` 合同，不能依据函数名或磁盘根key自行造连接令牌。`$DSH_HOME/.credentials.yaml` 的 `client-connection/browser-session` 是签名根key，不是现Host启动token；本轮没有读取，**不建议读它自行签cookie绕过已证实官方流程**。

scope限制：/connect创建owner Peer，interactions=none只禁回答交互请求，不把权力收窄到一个Session；owner在Gateway绕过remoteAccess资源判定。未找到外部/token参数中的单Session scope或短TTL支持；只能在Bridge适配器端固定Session/端点，并严格关闭自己的Peer，不能冒称服务端最小权限凭证。

Desktop Host `lib/index.js:342-350`只把authenticatedUrl经IPC ready发送给父Electron；main.js:3824/12191把URL和Cookie留在闭包，经自有scheme代理界面。未找到固定磁盘discovery文件或公开的“复制Host连接/在浏览器打开Host”UI；dsh://open仅聚焦应用。welcome copy-link与更新下载链接不是Host连接，不能冒用。只读单一已知Host进程的监听元数据至多找到origin，仍无法得到合法launch token/API Cookie。

目前缺的具体输入是**用户/原App通过受支持方式提供的现Host launch URL或已认证API Peer载体**。不是再读工程代码能补齐的字段。本轮没有因此读取凭证、浏览器Cookie数据库、内存或扫描端口，也没有启动dsh web/acp或改Runtime。若不能合法取得此载体，应保留阻塞，不能虚构自动登录能力。

## 已实现的隔离候选

新 `tools/dsh-native-access-candidate-001/adapter.mjs` 固定原Session `session-ebd654d5-1bf8-419c-bc2a-d9be1ed023fc`，默认原生/有界私密页读取均锁定；只接受显式既有loopback origin与官方既有Peer Cookie，不发现或签发凭证、不建Runtime。仅允许session/prompt与session/page，按公开client-request/server-response RPC envelope核对rpcId；发送必须有确切DISPATCHING许可和正文SHA，UNKNOWN不自动重发。

回收必须有显式throughSeq与最多10条消息窗口，最多1MiB响应；仅导自己requestId+全文所对应的原生UUID、完成turn和最后回复。缺起止、重复、插入用户、未知序号、tool活动或不完整时UNKNOWN，不把有界页当完整工具轨迹。物理读取可能包含窗口内邻近私密消息，只过滤输出不等于没读取；真实试投前须核对这项范围。此候选没有follow/Mux实现、没有接入Hybrid DS H收件协议，不能当作已交付日常Adapter。

fake fetch契约 **10/10、exit0**（FAKE_TEST_RESULTS.txt）。真实网络/API/原会话读取0；未新增原生操作或重复测试现有模块。仍需合法认证载体、必要复核、一次真实原Session prompt→page/follow验证，才能判断能否完全消除前台依赖。

主要安装源码SHA256：session-controller/lib/index.js `a9801acb577b03053c5d5a3191ff555c5f1d791d0acddec113bea4511e33b386`；生成Remote描述符 `f8760911d70173fc2e845b74747bda43f9d9e1d09789d78a00522decf853bb5b`；client-connection/lib/index.js `0ebcca7583e082716f79b0b55bc1749d48269cc8db2989b043b321b57abd3684`。这些摘要针对公开包内容，不证明运行进程加载的确是同一字节。
## CLI 静态补查（2026-11-13，安装版 0.2.1-rc.3）

**结论：本次核对的官方安装包未发现“连接当前 Desktop Host，并指定现有 live Session”的 CLI attach/connect 合同；能否用官方 CLI 保留当前原 Runtime 仍未知/阻塞，不能把启动或 resume 另一个 profile 当作已接通。**

- 公开命令入口是包内 `dsh/node_modules/@deepseek-ai/dsh/package.json` 的 `bin.dsh=lib/bin.js`。`dsh/lib/bin.js:101-136` 的顶层合同为 `dsh [--profile] <name> [options] [app-args...]`、`dsh plugin --profile <name> <pnpm-args...>` 及配置 dump；没有 attach/connect 子命令。第129行会把普通首词展开为 `--profile <首词>`，所以不能虚构 `dsh attach` / `dsh connect` 是现 Host 连接命令。第35-36、112行明确拒绝启动保留的 `desktop` profile；Desktop 自带 CLI 在 `dsh-desktop-host/lib/cli.js:94-107` 只是调用同一 `runCli({manageDesktopProfile:true,...})`，该例外仅在 `bin.js:119` 放行保留 profile 的插件管理，不增加现 Host 附接。
- `dsh --profile tui --resume <id>` 只是终端应用参数示例（`dsh/README.zh.md:24-30`）；`dsh --profile acp`、`sdk`、`sdk-minimal`、`headless`、`web` 的用途见同文11-20行。其 launcher 在 `bin.js:212-222` 走 `runProfile`，`dsh/lib/profile-boot-C14i-8IN.js:272,289-313` 组合并 boot 所选 profile 的运行树。这些命令不构成复用当前 Electron 原 Host/live Agent 的合同；未发现可给该 CLI 的既有 Desktop Host URL、API Peer 或指定 live Session attach 参数。
- 合法外部认证仍是已有 Host 的启动 URL/token → `GET /connect?token=...&interactions=none` → 自有 API Peer Cookie/生命周期 WebSocket（`dsh-client-connection/README.zh.md:41,51`）。本次未发现 CLI 自动发现当前 Desktop 合法 launch token/已认证 Peer 的公开入口，故此前认证发现阻塞不变。没有读取会话、配置、凭证或端口，也没有运行 DSH CLI/Runtime。

以上路径均相对同一 `resources/app.asar` 内公开包，非运行态证据。新增核对摘要：`@deepseek-ai/dsh/lib/bin.js` SHA256 `80112efe368efb1a39720c7ada0af00442e5131fb2744edaaff8a3e8bb499e6f`；`@deepseek-ai/dsh-desktop-host/lib/cli.js` SHA256 `ed8bd3ca840d67599bde74f940cdb1714f7b7a98cecd166705a42a661e5cd1b7`。

# WPF发送幂等与断线恢复候选

范围仅desktop/WorkbenchApp.cs、DraftStore.cs及本目录针对性fake验证。没有修改模式、Adapter、后端、launcher或原生会话；没有覆盖现有UX.Collab.exe。本候选待一次必要独立复核，尚未做真实WPF窗口体验或真实通道测试。

## 实际行为

- 主发送intent/chat/reply在HTTP前，按backend配置路径+project/workspace保存一个待核对请求：requestKey、exact path/payload、原草稿正文及reply引用。使用当前Windows用户DPAPI保护，短FileShare.None锁与原子文件替换；读写失败不生成替代键。
- 传输中断/响应不可解析保留PENDING及草稿。切回该会话主按钮显示“核对上次发送”；明确确认后使用旧key/path/payload恢复原API请求。已有后台缓存则取回；原API从未提交时只完成原逻辑请求的一次排队。不是要求重发Native UNKNOWN。
- 已收到2xx结果先持久为ACKNOWLEDGED，直到UI草稿状态保存后才消费；进程在这之间退出，重启仍可取回同结果。消费后用户下一次同文发送取得新key。
- 更改正文、接收者、引用、上下文或路径不能复用旧key。核对时只发送旧封存payload；当前完整payload不相等则编辑稿保留。跨Workspace独立；同Workspace存在未决请求时先核对，不悄悄创建第二条。
- 首次明确业务4xx拒绝记REJECTED；可显式查看本地拒绝结果、保留草稿并结束该客户端请求，之后允许修正。已不确定请求恢复后再遇4xx仍PENDING，不拿本次拒绝断言先前未提交。200 UNSUPPORTED仍是已收到的API结果，现有UX保留输入并完成客户端键消费。
- 未增加启动自动发送/后台重试。新发送前要求工作台草稿可持久保存。材料/审批/项目等其他POST与fallback不改；它们尚不包含本次主发送专用持久键。

HTTP请求确认与原生投递结果分开：API确认不证明Agent收件或完成，后台delivery UNKNOWN仍由现有状态显示且不自动重发。不存在新request-status接口依赖。

## 已跑验证

命令：`runtime/node.exe tools/client-pending-001/verify-client-pending.mjs`。

7/7通过、exit0。csc编译当前desktop/*.cs和独立harness Main至新的fake test-output目录；不实例化WPF。实际BridgeClient、ClientPendingStore和DraftFileStore连接loopback假Host，用不同子进程验证：提交后响应丢失重启同key/path/payload仅一个逻辑commit；ACK后崩溃本地恢复；确认后同文新key；Workspace隔离；编辑正文/收件人冲突不发HTTP且新草稿保留；首次拒绝可结束；不确定请求再遇403仍保留旧键。

最终证据：test-output/client-pending-001-fake-Vth5pW/result.json。初轮harness stdout默认GBK导致Node按UTF8读取虚构中文时失败，已仅将harness Console.OutputEncoding设UTF8后重跑；TEST_RESULTS_INITIAL.txt及其fake failure.json保留。未把初轮失败当产品通过，未跑全套或一小时。

测试覆盖实际客户端文件/HTTP恢复，不证明WPF视觉、控件交互或真实Adapter行为；交由独立只读复核核对UI接点，后续只使用新fake配置做原生窗口体验。

## 构建交接

现有build-desktop.ps1会编译所有desktop/*.cs，无需改csproj；新增store类放在DraftStore.cs内。根负责人先将当前runtime/native/TriReviewBridge.UX.Collab.exe复制到新归档目录并核对旧hash，再运行：

```powershell
powershell.exe -NoProfile -File scripts/build-desktop.ps1 -OutputName TriReviewBridge.UX.Collab.exe
```

该命令会替换标准输出位置，因此备份必须先完成；本任务没有执行它。针对性验证入口仍为上面的fake脚本，不使用主配置或真实队列。所有源码/日志/fixture hash以CANDIDATE.json冻结记录为准。

后续可选纯查询合同：认证主体+project/workspace+原requestKey查询api_idempotency缓存，只在匹配原请求时返回COMMITTED与缓存结果；缺失仍为UNKNOWN，不宣称未发送。当前代码不依赖此尚无接口，也不把API恢复叫只读查询。

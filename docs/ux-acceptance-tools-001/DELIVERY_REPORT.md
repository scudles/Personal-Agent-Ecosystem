# 离线体验与六向证据工具交付

Task：TRB-UX-ACCEPTANCE-TOOLS-001。负责人：Codex /root。当前为独立新增工具，不修改TRB-OFFLINE-COLLAB-002冻结的74项依赖。此前[检查点](CHECKPOINT.md)保留为用户Esc收口时的历史快照；用户明确恢复后完成下列实现。

## 原生proof静态检查器

[check-proof.mjs](../../tools/ux-acceptance/check-proof.mjs)读取显式指定的既有原生proof；实际已对当前`native-integration.json`运行，结果见[ux-proof-check.json](../../evidence/ux-acceptance-tools-001/ux-proof-check.json)。

本次45项检查全部通过，包括四个约定逻辑视口、Send可见/输入和正文区域记录、本机PNG及尺寸、UNKNOWN/暂停/普通赞同/原文相关断言、草稿/接收者隔离，以及当前源码与候选二进制hash对应。结论为`RECORDED_NATIVE_ASSERTIONS_CHECKED`，不是新运行一遍原生界面，也不是独立真人体验通过。

首次使用者、实际Windows125%/150%DPI、文本可读性与键盘体验仍明确列为NEEDS_HUMAN或NOT_TESTED，`acceptancePassed:false`。逻辑比例或PNG不能补物理DPI；没有启动窗口、修改系统显示设置或调用截图工具。

```powershell
.\runtime\node.exe tools/ux-acceptance/check-proof.mjs --proof evidence/offline-collab-002/native-integration.json --out evidence/ux-acceptance-tools-001/ux-proof-check.json
```

## 六向文件采集器

[collector.mjs](../../tools/real-link-evidence/collector.mjs)已实现显式batch及相对路径JSON回执导入；[使用合同](../../tools/real-link-evidence/README.md)定义字段、六向每向5槽位、双腿来源/反向路由/Session指纹、package/version/hash、一次提交及本地证据hash校验。

UNKNOWN、缺双腿、错投/错Session、重复ID/槽位/attempt/消息、版本不一致、回程不对应原回复均不计闭环。重复会同时作废所有涉及记录。工具不发送、不RPC、不控制UI、不访问公网、不执行任意命令。

人工报告、Agent声明、导入平台观察与模拟分别记录。人工B不补自动次数；导入平台标签本身不成为独立观测。工具只核对导入结构和本机文件hash，不能把接收端hash声明变成BYTE_VERIFIED，`realRoundTripsIndependentlyVerified=0 / acceptancePassed=false`。

本次只导入虚构示例，[示例报告](../../evidence/real-link-evidence-tools-001/fake-import-example.json)为FAKE_TEST：结构完整1、报告真实闭环0、独立真实核验0；没有导入或发起任何真实六向试验。真实原会话执行仍由root统一协调，材料互通、常驻恢复与主平台切换的授权不因本工具出现而合并。

## 自有验证与限制

12项自有虚构测试通过（UX4、collector8），覆盖正常记录和破坏性对照：DPI伪通过、来源/PNG失败、UNKNOWN、缺腿、错投、错误Session/版本、重复、模式伪装、本地篡改和路径越界。不使用冻结`test/`目录，不改构建，不运行真实Agent。

六向唯一性只覆盖当前显式batch，续批须合并完整账本；导入者能伪造JSON标签，本工具不提供平台来源签名认证。真实身份、观测来源和真实执行仍需独立证据核对。工具可交独立只读review，当前未自称已完成独立复核。

本工具不负责监测、终止或验收既有一小时进程，不把其运行时长、旧记录或这次静态检查转写为一小时通过。


## 第二轮定向复核结果

P1-UXTOOLS-PATH-001已解决，独立只读复核通过，未解决P0/P1为0。最终18/18自有测试和当前已有原生proof45/45检查通过，路径检查与输出独占创建均已核对。此结论仅为本地工具交付，不替代真人/DPI体验或真实六向往返。独立结论见evidence/ux-acceptance-tools-001/independent-review.json。主候选一小时已实际完成3600.573秒，工具未修改74项冻结依赖。

# TRB-UX-ACCEPTANCE-TOOLS-001 检查点

状态：PARTIAL / CHECKPOINT_ONLY。负责人：Codex /root。用户实体Esc停止Computer Use后，root要求本轮收口；本子任务未调用Computer Use，也不继续扩展实现或启动真实操作。

## 已保存

- `tools/ux-acceptance/check-proof.mjs`：可运行的既有原生proof静态检查CLI，读取显式指定的JSON。核对四个约定逻辑视口、Send/输入/正文区域记录、UNKNOWN/暂停/原文/普通赞同等已有自检事实，可核对来源和候选二进制hash及本机PNG。其结论是导入记录核对，不是重新执行原生UI。
- `tools/ux-acceptance/check-proof.test.mjs`：4项虚构测试，覆盖正常记录、缺失/错误状态、源码/图片失败，以及逻辑1.25/1.5不能产生物理DPI通过。
- 新工具语法检查通过，自有测试4/4通过。没有运行冻结的原有测试、重建或改动原生窗口。

尚未对实际native-integration.json执行CLI并生成体验核对报告；不能将单测通过说成现有产品体验已验收。首次使用者、真实125%/150%DPI、可读性和键盘体验始终列为NEEDS_HUMAN/NOT_TESTED；没有更改系统显示设置。

后续可在root恢复任务后显式运行（本次未执行）：

```powershell
.\runtime\node.exe tools/ux-acceptance/check-proof.mjs --proof evidence/offline-collab-002/native-integration.json --out evidence/ux-acceptance-tools-001/ux-proof-check.json
```

## 未完成

`tools/real-link-evidence/`六向采集器尚未创建，不能声称已实现。已和root约定其最小边界：仅显式导入batch JSON与本地JSON回执，六向每向5个唯一槽位；检查双腿源标识、反向路由/Session指纹、package/version/hash与一次提交；错投、重复、UNKNOWN不得计闭环。人工报告、Agent声明、导入的平台观察、本地文件hash和独立真实观测分别记录。它不能发送、RPC、控制UI、访问公网或执行任意命令。

恢复后应先实现上述导入校验与虚构破坏性测试，再考虑实际获准证据导入；不能以计划或测试假数据冒充真实线路通过。

## 保持的边界

没有修改冻结src/engineering/desktop/test/governance/native、构建或soak依赖，没有读取凭证、操作原会话/草稿/附件，没有启动或停止任何真实后台。当前一小时独立进程本子任务未监测、未终止、未验收；不根据进程可能仍在运行写成已通过。

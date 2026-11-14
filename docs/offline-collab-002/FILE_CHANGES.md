# TRB-OFFLINE-COLLAB-002 文件变更

核对时间：2026-11-12T12:36:25.644Z。唯一负责人：Codex /root；MAG-001不变。此清单只记录本离线Task，不包含真实材料canary脚本或文档。

基线：[baseline.json](../../evidence/offline-collab-002/baseline.json)，记录101个既有文件的原始SHA-256。此次逐项重算：11项变化、90项未变、0项缺失。备份原路径为 `D:\TriReviewBridge\backups\offline-collab-002-2026-11-12T10-57-27-489Z`。完整前后哈希见[changed-files.json](../../evidence/offline-collab-002/changed-files.json)。

`MODIFIED`有基线或原始备份哈希；`ADDED`来自本Task明确新建记录。101文件基线没有覆盖测试原件，缺少原始测试备份的条目统一写为`UPDATED_OR_ADDED`，不据文件名或当前存在状态断言NEW。文档与独立Collab二进制也不属于101个既有文件覆盖范围，其新增依据单列。

## 文件清单

| 文件 | 变化 | 当前SHA-256 | 用途 |
|---|---|---|---|
| [desktop/CollaborationPanel.cs](../../desktop/CollaborationPanel.cs) | ADDED | `6c9686ebe96e6e35ea45bdcb310735259399c65104c46ef6b7ab1a2a218799e8` | 计划状态与四项治理提醒的原生呈现。 |
| [desktop/StabilityProbe.cs](../../desktop/StabilityProbe.cs) | ADDED | `2c0026247f1201fb985364b907e71b2ced789bbf11c00f1baceaa35a8260304f` | Dispatcher心跳、真实选择执行计数及稳定性场景探针。 |
| [desktop/TriReviewBridge.csproj](../../desktop/TriReviewBridge.csproj) | MODIFIED | `3a7fcc8d014df37d714d52ac8a001bc479b3ecc085b8ab0b55ca26344a46fe60` | 纳入Collab候选类与独立构建输出。 |
| [desktop/UxPresentation.cs](../../desktop/UxPresentation.cs) | MODIFIED | `5260b791e8d7e194307038de45c4b2913984be17e71474463a1008de85ca8658` | 计划/治理信息、范围选择和原生刷新衔接。 |
| [desktop/UxTheme.cs](../../desktop/UxTheme.cs) | MODIFIED | `02ec9d407c9f6ada74db0b7a3bebe44e23122fada3b56bb1a3b3557a00a4c011` | 隔离新版稳定性探针的主题偏好路径。 |
| [desktop/WorkbenchApp.cs](../../desktop/WorkbenchApp.cs) | MODIFIED | `93f574010dab131746ff88e83bcce58a1605a13f1971672e98df5d1ebd664380` | 来源绑定、合法修订、草稿/导航及新版原生自测衔接。 |
| [docs/offline-collab-002/DELIVERY_REPORT.md](../../docs/offline-collab-002/DELIVERY_REPORT.md) | ADDED | `2999b3c0914460758272d9a4bfaf11df32a3c7f38677852a778dcd9b2901b6f0` | 本离线Task的新范围、操作、阶段或交付文档；不包含真实canary文档。 |
| [docs/offline-collab-002/IMPLEMENTATION_PLAN.md](../../docs/offline-collab-002/IMPLEMENTATION_PLAN.md) | ADDED | `aae1cf6f57387d6699cd1a885754e12d312564fb8881990fae312382145fb6a4` | 本离线Task的新范围、操作、阶段或交付文档；不包含真实canary文档。 |
| [docs/offline-collab-002/OPERATIONS.md](../../docs/offline-collab-002/OPERATIONS.md) | ADDED | `123d05661746635a7bd6cf6593b7e0c7b09f811f4f56e3870c285cff7f09f829` | 本离线Task的新范围、操作、阶段或交付文档；不包含真实canary文档。 |
| [docs/offline-collab-002/STAGE_REPORTS.md](../../docs/offline-collab-002/STAGE_REPORTS.md) | ADDED | `50d132d34314bf72126bea282b56bdf37c8a6a7154297cb09de5bf7c16545457` | 本离线Task的新范围、操作、阶段或交付文档；不包含真实canary文档。 |
| [engineering/exchange.mjs](../../engineering/exchange.mjs) | MODIFIED | `4ee77285a225da830e67084479bfdea90ae6f1a50e2e5299d89b28e4801fcad2` | 材料投递与文字计划未来预留共用根预算。 |
| [runtime/native/TriReviewBridge.UX.Collab.exe](../../runtime/native/TriReviewBridge.UX.Collab.exe) | ADDED | `871037d6e79227a90e6e8b0b2b2ecf79d38591763ddf3c39aafbcd9ef91f2532` | 当前冻结Collab候选二进制；旧exe不覆盖。 |
| [scripts/build-desktop.ps1](../../scripts/build-desktop.ps1) | MODIFIED | `82c2948da9a7002e4d77d22da773a3fe43d1196033a1506619488268d7067e07` | 增加Collab独立候选输出，保留旧版。 |
| [scripts/open-collab-workbench.mjs](../../scripts/open-collab-workbench.mjs) | ADDED | `e786033f963ecd15f783fb7ab2b7bb800bc5f4e65b504b48a750a65c9827c7e5` | 独立48736虚构演示准备及安全启动，不重置旧库/暂停。 |
| [scripts/open-collab-workbench.ps1](../../scripts/open-collab-workbench.ps1) | ADDED | `10bc3892a042b279cdffe986448bdd3cb3796333c7edd5e8b921cc2c26a0a76f` | 新版隔离入口PowerShell包装。 |
| [scripts/prepare-collab-002-review.mjs](../../scripts/prepare-collab-002-review.mjs) | ADDED | `50ea775c01fe9107412408dca74eda4b81fbe9ed8cf0154af2b253b5bb8300c7` | 不可覆盖的候选材料包；修订3仍为正式第2轮。 |
| [scripts/soak-collab-002.mjs](../../scripts/soak-collab-002.mjs) | ADDED | `e5de6103bb189b10568203ba342dec34b45a7180f6cdea35b2c0f624341bb0c3` | 隔离墙钟耐久驱动、故障注入、双心跳与模拟预算。 |
| [scripts/verify-collab-002-soak.mjs](../../scripts/verify-collab-002-soak.mjs) | ADDED | `a6583036e71fdaf73539ccf2c47ba569b8376c5d835c984e12c44f5f5a5cf93a` | 冻结来源、SQLite、原字节、墙钟/心跳及故障证据核验。 |
| [scripts/verify-collab-002.mjs](../../scripts/verify-collab-002.mjs) | ADDED | `7aa2baee2c566af498fcbc95c58a42169c47cc3c8a88b3e1f69d392d22af87a7` | 离线Task汇总与主平台保护核验，区分另Task的真实试验。 |
| [src/collaboration-governance.mjs](../../src/collaboration-governance.mjs) | MODIFIED | `bf87f7cedca8cad1ec3116c24a6bfdf9a3e9d103fe611c19ea1893370d5b64cb` | 公共入口、版本票、独立来源作者及工程Host保护。 |
| [src/collaboration-intent.mjs](../../src/collaboration-intent.mjs) | MODIFIED | `f2c71f21f74d1c8191a6f8ad288bbbf53be6f70dbafa36b344048e590c4001f1` | 有界自然协作、必要引用、持久计划接入及只读状态。 |
| [src/collaboration-plan.mjs](../../src/collaboration-plan.mjs) | MODIFIED | `c8cccb6c046c639dfe11143fca979a12fa9c32652a4e473100bd495d2af06527` | 保留原文位置的代码/引用屏蔽与单负责人、单复核者语法。 |
| [src/collaboration-plans-host.mjs](../../src/collaboration-plans-host.mjs) | ADDED | `b5c1124dde0ff24c2c3e61c4456b545254b467ee8008abde5c9e2d11e0a3b51b` | SQLite持久依赖、有效回执、未来预算预留、版本及UNKNOWN保护。 |
| [src/workbench-server.mjs](../../src/workbench-server.mjs) | MODIFIED | `30eadc80143d4da26801625df1cc3a1c153185901de44bf9a82ea1ece910c18d` | 可信消息来源映射、计划API、状态及重启暂停保护。 |
| [src/workbench.mjs](../../src/workbench.mjs) | MODIFIED | `628d6295e8ab7ede556fa7a7c154057ba5036cb0be6be51a27e5afc781d38b12` | 统一治理、冻结消息来源/快照、共享预算与直接入口防绕过。 |
| [test/collab-002-soak-smoke.test.mjs](../../test/collab-002-soak-smoke.test.mjs) | UPDATED_OR_ADDED | `6194fb78dda9d70f3e9bf1f88cd133402e5248f00d08a131e69de8a0da0f76c5` | 短烟测驱动，不代替一小时验收。 |
| [test/collab-plan-boundaries.test.mjs](../../test/collab-plan-boundaries.test.mjs) | UPDATED_OR_ADDED | `8a807b1692f2c4be906286bf34f3780151a5b1b2dbefba7f94b2095dfc3d18a0` | 持久计划的故障、版本、权限与不重复推进边界。 |
| [test/collaboration-governance.test.mjs](../../test/collaboration-governance.test.mjs) | UPDATED_OR_ADDED | `b8df1fb6942938f2cf6d6c3936e74c7f4a8a781573ec2064217ad95b8026de71` | 公共/派生入口、消息来源冻结、自审/交叉/修订及保护完整性回归。 |
| [test/collaboration-plan.test.mjs](../../test/collaboration-plan.test.mjs) | UPDATED_OR_ADDED | `ef1ba434d9e09d77659c33a3a5750898d0c2bbd4c1afeb57a1ae384708122ec3` | 语法与真实SQLite Host依赖、重启、UNKNOWN、预算、状态及版本破坏对照。 |
| [test/offline-collab-002-api.test.mjs](../../test/offline-collab-002-api.test.mjs) | UPDATED_OR_ADDED | `79ccddad3900ce11608781958c36b31defadcd5f5d3ab962bfa9bf4ec2d9d1c7` | HTTP幂等/作用域/暂停及可信消息作者、版本来源保护。 |
| [test/offline-collab-002-native.test.mjs](../../test/offline-collab-002-native.test.mjs) | UPDATED_OR_ADDED | `ea8b3299da4005cd9a91ed7f1d457112a3303cb941be44cef8e3693ee9fa0880` | 当前Collab二进制的真实WPF流程与来源合法修订集成。 |
| [test/offline-service-helper.mjs](../../test/offline-service-helper.mjs) | UPDATED_OR_ADDED | `390eeb29f6f1abbb2589b39627d170593a6868c9fc449abb6e343f7dceae44f8` | 隔离服务恢复helper；不把EMPTY初始化当恢复暂停授权。 |
| [test/ux-intent.test.mjs](../../test/ux-intent.test.mjs) | UPDATED_OR_ADDED | `df79c958505ea3e5d69b5e7ae1d5d18a687a71a85c15dfca07ed709dc9cd506c` | 有界自然动作、引用/代码路由、权限、明确未执行及工程关联回归。 |
| [打开新版协作工作台.cmd](../../打开新版协作工作台.cmd) | ADDED | `01962aa62f23a81d8364329b6ba2ea6e9dbe6dae9e8bf4682b7e4ab7a50d984e` | 新版Collab入口，与旧启动器并存。 |
| [本清单](FILE_CHANGES.md) | ADDED | 见JSON，避免自引用哈希 | 本离线Task新建的审计清单。 |

## 冻结与运行状态

当前代码/构建经过192/192完整回归；候选修订3的正式复核轮次仍为2，结果为限定范围内通过。30.67秒烟测的acceptance=false。最终一小时运行指针为[soak-running.json](../../evidence/offline-collab-002/soak-running.json)，启动于2026-11-12 12:28:53 UTC；本次核对仍为RUNNING，尚未形成一小时通过结论。

本次仅修改本清单、交付文档链接和派生哈希记录，没有修改运行中冻结的src、engineering、desktop、native、governance、脚本、构建或测试。完成耐久后仍应由实际runId报告和最终verifier核对，不能以本清单替代验收。

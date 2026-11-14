# USER_SEED最小增量交付

Task：TRB-REAL-LINK-USER-SEED-001。唯一负责人/root；实现/root/ux_layout。新实质缺口是每槽来源Agent先独立生成挑战所需的user→Agent seed无法如实入账；本Task不重开已关闭P1-RUNBOOK-CAP-001。

仅修改ledger.mjs的非imported持久化身份校验、reserve字段/来源/目标校验、幂等tuple；增加USER_SEED显式来源。旧Agent→Agent严格指纹、begin/result/预算/锁/pause/UNKNOWN/历史导入实现不变，CLI/safe-local-files依赖不变，无新schema/迁移。旧无kind记录按原规则读取，status不重写其快照或hash。

新合同：`kind:'USER_SEED', from:'user', fromSessionFingerprint:null`，to只能三个冻结original Agent，target指纹精确匹配。不支持Agent→user/未知Agent，不造用户Session、不以其他Agent身份发送，也不通过导入RESERVED获得准入。用户授权只是operator assertion+reference，工具不独立认证。

实跑命令：`runtime/node.exe --test tools/real-link-runbook/ledger.test.mjs`。原15+新增5=20/20，fail0/skip0/exit0；输出在本目录TEST_RESULTS.txt。新增：三目标正例；缺kind/非null用户指纹/用户或未知目标/假original与错误目标指纹/Agent冒用kind拒绝；旧Agent双方指纹及无kind快照兼容；seed与Agent同额度、跨3h/重启UNKNOWN与重复/暂停保持；imported RESERVED不能begin。原并发占位/双进程begin/cap1+30反例均一并运行。

旧冻结8文件及15/15日志完整复制在baseline/；根目录旧CANDIDATE.json和原TEST_RESULTS*.txt未覆盖。旧候选hash `633f5859e7cffa55ba64ab7ec0f30d7d515ad035f26047fd31a94575b61f9d02`。当前增量源码hash、测试hash及未变依赖见本目录CANDIDATE.json；独立首轮只读复核尚待负责人安排，不将实现自测代替复核。

负责人已报告REAL账本初始化且暂停；本实现没有读取/修改该账本、没有初始化或变更主暂停/原binding、没有真实SDK/UI/发送/凪操作。只写本工具和本Task新增fake测试目录；没有扩成调度系统。工具不能阻止外部人工/程序旁路；所有真实动作仍由负责人在原授权边界统一执行。

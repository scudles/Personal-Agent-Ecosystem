# HYBRID-NATIVE-001 原生通道候选

日期：2026-11-13。负责人：Codex root。此文件是实现方设计与自测记录，不是独立复核或真实通道验收。

## 最小实现

新增 `tools/hybrid-native-001/`；本子任务未执行任何真实会话操作，不主动提供模型/权限覆盖参数，不改Runtime源码、旧Gateway脚本或稳定DesktopSession.exe。只支持普通文字与纯文字任务；正式审批、自动工程执行、附件、跨Agent自主链均不开放。已确认session.resume可能提交原生派生policy刷新；未主动model override不等于原设置绝不会变化。生产Hermes inspect/submit/identity/prepare链默认锁住，不能依据通用native-access ack启用。

- `worker.mjs`：固定 HYBRID_NATIVE / hybrid-native-001 / 48738 / hybrid-workbench.sqlite；只用对应角色的 `hybridWorkerTokens`，不回退owner token。Hermes支持一次检查、持续检查和仅身份报告；DSH明确UNSUPPORTED，ChatGPT交由另一个接力worker。
- `contract.mjs`：固定Hermes原Session/title、请求sha和kind、最小原生admission投影；不合成原生消息UUID或工具轨迹。
- `hermes-gateway.py`：仅inspect、submit、receipt；从既有Gateway连接，不启动Gateway，不创建替代Session，不传model/profile/权限覆盖参数。
- `hermes_contract.py`：纯stdlib验证/最小投影，不导入Hermes SDK或读取任何真实数据。对应Python测试也只用虚构值。

Node/Python使用非TTY的stdin/stdout JSON，UTF-8连续解码；不把消息变成命令行或shell代码。真实Hermes CLI必须同时具备显式 `--ack-native-session-access` 与 `--ack-native-policy-refresh`；helper也独立校验两项，直接导出的Adapter默认拒绝，工厂仅显式allowPolicyRefresh=true才开放。第二开关只是操作者已经获得用户具体授权的声明，不是权限授予或绕过审查；当前没有用户对该实质副作用的新确认，不能自动填写。真实入口需root在必要复核及既有授权边界核对后执行，本子Agent没有执行。

## Hermes业务合同

1. 空队列不访问Gateway；暂停/阻断队列不begin，不自动恢复。
2. 新QUEUED先固定身份、完整忙状态、history摘要；busy不begin。
3. 本机begin耐久记录attempt后，第二次peek必须是同role/id/token、DISPATCHING、continuationAllowed且未cancel/paused，再调用提交。
4. Gateway在实际prompt.submit前再次resume同原Session核对busy、tailHash与profile标识；只传job.id作为input_id和确切原文。SDK恢复/挂载同一原Session不只常规引用和计时维护：session.resume可能在idle local session新attach前调用refresh_resumed_policy并commit新policy generation，更新reasoning默认、toolsets、MCP、terminal、max_turns/checkpoints等配置派生项。该实现意图保留model/provider及显式picks，但不能承诺全部原配置不变。详见HERMES_POLICY_PRESERVATION.md；当前生产链默认停用。
5. 有真实admission_id才登记SUBMITTED；发送超时、异常或不确定ack一律UNKNOWN，绝不重复submit寻找收件。重启DISPATCHING缺admission时也只进入UNKNOWN。显式UI准备请求由已授权运行的watch worker实际消费为一次身份报告，不自动enable；未启动worker时保持待处理，不是按钮已完成身份认证。
6. 回收只按耐久保存的同admission_id调用公开prompt.receipt，先include_result=false核对ref{profile_id,session_id}、status/outcome；仅terminal/completed才取同admission结果。无需session空闲，不以busy=false猜该回合完成。
7. include_result=true会把完整已存结果传入helper内存，可能包含工具、上下文或压缩历史；**仅输出投影不代表物理未读取这些内容**。此真实范围要由root核对授权，不读额外私密DB或改用旧sealed-batch日志许可。
8. 只导真实receipt最小投影：admission_id、ref、status/outcome、实际存在的sequence/authority_epoch/execution_generation及result.final_response。messages、tool、usage等不落平台DB；未知、压缩、截断、过长或缺final均拒绝。requestId明确为WORKER_REPORTED_INPUT_ID_ASSOCIATION，不声称是Gateway原生回执字段。

来源仍为WORKER_REPORTED的HERMES_GATEWAY_ADMISSION_RESULT。SHA证明记录的字节完整性，不证明平台独立认证；不填noToolCalls:true，不声称拥有完整工具轨迹。实际SDK返回字段/版本与Gateway权限尚未真实验证，不支持shape须安全停止，而不能伪造成功。

## DSH边界

旧src/transports.mjs的DSH send未采用Rev2输入保护，read又从整份日志按后续事件猜对应回复；不得直接用于新日常接入。Rev2候选仅30项纯测试及有限独立复核通过，真实UIA/Win32 hook/IME/窗口遮挡、多行尚未验证。默认仅单行BMP，固定多行probe不等于日常多行能力。

root本轮使用允许电脑操作通道只读观察：唯一DSH「主进度」、无编辑Value、sendDisabled=true、无stop，可见旧TRB_REAL_LINK文本锚；0点击、0输入。未观察原生Session UUID，标题/锚不能冒充UUID证据；这也不是Rev2输入guard真实测试。因此新worker不检查或操作DSH，不报虚假identity，不读原私密日志，返回 `UNSUPPORTED / DSH_desktop_candidate_not_real_app_verified`。

下一步可以先用允许的电脑操作通道在用户已选原会话核验一条固定虚构文字，之后评估受保护native输入候选；不能从shell运行候选去操作真实App以绕过电脑操作边界。原草稿和旧UNKNOWN/暂停不动。已有canary/run的整份日志许可仅覆盖该封存范围，不自动扩成日常通用收件授权。

## 验证、迁移与回退

P1 policy锁修复后的最终Node fakeAdapter与真实隔离HTTP/SQLite共22/22、Python纯合同及默认门13/13，退出码均0。本子任务真实Gateway/DSH/ChatGPT操作0次，未触及凪。实际HTTP+fakeHermes已验证普通chat、文字任务、SUBMITTED admission跨后台重启保留及用户文字验收；不属于真实Agent验证。日志在evidence/hybrid-native-001/native-worker-policy-r2-tests.txt与hermes-contract-policy-r2-tests.txt，最新HTTP证明test-output/hybrid-native-channel-eP55zU/fake-http-proof.json。

新worker源码/模式隔离，无旧数据库迁移；候选不启动即可回退，不改原稳定exe/旧worker和既有接力自动任务。watch模式自有角色锁，异常退出后残留锁会拒绝自动恢复，需核对后人工处理；不会自动删锁或重发消息。
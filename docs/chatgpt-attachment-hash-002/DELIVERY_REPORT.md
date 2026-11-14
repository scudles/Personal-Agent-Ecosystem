# ChatGPT原附件只读哈希工具交付

Task：TRB-CHATGPT-ATTACHMENT-HASH-002。唯一负责人：Codex /root。此子任务只实现本地校验器、虚构测试及发送材料，不操作原ChatGPT或其他真实会话；需一名独立只读复核者核对后由root统一处理实际一次性发送。

## 已实现及本地验证

- [标准库Python校验器](../../tools/chatgpt-attachment-hash/verify_attachments.py)：只接受正好五个当前附件的明确绝对路径映射，不发现路径或枚举目录；五份普通文件只读打开、限长并核对读取稳定性，实际计算size/SHA256、manifestHash及五项实测列表canonical packageHash。
- expected来自固定canary常量；declared仅来自实际控制文件；measured仅来自实际读取bytes。映射/bytes缺失为UNSUPPORTED，字节或声明不符为MISMATCH，全部实际匹配才MEASURED_MATCH；不会把预期值补到实测字段。
- [虚构测试](../../tools/chatgpt-attachment-hash/test_verify_attachments.py)12/12通过，真实使用已安装Python的`-I -B -S`隔离参数，不import Hermes源码/配置、不安装、不写venv。测试只写新的fake test-output目录；没有写原包。
- [虚构实测结果](../../evidence/chatgpt-attachment-hash-002/fake-measurement.json)使用固定公共虚构canary副本，确实从副本5文件读bytes计算hash；该结果明确FAKE_TEST，不是ChatGPT接收端证据。无映射结果另列UNSUPPORTED。

测试覆盖字节修改、控制文件声明与实测分离、附件原生重命名映射、缺文件/多映射/相对路径、重复文件身份、超长/读取中变化和禁止发现目录/写入式open。Windows预检查使用lstat与fstat共同字段；FD前后稳定性仍核对ctime，避免两接口creation/change-time差异误拒绝。

## 一次性发送材料

[完整请求正文及固定代码](../../evidence/chatgpt-attachment-hash-002/one-shot-request.txt)可由root在已确认的原ChatGPT会话一次性发送。SHA-256：`cdac3432eeb9996ac049a09ec79337044dd9996f84bf355c41f8f87c16bb5bad`。代码文件SHA-256：`335146079840d525f0a97fa93dbc92e7fd423ef7cddd9bc6afcb42f52f85e908`。

请求明确沿用原会话/模型，仅使用当前已经可用的原生Python沙箱及这5个当前附件的原始bytes路径。没有工具或bytes则UNSUPPORTED，不新增能力、不开新会话/API、不扫描/mnt/data、不读其他附件/目录，不写文件、联网、调用shell或执行材料内容。

早期未通过Windowsstat回归的请求候选保留为`one-shot-request-before-stat-fix.DO_NOT_SEND.txt`，不得发送；最终请求是上述12项测试通过后的新文件，不混用旧hash。[自然语言请求说明](ORIGINAL_CHATGPT_REQUEST.md)与[工具合同](../../tools/chatgpt-attachment-hash/README.md)供复核。

## 能下的结论

本地fake测试证明本代码可以对明确路径实际计算固定合同；不证明原ChatGPT现在有原始bytes/工具，也不证明其已经执行。即使实际接收端报告MEASURED_MATCH，原会话/工具来源仍需对应凭据核对；代码结果`platformObservationAuthenticated:false`，不自造独立平台观测。材料字节核对不构成工程审批或实施授权。

74项既有冻结依赖及固定原包保持；本子任务没有真实发送、UI/RPC/网络动作，不管理一小时进程、不更改任何原会话设置或草稿。正式独立只读复核与实际发送结果由root另行记录。

最终代码先导入内建sys并关闭本次Python字节码缓存写入，再导入其余标准库；12项测试包含这一顺序保护。此前未加该保护的请求保留为one-shot-request-before-bytecode-guard.DO_NOT_SEND.txt，不能与最终请求混用。

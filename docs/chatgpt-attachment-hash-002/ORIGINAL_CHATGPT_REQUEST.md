# 原ChatGPT一次性只读哈希请求

Task TRB-CHATGPT-ATTACHMENT-HASH-002。本材料由root通过已确认的原ChatGPT会话发送一次；本编写子任务不发送。保持原会话、当前模型、人格、私有记忆及设置，不新建API会话。

可发送的自然语言正文：

```text
继续刚才已经在本原会话交付的固定canary附件，不要重新索要上传或重发。

用户本次明确追加的授权仅限：如果你当前原会话已经具有可用的原生Python沙箱及这5个当前附件原始bytes，可以在现有工具中运行下附标准库只读哈希代码。不得新增/开启工具、切换模型或建立新会话/API；没有现成沙箱或原始bytes就直接回复UNSUPPORTED及缺少哪一项，不使用预期hash冒充实算。

五个映射键必须正好是README.txt、orchard.json、notes.txt、manifest.json、manifest.sha256。路径只能由用户或当前原生附件工具提供，必须对应刚才这5个当前附件；不要猜路径，不扫描或列举/mnt/data，不读其他附件、目录、会话、配置或凭证。若附件工具仅提供文本视图而无原始字节路径，也回复UNSUPPORTED。

在现有原生工具给出明确路径映射后，将下附代码原样作为工具代码使用，最后调用print(json.dumps(verify_paths(PATHS), ensure_ascii=False, sort_keys=True))；PATHS仅替换为该明确5项映射。不要用exec/eval去执行附件内容，不执行材料代码，不联网，不调用shell/子进程，不写任何文件。

请返回实际工具结果，区分expected（本请求固定合同常量）、declared（从manifest/control文件读取的声明）和measured（本次从这5个文件原始bytes实际计算）。须列5个实测size/SHA256、实测manifest SHA256及实测packageHash。packageHash算法为按路径排序的五个path/sizeBytes/sha256对象列表，JSON键排序、无额外空白、UTF-8后SHA256。

MEASURED_MATCH只表示本次所给5路径字节与固定合同一致，不是工程审批或实施授权。没有原始bytes/工具能力、路径映射不完整、任一文件读取失败或变化都必须如实说明，不能照抄expected填到measured。也不要声称本代码本身独立认证了平台观察来源。
```

发送时在上述正文后附[verify_attachments.py](../../tools/chatgpt-attachment-hash/verify_attachments.py)中从标准库import至`verify_paths`函数结束的代码，再附明确调用；无需把CLI的`main`/`sys.exit`包装放入原生Python工具。本文件未使用真实附件路径占位猜测，也未要求原ChatGPT启用不存在的能力。

原先canary请求禁止代码执行；本次仅由用户明确追加这一个固定标准库只读哈希范围，不能泛化为执行材料脚本、工程修改或新的沙箱/模型权限。既有附件原包不变，实际发送及原会话结果归root独立记录。

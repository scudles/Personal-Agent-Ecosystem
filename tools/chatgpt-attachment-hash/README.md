# 固定canary五附件只读SHA-256校验器

Task：TRB-CHATGPT-ATTACHMENT-HASH-002。标准库Python，代码自身不写文件、不扫描目录、不联网、不调用子进程、不执行材料内容。只读取调用者明确映射的README.txt、orchard.json、notes.txt、manifest.json、manifest.sha256五条绝对路径；支持原生附件重命名后的路径，不按文件名搜索。

固定合同为package `d63d404e-1861-4aec-ab1f-277c63b3ecff / v1`、snapshot `1f7a3f49-8190-4650-a586-ff4706e17b8d`。代码中常量是expected；manifest/control文件中读出的值是declared；文件原始bytes实际SHA-256/长度及canonical列表SHA-256是measured，三者不合并。

## 原会话用法

只有原ChatGPT当前已具备原生Python沙箱与用户/原附件工具提供的五个当前原附件路径时，才可在该现有工具中运行代码并调用`verify_paths(PATHS)`。没有能力或原字节，直接UNSUPPORTED；不启用新工具、不换模型、不换会话、不调用新API，也不扫描/mnt/data。一次性自然请求材料见[原会话请求](../../docs/chatgpt-attachment-hash-002/ORIGINAL_CHATGPT_REQUEST.md)。

本地CLI同样只接受显式映射JSON参数，结果只输出stdout，不读取映射文件：

```text
python -I -B -S verify_attachments.py --paths-json '<正好五项、原文件名到明确绝对路径的JSON映射>'
```

不提供映射时，CLI直接返回UNSUPPORTED并退出2，不猜路径。MISMATCH退出1，MEASURED_MATCH退出0。调用者可将函数用于现有原生沙箱；CLI包装不必复制到原ChatGPT。

## 实际校验

每个映射文件用只读os.open/os.read读取，文件必须普通、最大2MiB，读取前后身份/大小/时间稳定；重复路径或同一文件身份复用不能充五份原附件。只解析两个控制文件为数据；三个payload不解释执行。映射缺失/额外、原始bytes不能打开、文件变化或能力缺失均UNSUPPORTED，不用expected补measured。

实际packageHash算法：五个实测`{path,sizeBytes,sha256}`对象按路径排序，JSON键排序、无多余空白、UTF-8编码后SHA-256。manifestHash是实际manifest.json原bytes的SHA-256，不能从manifest.sha256抄进measured。

完整五文件实测、固定expected、manifest声明、控制行均匹配才MEASURED_MATCH。它只说明给定路径的字节一致；路径是否真属于当前原会话附件、代码是否确实由原平台运行，仍需原生工具/来源凭据核对。结果始终`platformObservationAuthenticated:false`、`implementationAuthorized:false`，不自造平台独立观察或工程授权。

## 虚构测试

`fake_fixture.py`只包含原固定公共虚构canary的测试副本；测试写入新`test-output/fake-chatgpt-hash-*`，不写原包。`test_verify_attachments.py`覆盖实际5文件/hash、缺bytes、错字节、声明与实测分离、重命名映射、重复身份、限长和读取中变化，以及禁止目录发现/写入式open。

使用已安装解释器的隔离参数`-I -B -S`，不导入Hermes源码或配置、不安装依赖、不写venv。此工具交付没有操作原ChatGPT；实际原会话动作由root一次性发送并独立留证，需一名独立只读复核者核对本工具边界。

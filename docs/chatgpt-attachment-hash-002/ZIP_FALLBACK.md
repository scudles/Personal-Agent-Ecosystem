# 单ZIP原字节交付备选

Task：TRB-CHATGPT-ATTACHMENT-HASH-002，负责人root。状态：LOCAL_CANDIDATE / NO_ORIGINAL_CHAT_OPERATION。本增量不改原5路径helper、不改canary package版本，不建立新会话或网络API；交付后由root安排同增量的独立只读复核。

## 本机只读研究结论

原ChatGPT在`TRB-CHATGPT-HASH-20261112-002`回复UNSUPPORTED：已有Python沙箱，但附件解析工具没有提供5份原始bytes的明确绝对路径映射，未运行哈希。此事实由root传入，本研究没有访问原会话。

当前可见的原生`send_message_to_thread`合同只有threadId、prompt及可选上下文字段，没有附件上传参数；`read_thread`面向消息/摘要，不提供原附件bytes获取或file ID解引用。没有发现可见的upload_attachment能力。项目旧`DesktopSession`只实现inspect/select/read/peek/calibrate/send；`ManualHandover`只导出材料和用户报告状态，不给原ChatGPT挂载文件。这些是当前本机schema/源码结论，不是联网核验后的全产品能力断言。

原生工具若将来明确提供“这一个当前附件ID → raw bytes/绝对路径”的已有解引用方法，可先按该确切ID核对；不能从ID自行拼URL或猜路径。当前没有已证实的自动路径交付链，不建议反复发送相同无路径哈希请求或盲目重发原5文件。

## 为何准备单ZIP

同包现有`CANARY_ORIGINALS.zip`已在本机核对5个原文件。本次只做其原字节副本。用户实际入口为[CANARY_ORIGINALS.zip](../../交付材料/ChatGPT哈希验证/CANARY_ORIGINALS.zip)，同目录有[短操作说明](../../交付材料/ChatGPT哈希验证/操作说明.txt)和[随附短请求](../../交付材料/ChatGPT哈希验证/随附短请求.txt)；不需要用户查找evidence目录或转抄大段代码。归档证据另保留[原字节副本](../../evidence/chatgpt-attachment-hash-002/zip-delivery/CANARY_ORIGINALS.zip)：1486 bytes，SHA-256 `ca7e2cc97e6dc496936ba7c183585c11b27537b44f22afbabc2558f6834f8f4c`。

包仍是`d63d404e-1861-4aec-ab1f-277c63b3ecff / v1`，snapshot仍为`1f7a3f49-8190-4650-a586-ff4706e17b8d`。ZIP只是运输wrapper，不把其SHA-256当作原包canonical packageHash，不重封/改写原包。

人工在同一原ChatGPT会话上传这一个ZIP，是目前的最小交付候选；它可能减少“五个独立路径”映射问题，但不能保证当前附件解析链会向Python暴露ZIP路径。只有原生工具明确给出这个ZIP的实际绝对路径才运行新helper；仍只有解析文字或不透明ID而没有合法解引用时，保持UNSUPPORTED。此时不要改模型、开新工具或新会话来补成功。

## 固定ZIP校验器

[verify_zip_attachment.py](../../tools/chatgpt-attachment-hash/verify_zip_attachment.py)标准库只读接受一个明确ZIP绝对路径。整ZIP最多2MiB，读取前后核对稳定性；字节在内存交给zipfile，不写副本或解压。

中央目录必须恰好README.txt、orchard.json、notes.txt、manifest.json、manifest.sha256，各出现一次。重复名、目录、路径穿越/分隔符、其他成员、加密、非普通成员、未知压缩方式及成员声明大小越界先拒绝，不打开成员。仅对固定成员以其预期长度+1有界读取，计算实际5个size/SHA-256、manifestHash及canonical packageHash；wrapperHash、declared与expected另外报告。zipfile成员读取是获准容器内读取，不枚举沙箱目录。

没有路径/原始ZIP bytes则UNSUPPORTED；结构/字节不符则MISMATCH；全部实测与固定合同及wrapper均一致才MEASURED_MATCH。结果不独立认证原会话平台来源、不构成工程授权。

## 人工下一步（本次未执行）

1. root完成增量只读复核后，把上述用户入口与短操作说明交给用户。
2. 用户在同一原ChatGPT会话上传单ZIP，可随同发送短请求一次，不重复原5附件；短请求只询问本ZIP的现有原生路径元数据，不先执行哈希。
3. **先确认ZIP上传成功及其明确原始路径元数据。** 之后root才通过原会话专用工具发送[固定代码请求](../../evidence/chatgpt-attachment-hash-002/zip-delivery/native-fixed-code-request.txt)一次，不让用户转抄大段代码，不提前重复发送。没有路径则保持UNSUPPORTED，不猜/mnt/data，也不启新能力。
4. root核对对应原消息/回执及其expected/declared/measured，按来源级别记录。人工上传、接收端报告实算与Bridge独立工具观察分别记录，不因本地fake测试或wrapper准备而升级。

`manual-upload-request.txt`是早期完整正文＋代码材料，保留备查；当前用户操作以人类入口的短请求为准，root代码以native-fixed-code-request.txt为准，均未由本子任务发送。

当前9项新fake测试通过。它们使用固定公共虚构ZIP副本，覆盖结构破坏、加密/限长/符号链接、字节变化、控制声明和禁止目录发现/解压；不是接收端已可读的证据。原helper及74冻结依赖和原包保持不变，没有原会话、CUA、发送、RPC或公网动作。

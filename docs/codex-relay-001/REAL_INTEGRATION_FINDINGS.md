# 临时接力真实联调检查点

日期：2026-11-13；此记录不作为真实往返通过证明。

1. 旧ConPTY JSONL方式在Windows终端回显中插入空格/换行，peek不能安全解析。实际在begin前退出，未向原会话发送。已切换非TTY一次性RPC，原始UTF-8用base64url作纯数据传输。
2. 补充复核P1-SPOOL-BOUNDARY：固定文件名不足以防止父目录junction；已将分块写入迁入固定worker，完整目录链、ReparsePoint、exact realpath、单链接句柄及清理前身份/内容复核已补。原15tests加真实Windows虚构junction测试为17/17（实现方，exit0）。独立限定复核PASS。
3. 真实读取原会话工具明确拒绝maxOutputCharsPerItem=64000：`Too big: expected number to be <=20000.` 两次执行均在原会话preflight读取处失败，未begin、未send。随后1000字符只读成功，原Thread固定ID/标题/kind匹配且idle；返回的截断item有truncated:true。正按实际20000上限收紧参数和回执边界，避免截断被当完整。

独立复核不覆盖未冻结的后续修改；最终源码、测试和真实试投结论见DELIVERY_REPORT.md。
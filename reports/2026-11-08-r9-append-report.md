# R9 复核：只用 FILE_APPEND_DATA 的追加写入

日期：2026-11-08｜作者：Hermes｜状态：**句柄语义已实测；ACL 边界仍 PLANNED**
关联：[W-1 v5.1 §2.1](2026-11-08-w1-account-poc-plan-v5.1.md)、探针 `tools/poc/append_probe.py`

---

## 1. 结论先说

1. **`FILE_APPEND_DATA`-only 的句柄本身就是"只能往末尾写"**：我把文件指针强行挪回 0 再写，数据仍然落在末尾（内容从 `AB` 变 `ABC`，不是 `CBC`）。
2. **该句柄截断不了文件**：`SetEndOfFile` 返回失败，`GetLastError = 5`（`ERROR_ACCESS_DENIED`），文件长度保持 3。
3. **所以 Recorder 的实现必须自己用 `CreateFileW(FILE_APPEND_DATA|SYNCHRONIZE)`**，不能用 `echo >>` / `Add-Content` / `FileMode.Append` 这类按 `GENERIC_WRITE` 申请的高层 API。
4. **但"普通 API 会失败"目前只是假设，尚未在受限身份下证实**——那需要四个账户，属于 A1′，状态 `PLANNED`。**不能**把这条当成已证事实写进验收。

---

## 2. 探针与真实输出

`python tools/poc/append_probe.py`（只写 `%TEMP%\r9-append-probe\`，不改任何 ACL）：

```
probe dir: C:\Users\ADMINI~1\AppData\Local\Temp\r9-append-probe

[PASS] T1 追加成功  ->  AB
[PASS] T2 指针归零后写入仍落在末尾（不覆盖）  ->  ABC
[PASS] T3 SetEndOfFile 被拒 (ok=False, err=5)  ->  size=3
[PASS] T4 不存在时 OPEN_ALWAYS+AD (created=True, err=0)  ->  环境相关
[PASS] T5 GENERIC_WRITE 打开（对照：本机必然成功）  ->  只说明本进程是全权身份
```

### 2.1 每条测试到底证明了什么

| ID | 动作 | 结果 | 能证明 | 不能证明 |
| --- | --- | --- | --- | --- |
| T1 | `CreateFileW(path, FILE_APPEND_DATA\|SYNCHRONIZE)` + `WriteFile("B")` | 文件 `A`→`AB` | append 句柄可用 | 受限账户能否打开（当前身份全权） |
| T2 | 同一句柄 `SetFilePointer(0)` 后 `WriteFile("C")` | 内容 `ABC` | **append 语义由句柄保证，不靠调用方自觉**；覆盖历史字节在这个句柄上做不到 | 其它进程用 `GENERIC_WRITE` 打开时的行为 |
| T3 | 同一句柄 `SetEndOfFile` | 失败，err=5，size 不变 | 截断需要 `FILE_WRITE_DATA`，append 句柄拿不到 | ACL 层是否额外拦住（这层由 A3 在受限账户下测） |
| T4 | 文件不存在时 `OPEN_ALWAYS + AD` | 本机成功创建 | 仅说明"创建需要目录的 `FILE_ADD_FILE`（= icacls 的 `WD`）"这一机制存在 | 受限账户能否创建（取决于目录 ACL） |
| T5 | 用 `GENERIC_WRITE` 打开 | 成功 | 对照：本进程身份全权，任何访问都放行 | 受限账户行为 |

**T4 的设计含义**（重要）：`audit` 目录对 Recorder 只给 `R`（无 `WD`），所以**受限账户下 `OPEN_ALWAYS` 会因"无法在目录中创建文件"而失败**。这不是缺陷，而是设计意图——Recorder 只能写**预建的段文件**。这也解释了为什么 v5.1 §4.7 要先 `seed` 再授权。

---

## 3. 对实现的硬约束

```text
✅ 允许：CreateFileW(path, FILE_APPEND_DATA | SYNCHRONIZE, ..., OPEN_EXISTING, ...)
        → 拿到句柄后 WriteFile 永远追加；SetEndOfFile / SetFilePointer 覆盖均无效
❌ 禁止：cmd 的 ">>" 重定向、Add-Content、Out-File -Append、[IO.File]::AppendAllText、
        FileStream(path, FileMode.Append, FileAccess.Write)
        —— 这些按 GENERIC_WRITE 申请，需要 FILE_WRITE_DATA，与"只追加"设计冲突
```

**理由**：`GENERIC_WRITE` 展开后同时包含 `FILE_WRITE_DATA` 与 `FILE_APPEND_DATA`；我们只给后者，所以任何请求前者的工具都会 `ERROR_ACCESS_DENIED`。

**这也意味着**：Recorder 不能依赖"随便找个日志库"。实现必须是显式的 append-only 打开，并且要有单元测试覆盖"故意 seek 到 0 写也不覆盖"。

---

## 4. A1 / A1′ 的拆分（Observer 要求）

| ID | 类别 | 动作（以 `pae-recorder`） | 期望 | 判定 |
| --- | --- | --- | --- | --- |
| **A1** | 真实追加 | `CreateFileW(FILE_APPEND_DATA)` + `WriteFile` 一行 JSON | 成功，行数 +1 | 退出码 `0` **且** 控制器复核行数 |
| **A1′a** | 普通写入（预期失败） | `cmd /c echo x>>D:\PAE\audit\events-0001.jsonl` | 失败 | 退出码 `10`（ACL 拒绝）**或** `1`（cmd 层报错，需附错误文本） |
| **A1′b** | 普通写入（预期失败） | `Add-Content -LiteralPath … -Value 'x'` | 失败 | `10` |
| **A1′c** | 普通写入（预期失败） | `[IO.File]::AppendAllText(path,'x')` | 失败 | `10` |
| **A9** | 正向读取 | `Get-Content … -TotalCount 1` | 成功 | `0` |

### 4.1 判据里必须写清的一句话

> **A1′ 失败 = 工具链按预期被挡，不作为"隔离成立"的证据；A1′ 成功 = 隔离失败（说明 ACL 多给了 `WD`）。**

这条要贴在测试脚本头部，防止后人把两者混为一谈。

### 4.2 为什么 A1′ 的失败码可能不是 10

`cmd` 的重定向失败发生在 `cmd` 内部，它可能直接把错误写 stderr 并以 `1` 退出，而不是把 `ERROR_ACCESS_DENIED` 透传给调用方。所以 A1′a 的判据是"**非 0 且 stderr 含 `Access is denied`/`拒绝访问`**"，A1′b/c 才是"等于 10"。**这就是"区分权限拒绝与其它错误"的具体落法**：不能用一个统一码糊过去。

---

## 5. 与 A2–A8 的边界（不回退已有设计）

| ID | 内容 | 相对 v5.1 |
| --- | --- | --- |
| A2 | 偏移写被拒（`FileAccess.ReadWrite`） | 不变，期望 `10` |
| A3 | 截断被拒（`FileMode.Truncate` / `SetEndOfFile`） | 不变，期望 `10`；**句柄层的证据已有（T3）** |
| A4 | 删除被拒（`[IO.File]::Delete`） | 不变，期望 `10` |
| A5 | 改名/替换被拒 | 不变，期望 `10` |
| A6 | 改 ACL 被拒（`Set-Acl`） | 不变，期望 `10` |
| A7 | 建文件被拒（缺 `WD`） | 不变，期望 `10` |
| A8 | 建子目录被拒（缺 `AD`） | 不变，期望 `10` |

---

## 6. 尚未解决

| # | 事项 | 为什么还没解决 |
| --- | --- | --- |
| U1 | 普通 API 到底申请什么访问权 | 需要受限账户才能观察到"被拒"，本机全权身份测不出来（A1′ PLANNED） |
| U2 | Recorder 打开不存在的段文件时的确切错误码 | 取决于目录 ACL 与 `OPEN_ALWAYS` 的组合，A7 会覆盖 |
| U3 | 多进程并发追加是否有交错风险 | `FILE_APPEND_DATA` 保证单次写入原子性到 EOF，但大记录跨多次写仍可能交错 → 需要"一行一次 WriteFile"的实现约束（记入实现要求，未测） |
| U4 | 段文件轮转的原子性 | 轮转由用户任务执行，Recorder 无 `WD`/`DE`，轮转期间可能短暂打开失败 → 需要"双段文件 + 指针切换"设计（未设计） |

---

## 7. 状态

| 项 | 等级 |
| --- | --- |
| append-only 句柄语义（追加落 EOF、截断被拒） | **VERIFIED（本机实测）** |
| Recorder 用 `FILE_APPEND_DATA` 的实现路径 | **DESIGNED**（探针已证明可行） |
| ACL 层是否真的只给了 `AD` | **PLANNED**（A1′/A2–A9） |
| 并发/轮转 | **未设计**（U3/U4） |

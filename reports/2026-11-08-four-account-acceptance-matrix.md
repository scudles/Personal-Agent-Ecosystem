# 四账户隔离验收矩阵（测试准备，未执行）

日期：2026-11-08｜作者：Hermes｜状态：**全部 PLANNED**（除已在 §0 列出的 VERIFIED 前置事实）
关联：[W-1 v5.1](2026-11-08-w1-account-poc-plan-v5.1.md)、[R9 报告](2026-11-08-r9-append-report.md)、[V25 设计](2026-11-08-v25-user-rights-safety.md)

---

## 0. 本矩阵的用途与边界

Observer 的要求是：**证明系统能阻止不该发生的事**，而不只是证明预期功能能跑。所以每一条都写成"**谁、对什么、做什么、必须被拒**"，而不是"功能是否可用"。

状态口径：

| 等级 | 含义 | 本矩阵里的分布 |
| --- | --- | --- |
| **VERIFIED** | 有真实运行证据 | 仅前置事实（见 §1），**没有一条隔离验收** |
| **DESIGNED** | 测试方法已定义、可执行 | 控制流程、判据、证据格式 |
| **PLANNED** | 待账户/ACL 就绪才能跑 | 全部 X 系列 |
| **BLOCKED** | 依赖未实现组件 | 审计链检出、失败关闭端到端 |

**判据一律写成"精确等于预期退出码"**（0=成功／10=ACL 拒绝／11=路径不存在／12=参数错／13=其它／`0x80070569`=登录类型未授予）。**禁止"非零即通过"。**

---

## 1. 已 VERIFIED 的前置事实（不是隔离结论）

| # | 事实 | 证据 |
| --- | --- | --- |
| P1 | `pae-*` 账户数 = 0 | `Get-LocalUser` 过滤 |
| P2 | `D:\PAE`、`D:\PAE-acl-backup` 不存在 | 目录检查 |
| P3 | `D:\` 根继承 `Authenticated Users:(M)` | `icacls D:\` |
| P4 | DSH 安装目录无 `Users:(RX)` | `icacls …\DeepSeek Harness` |
| P5 | `WD`=建文件、`AD`=建子目录、`(IO)`=仅继承 | `icacls /?` 原文 |
| P6 | append-only 句柄不能覆盖/截断 | `append_probe.py` T1–T3 |
| P7 | 未提权无法 `secedit /export` | exit 740 |

> 这些只说明"设计的假设是真的"，**不说明任何隔离已生效**。

---

## 2. A 区：跨账户私人目录访问拒绝

| ID | 身份 | 目标 | 动作 | 期望 | 状态 |
| --- | --- | --- | --- | --- | --- |
| X-A1 | pae-hermes | `D:\PAE\runtime\dsh-home` | 列目录 | 拒（10） | PLANNED |
| X-A2 | pae-dsh | `D:\PAE\runtime\hermes-home` | 列目录 | 拒（10） | PLANNED |
| X-A3 | pae-hermes | `D:\PAE\runtime\dsh-home\probe.txt`（预置） | 读文件 | 拒（10） | PLANNED |
| X-A4 | pae-dsh | `D:\PAE\runtime\hermes-home\probe.txt` | 读文件 | 拒（10） | PLANNED |
| X-A5 | pae-hermes | `D:\HermesAgent\Data\profiles` | 列目录 | 拒（10） | PLANNED |
| X-A6 | pae-dsh | `D:\HermesAgent\Data\profiles` | 列目录 | 拒（10） | PLANNED |
| X-A7 | pae-hermes | `C:\Users\Administrator\.dsh` | 列目录 | 拒（10） | PLANNED |
| X-A8 | pae-dsh | `C:\Users\Administrator\.dsh` | 列目录 | 拒（10） | PLANNED |

**反向断言（不许出现）**：任何一条返回 `0`。若出现，先怀疑 ACL 没生效（继承未切断），不要先怀疑测试。

---

## 3. B 区：运行时 Home 隔离

| ID | 身份 | 动作 | 期望 | 状态 |
| --- | --- | --- | --- | --- |
| X-B1 | pae-hermes | 在 `hermes-home` 建目录+写文件+改名 | 全成功（0） | PLANNED |
| X-B2 | pae-dsh | 在 `dsh-home` 建目录+写文件+改名 | 全成功（0） | PLANNED |
| X-B3 | pae-dsh | 在 `hermes-home` 建文件 | 拒（10） | PLANNED |
| X-B4 | pae-hermes | 在 `dsh-home` 建文件 | 拒（10） | PLANNED |
| X-B5 | pae-recorder / pae-anchor | 在两个 home 建文件 | 拒（10） | PLANNED |
| X-B6 | pae-hermes | 启动后 `whoami` + 打印 `HERMES_HOME` | 输出 `pae-hermes` 与自家路径 | PLANNED |

**注意 X-B6**：只验身份与变量，不启动真实模型（`gateway status` 之类不产生费用，但需单独确认）。

---

## 4. C 区：审计文件追加权限（Recorder）

| ID | 身份 | 动作 | 期望 | 备注 | 状态 |
| --- | --- | --- | --- | --- | --- |
| X-C1 | pae-recorder | `CreateFileW(FILE_APPEND_DATA)` 追加一行 | 0（成功） | A1 | PLANNED |
| X-C2 | pae-recorder | `cmd echo >>` | 非 0 且 stderr 含拒绝 | A1′a，**不作隔离证据** | PLANNED |
| X-C3 | pae-recorder | `Add-Content` | 10 | A1′b | PLANNED |
| X-C4 | pae-recorder | `[IO.File]::AppendAllText` | 10 | A1′c | PLANNED |
| X-C5 | pae-recorder | 偏移写（`FileAccess.ReadWrite`） | 10 | A2 | PLANNED |
| X-C6 | pae-recorder | 截断（`FileMode.Truncate`） | 10 | A3 | PLANNED |
| X-C7 | pae-recorder | 删除段文件 | 10 | A4 | PLANNED |
| X-C8 | pae-recorder | 改名为 `evil.jsonl` | 10 | A5 | PLANNED |
| X-C9 | pae-recorder | `copy /y shared\probe.txt → 段文件` | 10 | A5 | PLANNED |
| X-C10 | pae-recorder | `Set-Acl` / `icacls /grant` | 10 | A6 | PLANNED |
| X-C11 | pae-recorder | 在 `audit` 建新文件 | 10 | A7（缺 `WD`） | PLANNED |
| X-C12 | pae-recorder | 在 `audit` 建子目录 | 10 | A8（缺 `AD`） | PLANNED |
| X-C13 | pae-recorder | 读明细首行 | 0（允许） | A9 | PLANNED |
| X-C14 | pae-hermes / pae-dsh | 读 `audit` 任何内容 | 10（**连读都没有**） | — | PLANNED |

**核心断言**：X-C1 与 X-C11 必须同时成立——**能追加、但不能造新文件**。这两条一起才说明 `AD` 落在了"文件"而不是"目录"上。

---

## 5. D 区：Anchor 对审计链的读取与追加

| ID | 身份 | 动作 | 期望 | 状态 |
| --- | --- | --- | --- | --- |
| X-D1 | pae-anchor | 读 `audit\events-0001.jsonl` | 0 | PLANNED |
| X-D2 | pae-anchor | 用 `FILE_APPEND_DATA` 追加 checkpoint | 0 | PLANNED |
| X-D3 | pae-anchor | 改 `audit` 明细（偏移写） | 10 | PLANNED |
| X-D4 | pae-anchor | 删 `audit` 明细 | 10 | PLANNED |
| X-D5 | pae-anchor | 在 `audit` 建新文件 | 10 | PLANNED |
| X-D6 | pae-recorder | 读 `audit-anchor` | 10（**deny F**） | PLANNED |
| X-D7 | pae-recorder | 追加调用 checkpoint | 10 | PLANNED |
| X-D8 | pae-recorder | 删 checkpoint | 10 | PLANNED |
| X-D9 | 双方 | `icacls <对方目录> /grant` | 均 10 | PLANNED |

**X-D1 的意义**：这条是 v3 判据表缺陷的回归测试——早期设计把 `audit` 的读一律写成"拒绝"，会连 Anchor 的合法读取一起否掉。

---

## 6. E 区：用户与 Agent 的权限边界

| ID | 身份 | 动作 | 期望 | 状态 |
| --- | --- | --- | --- | --- |
| X-E1 | 用户 | 读/写 `audit`、`audit-anchor` | 全部成功 | PLANNED |
| X-E2 | 用户 | 追加 checkpoint | 成功 | PLANNED |
| X-E3 | 用户 | 读 `PAE-verify` 结果文件 | 成功 | PLANNED |
| X-E4 | 四个账号 | 写 `PAE-verify` / `PAE-acl-backup` | 全 10 | PLANNED |
| X-E5 | 用户 | 修改任一 `pae-*` 的 ACL | 成功（这是管理权） | PLANNED |
| X-E6 | 用户 | 删除 `pae-recorder` 的段文件 | 成功（这是最高权限的**事实**，不美化） | PLANNED |

**X-E6 是刻意的**：它证明"管理员仍可毁掉一切"。这条必须写进报告，不能只写"隔离很强"。

---

## 7. F 区：失败回滚与孤儿 SID

| ID | 内容 | 判据 | 状态 |
| --- | --- | --- | --- |
| X-F1 | 演练：改坏 Owner/ALLOW/DENY/继承 → `/restore` | 恢复后四项全等（含 `AreAccessRulesProtected`） | PLANNED |
| X-F2 | 六个目标逐一 `acl-after.xml` vs `acl-before.xml` | `Compare-Object` 零差异 | PLANNED |
| X-F3 | 孤儿 SID 扫描 | `Translate` 失败的 SID 全部列出，且**均为预期内的空集** | PLANNED |
| X-F4 | 建号失败逆序回滚 | `Remove-LocalUser` 后 `pae-*` 数量 = 0 | PLANNED |
| X-F5 | 回滚中途人为失败 | 立即停止，不再执行后续；状态可解释 | PLANNED |
| X-F6 | 账户禁用/启用状态机 | 隔离未完成前 `Enabled=False` | PLANNED |

---

## 8. 依赖顺序（不许乱）

```text
建号(禁用) → 备份/快照 → 目录+ACL → V25 登录权 → 启用账户 → V26 控制器
   → A 区 → B 区 → C 区 → D 区 → E 区 → F 区（F 可与 E 并行，但必须在启用前后各跑一次）
   → AC-5 检出档（BLOCKED：需 verify_audit 实现）
```

不允许跳过 A/B 直接跑 C/D——因为审计目录的隔离依赖"home 与运行时授权正确"这一前提；前提错了，C/D 的失败原因无法归因。

---

## 9. 证据格式（每条测试都要留）

```json
{"test":"X-C11","account":"pae-recorder","expect":10,"actual":10,"pass":true,
 "cmd":"powershell -File a7.ps1","stderr":"","ts":"2026-11-08T…","controller":"user"}
```

规则：
1. `actual` 必须来自 `LastTaskResult`（OS 记录），不是被测脚本自述的"我失败了"；
2. `expect` 与 `actual` **精确相等**才算通过；
3. `pass=false` 的记录同样要留，不许只存成功的；
4. 汇总报告里 PASS/FAIL 计数必须能由这些记录机械算出来——不能手写。

---

## 10. 汇总口径

| 区 | 条数 | 已 VERIFIED | 说明 |
| --- | --- | --- | --- |
| A 跨账户私人目录 | 8 | 0 | |
| B 运行时 home | 6 | 0 | |
| C 审计追加 | 14 | 0 | 句柄语义另有 3 条 VERIFIED（不属本区） |
| D Anchor 独立性 | 9 | 0 | |
| E 用户/Agent 边界 | 6 | 0 | |
| F 回滚与孤儿 SID | 6 | 0 | |
| **合计** | **49** | **0** | 全部 PLANNED |

**这张表目前是 0/49。** 写在这里，是为了防止下一次有人把"设计完备"读成"验收通过"。

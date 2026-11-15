# W-1 实施方案 v5.1：Windows 独立账户 PoC（仅方案，未执行）

日期：2026-11-08（v5.1，按 Observer 第四轮 P0/P1 最小幅修订）
作者：Hermes｜审阅：ChatGPT Observer / 用户（待）
状态：**方案稿。未创建账户、未修改任何 ACL、未改登录权、未启停账户、未装软件、未起 Agent、未调模型、费用 0。**
基线：[v5](2026-11-08-w1-account-poc-plan-v5.md)（未改动，保留审查证据）。本文只替换 v5 中受影响的章节，其余照 v5。

---

## 0. 口径、边界、以及本轮到底验了什么

| 等级 | 定义 | 本轮归属 |
| --- | --- | --- |
| **VERIFIED（本机实测）** | 有原始输出 | ①`icacls /?` 的 WD/AD/OI/CI/IO 语义；②Step 包装器的 T1–T5 自测；③`Get-LocalUser` 无 `pae-*`；④`D:\` 根继承 ACE；⑤`Start-Process` 可用参数 |
| **DESIGNED** | 设计完整、未实施 | 权限矩阵、控制器、快照/恢复、暴露窗口顺序 |
| **PLANNED** | 验收方法明确、未执行 | A1–A9、B1–B6、C1–C4、V1–V26 |
| **BLOCKED** | 依赖未实现组件 | AC-5 检出档（V19）、C1–C4 端到端、HMAC |

> **本轮没有任何 Windows 权限边界被验证。** A/B 测试一条都没跑，因为它们需要四个真实账户。文档自检通过 ≠ 运行验收通过。

---

## 1. 修订项 ↔ 原文位置对照

| Observer 项 | 打在 v5 的哪一节 | 本文哪一节 | 改了什么性质的东西 |
| --- | --- | --- | --- |
| **P0-1** 登录策略与控制器冲突 | §5.1 测试控制器 | §4 | **推翻原方案**：`Start-Process -Credential` 作废，改计划任务 + 批处理登录 |
| **P0-2** Step 吞中间失败 | §4.1 `Step` | §5 | **推翻原方案**：`$LASTEXITCODE` 后置检查作废，改逐命令 `Invoke-NativeChecked`（已实测复现旧 bug） |
| **P0-3** 快照不含目录自身 | §9.1 `Snapshot` | §6 | 补：目标自身先行、Owner/继承标志、完整 SDDL 比对、不可恢复项清单 |
| **P0-4** 暴露窗口 | §4.3 建号 | §7 | 补：建号即禁用 → 全部就绪 → 最后启用 |
| **P1-1** 退出码 | §6.1 测试 | §8.1 | 新增退出码分类表（拒绝/路径/登录/其他分开） |
| **P1-2** 回滚顺序 | §4.3 `Sort-Object -Descending` | §8.2 | 改为按创建记录逆序 |
| **P1-3** ACL-17 无命令 | §3 矩阵 | §3/§8.3 | 标 `REFERENCE_ONLY`；自检器区分三类 |
| **P1-4** 编号不一致 | §0 | §0/§10 | §0 原文写「V1–V21」，实为 V1–V26，已改 |
| **P1-5** WORKSTREAMS 同步 | `WORKSTREAMS.md` | §8.5 | 两账号 → 四账号；授权状态不动 |
| **三** ACL 语义纠正 | §7.2 / §3 / §6 | §2 | **我的解释错了**：目录的 `AD` 是建子目录，不是建文件 |

---

## 2. ACL 语义纠正（Observer 反证成立，我接受）

**本机 `icacls /?` 原文**（`%TEMP%\icacls_help.txt` 第 102–103 行）：

```
WD - 写入数据/添加文件
AD - 附加数据/添加子目录
```

对应到 Windows 权限位：

| 位 | 常量 | 在**文件**上 | 在**目录**上 |
| --- | --- | --- | --- |
| `WD` | `FILE_WRITE_DATA` / `FILE_ADD_FILE` | 偏移写数据 | **创建文件** |
| `AD` | `FILE_APPEND_DATA` / `FILE_ADD_SUBDIRECTORY` | **末尾追加** | **创建子目录** |
| `R` | `FILE_READ_DATA` / `FILE_LIST_DIRECTORY` | 读 | 列目录 |

**我 v4/v5 错在哪**：写了「目录的 `AD` = 建文件」。**错的**。建文件要 `WD`，建子目录才是 `AD`。
**结论没变但理由变了**：v5 对 `audit` 目录只给了 `R`（既无 `WD` 也无 `AD`），所以两条路都堵住了——**是碰巧对，不是我论证对**。这一点必须写清，否则后来者会按错误理解去放宽。

### 2.1 由此暴露的一个真问题（新风险 R9）

Recorder 只有文件级 `AD`（`FILE_APPEND_DATA`），**没有 `WD`**。而大量常规工具打开文件时要 `GENERIC_WRITE`（= `WD`+`AD`+…），会被直接拒。

- `cmd` 的 `>>` 重定向、`[IO.File]::Open($f,'Append','Write')`、`Add-Content` 都按 `GENERIC_WRITE` 申请 → **很可能失败**；
- 正确姿势是用 `FILE_APPEND_DATA | SYNCHRONIZE` 打开（P/Invoke `CreateFileW`）。

**影响**：Recorder 的实现必须是"append-only 打开"，不能用现成的高层写文件 API。这不是缺陷，是约束——但必须在 A1 里用 P/Invoke 验证，**不能用 `echo >>` 当 A1**（那样测出来的是工具链限制，不是权限边界）。

A1 因此拆成 A1（P/Invoke 追加，应成功）与 A1′（`echo >>`，预期失败，仅记录工具链行为，不作为隔离判据）。

---

## 3. 更新后的权限矩阵（含类别列）

| ID | 路径 | 用户 | hermes | dsh | recorder | anchor | 命令 | 验收 | 类别 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACL-01 | `D:\PAE` | F | — | — | — | — | C01 | V4 | IMPL |
| ACL-02 | `runtime\hermes-home` | F | **F** | deny F | deny F | deny F | C02 | V4,V8,V18 | IMPL |
| ACL-03 | `runtime\dsh-home` | F | deny F | **F** | deny F | deny F | C03 | V4,V9,V19 | IMPL |
| ACL-04 | `shared` | F | RX+封写 | RX+封写 | RX+封写 | RX+封写 | C04 | V5,V6,V7 | IMPL |
| ACL-05 | `policy` | F | RX+封写 | RX+封写 | RX+封写 | RX+封写 | C05 | V5,V6,V7 | IMPL |
| ACL-06 | `logs` | F | RX+封写 | RX+封写 | RX+封写 | RX+封写 | C06 | V5,V6,V7 | IMPL |
| ACL-07 | `audit`（目录） | F | deny F | deny F | **R（无 WD 无 AD）** | **R** | C07 | V10,V11 | IMPL |
| ACL-07b | `audit\*.jsonl` | F | 被拒 | 被拒 | **`(OI)(IO)(AD)` → 文件 `R,AD`** | R | C17 | V12 | IMPL |
| ACL-08 | `audit-anchor`（目录） | F | deny F | deny F | **deny F** | **R（无 WD 无 AD）** | C08 | V13 | IMPL |
| ACL-08b | `audit-anchor\*.jsonl` | F | 被拒 | 被拒 | 被拒 | **`R,AD`** | C18 | V13 | IMPL |
| ACL-09 | `D:\PAE-verify` | F | deny F | deny F | deny F | deny F | C09 | V23 | IMPL |
| ACL-10 | `D:\PAE-acl-backup` | F | deny F | deny F | deny F | deny F | C10 | V3,V23 | IMPL |
| ACL-11 | `Data\profiles` | 不变 | **deny F** | **deny F** | deny F | deny F | C11 | V14 | IMPL |
| ACL-12 | `C:\Users\Administrator\.dsh` | 不变 | **deny F** | **deny F** | deny F | deny F | C12 | V15 | IMPL |
| ACL-13 | `Data\tools` / `D:\HermesAgent\Source` | 不变 | **RX + 封写** | — | — | — | C13 | V20 | IMPL |
| ACL-14 | `Data\installs` | 不变 | **RX + 封写**（+ 禁 pyc） | — | — | — | C14 | V21 | IMPL |
| ACL-15 | `…\Programs\DeepSeek Harness` | 不变 | — | **RX + 封写** | — | — | C15 | V22 | IMPL |
| ACL-16 | `config.yaml`/`.env`/`auth.json` | 不变 | **deny F** | **deny F** | deny F | deny F | C16 | V16 | IMPL |
| ACL-17 | `D:\HermesAgent\Data`（根） | 保持原样 | — | — | — | — | — | — | **REFERENCE_ONLY** |

**"封写"** = `(OI)(CI)(WD,AD,WEA,WA,DE,DC,WDAC,WO)` 的账号级 deny（不 deny 组，否则会打到用户自己）。

**ACL-17 为什么是 `REFERENCE_ONLY`**：`Data` 根是 Hermes 运行时的祖先，在它上面加 deny 会连 `installs`/`tools` 一起锁死。它只作为"继承源"被引用，**有意不改**。自检器现在区分 `IMPL` 与 `REFERENCE_ONLY`，`REFERENCE_ONLY` 允许没有命令与验收，前提是矩阵里显式标注（且不许偷偷引用命令）。

---

## 4. P0-1：测试控制器重设计（Task Scheduler + 批处理登录）

### 4.1 冲突确认

`Start-Process -Credential` 走 `CreateProcessWithLogonW`，登录类型是 **`LOGON32_LOGON_INTERACTIVE`**；一旦配了 `SeDenyInteractiveLogonRight`，它会以 `0x80070569`（"尚未授予该用户请求的登录类型"）失败。**Observer 的冲突判断成立**，v5 §5.1 那套作废。

### 4.2 新方案

| 环节 | 做法 |
| --- | --- |
| 运行被测动作 | `schtasks /create /tn PAE-T-<id> /tr "<exe> <args>" /ru <account> /rp <pwd> /sc once /st 23:59 /f`，然后 `schtasks /run` |
| 登录类型 | 计划任务用**批处理登录**（`SeBatchLogonRight`），不碰交互登录 |
| 收结果 | 控制器轮询 `Get-ScheduledTaskInfo -TaskName ...` 的 `LastTaskResult`（= 进程退出码；`267009` = 仍在运行） |
| 落盘 | **控制器**（用户身份）把 `LastTaskResult` 写 `D:\PAE-verify\`；被测账号全程不写盘 |
| 清理 | 每次测试后 `schtasks /delete /f`，不留常驻任务 |

**前置依赖（顺序不能反）**：`SeBatchLogonRight` **不是标准用户默认拥有的**（默认只有 Administrators / Backup Operators 等）。所以 **V25（登录权）必须先于 V26（控制器）**，且 V25 不只是"禁止"三类登录，还要**显式授予批处理登录**：

```
SeDenyInteractiveLogonRight        = *SID…   （四个账号）
SeDenyRemoteInteractiveLogonRight  = *SID…
SeDenyNetworkLogonRight            = *SID…
SeBatchLogonRight                  = *SID…   ← 必须给，否则任务起不来
```

配置方式：`secedit /export /cfg tmp.inf` → 编辑 `[Privilege Rights]` → `secedit /configure /db ... /cfg tmp.inf /areas USER_RIGHTS` → `gpupdate /force`。属系统变更，需单独授权。

### 4.3 为什么这样就不会把失败伪装成成功

- 控制器只信 `LastTaskResult`（由 OS 记录），不信被测进程的自述；
- 任务失败（登录被拒等）会表现为 `0x8007xxxx`，与"权限拒绝"的 `10` 在数值上可区分（见 §8.1），不会混为一谈；
- 被测账号对 `D:\PAE-verify` 与 `D:\PAE-acl-backup` 都没有任何权限（ACL-09/10），改不了成绩单。

**残余依赖**：`LastTaskResult` 对超过 32 位的 HRESULT 会保留原值，判据表按"精确等于预期码"而不是"非零即失败"来做，避免误读。

---

## 5. P0-2：Step 包装器重写（已在本机实测复现并修好）

### 5.1 旧写法的问题（实测）

v5 §4.1 的 `Step` 只在**整个 block 结束后**看 `$LASTEXITCODE`；中间那条失败会被后一条成功覆盖。本机实测（`%TEMP%` 下临时脚本，非项目文件）：

```
== T1 旧写法：第一条失败 + 第二条成功 ==
PASS compose-naive          ← 明明第一条 exit=1，仍被判成功
== T2 新写法：同一组命令 ==
  -> STEP 'compose-new' ABORTED: native-fail: cmd /c exit 1 exit=1
== T3 新写法：全部成功 ==
PASS all-ok
== T4 新写法：第二条失败（后续条被跳过）==
  -> STEP 'tail-fail' ABORTED: native-fail: cmd /c exit 7 exit=7 ; 已执行序号=0
== T5 Cmdlet 失败也要中止 ==
  -> STEP 'cmdlet-fail' ABORTED: 找不到路径…Z:\definitely\missing
```

**T1 就是 Observer 说的那个 bug，用真实运行证明了它存在。**

### 5.2 新写法（v5.1 起唯一允许的写法）

```powershell
$ErrorActionPreference = 'Stop'

# 唯一的原生命令入口：每次调用后立刻判退出码，失败立即 throw
function Invoke-NativeChecked([string]$exe, [string[]]$args) {
  $out = & $exe @args 2>&1
  $code = $LASTEXITCODE
  $out | Tee-Object -Append $env:OPLOG | Out-Null
  if ($code -ne 0) { throw "native-fail: $exe $($args -join ' ') exit=$code" }
  return $code
}

# Step 只做语义分组；一旦内部 throw，后面的命令根本不会执行
function Step([string]$name, [scriptblock]$block) {
  try { & $block } catch { throw "STEP '$name' ABORTED: $($_.Exception.Message)" }
  "STEP '$name' OK" | Tee-Object -Append $env:OPLOG | Out-Null
}
```

**规则（写死，防退化）**：
1. **一个 Step 里禁止出现裸原生命令**，一律走 `Invoke-NativeChecked`；
2. 不允许在 Step 结束时再判 `$LASTEXITCODE`（那是被覆盖过的值）；
3. Cmdlet 靠全局 `-ErrorAction Stop`；
4. 想"允许失败"的命令必须显式 `try { Invoke-NativeChecked ... } catch { }` 并说明理由，默认不允许吞。

---

## 6. P0-3：快照 / 恢复完整化

### 6.1 快照必须包含目标自身

v5 的 `Snapshot` 只递归子项，**漏了目标目录自己**（它的 Owner 与继承标志恰恰是最容易被改的）。v5.1 改为：

```powershell
function Snapshot([string]$path, [string]$out) {
  $items = @()
  # 1) 目标自身先来
  $items += [pscustomobject]@{ Path = $path; Self = $true;  Owner = (Get-Acl -LiteralPath $path).Owner
                               SDDL = (Get-Acl -LiteralPath $path).Sddl
                               InheritProtected = (Get-Acl -LiteralPath $path).AreAccessRulesProtected
                               RuleCount = (Get-Acl -LiteralPath $path).Access.Count }
  # 2) 再递归（读错误一律抛出，不吞）
  Get-ChildItem -LiteralPath $path -Recurse -Force -ErrorAction Stop | ForEach-Object {
    $a = Get-Acl -LiteralPath $_.FullName -ErrorAction Stop
    $items += [pscustomobject]@{ Path = $_.FullName; Self = $false; Owner = $a.Owner; SDDL = $a.Sddl
                                 InheritProtected = $a.AreAccessRulesProtected; RuleCount = $a.Access.Count }
  }
  $items | Export-Clixml $out
}
```

**记录字段**：`Owner`、完整 `SDDL`（含 DACL 与继承标志）、`AreAccessRulesProtected`（是否切断继承）、`RuleCount`（ACE 条数，防"SDDL 相同但 ACE 被折叠"）。

### 6.2 比对必须是逐项全等

```powershell
function CompareSnap($before, $after) {
  $b = Import-Clixml $before; $a = Import-Clixml $after
  if ($b.Count -ne $a.Count) { throw "条目数不同: $($b.Count) vs $($a.Count)" }
  $diff = Compare-Object $b $a -Property Path,Owner,SDDL,InheritProtected,RuleCount
  if ($diff) { $diff | Format-Table -AutoSize | Out-String | Write-Host; throw "SDDL/Owner 不一致 $($diff.Count) 处" }
  'SNAPSHOT MATCH (Owner + SDDL + 继承标志 + ACE 数)'
}
```

**演练必须真的改坏四处**（不只加 DENY）：改 Owner、加 ALLOW、加 DENY、把继承从"切断"改回"继承"，恢复后四样都要回到原值。

### 6.3 明确列出**无法**用 `icacls /save` 完整恢复的东西（不宣称完整恢复）

| 项 | icacls /save 是否含 | 说明 |
| --- | --- | --- |
| DACL（含继承标志） | **含** | 主路径 |
| Owner | **不含** | icacls 只存 DACL；Owner 变更需 `icacls /setowner` 或 `Set-Acl -AclObject`，且常需 `SeRestorePrivilege` |
| SACL（审计 ACE） | **不含** | 需 `SeSecurityPrivilege` 单独导出（`Get-Acl -Audit`） |
| 完整性级别（IL） | **不含** | 需 `icacls /setintegritylevel` 或 `Set-Acl` 单独处理 |
| 显式 ACE 的"仅继承"标志 | 部分 | SDDL 里有 `ID` 标志位，但跨版本行为可能不同，故用 SDDL 全等比对而非"看起来对" |

**因此本方案的可承诺范围**：**DACL + 继承状态**可完整恢复并逐项校验；**Owner 可校验但需额外命令恢复**（v5.1 起纳入恢复步骤）；**SACL 与 IL 不在承诺内**，PoC 期间不修改这两项（若将来要改，需先补恢复方案）。

### 6.4 正式回滚：六个目标各自的命令与路径映射

| 目标 | 备份文件 | 保存时目录 | 恢复命令 |
| --- | --- | --- | --- |
| `D:\HermesAgent\Data\profiles` | `profiles.acl` | `D:\` | `cd D:\; icacls "D:\" /restore "…\profiles.acl"` |
| `D:\HermesAgent\Data` | `dataroot.acl` | `D:\` | `cd D:\; icacls "D:\" /restore "…\dataroot.acl"` |
| `C:\Users\Administrator\.dsh` | `dshhome.acl` | `C:\` | `cd C:\; icacls "C:\" /restore "…\dshhome.acl"` |
| `…\Data\config.yaml` | `config.acl` | `D:\` | `cd D:\; icacls "D:\" /restore "…\config.acl"` |
| `…\Data\.env` | `env.acl` | `D:\` | `cd D:\; icacls "D:\" /restore "…\env.acl"` |
| `…\Data\auth.json` | `auth.acl` | `D:\` | `cd D:\; icacls "D:\" /restore "…\auth.acl"` |

**`/save` 记录的是相对当前目录的路径**——存与恢复必须在同一盘符根，这点 v5 已写、此处再钉一次。每个目标恢复后立刻 `CompareSnap`，任一失败**立即停止**，不再继续后面的目标。

---

## 7. P0-4：消除暴露窗口

问题：账号一建出来就有密码、能登录，而隔离还没配完。

**修正后的顺序（v5.1 起强制）**：

| 步 | 动作 | 账户状态 |
| --- | --- | --- |
| 1 | 建 4 个账号，**建完立刻 `Disable-LocalUser`** | 禁用 |
| 2 | 校验 `Enabled=False` ×4 | 禁用 |
| 3 | 备份 6 目标 + 快照（ACL 还没动，备份干净） | 禁用 |
| 4 | 建目录 + 切继承 + 按矩阵授权 + 段文件 + 传播 | 禁用 |
| 5 | 配置登录权（V25：禁三类 + 授批处理） | 禁用 |
| 6 | **启用** 4 个账号 | 启用 |
| 7 | 验证控制器可用（V26） | 启用 |
| 8 | 跑 A/B/V 系列验收 | 启用 |

```powershell
# 第 1 步末尾
foreach ($n in $names) { Disable-LocalUser -Name $n }
# 第 2 步校验
if ((Get-LocalUser $names | Where-Object Enabled).Count -ne 0) { throw '有账户仍启用' }
```

**理由**：禁用状态下 ACL 照样能配（ACL 是按 SID 记的），登录权也能配（按 SID）。所以完全没必要让"半隔离"的账号处于可登录状态。任一步失败 → 按 §8.2 顺序回滚（先禁用全部，再恢复 ACL，最后删号）。

---

## 8. P1 五项

### 8.1 退出码分类（不允许"任意失败=ACL 拒绝"）

被测脚本统一模板：

```powershell
$ErrorActionPreference = 'Stop'
try {
  <被测操作>
  exit 0                       # 成功必须显式 exit 0
} catch [System.UnauthorizedAccessException] { exit 10 }          # ACL 拒绝
  catch [System.IO.FileNotFoundException]    { exit 11 }          # 路径/文件不存在
  catch [System.IO.DirectoryNotFoundException]{ exit 11 }
  catch [System.ArgumentException]           { exit 12 }          # 参数/语法错（测试自身有问题）
  catch { exit 13 }                                               # 其他异常
```

| 码 | 含义 | "应被拒"测试的期望 | "应允许"测试的期望 |
| --- | --- | --- | --- |
| 0 | 操作成功 | **= 隔离失败** | = 通过 |
| 10 | ACL 拒绝 | **= 通过** | = 失败 |
| 11 | 路径/文件不存在 | = 测试无效，**不算通过** | 同左 |
| 12 | 参数错误 | = 测试无效 | = 测试无效 |
| 13 | 其他异常 | = 未定，需人工看 | 同左 |
| `0x80070569` | 登录类型未授予（任务层面） | = **V25 没配好**，不是 ACL 结论 | 同左 |
| `0x80070005` | 任务层面拒绝访问 | 需结合上下文 | 同左 |

判据一律写成"**等于预期码**"，不写"非零即通过"——那是把"登录失败"当成"权限拒绝"的经典错误。

### 8.2 回滚按创建记录逆序（不是名称排序）

v5 的 `$created | Sort-Object -Descending` 是**字符串排序**（`pae-recorder` 会排在 `pae-anchor` 之前），不是创建顺序逆序。改为：

```powershell
for ($i = $created.Count - 1; $i -ge 0; $i--) {
  $n = $created[$i]                       # $created 是 List，按追加顺序
  try { Remove-LocalUser -Name $n -ErrorAction Stop }
  catch { throw "ROLLBACK FAILED: $n : $($_.Exception.Message) —— 立即停止，人工介入" }
}
$left = @(Get-LocalUser | Where-Object Name -like 'pae-*')
if ($left.Count) { throw "回滚不完整，残留 $($left.Name -join ',')" }
```

`$created` 必须是逐条 `+=` 的真实记录；删除失败**直接停**，不继续删后面的（否则残留状态无法解释）。

### 8.3 自检器区分三类

`tools/policy/check_w1_plan.py`（本轮新增，已可运行）：

- **IMPL**：必须有命令 + 验收；
- **REFERENCE_ONLY**：允许没有命令/验收，但**不许引用命令**（防"嘴上说参考、实际偷偷改"）；
- **空壳检测**：`C` 或 `V` 列是空、或只有 `--`，而该行不是 REFERENCE_ONLY → 报缺陷。

### 8.4 编号统一

v5 §0 写的是「A1–A8、B1–B6、C1–C4、V1–V21」，实际已到 V1–V26。v5.1 起统一为 **V1–V26**；`A` 系列因 §2.1 新增 A1′ 与 A9，见 §10。

### 8.5 WORKSTREAMS 同步（不动授权状态）

- `CI-1.1` 标题从「创建 `pae-hermes` / `pae-dsh` 账号」改为四项：`pae-hermes` / `pae-dsh` / `pae-recorder` / `pae-anchor`；
- W-1 实施范围写明"四账号 + 暴露窗口控制"；
- 风险说明补 R9（AD-only 追加工具链）与登录权依赖；
- 加 Observer 审查记录（第四轮）；
- **状态保持 `READY`，不因方案更新变成 `AUTHORIZED`。**

---

## 9. 命令 ↔ 验收对照（更新后）

| 命令 | 覆盖 | 验收 | 备注 |
| --- | --- | --- | --- |
| C01 | ACL-01 | V4 | 建目录 + 切继承 |
| C02 | ACL-02 | V4,V8,V18 | hermes-home（v5 缺的那条） |
| C03 | ACL-03 | V4,V9,V19 | dsh-home |
| C04 | ACL-04 | V5,V6,V7 | shared |
| C05 | ACL-05 | V5,V6,V7 | policy |
| C06 | ACL-06 | V5,V6,V7 | logs |
| C07 | ACL-07 | V10,V11 | audit 目录：只 R |
| C17 | ACL-07b | V12 | `(OI)(IO)(AD)` + `/reset` 传播 |
| C08 | ACL-08 | V13 | anchor 目录 |
| C18 | ACL-08b | V13 | `(OI)(IO)(AD)` + `/reset` |
| C09 | ACL-09 | V23 | verify 目录 |
| C10 | ACL-10 | V3,V23 | 备份目录 |
| C11 | ACL-11 | V14 | profiles |
| C12 | ACL-12 | V15 | `.dsh` |
| C13 | ACL-13 | V20 | tools / Source |
| C14 | ACL-14 | V21 | installs（含 pyc 冲突） |
| C15 | ACL-15 | V22 | DSH 安装目录 |
| C16 | ACL-16 | V16 | 三配置文件 |
| — | ACL-17 | — | `REFERENCE_ONLY` |

---

## 10. 验收清单 V1–V26（更新后）

| V | 内容 | 状态 |
| --- | --- | --- |
| V1 | 四账号为标准用户、SID 互异、**建完即禁用** | PLANNED |
| V2 | 备份 6 对文件齐全 + 条目数匹配（含目标自身） | PLANNED |
| V3 | 备份目录对四账号不可写 | PLANNED |
| V4 | 新目录无 `(I)` 继承 | PLANNED |
| V5 | 只读三目录可读 | PLANNED |
| V6 | 只读三目录写/删/改 ACL 三拒 | PLANNED |
| V7 | 只读三目录不能建文件（缺 `WD`）与建子目录（缺 `AD`） | PLANNED |
| V8 | hermes-home：PH 可写，其余三账号被拒 | PLANNED |
| V9 | dsh-home：PD 可写，其余三账号被拒 | PLANNED |
| V10 | 执行账号对 audit 读也拒 | PLANNED |
| V11 | audit 目录：Recorder 无 `WD` 无 `AD`（建不了文件也建不了目录） | PLANNED |
| V12 | A1、A1′、A2–A9 | PLANNED |
| V13 | B1–B6 | PLANNED |
| V14 | AC-1 `.dsh` 双向拒绝 | PLANNED |
| V15 | AC-2 `profiles` 双向拒绝 | PLANNED |
| V16 | AC-3 三配置文件拒读拒写 | PLANNED |
| V17 | AC-4 启停脚本 | PLANNED |
| V18 | AC-5 拒改档 | PLANNED |
| V19 | AC-5 检出档（`verify_audit`） | **BLOCKED** |
| V20 | Hermes 运行时可用（`import ruamel`） | PLANNED |
| V21 | `installs` 封写后仍能启动（含 pyc 处理） | PLANNED |
| V22 | DSH 运行时可用（`dsh.cmd --version`） | PLANNED |
| V23 | 四账号写不进 verify / backup | PLANNED |
| V24 | 运行时目录写/删/改 ACL 三拒 | PLANNED |
| V25 | 登录权：禁交互/远程/网络 + **授批处理** | PLANNED（需系统授权） |
| V26 | 控制器可用（计划任务 + `LastTaskResult`），**在 V25 之后** | PLANNED |

### 10.1 A/B/C 更新

| ID | 内容 | 相对 v5 的变化 |
| --- | --- | --- |
| A1 | P/Invoke `CreateFileW(FILE_APPEND_DATA)` 追加成功 | **新**（不能用 `echo >>`） |
| A1′ | `cmd /c echo >>` 预期失败 | **新**：记录工具链行为，**不作隔离判据** |
| A2 | 偏移写被拒（`FileAccess.ReadWrite`） | 判据改为退出码 10 |
| A3 | 截断被拒 | 同上 |
| A4 | 删除被拒（`[IO.File]::Delete`） | 同上 |
| A5 | 改名/替换被拒（`[IO.File]::Move` / 覆盖写） | 路径明确为 `events-0001.jsonl` 与 `shared\probe.txt` |
| A6 | 改 ACL 被拒（`Set-Acl`） | 不再用 `takeown` 作判据 |
| A7 | 建文件被拒（缺 `WD`） | **语义纠正** |
| A8 | 建子目录被拒（缺 `AD`） | **语义纠正** |
| A9 | Recorder 读得到明细（正向） | **新**：否则 A1 无法解释 |
| B1–B6 | 不变 | 判据改为退出码 |

---

## 11. 自检脚本与结果（真实输出）

`tools/policy/check_w1_plan.py`：只读解析本文，检查三类 ID 闭合、空壳、孤儿、编号连续性、REFERENCE_ONLY 一致性。

首轮运行结果（真实输出）：

```
矩阵 ACL 19 条 | 命令 16 条 | 验收 26 条
验收区间 V1..V26 连续=True
FAIL
  - ACL-07b: 缺实施命令
  - ACL-08b: 缺实施命令
```

原因：命令编号写成了 `C07b`/`C08b`——**带字母后缀又破坏了 `C\d+` 的编号规则**。这和 v5 那轮 `V5a/V20b` 是同一类错误，说明"人眼过的表不可信"。已改为 `C17`/`C18`，复跑见下。

复跑结果（真实输出）：

```
矩阵 ACL 19 条 | 命令 18 条 | 验收 26 条
验收区间 V1..V26 连续=True
PASS 矩阵/命令/验收三类 ID 闭合，无空命令、无空验收、无孤儿
```

**注意**：这只是"文档闭合"，**不是**权限验收通过。它证明的是"没有哪条 ACL 被漏写命令/漏写验收"，不证明这些命令在 Windows 上真的生效。

**设计要点**：`REFERENCE_ONLY` 行不许引用命令（防"名义参考、实际修改"）；`--` 视作"不适用"而非空白；空串/纯连接符算缺陷。

---

## 12. 工具链自证（Observer 新增的长期要求）

安全验收不能只证明"预期路径能跑通"，还要证明**工具本身不会把失败伪装成成功**：

| 工具 | 它可能怎么骗人 | 本方案的防伪措施 | 证据 |
| --- | --- | --- | --- |
| Step 包装器 | 中间失败被后一条成功覆盖 | `Invoke-NativeChecked` 逐条 immediate check；禁止 Step 末尾再判 | **T1 复现旧 bug / T2 修复**（本机实测） |
| 测试控制器 | 把"登录失败"当"权限拒绝" | 退出码分类 + `0x8007xxxx` 单列 + 精确等于判据 | 设计（PLANNED） |
| 退出码捕获 | 只看非零 | 期望值精确匹配；0 对"应拒"测试 = 失败 | 设计（PLANNED） |
| 备份/恢复 | 只比文件长度、只查 DENY 消失 | Owner+SDDL+继承标志+ACE 数四项全等；演练先改坏四处 | 设计（DESIGNED） |
| 自检脚本 | REFERENCE_ONLY 被当成"已实施" | 三分类 + 空壳检测 + 孤儿检测 | 已对 v5.1 运行 |
| 验收报告生成 | 无证据也写 PASS | 只有 `LastTaskResult == 预期码` 才允许写 PASS；证据列留原始码 | 设计（DESIGNED） |

**自我约束**：本轮我修的两处（`(IO)` 论证、`AD/WD` 语义）都是"结论碰巧对、理由错"，这类问题只有靠反证才暴露。所以 v5.1 把"每个结论必须能指出证据来源"写成硬要求：证据是"文档/帮助文本"还是"实跑输出"，必须标出来。

---

## 13. 剩余风险

| # | 风险 | 等级 | 缓解 | 状态 |
| --- | --- | --- | --- | --- |
| R1 | Recorder 可追加伪造事件 | 中 | Agent 侧 HMAC + 交叉核对 | BLOCKED |
| R2 | 失败关闭仅设计 | 高 | CI-3.1 + C1–C4 反向测试 | BLOCKED |
| R3 | 管理员可绕过 | 结构 | 文档声明 | 已接受 |
| R4 | 轮转需用户预建段文件 | 低 | runbook | 已接受 |
| R5 | `installs` 封写致启动失败 | 中 | `PYTHONDONTWRITEBYTECODE=1`；失败降级 RX-only | PLANNED |
| R6 | ~~`Start-Process -Credential` 被登录策略挡~~ | — | **已由 §4 取代**（改计划任务） | 已消除 |
| R7 | OAuth 凭据共享（P-0） | 中 | API-key 型 provider | 已记录 |
| R8 | 四账号密码管理未定 | 中 | 见 §15 | 待决策 |
| **R9** | **只有 `AD` 时常规追加 API 会失败**（`echo >>`、`Add-Content`、`FileMode.Append`） | 中 | Recorder 必须用 `FILE_APPEND_DATA` 打开；A1/A1′ 分开测 | **新** |
| R10 | `SeBatchLogonRight` 默认不给标准用户 | 中 | V25 显式授予；顺序在 V26 之前 | **新** |
| R11 | `LastTaskResult` 对 HRESULT 的表现需实机确认 | 低 | 判据用精确码；V26 先跑一次空任务校准 | 新 |

---

## 14. 哪些是静态审查、哪些是真跑过

| 内容 | 性质 |
| --- | --- |
| ACL 语义（WD=建文件、AD=建子目录、IO=仅继承） | **实测**：本机 `icacls /?` 原文 |
| Step 包装器会吞中间失败 | **实测**：T1 复现；T2–T5 验证修复 |
| `pae-*` 账户数 0、`D:\PAE` 不存在 | **实测** |
| `D:\` 根继承 `Authenticated Users:(M)` | **实测** |
| `Start-Process` 参数含 Credential/Redirect* | **实测** |
| 计划任务 + `LastTaskResult` 控制器 | **设计**（未运行，需账户） |
| 暴露窗口顺序、快照完整化、退出码分类 | **设计** |
| A/B 全部测试、V1–V26 | **未执行**（PLANNED/BLOCKED） |

---

## 15. 待用户决策（不变，等第五次授权）

| # | 事项 | 建议 |
| --- | --- | --- |
| D-a | 四账号密码存放 | 每账号随机 + Windows 凭据管理器 |
| D-b | 登录权（`secedit`）是否与 ACL 同轮 | 建议同轮，否则 V26 跑不起来 |
| D-c | `installs` 封写失败时的降级 | 退回 RX-only 并如实标注 |
| D-d | 第五次授权范围 | 全量一次做完，任一步失败即停 |

---

**本轮没有做的事**：没建/删账户、没改任何 ACL、没改登录权、没启停账户、没装软件、没起 Agent、没调模型、没产生费用。唯一写盘动作是 `%TEMP%` 下的临时测试脚本与项目内的方案文件。

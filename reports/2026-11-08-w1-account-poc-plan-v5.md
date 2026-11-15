# W-1 实施方案 v5：Windows 独立账户 PoC（仅方案，未执行）

> **已被 [v5.1](2026-11-08-w1-account-poc-plan-v5.1.md) 取代（2026-11-08，按 Observer 第四轮审查修订）。** 原文保留作审查证据。

日期：2026-11-08（v5，按 Observer 第三轮 P0/P1/P2 修订）
作者：Hermes｜审阅：ChatGPT Observer / 用户（待）
状态：**方案稿。未创建账户、未修改 ACL、未执行任何系统级变更。** 需第五次明确授权。
沿革：[v1](2026-11-08-w1-account-poc-plan.md) → [v2](2026-11-08-w1-account-poc-plan-v2.md) → [v3](2026-11-08-w1-account-poc-plan-v3.md) → [v4](2026-11-08-w1-account-poc-plan-v4.md) → v5（本文）。前四版原文保留。

---

## 0. 状态口径与边界

| 等级 | 定义 | 本轮哪些东西属于它 |
| --- | --- | --- |
| **VERIFIED** | 有真实运行证据（命令原始输出） | 静态查询：`Get-LocalUser`、`icacls` 现状、`icacls` 帮助语义、`Start-Process` 参数 |
| **DESIGNED** | 设计完整，未实施 | 权限矩阵、命令清单、信任模型、失败关闭流程 |
| **PLANNED** | 验收方法明确、未执行 | A1–A8、B1–B6、C1–C4、V1–V23 |
| **BLOCKED** | 依赖未实现组件 | AC-5 检出档、C1–C4 端到端、HMAC 密钥分发 |

本轮**只做**：文档、静态只读查询。**没做**：建号、改 ACL、装软件、起 Agent、调模型、花钱。

---

## 1. 修订差异（v4 → v5）

| # | Observer 指出 | v4 实况 | v5 修法 |
| --- | --- | --- | --- |
| **P0-1** | `(OI)(AD)` 的继承语义没分清 | v4 用 `(OI)(AD)`：**不带 `(IO)` → 该 ACE 同时作用于目录本身**，Recorder 仍能在 `D:\PAE\audit` 里建文件。这是个真 bug | 改为 `(OI)(IO)(AD)`：仅继承给子文件；目录本身只给 `R`。并新增 A7/A8 两条实测证明"不能建文件/不能建子目录" |
| **P0-2** | Runtime Home 缺实际命令 | v4 §4.5 只 `/inheritance:r` + 用户 F，**矩阵写了 F 但命令没给** | §4.6 补 `/grant F` + 对另外三个账号 `deny F` |
| **P0-3** | 安装目录不能只说 RX | `D:\` 下三个运行时目录都继承 `Authenticated Users:(M)`，**只加 RX 等于没管住写** | 对执行账号显式 `deny (WD,AD,WEA,WA,DE,DC,WDAC,WO)`；**只 deny 账号、不 deny 组**（否则会打到自己）。新增 V24 实测 |
| **P0-4** | PAE-verify 自相矛盾 | v4 一边 deny 执行账号写 verify，一边要它们把结果写进 verify | 改为**测试控制器**：被测账号不写盘，控制器收集退出码/输出并落盘；verify 对四账号仍全拒 |
| **P0-5** | 创建失败要可靠逆序回滚 | v4 的 SID 互异判断是空语句（`if (...) { }`），等于没查 | 改写为 `Select-Object -Unique` 计数 + `$stage` 状态机 + 失败逆序删号并**验证删除结果** |
| **P0-6** | 备份与错误处理 | 备份目录未保护；只有 profiles 做了快照；`SilentlyContinue` 吞错；`Step` 只查 `$LASTEXITCODE`（管不到 Cmdlet） | §4.4 重写：备份目录先建先锁；6 目标各一份 SDDL；`-ErrorAction Stop`；`Step` 同时捕获异常与退出码；补齐 `acl-after.xml` 与比对 |
| **P1-1** | A5/A6 路径、SID、判据 | A5 的 `probe.txt` 没路径；A6 用 `takeown` 会因缺特权失败，**混淆了"ACL 拒绝"与"权限不足"** | A5 用 `D:\PAE\shared\probe.txt`（有据可依）；A6 改用 `icacls /grant` + `Set-Acl`（纯 WRITE_DAC 测试），`takeown` 降为补充并注明失效原因 |
| **P1-2** | V5/V20 与 ACL-09 映射错 | v4 让 ACL-09 指向 V5（只读三目录），V20（回滚）与 ACL-09 无关 | ACL-09 → 新增 **V23**；V20 改为纯回滚演练；对照表重排 |
| **P1-3** | 登录限制没写 | 只写了"标准用户" | §8 写清四种登录权（交互/远程交互/网络/批量）、配置方式、以及"ACL 管不到登录权" |
| **P1-4** | 矩阵每项要有命令+验收 | v4 有 3 处缺列 | §10 对照表全覆盖，并用脚本自检（见 §10.2） |
| **P1-5** | Recorder 伪造事件风险要展开 | v4 只有一句 R1 | §7.3 展开：威胁路径、HMAC 为什么不够、交叉核对依赖哪些组件、标 `BLOCKED` |

---

## 2. 本轮静态核查（VERIFIED）

| 核查项 | 原始证据 | 结论 |
| --- | --- | --- |
| `(IO)` 的语义 | `icacls /?`：`(OI) - 对象继承`／`(CI) - 容器继承`／**`(IO) - 仅继承`**／`(NP) - 不传播继承` | `(IO)` = **inherit only**，ACE 不作用于本对象。`(OI)(IO)(AD)` 正是"只给子文件追加权、目录本身不给" |
| `(IO)` 确实出现在系统 ACE 里 | `icacls D:\` 输出含 `BUILTIN\Administrators:(OI)(CI)(IO)(F)` | 组合语法在本机可用 |
| `Start-Process` 能否当测试控制器 | `(Get-Command Start-Process).Parameters.Keys` 含 `Credential,LoadUserProfile,RedirectStandardError,RedirectStandardInput,RedirectStandardOutput` | 可用 `-Credential` 以目标账号启动，并用 `-PassThru -Wait` 取 `ExitCode` |
| `pae-*` 账户 | `Get-LocalUser` 过滤结果 **0** | 无半成品 |
| `D:\PAE`、`D:\PAE-acl-backup` | 均不存在 | 干净起点 |
| `D:\` 根 ACE | 含 `Authenticated Users:(M) (OI)(CI)(IO)(M)` | 新目录不切继承即等于可写；运行时目录同理 |

---

## 3. 完整权限矩阵 v5

`F`=完全 `RX`=读+执行 `R`=读 `AD`=追加 `WD`=写数据 `DE`=删除 `DC`=删子项 `WDAC`=改权限 `WO`=改所有者 `IO`=仅继承（不作用于本对象）

| ID | 路径 | 用户 | pae-hermes | pae-dsh | pae-recorder | pae-anchor | 命令 | 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACL-01 | `D:\PAE` | F | — | — | — | — | C01 | V4 |
| ACL-02 | `runtime\hermes-home` | F | **F** | deny F | deny F | deny F | C02 | V4,V8,V18 |
| ACL-03 | `runtime\dsh-home` | F | deny F | **F** | deny F | deny F | C03 | V4,V9,V19 |
| ACL-04 | `shared` | F | RX+ deny 写类 | RX+ deny 写类 | RX+ deny 写类 | RX+ deny 写类 | C04 | V5,V6,V7 |
| ACL-05 | `policy` | F | 同 ACL-04 | 同 | 同 | 同 | C05 | V5,V6,V7 |
| ACL-06 | `logs` | F | 同 ACL-04 | 同 | 同 | 同 | C06 | V5,V6,V7 |
| ACL-07 | `audit`（目录） | F | deny F | deny F | **R**（无 AD） | **R** | C07 | V10,V11 |
| ACL-07b | `audit\*.jsonl`（继承） | F | 被拒 | 被拒 | **`(OI)(IO)(AD)` → 子文件 `R,AD`** | **R** | C07b | V12,A1–A8 |
| ACL-08 | `audit-anchor`（目录） | F | deny F | deny F | **deny F** | **R**（无 AD） | C08 | V13 |
| ACL-08b | `audit-anchor\*.jsonl` | F | 被拒 | 被拒 | 被拒 | **`R,AD`** | C08b | V13,B1–B6 |
| ACL-09 | `D:\PAE-verify` | F | deny F | deny F | deny F | deny F | C09 | **V23** |
| ACL-10 | `D:\PAE-acl-backup` | F | deny F | deny F | deny F | deny F | C10 | V3,V23 |
| ACL-11 | `Data\profiles` | 不变 | **deny F** | **deny F** | deny F | deny F | C11 | V14 |
| ACL-12 | `C:\Users\Administrator\.dsh` | 不变 | **deny F** | **deny F** | deny F | deny F | C12 | V15 |
| ACL-13 | `Data\tools` / `D:\HermesAgent\Source` | 不变 | **RX + deny 写类** | — | — | — | C13 | V20 |
| ACL-14 | `Data\installs` | 不变 | **RX + deny 写类**（+ 关闭 pyc） | — | — | — | C14 | V21 |
| ACL-15 | `…\Programs\DeepSeek Harness` | 不变 | — | **RX + deny 写类** | — | — | C15 | V22 |
| ACL-16 | `config.yaml`/`.env`/`auth.json` | 不变 | **deny F** | **deny F** | deny F | deny F | C16 | V16 |
| ACL-17 | `D:\HermesAgent\Data`（根） | 不变 | 不加 deny | 不加 deny | — | — | — | — |

**"deny 写类"** = `(OI)(CI)(WD,AD,WEA,WA,DE,DC,WDAC,WO)`，只对具体账号，**不对 `Authenticated Users` 或 `Users` 组**（否则会把用户自己一起 deny 掉，桌面应用立刻坏）。

**ACL-14 的真实冲突（必须先说清）**：`Data\installs` 里是 Hermes 的 venv，Python 运行时可能写 `__pycache__`。deny 掉 `AD/WD` 后可能起不来。对策：执行环境设 `PYTHONDONTWRITEBYTECODE=1`，`PYTHONPYCACHEPREFIX` 指到自己的 home。这属于 `PLANNED` 验证项（V19b），**不通过就退成 RX-only（不加 deny）并如实降级表述**——不硬撑。

---

## 4. ACL 命令清单

> 管理员 PowerShell。`$U`=用户 SID，`$PH/$PD/$PR/$PA`=四个账号 SID。
> 统一步骤包装见 §4.1，**任何一步失败立即 throw**，不做"部分成功"。

### 4.1 Step 包装（同时管原生命令与 Cmdlet）

```powershell
$ErrorActionPreference = 'Stop'
function Step($name, [scriptblock]$block) {
  $global:LASTEXITCODE = 0
  try {
    $out = & $block 2>&1
  } catch {
    "FAIL(exception) $name :: $($_.Exception.Message)" | Tee-Object -Append $env:OPLOG
    throw
  }
  $code = $LASTEXITCODE
  ($out | Out-String) | Tee-Object -Append $env:OPLOG | Out-Null
  if ($code -ne 0) { throw "FAIL(exit=$code) $name" }
  if ($out -match 'Failed processing|拒绝访问|Access is denied' -and $name -notmatch '^expect-denied') {
    # icacls 的警告文本不进退出码，这里显式拦
    throw "FAIL(output) $name :: matched failure text"
  }
}
```

要点：`$LASTEXITCODE` 只管原生命令，Cmdlet 失败靠 `try/catch`（`-ErrorAction Stop` 已全局生效）。

### 4.2 前置检查（不通过就停，不进 ACL 阶段）

```powershell
$stage = 'preflight'
if (Get-LocalUser | Where-Object Name -like 'pae-*') { throw 'pae-* 已存在，先人工确认' }
if (Test-Path D:\PAE)          { throw 'D:\PAE 已存在' }
if (Test-Path D:\PAE-acl-backup){ throw 'D:\PAE-acl-backup 已存在' }
```

### 4.3 建号（先全建成，再碰 ACL）

```powershell
$stage = 'create-accounts'
$created = @()
try {
  foreach ($n in 'pae-hermes','pae-dsh','pae-recorder','pae-anchor') {
    $pw = Read-Host "password for $n" -AsSecureString
    New-LocalUser -Name $n -Password $pw -PasswordNeverExpires -UserMayNotChangePassword `
                  -Description "PAE $n (Bridge-managed; no interactive logon)" -ErrorAction Stop | Out-Null
    $created += $n
    "created $n" | Tee-Object -Append $env:OPLOG
  }
  $u = @(Get-LocalUser pae-*) 
  if ($u.Count -ne 4) { throw "账户数 $($u.Count) ≠ 4" }
  $sids = $u.SID.Value
  if (($sids | Select-Object -Unique).Count -ne 4) { throw '四个 SID 不互异' }
  $admins = (net localgroup Administrators) -join "`n"
  foreach ($n in 'pae-hermes','pae-dsh','pae-recorder','pae-anchor') {
    if ($admins -match [regex]::Escape($n)) { throw "$n 在 Administrators 组里" }
  }
} catch {
  "create failed: $_ ; rolling back created = $($created -join ',')" | Tee-Object -Append $env:OPLOG
  foreach ($n in ($created | Sort-Object -Descending)) {   # 逆序
    try { Remove-LocalUser -Name $n -ErrorAction Stop } catch { "ROLLBACK FAILED for $n : $_" | Tee-Object -Append $env:OPLOG }
  }
  $left = @(Get-LocalUser | Where-Object Name -like 'pae-*')
  if ($left.Count -ne 0) { throw "回滚不完整，残留: $($left.Name -join ',') —— 人工介入，禁止继续" }
  throw '账户阶段失败，已回滚干净，未进入 ACL 阶段'
}
$stage = 'accounts-ready'
```

**关键**：回滚后**再查一遍残留**；残留 ≠ 0 就直接终止并要人工介入，不允许"带着半成品继续"。

### 4.4 备份目录 + 6 目标快照（先建先锁）

```powershell
$stage = 'backup'
New-Item -ItemType Directory -Force D:\PAE-acl-backup | Out-Null
New-Item -ItemType Directory -Force D:\PAE-acl-backup\snap  | Out-Null
Step 'backup-dir-lock' {
  icacls 'D:\PAE-acl-backup' /inheritance:r
  icacls 'D:\PAE-acl-backup' /grant:r "*${U}:(OI)(CI)F"
  foreach ($s in $PH,$PD,$PR,$PA) { icacls 'D:\PAE-acl-backup' /deny "*${s}:(OI)(CI)F" }
}

$targets = @{
  profiles = 'D:\HermesAgent\Data\profiles'
  dataroot = 'D:\HermesAgent\Data'
  dshhome  = 'C:\Users\Administrator\.dsh'
  config   = 'D:\HermesAgent\Data\config.yaml'
  env      = 'D:\HermesAgent\Data\.env'
  auth     = 'D:\HermesAgent\Data\auth.json'
}
foreach ($k in $targets.Keys) {
  $p = $targets[$k]
  $drive = Split-Path -Qualifier $p            # 'D:' 或 'C:'
  Step "save-$k" { Set-Location $drive; icacls $p /save "D:\PAE-acl-backup\$k.acl" /T }
  # 每个目标一份 SDDL 快照（含子项，读错误不吞）
  Step "snap-$k" {
    Get-ChildItem -LiteralPath $p -Recurse -Force -ErrorAction Stop |
      ForEach-Object { [pscustomobject]@{ Path = $_.FullName; SDDL = (Get-Acl -LiteralPath $_.FullName -ErrorAction Stop).Sddl } } |
      Export-Clixml "D:\PAE-acl-backup\snap\$k-before.xml"
  }
}
```

**不做 `.Keys` 顺序依赖**：每个目标独立 `save` + 独立 `snap`，任一失败即停（Step 已保证）。

**校验**：6 个 `.acl` + 6 个 `-before.xml` 全存在且非空；`snap\profiles-before.xml` 条目数 == `(Get-ChildItem D:\HermesAgent\Data\profiles -Recurse -Force).Count`。

### 4.5 目录 + 切断继承 + home 授权（P0-1、P0-2）

```powershell
$stage = 'dirs'
$dirs = 'D:\PAE','D:\PAE\runtime','D:\PAE\runtime\hermes-home','D:\PAE\runtime\dsh-home',
        'D:\PAE\shared','D:\PAE\policy','D:\PAE\audit','D:\PAE\audit-anchor','D:\PAE\logs','D:\PAE-verify'
foreach ($d in $dirs) { New-Item -ItemType Directory -Force $d | Out-Null }

foreach ($d in $dirs + 'D:\PAE-acl-backup') {
  Step "inh-r $d"   { icacls $d /inheritance:r }
  Step "user-f $d"  { icacls $d /grant:r "*${U}:(OI)(CI)F" }
}

# ACL-02 / ACL-03：各自的家（v4 缺的就是这两行）
Step 'home-hermes' { icacls 'D:\PAE\runtime\hermes-home' /grant "*${PH}:(OI)(CI)F" `
                                                 /deny "*${PD}:(OI)(CI)F" /deny "*${PR}:(OI)(CI)F" /deny "*${PA}:(OI)(CI)F" }
Step 'home-dsh'    { icacls 'D:\PAE\runtime\dsh-home'    /grant "*${PD}:(OI)(CI)F" `
                                                 /deny "*${PH}:(OI)(CI)F" /deny "*${PR}:(OI)(CI)F" /deny "*${PA}:(OI)(CI)F" }
```

### 4.6 只读三目录（ACL-04/05/06）

```powershell
$wDeny = '(OI)(CI)(WD,AD,WEA,WA,DE,DC,WDAC,WO)'
foreach ($d in 'D:\PAE\shared','D:\PAE\policy','D:\PAE\logs') {
  foreach ($s in $PH,$PD,$PR,$PA) {
    Step "ro-$d-$s" { icacls $d /grant "*${s}:(OI)(CI)RX" ; icacls $d /deny "*${s}:$wDeny" }
  }
}
```

### 4.7 审计双主体（ACL-07/07b/08/08b，P0-1 的核心修正）

```powershell
$stage = 'audit'

# 先造段文件（目录不给 AD，谁都不能事后自造）
Step 'seed' { New-Item -ItemType File -Force 'D:\PAE\audit\events-0001.jsonl' | Out-Null
              New-Item -ItemType File -Force 'D:\PAE\audit-anchor\anchor-0001.jsonl' | Out-Null }

# 1) 目录：Recorder 只读不写（无 AD、无 WD），Anchor 只读
Step 'audit-dir-recorder' { icacls 'D:\PAE\audit' /grant "*${PR}:(R)" }
Step 'audit-dir-anchor'   { icacls 'D:\PAE\audit' /grant "*${PA}:(R)" }
Step 'audit-deny-exec'    { icacls 'D:\PAE\audit' /deny "*${PH}:(OI)(CI)F" /deny "*${PD}:(OI)(CI)F" }
Step 'audit-deny-anchorw' { icacls 'D:\PAE\audit' /deny "*${PA}:(WD,AD,WEA,WA,DE,DC,WDAC,WO)" }

# 2) 只是"仅继承"给子文件 → 目录本身仍无 AD，Recorder 造不出新文件
Step 'audit-file-recorder-ad' { icacls 'D:\PAE\audit' /grant "*${PR}:(OI)(IO)(AD)" }
Step 'audit-file-recorder-r'  { icacls 'D:\PAE\audit' /grant "*${PR}:(OI)(IO)(R)" }

# 3) 让已存在的段文件真正吃到继承（不放宽目录）
Step 'audit-propagate' { icacls 'D:\PAE\audit\events-0001.jsonl' /reset }

# 4) 锚点侧同构
Step 'anchor-dir-anchor'    { icacls 'D:\PAE\audit-anchor' /grant "*${PA}:(R)" }
Step 'anchor-file-anchor'   { icacls 'D:\PAE\audit-anchor' /grant "*${PA}:(OI)(IO)(R)" /grant "*${PA}:(OI)(IO)(AD)" }
Step 'anchor-propagate'     { icacls 'D:\PAE\audit-anchor\anchor-0001.jsonl' /reset }
Step 'anchor-deny-others'   { icacls 'D:\PAE\audit-anchor' /deny "*${PR}:(OI)(CI)F" /deny "*${PH}:(OI)(CI)F" /deny "*${PD}:(OI)(CI)F" }
```

**自检（必须做，否则等于没改）**：

```powershell
Step 'audit-selfcheck' {
  $ace = (Get-Acl 'D:\PAE\audit').Access | Where-Object { $_.IdentityReference -like "*pae-recorder" }
  if ($ace.AccessControlType -contains 'Allow' -and ($ace.FileSystemRights -band [Security.AccessControl.FileSystemRights]::CreateFiles)) {
    throw 'Recorder 在 audit 目录仍有 CreateFiles —— (IO) 没生效'
  }
}
```

### 4.8 现有路径加锁（ACL-11/12/16）

```powershell
Step 'profiles' { icacls 'D:\HermesAgent\Data\profiles' /deny "*${PH}:(OI)(CI)F" /deny "*${PD}:(OI)(CI)F" /deny "*${PR}:(OI)(CI)F" /deny "*${PA}:(OI)(CI)F" }
Step 'dshhome'  { icacls 'C:\Users\Administrator\.dsh'  /deny "*${PH}:(OI)(CI)F" /deny "*${PD}:(OI)(CI)F" /deny "*${PR}:(OI)(CI)F" /deny "*${PA}:(OI)(CI)F" }
foreach ($f in 'config.yaml','.env','auth.json') {
  Step "cfg-$f" { icacls "D:\HermesAgent\Data\$f" /deny "*${PH}:(F)" /deny "*${PD}:(F)" /deny "*${PR}:(F)" /deny "*${PA}:(F)" }
}
```

### 4.9 运行时（ACL-13/14/15，P0-3）

```powershell
$stage = 'runtime'
# Hermes：读+执行，同时封掉写/删/改权限（继承来的 Authenticated Users:(M) 仍在组层面，靠账号级 deny 压住）
foreach ($p in 'D:\HermesAgent\Data\tools','D:\HermesAgent\Source') {
  Step "rt-rx $p"  { icacls $p /grant "*${PH}:(OI)(CI)RX" }
  Step "rt-deny $p"{ icacls $p /deny  "*${PH}:$wDeny" }
}
Step 'rt-installs-rx'  { icacls 'D:\HermesAgent\Data\installs' /grant "*${PH}:(OI)(CI)RX" }
Step 'rt-installs-deny'{ icacls 'D:\HermesAgent\Data\installs' /deny  "*${PH}:$wDeny" }
Step 'rt-dsh-rx'       { icacls 'C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness' /grant "*${PD}:(OI)(CI)RX" }
Step 'rt-dsh-deny'     { icacls 'C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness' /deny  "*${PD}:$wDeny" }
```

> `Data\installs` 的 deny 是**有条件**的：V19b 若因为 pyc 写入失败而启动不了，就撤掉该 deny、退回 RX-only，并在文档里写明"installs 只做了读隔离，写隔离未实现"。不硬撑。

### 4.10 验收目录（ACL-09/10）

```powershell
Step 'verify'   { icacls 'D:\PAE-verify' /deny "*${PH}:(OI)(CI)F" /deny "*${PD}:(OI)(CI)F" /deny "*${PR}:(OI)(CI)F" /deny "*${PA}:(OI)(CI)F" }
```

---

## 5. 有效权限怎么测（解决 P0-4 的矛盾）

**矛盾**：被测账号不能写 `PAE-verify`，但又需要它的输出来作证据。
**解法**：**成绩单不由被测者写**。

### 5.1 测试控制器（以用户身份运行）

```powershell
function Invoke-AsAccount($account, $exe, $argList) {
  $pw   = Read-Host "password for $account" -AsSecureString
  $cred = New-Object System.Management.Automation.PSCredential($account, $pw)
  $p = Start-Process -FilePath $exe -ArgumentList $argList -Credential $cred `
        -WorkingDirectory 'C:\Windows\System32' -PassThru -Wait -WindowStyle Hidden
  [pscustomobject]@{ Account=$account; Cmd="$exe $($argList -join ' ')"; ExitCode=$p.ExitCode }
}
```

- 控制器是**用户**，它写的 `results.jsonl` 被测账号改不了（ACL-09）。
- 证据主要由 **ExitCode** 承载：`0` = 意外成功（=隔离失败），`非 0` = 被拒（=符合预期）。
- 若要文本证据，加 `-RedirectStandardOutput D:\PAE-verify\a1.out`：文件句柄由控制器创建并传给子进程，**子进程靠句柄写，不需要 ACL 写权限**——这是"用句柄代替权限"的标准做法。

**局限（要写清）**：`Start-Process -Credential` 是 `CreateProcessWithLogonW`，需要该账号**未被禁止"批量登录"**；如果环境禁止，就退回 `schtasks /ru <account> /rp *` + **只认退出码**（任务不落盘输出）。这条要在 V26 里先验证。

### 5.2 三层判据

| 层 | 内容 | 能证明什么 | 状态上限 |
| --- | --- | --- | --- |
| L1 | `icacls` 静态 ACE（`(I)`/`(IO)`/deny 覆盖） | 配置写了什么 | `DESIGNED` |
| L2 | 控制器以目标账号真跑动作，看 ExitCode | 边界在真实运行时成立 | `VERIFIED` |
| L3 | 允许的动作确实可用（读/执行） | 没有过度收紧 | `VERIFIED` |

---

## 6. 测试定义（A/B/C，全部 PLANNED）

### 6.1 A：Recorder 边界（P1-1 修正后）

前置：`events-0001.jsonl` 已有 1 行；`D:\PAE\shared\probe.txt` 由控制器预先放好（Recorder 有 RX 可读）。

| ID | 意图 | 命令（以 `pae-recorder`） | 通过判据 |
| --- | --- | --- | --- |
| A1 | 能追加 | `cmd /c echo {"n":2}>>D:\PAE\audit\events-0001.jsonl` | **ExitCode=0** 且行数 1→2（控制器核对） |
| A2 | 不能偏移写 | `powershell -NoProfile -c "[IO.File]::Open('D:\PAE\audit\events-0001.jsonl','Open','ReadWrite').Dispose()"` | ExitCode≠0 |
| A3 | 不能截断 | `powershell -NoProfile -c "Set-Content -LiteralPath 'D:\PAE\audit\events-0001.jsonl' -Value 'x'"` | ExitCode≠0 **且**行数仍为 2 |
| A4 | 不能删除 | `cmd /c del /f /q D:\PAE\audit\events-0001.jsonl` | ExitCode≠0 且文件仍在 |
| A5 | 不能改名/替换 | ①`cmd /c ren D:\PAE\audit\events-0001.jsonl evil.jsonl` ②`cmd /c copy /y D:\PAE\shared\probe.txt D:\PAE\audit\events-0001.jsonl` | ①② 都 ExitCode≠0；文件名未变、内容未变 |
| A6 | 不能改 ACL | ①`icacls D:\PAE\audit\events-0001.jsonl /grant *<PH_SID>:(F)` ②`powershell -c "$a=Get-Acl 'D:\PAE\audit\events-0001.jsonl'; $a.SetAccessRule((New-Object Security.AccessControl.FileSystemAccessRule('<PH_SID>','FullControl','Allow'))); Set-Acl 'D:\PAE\audit\events-0001.jsonl' $a"` | ①② ExitCode≠0。**不用 `takeown` 作判据**：标准用户常因缺 `SeRestorePrivilege` 先失败，证明不了 ACL；`takeown` 只作补充观察 |
| A7 | 不能建新文件 | `cmd /c echo x>D:\PAE\audit\evil.jsonl` | ExitCode≠0 且文件不存在 |
| A8 | 不能建子目录 | `cmd /c mkdir D:\PAE\audit\sub` | ExitCode≠0 且目录不存在 |

**A1 一旦通过而 A2–A8 有任一也通过 → 隔离失败，回退 ACL，标 `FAIL`。**

### 6.2 B：Anchor 独立性

| ID | 意图 | 以 `pae-anchor` | 判据 |
| --- | --- | --- | --- |
| B1 | 能读明细 | `cmd /c type D:\PAE\audit\events-0001.jsonl` | ExitCode=0 |
| B2 | 能追加 checkpoint | `cmd /c echo {"seq":2}>>D:\PAE\audit-anchor\anchor-0001.jsonl` | ExitCode=0 |
| B3 | 不能改明细 | `powershell -c "[IO.File]::Open('D:\PAE\audit\events-0001.jsonl','Open','ReadWrite').Dispose()"` | ≠0 |
| B4 | 不能删明细 | `cmd /c del /f /q D:\PAE\audit\events-0001.jsonl` | ≠0 且文件在 |
| B5 | Recorder 碰不到锚点 | 以 `pae-recorder`：`type` / `echo>>` / `del` 锚点文件 | **三条全 ≠0（含读）** |
| B6 | 互不改权限 | 双方各自 `icacls <对方目录> /grant` | 均 ≠0 |

### 6.3 C：失败关闭（DESIGNED，端到端 BLOCKED）

| ID | 判定点 | 可观察证据 |
| --- | --- | --- |
| C1 | Recorder 自检失败 → 不 ready | 日志 `recorder.selfcheck FAILED` + `bridge.ready=false` |
| C2 | 审计不可用 → 新任务被拒 | `POST /tasks` → 503 `audit_unavailable` |
| C3 | 在途任务 | `session/cancel` + `unknown_execution` 队列 |
| C4 | 无静默降级 | 代码里不存在内存缓冲/事后补账路径 |

**反向测试**：临时摘掉 Recorder 的 `AD`（改一条 ACE）→ 必须触发 C2。只测正常路径不算验证失败关闭。

---

## 7. 审计信任模型（v4 保留 + P1-5 展开）

### 7.1 五问（不变）

1. Recorder 攻陷 → 改不了锚点（ACL-08 deny F），能追加垃圾（可发现）。
2. 只有 `pae-anchor`（追加）与用户（全权）能改 checkpoint。
3. Observer 只读三通道：重算链 / 核对锚点 `(seq,hash)` / 检查 `seq_local` 跳号。
4. 防"重写再重算"：明细对 Recorder 无 `WD/DE/DC`；锚点在另一主体；链本身让改一行要重算其后全部。
5. 落不了盘：自检 → 503 → 在途取消 → 告警。

### 7.2 为什么 `(IO)` 这一步是必须的

不带 `(IO)` 时，`(OI)(AD)` 会**同时**给目录本身 `AD`（目录的 AD = add file）→ Recorder 能在审计目录里造新文件，也就等于能"造一个看起来像历史段的新文件"。加了 `(IO)` 之后，这条路径断掉，代价是轮转必须由用户任务预建段文件。

### 7.3 Recorder 能追加伪造事件（P1-5 展开）

| 项 | 说明 |
| --- | --- |
| 威胁路径 | Recorder 有合法 `AD` → 可写入任意内容的事件行；ACL 无法区分"真事件"和"伪造事件" |
| 为什么 HMAC 能挡 | 每条事件由 **Agent** 用自己的密钥签名，Recorder **不持有**这些密钥 → 它能写行，但写不出合法 `mac` |
| 为什么 HMAC 还不够 | Agent 密钥若泄露，伪造者可以冒充该 Agent；且 HMAC 不防"顺序/删除"（那由链与锚点负责） |
| 还需要交叉核对 | ①`seq` 全局连续、②时间戳单调、③Agent 侧 `seq_local` 与账本对账、④事件数与 Agent 自报数一致、⑤Observer 独立重算 |
| 依赖 | `CI-3.1` 账本实现、`CI-3.2` HMAC 密钥分发（密钥不进 Recorder 进程），**均未实现 → BLOCKED** |
| 现阶段结论 | 只能做到"篡改/伪造**可被发现**"，做不到"不可发生"。文档与验收都按这个口径写 |

---

## 8. 账户身份与登录限制（P1-3）

| 项 | 现状 | 目标 | 怎么做 | 状态 |
| --- | --- | --- | --- | --- |
| 组成员 | 新建账号默认只属 `Users` | 不在 `Administrators` | 建号后校验 `net localgroup Administrators` | PLANNED（V1） |
| 交互登录 | 默认允许 | 禁止 | `secedit /export` → 在 `[Privilege Rights]` 加 `SeDenyInteractiveLogonRight = *SID…` → `secedit /configure` | PLANNED（V1b，**属系统变更，需单独授权**） |
| 远程交互 | 默认允许（若 RDP 开启） | 禁止 | `SeDenyRemoteInteractiveLogonRight` | PLANNED |
| 网络登录 | 默认允许 | 建议禁止 | `SeDenyNetworkLogonRight` | PLANNED |
| 批量登录 | 默认可能允许 | **必须允许** | 计划任务/`Start-Process -Credential` 依赖 `SeBatchLogonRight` | PLANNED（V26 先验证） |
| 密码 | 无 | 随机、仅内存/凭据管理器 | 交互输入、不落盘不进日志 | 待用户定（§13） |

**诚实说明**：以上四条是 **LSA 登录权，不是文件 ACL**，`icacls` 管不到；本方案的 ACL 部分不能声称解决了登录隔离。未配置前，账号"不能交互登录"是不成立的。

---

## 9. 备份、恢复、回滚（P0-6 强化）

### 9.1 恢复后比对（补齐 `acl-after.xml`）

```powershell
$stage = 'restore-drill'
# 演练：小目录先试
New-Item -ItemType Directory -Force D:\PAE-acl-backup\drill | Out-Null
Step 'drill-prep'   { icacls 'D:\PAE-acl-backup\drill' /grant:r "*${U}:(OI)(CI)F" }
Step 'drill-save'   { Set-Location 'D:\'; icacls 'D:\PAE-acl-backup\drill' /save 'D:\PAE-acl-backup\drill.acl' /T }
Step 'drill-break'  { icacls 'D:\PAE-acl-backup\drill' /deny "*${PD}:(F)" }
Step 'drill-restore'{ Set-Location 'D:\'; icacls 'D:\' /restore 'D:\PAE-acl-backup\drill.acl' }
Step 'drill-verify' {
  $a = (Get-Acl 'D:\PAE-acl-backup\drill').Access | Where-Object AccessControlType -eq 'Deny'
  if ($a) { throw '演练失败：DENY 仍残留' }
}
```

**正式恢复后**逐目标生成 `-after.xml` 并比对：

```powershell
function Snapshot($path, $out) {
  Get-ChildItem -LiteralPath $path -Recurse -Force -ErrorAction Stop |
    ForEach-Object { [pscustomobject]@{ Path=$_.FullName; SDDL=(Get-Acl -LiteralPath $_.FullName -ErrorAction Stop).Sddl } } |
    Export-Clixml $out
}
function CompareSnap($before, $after) {
  $b = Import-Clixml $before; $a = Import-Clixml $after
  $d = Compare-Object $b $a -Property Path,SDDL
  if ($d) { $d | Format-Table -AutoSize | Out-String | Write-Host; throw "ACL 恢复不一致：$($d.Count) 处差异" }
  'ACL restores match'
}
```

**判据**：6 个目标全部 `CompareSnap` 通过才算恢复成功。少一个都算失败。

### 9.2 回滚顺序与停止条件

1. `schtasks /end` + `/delete` 全部 PAE 任务
2. 停 Bridge / Recorder / Anchor
3. `icacls /restore`（文件级先、目录级后，盘符根对应）
4. `CompareSnap` 六个目标
5. 孤儿 SID 扫描
6. `Disable-LocalUser pae-*`
7. 确认桌面 Hermes / DSH 正常
8. 最后 `Remove-LocalUser`
9. 按需删 `D:\PAE`（保留 backup）

**停止条件（任一命中即停，不再做破坏性动作）**：
- 任一 `/restore` 退出码 ≠ 0
- `CompareSnap` 有差异
- 孤儿 SID 非空且无法解释
- `Remove-LocalUser` 失败

---

## 10. 命令 ↔ 验收对照（P1-4）

### 10.1 全量对照

| 命令 | 覆盖 ACL | 验收 |
| --- | --- | --- |
| C01 | ACL-01 | V4 |
| C02 | ACL-02 | V4, V5a, V18 |
| C03 | ACL-03 | V4, V5b, V19 |
| C04 | ACL-04（shared） | V5, V6, V7 |
| C05 | ACL-05（policy） | V5, V6, V7 |
| C06 | ACL-06（logs） | V5, V6, V7 |
| C07 | ACL-07 | V10, V11 |
| C07b | ACL-07b | V12, A1–A8 |
| C08 | ACL-08 | V13 |
| C08b | ACL-08b | V13, B1–B6 |
| C09 | ACL-09 | **V23** |
| C10 | ACL-10 | V3, V23 |
| C11 | ACL-11 | V14 |
| C12 | ACL-12 | V15 |
| C13 | ACL-13 | V20 |
| C14 | ACL-14 | V21 |
| C15 | ACL-15 | V22 |
| C16 | ACL-16 | V16 |

### 10.2 自检规则与**已执行**结果

规则：矩阵 ID 集合 ⊆ 命令表 ID 集合；矩阵每行必须有命令列与验收集合；反向查"命令表里有、矩阵里没有"的孤儿项。

用内联脚本对**本文件自身**跑过（静态解析 markdown 表格，不依赖人工目检）：

```
矩阵 ACL 条目 19 · 命令表 15 条（C01…C16）· 26 条（V1…V26，连续编号）
缺命令的 ACL：无
矩阵引用但验收清单缺失的 V：无
```

首轮自查曾报出两处缺陷，已在本次修订中修掉：①命令表把 `C04–C06` 写成一格（矩阵逐条引用，对不上）；②把 `V5a/V5b` 当成编号后缀（既破坏 ID 规则也容易被读成同一个 V）。**这正是自检规则存在的意义——不能靠"看起来对"。**

**流程类验收**（不对应单条 ACL，属于准备/治理动作）：`V1`（账号合规）、`V2`（备份完整性）、`V17`（AC-4 脚本）、`V24`（运行时写拒）、`V25`（登录权）、`V26`（控制器）。它们不出现在矩阵行里是**设计如此**，不是遗漏。

### 10.3 验收清单 V1–V26（连续编号）

| V | 内容 | 状态 |
| --- | --- | --- |
| V1 | 四账号为标准用户、SID 互异 | PLANNED |
| V2 | 备份 6 对文件齐全 + 条目数匹配 | PLANNED |
| V3 | 备份目录对四账号不可写 | PLANNED |
| V4 | 新目录无 `(I)` 继承 | PLANNED |
| V5 | 只读三目录可读 | PLANNED |
| V6 | 只读三目录写/删/改 ACL 三拒 | PLANNED |
| V7 | 只读三目录不能建文件 | PLANNED |
| V8 | hermes-home：PH 可写，其余三账号被拒 | PLANNED |
| V9 | dsh-home：PD 可写，其余三账号被拒 | PLANNED |
| V10 | 执行账号对 audit 读也拒 | PLANNED |
| V11 | audit 目录无 `(I)`、Recorder 无 CreateFiles | PLANNED |
| V12 | A1–A8 | PLANNED |
| V13 | B1–B6 | PLANNED |
| V14 | AC-1 `.dsh` 双向拒绝 | PLANNED |
| V15 | AC-2 `profiles` 双向拒绝 | PLANNED |
| V16 | AC-3 三配置文件拒读拒写 | PLANNED |
| V17 | AC-4 启停脚本 | PLANNED |
| V18 | AC-5 拒改档（Recorder/Anchor） | PLANNED |
| V19 | AC-5 检出档（`verify_audit`） | **BLOCKED** |
| V20 | Hermes 运行时可用（`import ruamel`） | PLANNED |
| V21 | `Data\installs` deny 写后仍能启动 | PLANNED（失败则退回 RX-only 并降级表述） |
| V22 | DSH 运行时可用（`dsh.cmd --version`） | PLANNED |
| V23 | 四账号都写不进 `PAE-verify` / `PAE-acl-backup` | PLANNED |
| V24 | 运行时目录写/删/改 ACL 三拒 | PLANNED |
| V25 | 登录权（交互/远程/网络禁、批量允许） | PLANNED（需单独系统授权） |
| V26 | 测试控制器可用性（`Start-Process -Credential` + 退出码） | PLANNED |
---

## 11. Windows ACL 给不了的保证（特别要求，照实写）

| # | 给不了什么 | 为什么 | 本方案怎么处理 |
| --- | --- | --- | --- |
| 1 | **不可篡改** | 需要 WORM 介质或外部时间戳服务 | 只承诺"可发现"；锚点 + 链 |
| 2 | **防住管理员** | `SeTakeOwnership`/`SeRestore` 可绕过一切 ACL | 文档写明；审计对象是"普通权限的 Agent" |
| 3 | **阻止 Recorder 追加伪造事件** | 它有合法 `AD` | HMAC（Agent 侧签名）+ 交叉核对，`BLOCKED` |
| 4 | **登录隔离** | 属 LSA 特权，不在 ACL | §8 单列，需 `secedit`（另需授权） |
| 5 | **内存内伪造/重放** | 进程自身行为 | nonce + 时间窗 + `seen_nonces`（MVP §5） |
| 6 | **同一卷内硬链接绕过** | 建硬链接属文件写权限范畴，权限判定仍落在原文件 | 审计目录内不允许出现新文件（ACL-07），间接缓解 |
| 7 | **符号链接/junction 逃逸** | 需 `SeCreateSymbolicLinkPrivilege`（标准用户默认无） | 路径规范化（SECURITY §11） |
| 8 | **"没有写入权限"= 完全安全** | 拒绝写入 ≠ 拒绝读取；读也是攻击面 | 执行账号对 audit 连读都没有（ACL-07） |

---

## 12. 剩余风险与缓解

| # | 风险 | 等级 | 缓解 | 状态 |
| --- | --- | --- | --- | --- |
| R1 | Recorder 追加伪造事件 | 中 | HMAC + 交叉核对 | BLOCKED |
| R2 | 失败关闭只有设计，无实现 | 高 | CI-3.1 实现后 C1–C4 端到端 | BLOCKED |
| R3 | 管理员可绕过 | 结构 | 文档声明，不宣称防住 | 已接受 |
| R4 | 轮转依赖用户任务预建段文件 | 低 | runbook 写死，禁"顺手放开目录 AD" | 已接受 |
| R5 | `Data\installs` deny 写可能致 Hermes 起不来 | 中 | `PYTHONDONTWRITEBYTECODE=1` + V19b；失败则降级为 RX-only | PLANNED |
| R6 | `Start-Process -Credential` 可能被登录策略挡住 | 中 | V26 先验；不行退 `schtasks` + 只认退出码 | PLANNED |
| R7 | OAuth 凭据共享（P-0） | 中 | 执行实例用 API-key 型 provider | 已记录 |
| R8 | 四账号密码管理未定 | 中 | 见 §13 | 待决策 |

---

## 13. 待用户决策

| # | 事项 | 选项 | 建议 |
| --- | --- | --- | --- |
| D-a | 四账号密码怎么存 | ① 每账号随机 + 只存 Windows 凭据管理器；② 统一密码；③ 用 `Managed Service Account`（更安全但要求 Windows 域/`-Group Managed` 不支持本地） | ① |
| D-b | 是否配置登录权（`secedit`） | ① 本轮一起做；② 先做 ACL，登录权单独一轮 | ①一起做更完整，但属系统变更需单独授权 |
| D-c | `Data\installs` 写隔离失败时 | ① 退回 RX-only 并降级表述；② 放弃用该 venv，另建只读副本 | ① |
| D-d | 第五次授权范围 | 仅建号+备份+演练；还是含 ACL 与验收 | 建议全量一次做完，中途失败即停 |

---

## 14. 下一阶段最小授权清单

按顺序，任一步失败即停并回滚：

1. **建 4 个标准账号**（密码交互输入，失败逆序删除并复查残留）
2. **建备份目录并锁定** + 6 目标 `.acl` + 6 份 SDDL 快照
3. **restore 演练**（drill 目录）
4. **建目录 + `/inheritance:r` + home 授权**
5. **只读三目录 + 审计双主体（`(OI)(IO)(AD)`）+ 段文件预建 + 传播**
6. **现有路径加锁 + 运行时 RX/deny**
7. **跑 V1–V26（其中 V19 = AC-5 检出档仍 `BLOCKED`）
8. **更新 WORKSTREAMS/DEVELOPMENT_LOG**，AC-5 记 `PARTIAL`

---

**本轮没有做的事**：没建账户、没改 ACL、没装软件、没启动 Agent、没调模型、没产生费用。所有 `icacls` 调用都是 `/save` 之外的只读查询（`icacls <path>`、`icacls /?`、`Get-Acl` 读取）。

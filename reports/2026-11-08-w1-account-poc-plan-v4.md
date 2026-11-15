# W-1 实施方案 v4：Windows 独立账户 PoC（仅方案，未执行）

> **已被 [v5](2026-11-08-w1-account-poc-plan-v5.md) 取代（2026-11-08，按 Observer 第三轮审查修订）。** 原文保留作审查证据。

日期：2026-11-08（v4，落实 P-007=A：`pae-recorder` 与 `pae-anchor` 双主体必需）
作者：Hermes｜审阅：ChatGPT Observer / 用户（待）
状态：**方案稿。未创建账户、未修改 ACL、未执行任何系统级变更。** 需第四次明确授权。
沿革：[v1](2026-11-08-w1-account-poc-plan.md) → [v2](2026-11-08-w1-account-poc-plan-v2.md) → [v3](2026-11-08-w1-account-poc-plan-v3.md) → 本文（v4）。前三版原文保留，作审查证据。

---

## 0. 本轮口径

### 0.1 证据等级（与任务状态正交，Observer 要求）

| 等级 | 含义 | 本文件怎么用 |
| --- | --- | --- |
| **VERIFIED** | 有实际运行证据（真实进程/真实文件操作/原始输出） | 只用于本轮真跑过的静态查询 |
| **DESIGNED** | 设计完成、可通过审查，但尚无运行证据 | 权限矩阵、信任模型、失败关闭流程 |
| **PLANNED** | 已定义验收方法，但依赖前置（账号/ACL/组件） | A1–A6、B1–B5、C1–C4、V1–V20 |
| **BLOCKED** | 有明确前置未满足 | AC-1…AC-5、Recorder 实现 |

**规则**：ACE 静态检查最多到 `DESIGNED`；`VERIFIED` 必须来自"用目标账户真的去写、去删、去改权限"的结果。

### 0.2 P-007 的落实

用户选择 A，Observer 追加要求：**Recorder 也必须是独立账户，不能与用户同权**。理由成立——若 Recorder 与用户共用身份，攻陷 Recorder 即可改 Anchor，"双主体"只是纸面。已按"两个审计主体均独立"重写本方案，记录见 `DECISIONS.md` D-012。

---

## 1. 主体清单（四个执行/审计身份）

| 主体 | 账号 | 职责 | 对 `audit` | 对 `audit-anchor` |
| --- | --- | --- | --- | --- |
| 用户 | `*…-500` | 最终管理 | F | F |
| Hermes 执行 | `pae-hermes` | 跑 Hermes ACP | **无（连读都无）** | 无 |
| DSH 执行 | `pae-dsh` | 跑 DSH ACP | **无** | 无 |
| Recorder | `pae-recorder` | **只追加**审计明细 | `R` + 文件 `AD` | 无 |
| Anchor | `pae-anchor` | 读明细、**只追加** checkpoint | `R` | `R` + 文件 `AD` |

四个账号**全部是本地标准用户**，不加入 `Administrators`。密码交互输入，不落盘、不进文档、不进日志。

---

## 2. 本轮静态检查（VERIFIED，只读）

| 检查 | 结果 |
| --- | --- |
| `Get-LocalUser` 中 `pae-*` | **0 个**（无半成品账户） |
| `D:\PAE` | **不存在** |
| `D:\` 根 ACE | 含 `Authenticated Users:(M) (OI)(CI)(IO)(M)` → 新目录不切断继承即等于可写 |
| `…\Programs\DeepSeek Harness` | 仅 SYSTEM / Administrators / Administrator `(F)`，**无 `Users:(RX)`** |
| `icacls` 具体权限语法 | 官方帮助示例 `icacls file /grant *S-1-1-0:(D,WDAC)` → 支持逗号列举具体权限与 `*SID:` 形式 |

> 这四条我跑过并贴了原始输出（见上一轮与 `DEVELOPMENT_LOG`）。它们**不能**证明权限边界成立，只证明"设计所依据的前提是真的"。

---

## 3. 权限矩阵 v4（读写分离，含两个审计主体）

`F`=完全 `RX`=读+执行 `R`=读 `AD`=追加/建文件 `WD`=写数据 `DE`=删除 `DC`=删子项 `WDAC`=改权限 `WO`=改所有者。

| ID | 路径 | 用户 | pae-hermes | pae-dsh | pae-recorder | pae-anchor |
| --- | --- | --- | --- | --- | --- | --- |
| ACL-01 | `D:\PAE` | F | — | — | — | — |
| ACL-02 | `runtime\hermes-home` | F | **F** | deny F | deny F | deny F |
| ACL-03 | `runtime\dsh-home` | F | deny F | **F** | deny F | deny F |
| ACL-04 | `shared` | F | RX | RX | RX | RX |
| ACL-05 | `policy` | F | RX | RX | RX | RX |
| ACL-06 | `logs` | F | RX | RX | RX | RX |
| ACL-07 | `audit`（目录） | F | deny F | deny F | **`R` + `(OI)(AD)`** | **`R`** |
| ACL-07b | `audit`（明细文件） | F | 经 ACL-07 被拒 | 被拒 | **`R,AD`** | `R` |
| ACL-08 | `audit-anchor`（目录） | F | deny F | deny F | **deny F** | **`R` + `(OI)(AD)`** |
| ACL-08b | checkpoint 文件 | F | 被拒 | 被拒 | 被拒 | **`R,AD`** |
| ACL-09 | `D:\PAE-verify` | F | deny F | deny F | deny F | deny F |
| ACL-11 | `Data\profiles` | 不变 | **deny F** | **deny F** | deny F | deny F |
| ACL-12 | `C:\Users\Administrator\.dsh` | 不变 | **deny F** | **deny F** | deny F | deny F |
| ACL-13 | `Data\tools`/`installs`/`Source` | 不变 | **RX** | — | — | — |
| ACL-14 | `…\Programs\DeepSeek Harness` | 不变 | — | **RX** | — | — |
| ACL-15 | `config.yaml`/`.env`/`auth.json` | 不变 | **deny F** | **deny F** | deny F | deny F |
| ACL-16 | `D:\HermesAgent\Data`（根） | 不变 | 不加 deny | 不加 deny | — | — |

**只读三目录（ACL-04/05/06）** 在 RX 之外，对四个执行/审计账号一律显式 deny：
`(OI)(CI)(WD,AD,WEA,WA,DE,DC,WDAC,WO)` —— 写数据、建文件、删自身、删子项、改 ACL、改所有者，六项全封。

**矩阵与 v3 的差别（Observer §4 指出）**：v3 的判据表把 `audit` 的"读"一律标成拒绝，等于把 Anchor 的合法读取也否掉。v4 改成**按角色分列**：执行账号读也拒；Recorder 读+追加；Anchor 读明细、追加锚点；用户全权。

**为什么是"目录 AD + 文件 AD"而不是"目录 F"**：`(OI)(AD)` 只让 **子文件**可追加，目录本身连"新建文件"都没有 → Recorder 不能自己造新文件，只能往既有明细里追加。代价：日志轮转必须由用户侧计划任务预建下一个段文件。这个限制是刻意的，写在这里防后人"顺手放开"。

---

## 4. 命令清单（逐条对应 ACL 编号，每步查退出码）

```powershell
function Step($name, [scriptblock]$block) {
  $out = & $block 2>&1
  $out | Tee-Object -Append D:\PAE-acl-backup\oplog.txt
  if ($LASTEXITCODE -ne 0) { throw "STEP FAILED: $name (exit=$LASTEXITCODE)" }
}
```

### 4.1 前置检查（建号之前，**不通过就停**）

```powershell
$existing = Get-LocalUser | Where-Object { $_.Name -like 'pae-*' }
if ($existing) { throw "已存在 pae-* 账户，可能上次中断：$($existing.Name -join ',')" }
if (Test-Path D:\PAE) { throw "D:\PAE 已存在，上次可能中断，先人工确认" }
```

### 4.2 建四个标准账号（**先全建成，再碰 ACL**）

```powershell
foreach ($n in "pae-hermes","pae-dsh","pae-recorder","pae-anchor") {
  $pw = Read-Host "password for $n" -AsSecureString
  try   { New-LocalUser -Name $n -Password $pw -PasswordNeverExpires -UserMayNotChangePassword `
                         -Description "PAE $n (Bridge-managed, no interactive logon)" -ErrorAction Stop }
  catch { Write-Error "create $n failed: $_"; break }
}
Get-LocalUser pae-* | Select-Object Name,Enabled,SID
net localgroup Administrators    # 预期：不含任何 pae-*
```

**半成品处理**：任何一步失败 → 立刻 `Remove-LocalUser` 已建成的账户（反向顺序），**不进入 ACL 阶段**。账户建完但 ACL 没动，世界仍是干净的。

### 4.3 SID 解析与核对

```powershell
$AD = (Get-LocalUser Administrator).SID.Value
$PH = (Get-LocalUser pae-hermes).SID.Value
$PD = (Get-LocalUser pae-dsh).SID.Value
$PR = (Get-LocalUser pae-recorder).SID.Value
$PA = (Get-LocalUser pae-anchor).SID.Value
@($AD,$PH,$PD,$PR,$PA) | ForEach-Object { "$_  len=$($_.Length)" }
if ($AD -notlike "*-500") { throw "用户 SID 末段不是 500" }
if (($PH + $PD + $PR + $PA).ToCharArray() | Group-Object | Where-Object Count -gt 1) { }  # 人工确认五个 SID 互不相同
```

### 4.4 备份（6 目标，盘符根执行）+ 双轨校验

```powershell
Step "backup-profiles" { cd D:\; icacls "D:\HermesAgent\Data\profiles" /save "D:\PAE-acl-backup\hermes-profiles.acl" /T }
Step "backup-data-root" { cd D:\; icacls "D:\HermesAgent\Data" /save "D:\PAE-acl-backup\hermes-data-root.acl" }
Step "backup-dsh-home"  { cd C:\; icacls "C:\Users\Administrator\.dsh" /save "D:\PAE-acl-backup\dsh-desktop-home.acl" /T }
Step "backup-config"    { cd D:\; icacls "D:\HermesAgent\Data\config.yaml" /save "D:\PAE-acl-backup\file-config.acl" }
Step "backup-env"       { cd D:\; icacls "D:\HermesAgent\Data\.env" /save "D:\PAE-acl-backup\file-env.acl" }
Step "backup-auth"      { cd D:\; icacls "D:\HermesAgent\Data\auth.json" /save "D:\PAE-acl-backup\file-auth.acl" }
```

> **不带 `/C`**：让它在遇到第一个不可读文件时就失败，而不是"部分成功还返回 0"。确认全过，才允许后续。

双轨校验（**不只看长度**）：

```powershell
# 轨道 1：条目数
$n1 = (Get-ChildItem "D:\HermesAgent\Data\profiles" -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object).Count
# 轨道 2：SDDL 快照（恢复后逐项比对）
Get-ChildItem "D:\HermesAgent\Data\profiles" -Recurse -Force -ErrorAction SilentlyContinue |
  ForEach-Object { [pscustomobject]@{ Path=$_.FullName; SDDL=(Get-Acl $_.FullName).Sddl } } |
  Export-Clixml D:\PAE-acl-backup\acl-before.xml
```

判据：`acl-before.xml` 条目数 == `$n1`；任一 `.acl` 缺失或 0 字节 → **停止**。

### 4.5 建目录 + 切断继承

```powershell
$dirs = "D:\PAE","D:\PAE\runtime","D:\PAE\runtime\hermes-home","D:\PAE\runtime\dsh-home",
        "D:\PAE\shared","D:\PAE\policy","D:\PAE\audit","D:\PAE\audit-anchor","D:\PAE\logs","D:\PAE-verify"
foreach ($d in $dirs) { New-Item -ItemType Directory -Force $d | Out-Null }
foreach ($d in $dirs) {
  Step "inheritance-r $d" { icacls $d /inheritance:r }
  Step "grant-user $d"    { icacls $d /grant:r "*${AD}:(OI)(CI)F" }
}
```

### 4.6 只读三目录（ACL-04/05/06）

```powershell
$roDeny = "(OI)(CI)(WD,AD,WEA,WA,DE,DC,WDAC,WO)"
foreach ($d in "D:\PAE\shared","D:\PAE\policy","D:\PAE\logs") {
  foreach ($s in $PH,$PD,$PR,$PA) {
    Step "ro-grant $d" { icacls $d /grant "*${s}:(OI)(CI)RX" }
    Step "ro-deny  $d" { icacls $d /deny  "*${s}:$roDeny" }
  }
}
```

### 4.7 审计双主体（ACL-07 / 07b / 08 / 08b）

```powershell
# 明细：Recorder 读整个目录 + 只能追加到既有文件；Anchor 只读
Step "audit-grant-recorder-r"  { icacls "D:\PAE\audit" /grant "*${PR}:(OI)(CI)R" }
Step "audit-grant-recorder-ad" { icacls "D:\PAE\audit" /grant "*${PR}:(OI)(AD)" }
Step "audit-grant-anchor-r"    { icacls "D:\PAE\audit" /grant "*${PA}:(OI)(CI)R" }
Step "audit-deny-exec"         { icacls "D:\PAE\audit" /deny "*${PH}:(OI)(CI)F" /deny "*${PD}:(OI)(CI)F" }
Step "audit-deny-anchor-write" { icacls "D:\PAE\audit" /deny "*${PA}:(WD,AD,WEA,WA,DE,DC,WDAC,WO)" }

# 锚点：Anchor 读 + 只能追加；Recorder 与执行账号完全不可见
Step "anchor-grant-anchor" { icacls "D:\PAE\audit-anchor" /grant "*${PA}:(OI)(CI)R" /grant "*${PA}:(OI)(AD)" }
Step "anchor-deny-others"  { icacls "D:\PAE\audit-anchor" /deny "*${PR}:(OI)(CI)F" /deny "*${PH}:(OI)(CI)F" /deny "*${PD}:(OI)(CI)F" }

# 验收证据目录：四个账号全拒
Step "verify-deny" { icacls "D:\PAE-verify" /deny "*${PH}:(OI)(CI)F" /deny "*${PD}:(OI)(CI)F" /deny "*${PR}:(OI)(CI)F" /deny "*${PA}:(OI)(CI)F" }
```

**段文件预建**（因为目录本身不给 AD，Recorder 造不出新文件）：

```powershell
Step "seed-segment" { New-Item -ItemType File -Force "D:\PAE\audit\events-0001.jsonl" | Out-Null }
Step "seed-anchor"  { New-Item -ItemType File -Force "D:\PAE\audit-anchor\anchor-0001.jsonl" | Out-Null }
```

### 4.8 现有路径加锁（ACL-11 / 12 / 15）

```powershell
Step "profiles-deny" { icacls "D:\HermesAgent\Data\profiles" /deny "*${PH}:(OI)(CI)F" /deny "*${PD}:(OI)(CI)F" /deny "*${PR}:(OI)(CI)F" /deny "*${PA}:(OI)(CI)F" }
Step "dsh-home-deny" { icacls "C:\Users\Administrator\.dsh" /deny "*${PH}:(OI)(CI)F" /deny "*${PD}:(OI)(CI)F" /deny "*${PR}:(OI)(CI)F" /deny "*${PA}:(OI)(CI)F" }
foreach ($f in "config.yaml",".env","auth.json") {
  Step "cfg-deny $f" { icacls "D:\HermesAgent\Data\$f" /deny "*${PH}:(F)" /deny "*${PD}:(F)" /deny "*${PR}:(F)" /deny "*${PA}:(F)" }
}
```

### 4.9 运行时授权（ACL-13 / 14）

```powershell
foreach ($p in "D:\HermesAgent\Data\tools","D:\HermesAgent\Data\installs","D:\HermesAgent\Source") {
  Step "hermes-runtime $p" { icacls $p /grant "*${PH}:(OI)(CI)RX" }
}
Step "dsh-runtime" { icacls "C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness" /grant "*${PD}:(OI)(CI)RX" }
```

---

## 5. 有效权限验证（三层，按角色分列）

| 层 | 做什么 | 判据 |
| --- | --- | --- |
| L1 静态 | `icacls` 看有无 `(I)` 继承项、deny 是否覆盖 | 只到 `DESIGNED` |
| L2 动作 | 用目标账号真跑写/覆盖/截断/删/改权限 | 全部 `Access is denied` → 才能 `VERIFIED` |
| L3 正向 | 该允许的操作确实可用 | 输出符合预期 |

**逐目标判据（v4 修正版——不再把 audit 笼统标成"读也拒"）**

| 目标 | pae-hermes | pae-dsh | pae-recorder | pae-anchor |
| --- | --- | --- | --- | --- |
| `policy`/`shared`/`logs` | 读✓ 写✗ 删✗ 改ACL✗ | 同左 | 读✓ 写✗ 删✗ | 读✓ 写✗ 删✗ |
| `audit` | **读✗** 写✗ | **读✗** 写✗ | **读✓ 追加✓** 改✗ 删✗ | **读✓** 写✗ 删✗ |
| `audit-anchor` | 读✗ 写✗ | 读✗ 写✗ | **读✗ 写✗** | **读✓ 追加✓** 改✗ 删✗ |
| 对方 home | 全✗ | 全✗ | 全✗ | 全✗ |
| `Data\profiles` / `.dsh` | 全✗ | 全✗ | 全✗ | 全✗ |
| `Data\tools`/`installs`/`Source` | 读✓ 执行✓ 写✗ | — | — | — |
| DSH 安装目录 | — | 读✓ 执行✓ 写✗ | — | — |
| `PAE-verify` | 全✗ | 全✗ | 全✗ | 全✗ |

**测试结果落盘位置**：`D:\PAE-verify\`（四个账号都写不进去），避免"被测者篡改成绩单"。

---

## 6. 审计信任模型 v4（双主体，五问更新）

### 6.1 为什么 `AD`（追加）真的挡得住覆盖

不是"约定"，是 Windows 的访问权映射：

| 想做的事 | 需要的权限 | Recorder 有吗 |
| --- | --- | --- |
| 追加到文件末尾 | `FILE_APPEND_DATA`（`AD`） | **有** |
| 在任意偏移写 | `FILE_WRITE_DATA`（`WD`） | 无 |
| 截断文件 | `FILE_WRITE_DATA`（`SetEndOfFile` 需要它） | 无 |
| 删除文件 | `DELETE`（`DE`） | 无 |
| 改名/替换 | 目标上的 `DELETE` + 目录的 `AD` | 目标无 `DELETE` |
| 改 ACL / 所有者 | `WRITE_DAC` / `WRITE_OWNER` | 无 |

所以 `R,AD` 是一个**"只能往末尾写、只能读"**的身份。这是可被实际测试证伪的（§7 A1–A6），不是逻辑自证。

### 6.2 五问（v4 答案）

| # | 问题 | 答案 |
| --- | --- | --- |
| 1 | Recorder 被攻陷能否同时改 audit 和 anchor | **不能改锚点**：`pae-recorder` 对 `audit-anchor` 是 deny F（ACL-08）。它能追加垃圾到明细（可被发现），改不了既有 checkpoint |
| 2 | 谁能改 checkpoint | 只有 `pae-anchor`（追加）与用户（全权）。ACL 强制，不靠约定 |
| 3 | Observer 如何独立验证 | 只读三通道：重算链找第一断点 / 核对锚点 `(seq,hash)` 在明细中存在 / 检查各 Agent `seq_local` 跳号。不采信 Recorder 自述 |
| 4 | 怎么防"重写历史再重算链" | 明细对 Recorder 无 `WD/DE/DC` → 不能改旧行、不能截断、不能删了重建；锚点在另一主体手里 → 整体替换也会与旧 checkpoint 分叉；链本身让改一行要重算其后全部 |
| 5 | Recorder 落不了盘怎么办 | 启动自检 → 准入闸门 503 → 在途 `session/cancel` + `unknown_execution` → 立即告警。四步见 §7 C1–C4 |

**两条照旧写死**：①不是"不可篡改"，是"篡改必留断点"；②**拿到管理员权限的一方仍可改写一切**——审计抬高门槛与可发现性，不防最高权限。

**新增的诚实边界（v4）**：Recorder 能**追加伪造事件**（它本来就有追加权）。这不是 ACL 能解决的，靠 HMAC 签名 + 事件编号 + Observer 交叉核对发现异常；本轮不实现。

---

## 7. 验收测试定义（全部 PLANNED，需账号存在才能跑）

> 一律以目标账号身份执行（`schtasks /ru <account>`），输出写 `D:\PAE-verify\`。下面每条都给出"预期被拒"或"预期成功"的明确判据。

### 7.1 A：Recorder 追加权限（Observer §二.1）

前置：`D:\PAE\audit\events-0001.jsonl` 已有 1 行；用 `pae-recorder` 跑下列命令。

| ID | 测试 | 命令 | 预期 |
| --- | --- | --- | --- |
| A1 | 能追加 | `cmd /c echo {"n":2} >> D:\PAE\audit\events-0001.jsonl` | 成功，行数 1→2 |
| A2 | 不能改已有字节 | `powershell -c "[IO.File]::Open('D:\PAE\audit\events-0001.jsonl','Open','ReadWrite')"` | `UnauthorizedAccessException` |
| A3 | 不能截断 | `powershell -c "Set-Content D:\PAE\audit\events-0001.jsonl 'x'"` | 拒绝 |
| A4 | 不能删除 | `cmd /c del D:\PAE\audit\events-0001.jsonl` | `Access is denied`，文件仍在 |
| A5 | 不能替换/改名 | `cmd /c ren events-0001.jsonl evil.jsonl`；`cmd /c copy /y probe.txt events-0001.jsonl` | 两条都拒绝 |
| A6 | 不能改 ACL/所有者 | `icacls D:\PAE\audit\events-0001.jsonl /grant "*<PH>:(F)"`；`takeown /f ...` | 拒绝 |
| A7 | 不能建新文件 | `cmd /c echo x > D:\PAE\audit\new.jsonl` | 拒绝（目录无 `AD`） |

**全过才算 Recorder 边界 `VERIFIED`。** 任一条通过（=没挡住）→ 记 `FAIL`，回退 ACL 并重设计。

### 7.2 B：Anchor 独立性（Observer §二.2）

| ID | 测试 | 命令（以 `pae-anchor`） | 预期 |
| --- | --- | --- | --- |
| B1 | 能读 audit | `cmd /c type D:\PAE\audit\events-0001.jsonl` | 成功输出 |
| B2 | 能追加 checkpoint | `cmd /c echo {"seq":2} >> D:\PAE\audit-anchor\anchor-0001.jsonl` | 成功 |
| B3 | 不能改 audit 明细 | `powershell -c "[IO.File]::Open('D:\PAE\audit\events-0001.jsonl','Open','ReadWrite')"` | 拒绝 |
| B4 | 不能删 audit | `cmd /c del D:\PAE\audit\events-0001.jsonl` | 拒绝 |
| B5 | Recorder 不能碰 checkpoint | 以 `pae-recorder`：`type` / `echo >>` / `del` 锚点文件 | **三条全拒**（含读） |
| B6 | 互不改权限 | 双方各自 `icacls ... /grant` 对方目录 | 均拒绝 |

### 7.3 C：失败关闭（Observer §二.3）

这几条要 Bridge 存在才能端到端跑，本轮只能给判定点，状态 `DESIGNED`：

| ID | 判定点 | 可观察证据 | 状态 |
| --- | --- | --- | --- |
| C1 | Recorder 自检失败 → 不 ready | 启动日志出现 `recorder.selfcheck FAILED`，随后 `bridge.ready=false` | DESIGNED |
| C2 | 审计不可用 → 新任务被拒 | `POST /tasks` 返回 503 + `reason=audit_unavailable` | DESIGNED |
| C3 | 在途任务处理 | `session/cancel` 发出；未入账结果标 `unknown_execution` 并进待裁决队列 | DESIGNED |
| C4 | 无静默降级 | 日志里**不存在**"buffer/flush later/retry in memory"路径；审计恢复前不得放行任何入账 | DESIGNED |

**反向测试（一定要做）**：人为让 `D:\PAE\audit` 不可写（比如临时把 Recorder 的 `AD` 摘掉），验证 C2 真的触发。只测"正常路径"不算验证失败关闭。

### 7.4 D：ACL 与验收一致性（Observer §二.4）

已按角色重写 §3/§5/§11；核对方式是**逐行比对**：矩阵里每个单元格都要能在 §4 找到命令、在 §10 找到验收 ID。缺一即视为方案缺陷（§11 是这张对照表本身）。

---

## 8. 账户创建与回滚（Observer §二.5）

| 检查 | 做法 | 判据 |
| --- | --- | --- |
| 全为标准用户 | 建完查 `net localgroup Administrators` | 无 `pae-*` |
| SID 准确对应 | 四个 SID 全部来自 `Get-LocalUser`，命令一律 `*SID:` | 无名称解析 |
| 创建失败不留半成品 | 4 个账号**先全建成**再动 ACL；任一失败 → `Remove-LocalUser` 已建的 + 停止 | 世界回到干净状态 |
| 备份完整 | 6 个 `.acl` + `acl-before.xml`，无 `/C` | 全部 exit 0 |
| 孤儿 SID | 恢复后扫描：对每个 ACE 的 SID 做 `Translate`，失败即列出 | 只报告，不自动删条目 |
| 回滚失败即停 | 任一 `/restore` 非 0 → **停止**，不再 `Disable-LocalUser`/`Remove-LocalUser` | 保住可诊断状态 |

**孤儿 SID 扫描**（恢复后跑）：

```powershell
Get-ChildItem D:\PAE -Recurse -Force | ForEach-Object {
  (Get-Acl $_.FullName).Access | ForEach-Object {
    try { [void]$_.IdentityReference.Translate([System.Security.Principal.NTAccount]) }
    catch { "ORPHAN: $($_.IdentityReference) on $($_.FullName)" }
  }
}
```

**回滚顺序（固定）**：
1. `schtasks /end` + `/delete` 全部 PAE 任务
2. 停 Bridge / Recorder / Anchor 进程
3. `icacls /restore`（文件级先、目录级后）
4. `acl-after.xml` 与 `acl-before.xml` 逐项 `Compare-Object`
5. 孤儿 SID 扫描（§8 上面那段）
6. `Disable-LocalUser pae-*`
7. 确认桌面 Hermes / DSH 正常
8. 最后 `Remove-LocalUser`（先删会产生孤儿 SID，排障时说不清是谁）
9. 按需删 `D:\PAE`（保留 `D:\PAE-acl-backup` 与日志）

---

## 9. 验收清单 V1–V20

| V | 内容 | 对应 ACL | 状态 |
| --- | --- | --- | --- |
| V1 | 四个账号均为标准用户 | — | PLANNED |
| V2 | SID 解析正确、互不相同、`$AD` 末段 500 | — | PLANNED |
| V3 | 备份 6 目标 exit 0，`acl-before.xml` 条目数匹配 | — | PLANNED |
| V4 | 新目录无 `(I)` 继承 | ACL-01…09 | PLANNED |
| V5 | 只读三目录 L2 写/删/改ACL 三拒 | ACL-04/05/06 | PLANNED |
| V6 | 只读三目录 L3 可读 | ACL-04/05/06 | PLANNED |
| V7 | 执行账号对 audit 读也拒 | ACL-07 | PLANNED |
| V8 | **AC-1** `.dsh` 双向拒绝 | ACL-12 | PLANNED |
| V9 | **AC-2** `profiles` 双向拒绝 | ACL-11 | PLANNED |
| V10 | **AC-3** 三配置文件拒读拒写 | ACL-15 | PLANNED |
| V11 | A1–A7 Recorder 边界 | ACL-07/07b | PLANNED |
| V12 | B1–B6 Anchor 独立性 | ACL-07/08 | PLANNED |
| V13 | Hermes 运行时可用（`import ruamel`） | ACL-13 | PLANNED |
| V14 | DSH 运行时可用（`dsh.cmd --version`） | ACL-14 | PLANNED |
| V15 | **AC-4** 启停脚本 | — | PLANNED |
| V16 | **AC-5 拒改档** | ACL-07/08 | PLANNED（依赖 V11/V12） |
| V17 | **AC-5 检出档**（`verify_audit` 抓篡改） | — | **BLOCKED**（组件未实现） |
| V18 | C1/C2 失败关闭（自检失败→503） | — | **BLOCKED**（Bridge 未实现） |
| V19 | C2 反向测试（摘掉 AD 看是否 503） | ACL-07b | **BLOCKED** |
| V20 | 回滚演练 + 孤儿 SID 扫描 | — | PLANNED |

---

## 10. 一致性核对表（矩阵 ↔ 命令 ↔ 验收 ↔ 状态）

| ACL | 矩阵 | 命令 | 验收 | 状态 |
| --- | --- | --- | --- | --- |
| 01 | `D:\PAE` 用户 F | §4.5 | V4 | PLANNED |
| 02/03 | runtime homes | §4.5 | V4 | PLANNED |
| 04/05/06 | 只读三目录 RX + 6 项 deny | §4.6 | V5,V6 | PLANNED |
| 07 | audit 目录：PR `R`+`(OI)AD`；PA `R`；执行 deny F | §4.7 | V7,V11,V12 | PLANNED |
| 07b | 明细文件：PR `R,AD` | §4.7 | A1–A7 | PLANNED |
| 08 | anchor 目录：PA `R`+`(OI)AD`；PR/执行 deny F | §4.7 | B2,B5 | PLANNED |
| 08b | checkpoint 文件：PA `R,AD` | §4.7 | B2,B5 | PLANNED |
| 09 | verify 目录四账号全拒 | §4.7 | V5（成绩单不可改） | PLANNED |
| 11 | profiles 四账号 deny F | §4.8 | V9 | PLANNED |
| 12 | `.dsh` 四账号 deny F | §4.8 | V8 | PLANNED |
| 13 | Hermes 运行时 RX | §4.9 | V13 | PLANNED |
| 14 | DSH 安装目录 RX | §4.9 | V14 | PLANNED |
| 15 | 三配置文件 deny F | §4.8 | V10 | PLANNED |

---

## 11. 未解决的风险（照实列，不藏）

| # | 风险 | 现状 | 缓解/待办 |
| --- | --- | --- | --- |
| R1 | Recorder 可**追加伪造事件** | 无解于 ACL 层 | HMAC + 事件编号 + Observer 交叉核对（未实现） |
| R2 | Bridge/审计组件尚未实现，C1–C4 只有设计 | `BLOCKED` | CI-3.1 |
| R3 | 管理员权限可绕过一切 | 结构性事实 | 文档已写明；不宣称"不可篡改" |
| R4 | 日志轮转需用户侧任务预建段文件 | 设计取舍 | 写进 runbook，防"顺手放开目录 AD" |
| R5 | `icacls /save` 相对路径易错（盘符根） | 已知 | §4.4 固定 `cd`，回滚同理 |
| R6 | OAuth 凭据共享（P-0 结论） | 部分隔离 | 执行实例只用 API-key 型 provider |
| R7 | 四账号密码管理 | 未定 | 建议：随机密码 + 只存本机凭据管理器，不进文档；需用户拍板 |

---

## 12. 下一次授权需要用户点头的具体操作

按顺序，**任一步失败即停**：

1. **建 4 个本地标准账号**（`pae-hermes`/`pae-dsh`/`pae-recorder`/`pae-anchor`），密码交互输入；
2. **备份 6 个 ACL 目标** + `acl-before.xml`；
3. **restore 演练**（小范围，`D:\PAE-acl-backup\drill`）；
4. 建目录 + `/inheritance:r` + 按矩阵授权（§4.5–4.9）；
5. **预建段文件**（`events-0001.jsonl`、`anchor-0001.jsonl`）；
6. 跑 **V1–V16、V20**，贴原始输出（V17–V19 因组件缺失仍 `BLOCKED`）；
7. 如实写 `WORKSTREAMS` / `DEVELOPMENT_LOG`，AC-5 记 **PARTIAL**。

**本轮没有做的事**：没建账户、没改 ACL、没装软件、没启动 Agent、没调模型、没产生费用。

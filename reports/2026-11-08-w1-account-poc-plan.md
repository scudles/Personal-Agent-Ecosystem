# W-1 实施方案：Windows 独立账户 PoC（仅方案，未执行）

> **已被 [v2](2026-11-08-w1-account-poc-plan-v2.md) 取代（2026-11-08，按 Observer 审查修订）。** 本文件保留作沿革，执行时以 v2 为准。

日期：2026-11-08
作者：Hermes｜审阅：用户（待）｜执行：**未授权**
状态：**方案稿。本轮没有创建账户、没有修改 ACL、没有执行任何系统级变更。** 需要第二次明确授权才动手。

目标：让两个**执行实例**（不是桌面应用）各自跑在独立 Windows 账户下，使 AC-1…AC-5 可被验证。

---

## 0. 前置结论（先说清边界）

1. **只动执行实例，不动桌面。** Hermes Desktop / DSH Desktop 继续以 `Administrator` 运行；它们的配置与数据对 `pae-*` 一律拒绝。
2. **当前会话未提权**（实测 `IsInRole(Administrator)=False`），所以每一步系统变更都需要 UAC；方案里标注了哪些步骤要提权。
3. **先备份再改，先小范围验证再全量。** 顺序错了会把用户自己锁出目录。
4. 全部操作**可回滚**：`icacls /save` + `/restore`，账户删了也不影响数据目录内容。

---

## 1. 创建账户的具体步骤

| 步骤 | 命令（管理员 PowerShell） | 说明 |
| --- | --- | --- |
| S1 | `net user pae-hermes * /add /comment:"PAE execution instance — Hermes"` | 密码交互输入，**不写进任何文档/日志** |
| S2 | `net user pae-dsh * /add /comment:"PAE execution instance — DSH"` | 同上 |
| S3 | `net user pae-hermes` / `net user pae-dsh` | 确认账号存在且 `Account active = Yes` |
| S4 | 确认未加入 Administrators：`net localgroup Administrators` | 输出里不应出现 `pae-*`（标准用户） |
| S5 | 记录 SID：`wmic useraccount where name='pae-hermes' get name,sid` | SID 后续可写进 ACL 审计记录；**只记 SID，不记密码** |

**密码保管**：不落盘到项目目录。执行实例由**计划任务**拉起（Scheduled Task 用 DPAPI 保存密码），Bridge 只调用 `schtasks /run`，不接触明文密码。

---

## 2. 目录结构与 ACL 权限矩阵

### 2.1 新目录（全部在 `D:\PAE\` 下新建，不动现有目录）

```text
D:\PAE\
├── runtime\
│   ├── hermes-home\      # pae-hermes 的 HERMES_HOME（专用 profile 风格）
│   ├── dsh-home\         # pae-dsh 的 DSH_HOME
│   └── observer-home\    # 预留（本轮不建也可）
├── shared\               # 双方只读共享（项目资料副本入口）
├── policy\               # 策略文件：Agent 只读、不可写
├── audit\                # 审计落盘：Agent 只追加、不可删
└── logs\                 # Bridge 自身日志（用户可读）
```

### 2.2 ACL 矩阵（R=读、RX=读+执行、M=改、F=完全、AD=仅追加、DC=拒绝删除）

| 路径 | `Administrator`（用户） | `pae-hermes` | `pae-dsh` | `SYSTEM` |
| --- | --- | --- | --- | --- |
| `D:\PAE\runtime\hermes-home` | F | **F** | 拒绝 R/W | F |
| `D:\PAE\runtime\dsh-home` | F | 拒绝 R/W | **F** | F |
| `D:\PAE\shared` | F | RX | RX | F |
| `D:\PAE\policy` | F | RX（**禁止写**） | RX（**禁止写**） | F |
| `D:\PAE\audit` | F | AD（追加）+ 拒绝 DC | AD + 拒绝 DC | F |
| `D:\PAE\logs` | F | RX | RX | F |

### 2.3 对现有目录的加锁（AC-1 / AC-2 / AC-3 的实质）

| 现有路径 | 对 `pae-hermes` | 对 `pae-dsh` | 理由 |
| --- | --- | --- | --- |
| `D:\HermesAgent\Data\profiles\*` | **拒绝 R/W** | **拒绝 R/W** | AC-2：DSH 不能读 Hermes 私人目录；Hermes 执行实例用自己的 home |
| `D:\HermesAgent\Data\config.yaml`、`.env`、`auth.json` | **拒绝 R/W** | **拒绝 R/W** | AC-3：桌面配置与凭据 |
| `C:\Users\Administrator\.dsh\` | **拒绝 R/W** | **拒绝 R/W** | AC-1：桌面 DSH 的私人目录；执行实例用 `D:\PAE\runtime\dsh-home` |
| `D:\HermesAgent\Data\tools`、`Data\installs`、`D:\HermesAgent\Source` | RX | — | 运行时只读（否则进程起不来） |
| `C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness` | — | RX | DSH 可执行文件只读 |

> **关键细节**：不在 `D:\HermesAgent\Data` 根上做整体拒绝——那样会把运行时也一起锁死。只在**具体子路径**加 deny ACE，并且**先 grant 后 deny**。

---

## 3. 执行顺序与 UAC 操作

顺序不能调换（每一步都以"上一步验证通过"为前提）：

| # | 动作 | 要 UAC？ | 预计 |
| --- | --- | --- | --- |
| 0 | 开一个**管理员 PowerShell 并全程不关**（兜底救援窗口） | 是 | — |
| 1 | 备份 ACL（第 4 节）+ 导出账号列表 | 是 | 2 min |
| 2 | 建两个账户（S1–S5） | 是 | 5 min |
| 3 | 建 `D:\PAE\*` 目录树 | 否（D 盘普通权限即可，若无写权限则提权） | 2 min |
| 4 | 给用户自己在 `D:\PAE` 上显式授 F（**先给自己**） | 是 | 1 min |
| 5 | 授予执行账号的最小权限（runtime F、shared RX、policy RX、audit AD） | 是 | 5 min |
| 6 | 在现有目录上加 deny（2.3 表），**逐个加、逐个验证** | 是 | 10 min |
| 7 | 建计划任务（以各账号运行，含 `HERMES_HOME`/`DSH_HOME`） | 是 | 10 min |
| 8 | 执行验证（第 7 节 AC-1…AC-4 的命令） | 是 | 20 min |
| 9 | 记录结果到 `reports/`，更新 `WORKSTREAMS.md` | 否 | 5 min |

---

## 4. icacls 备份方案

**必须先 cd 到盘符根目录**——`icacls /save` 存的是相对路径，恢复时要在同一根目录执行。

```powershell
# 4.1 建备份目录
New-Item -ItemType Directory -Force D:\PAE-acl-backup

# 4.2 备份新目录树（此时还不存在，跳过；建完后补一次）
cd D:\
icacls "D:\PAE" /save "D:\PAE-acl-backup\PAE.acl" /T /C

# 4.3 备份要加锁的现有路径（三份，分开存，便于单独回滚）
cd D:\
icacls "D:\HermesAgent\Data\profiles" /save "D:\PAE-acl-backup\hermes-profiles.acl" /T /C
icacls "C:\Users\Administrator\.dsh"   /save "D:\PAE-acl-backup\dsh-home.acl" /T /C

# 4.4 备份配置文件本身的 ACL（文件级）
icacls "D:\HermesAgent\Data\config.yaml" /save "D:\PAE-acl-backup\hermes-config.acl"
icacls "D:\HermesAgent\Data\.env"        /save "D:\PAE-acl-backup\hermes-env.acl"
icacls "D:\HermesAgent\Data\auth.json"   /save "D:\PAE-acl-backup\hermes-auth.acl"

# 4.5 账号快照
Get-LocalUser | Select-Object Name,SID,Enabled | Export-Csv D:\PAE-acl-backup\local-users.csv -NoTypeInformation
```

**验证备份有效**：对其中一个小目录先做一次 `/restore` 演练，确认无报错再继续（见第 5 节）。

---

## 5. icacls 回滚方案

```powershell
# 5.1 目录 ACL 回滚（在对应盘符根目录执行）
cd D:\
icacls "D:\" /restore "D:\PAE-acl-backup\PAE.acl" /C
icacls "D:\" /restore "D:\PAE-acl-backup\hermes-profiles.acl" /C
icacls "C:\" /restore "D:\PAE-acl-backup\dsh-home.acl" /C

# 5.2 文件级回滚
icacls "D:\HermesAgent\Data" /restore "D:\PAE-acl-backup\hermes-config.acl" /C
icacls "D:\HermesAgent\Data" /restore "D:\PAE-acl-backup\hermes-env.acl" /C
icacls "D:\HermesAgent\Data" /restore "D:\PAE-acl-backup\hermes-auth.acl" /C

# 5.3 停用/删除账户（数据目录不动，删号不影响文件内容）
Disable-LocalUser -Name pae-hermes
Disable-LocalUser -Name pae-dsh
# 确认无用后再删：
# Remove-LocalUser -Name pae-hermes ; Remove-LocalUser -Name pae-dsh

# 5.4 删除计划任务
schtasks /delete /tn "PAE-hermes-exec" /f
schtasks /delete /tn "PAE-dsh-exec" /f
```

**判定回滚成功**：`icacls <path>` 输出与备份前一致；桌面 Hermes/DSH 正常读写自己的目录；`D:\PAE` 仍可由用户删除。

---

## 6. 防止用户自己失去目录访问权限（五道保险）

1. **先给自己 F，再给别人**：任何目录的第一步都是 `icacls "<path>" /grant:r "Administrator:(OI)(CI)F"`。
2. **绝不对 `Administrator` 写 deny**：deny 只针对 `pae-*`。deny 优先级最高，一条写错就把自己锁死。
3. **不在继承根上做整体拒绝**：只对具体子路径加 ACE，避免把运行时/父目录一起锁死。
4. **全程保留一个管理员 PowerShell**：即使资源管理器打不开，也能在里面 `takeown` + `icacls` 救回。
5. **救援命令预先写好**（复制到剪贴板/贴在自己的笔记里）：
   ```powershell
   takeown /f "D:\PAE" /r /d y
   icacls "D:\PAE" /grant "Administrator:(OI)(CI)F" /T /C
   ```
6. 附加：`D:\PAE` 与备份目录都**不要**设"拒绝删除"，否则连回滚都做不了。

---

## 7. 每一步的验收命令与预期结果

| # | 验收什么 | 命令 | 预期 |
| --- | --- | --- | --- |
| V1 | 账号存在且为标准用户 | `net user pae-hermes` → `net localgroup Administrators` | `Account active Yes`；管理员组里**没有** `pae-*` |
| V2 | 目录 ACL 正确 | `icacls D:\PAE\runtime\hermes-home` | 含 `pae-hermes:(OI)(CI)(F)`、`Administrator:(OI)(CI)(F)` |
| V3 | policy 只读 | `icacls D:\PAE\policy` | `pae-*` 只有 `(RX)`；无 `(W)` |
| V4 | audit 只追加 | `icacls D:\PAE\audit` | `pae-*` 有 `(AD)` 且含 `(DC)` 的 deny |
| V5 | **AC-1**：Hermes 执行实例读不到 DSH 私人目录 | 以 `pae-hermes` 跑 `dir C:\Users\Administrator\.dsh` | `Access is denied` |
| V6 | **AC-2**：DSH 执行实例读不到 Hermes 私人目录 | 以 `pae-dsh` 跑 `dir D:\HermesAgent\Data\profiles` | `Access is denied` |
| V7 | **AC-3**：改不了桌面配置 | 以两个账号分别 `echo x >> D:\HermesAgent\Data\config.yaml` | `Access is denied`（读也要被拒） |
| V8 | 正向可用：能读到运行时 | 以 `pae-hermes` 跑 `dir D:\HermesAgent\Data\installs` | 正常列出（证明没锁过头） |
| V9 | 以执行账号能起进程 | `schtasks /run /tn PAE-hermes-exec` → 读输出文件里的 `whoami` | `pae-hermes` |
| V10 | **AC-4**：Bridge 能启停 | 用 `tools/poc/ac4_lifecycle.py` 对执行实例做一次启动/停止 | 退出码 0、无残留（脚本已自测 6/6） |

**"以某账号执行"怎么做**（没有 psexec 也能测）：
```powershell
schtasks /create /tn "PAE-AC1" /tr "cmd /c (whoami & dir C:\Users\Administrator\.dsh) > D:\PAE\shared\ac1.txt 2>&1" /sc once /st 23:59 /ru pae-hermes /rp *
schtasks /run /tn "PAE-AC1"
# 等 3 秒后读 D:\PAE\shared\ac1.txt，确认 whoami 为 pae-hermes 且 dir 报拒绝
schtasks /delete /tn "PAE-AC1" /f
```

---

## 8. 风险与回退成本

| 风险 | 影响 | 缓解 | 回退 |
| --- | --- | --- | --- |
| 把自己锁出目录 | 高 | 第 6 节五道保险 + 全程管理员窗口 | `takeown` + `/grant` |
| 执行账号读不到运行时 → 进程起不来 | 中 | 只对 `tools/installs/Source` 授 RX，先 V8 验证 | 补一条 `icacls /grant` |
| 计划任务密码过期/丢失 | 中 | 密码永不过期 + 失败告警 | 重建任务 |
| DSH 执行实例缺 `DSH_HOME` → 写到默认位置 | 中 | 任务里显式 `set DSH_HOME=...`，启动后打印 home 核对 | 改任务参数 |
| ACL 继承混乱（父目录 deny 影响子目录） | 中 | 只对具体子路径加 ACE，不用 `/inheritance:r` 全禁 | `/restore` 单路径回滚 |

**总工时**：顺利 3–4 小时（含验证），排障另留 1 天。

---

## 9. 本轮状态（严格区分）

| 项 | 状态 |
| --- | --- |
| 方案编写 | **已编写**（本文件） |
| 方案评审 | 待用户审阅 |
| 账户创建 | **尚未实施** |
| ACL 修改 | **尚未实施** |
| 计划任务 | **尚未实施** |
| AC-1/2/3 验收 | **尚未实施**（当前 `BLOCKED`） |

**下次授权只需要说一句"按方案执行 W-1"，我会从第 0 步（开管理员窗口）开始，并在每一步之后贴出 V1–V10 的实际输出。**

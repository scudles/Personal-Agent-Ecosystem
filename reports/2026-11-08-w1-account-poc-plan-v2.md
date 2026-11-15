# W-1 实施方案 v2：Windows 独立账户 PoC（仅方案，未执行）

> **已被 [v3](2026-11-08-w1-account-poc-plan-v3.md) 取代（2026-11-08，按 Observer 第二轮审查修订）。** 本文件保留作审查证据，执行以 v3 为准。

日期：2026-11-08（v2，按 Observer 第一轮审查修订；v1 见 `2026-11-08-w1-account-poc-plan.md`，已标记为被取代）
作者：Hermes｜审阅：ChatGPT Observer / 用户（待）
状态：**方案稿。未创建账户、未修改 ACL、未执行任何系统级变更。** 需第二次明确授权。

---

## 0. v2 变更记录（对照 Observer 五条修订）

| # | 审查要求 | v2 的改动 |
| --- | --- | --- |
| 1 | 审计权限不能只靠 `AD + DC DENY` | **结构性改造**：Agent 不再直接写审计；改为「事件 → Recorder 落盘 → Anchor 锚点」三角色，ACL 上 Agent 对审计目录**完全不可见**（连读都没有）。设计见 [MVP §5.2](MVP_IDENTITY_AND_POLICY.md) |
| 2 | 备份要逐目标、路径一致、先演练、失败即停 | §5.2 / §5.5 重写：**6 个独立备份目标**、统一在盘符根执行、**先做小范围 restore 演练**、任一步备份失败即中止全部后续 |
| 3 | 新增 P-0 专属 Profile 兼容性验证 | 已实测并单独成文：[P-0 报告](2026-11-08-p0-profile-compatibility.md)。结论进了 §2，并**改变了启动命令** |
| 4 | 逐路径 ACL 命令 + 预期输出 + 核实 SID | §1 核身份（RID 500），§5 逐路径给出 grant/deny/inheritance/backup/restore/verify 与预期输出 |
| 5 | 更新工作流文档、修正 W-2/W-4 状态 | 见 `WORKSTREAMS.md` / `CORE_INFRASTRUCTURE.md`：W-2、W-4 标 `VERIFIED`（代码级），并明确「不等于隔离验收」 |

---

## 1. 身份与前置（先证清楚"我是谁"）

| 项 | 实测值 | 说明 |
| --- | --- | --- |
| 当前账户 | `DESKTOP-92SEIJ8\Administrator` | 名称与内置账号一致 |
| SID | `S-1-5-21-2685768553-884237945-3896909734-500` | **RID 500 = 内置 Administrator 本体**，不是改名账号 |
| 提权状态 | `IsInRole(Administrator) = False` | 令牌被 UAC 过滤；建号/改 ACL 仍需 UAC |
| Hermes store python | `D:\HermesAgent\Data\installs\<key>\environments\<gen>\venv\Scripts\python.exe` | **执行实例必须用它启动**，不能用 `hermes.exe`（见 §2） |

**ACL 命令一律用 `*SID` 形式**，避免名称解析歧义；首次执行时用 `icacls` 回显核对。

---

## 2. P-0 结论摘要（改变本方案的三条）

| 结论 | 对本方案的影响 |
| --- | --- |
| `hermes.exe` + 全新 `HERMES_HOME` → `ModuleNotFoundError: ruamel`；store venv python 直调 → exit 0 且只写新 home | **计划任务必须用 venv python 直调**，否则执行实例起不来 |
| `.env` 不回落；但 **OAuth 按 provider 回退到全局根 `auth.json`**（源码证据） | 执行实例只用 **API-key 型 provider**；否则策略里要标 `credential.shared=true`，不得声称凭据隔离 |
| `DSH_HOME` 实测生效，且未写原 `~/.dsh`（快照哈希不变、3 分钟内 0 变更） | DSH 侧可直接用独立 home；凭据隔离待 AC 后复测 |

---

## 3. 目录结构与 ACL 矩阵（v2）

```text
D:\PAE\
├── runtime\hermes-home\     # pae-hermes 的 HERMES_HOME
├── runtime\dsh-home\        # pae-dsh 的 DSH_HOME
├── shared\                  # 双方只读
├── policy\                  # 双方只读（不可写）
├── audit\                   # 仅 Recorder 可写；Agent 完全不可见
├── audit-anchor\            # 仅用户可读；Agent 完全不可见
└── logs\                    # Bridge 自身日志，双方只读
```

| 路径 | Administrator(`*…-500`) | `pae-hermes` | `pae-dsh` | SYSTEM |
| --- | --- | --- | --- | --- |
| `runtime\hermes-home` | F | **F** | 拒绝 F | F |
| `runtime\dsh-home` | F | 拒绝 F | **F** | F |
| `shared` | F | RX | RX | F |
| `policy` | F | RX（禁写） | RX（禁写） | F |
| `audit` | F | **拒绝 F**（连读都没有） | **拒绝 F** | F |
| `audit-anchor` | R | **拒绝 F** | **拒绝 F** | F |
| `logs` | F | RX | RX | F |

**对现有目录的加锁**

| 路径 | pae-hermes | pae-dsh | 对应验收 |
| --- | --- | --- | --- |
| `D:\HermesAgent\Data\profiles`（含子目录） | 拒绝 F | 拒绝 F | AC-2 |
| `D:\HermesAgent\Data\config.yaml` / `.env` / `auth.json` | 拒绝 F | 拒绝 F | AC-3 |
| `C:\Users\Administrator\.dsh`（含子目录） | 拒绝 F | 拒绝 F | AC-1 |
| `D:\HermesAgent\Data\tools` / `installs` / `D:\HermesAgent\Source` | RX | — | 正向可用 |
| `C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness` | — | RX | 正向可用 |

> **不做什么**：不在 `D:\HermesAgent\Data` 根上整体拒绝（会把运行时一起锁死）；不对 `Administrator` 写任何 deny。

---

## 4. 审计写入机制在目录层的落法

设计见 [MVP §5.2](MVP_IDENTITY_AND_POLICY.md)。落到 ACL 就是三句话：

1. **Agent 看不到 audit**：`/deny "*<pae-sid>:(OI)(CI)(F)"` —— 连读都不给，杜绝"读了再照着改"。
2. **Recorder 只追加**：v1 里 Recorder 以用户账号运行（Bridge 内组件），无需额外 ACE；若将来独立成账号，给它目录 `(AD)`、文件 `(AD)`，并 deny `(W)` / `(DC)` / `(WDAC)`。
3. **Anchor 单独一份**：`audit-anchor` 对 Agent 同样完全拒绝；checkpoint 由 Recorder 写、用户读、Observer 可读。

**写失败即停**：Recorder 无法落盘时，Bridge 拒绝新任务准入（行为约定，不靠 ACL 保证）。

---

## 5. 逐路径 ACL 命令清单

> 全部在**管理员 PowerShell** 执行；`$PH`/`$PD`/`$AD` 见 §5.1。
> 预期输出里 `NT AUTHORITY\SYSTEM` 在中文系统可能显示为本地化名称，属正常。

### 5.1 解析 SID（建号之后、改 ACL 之前）

```powershell
$PH = (Get-LocalUser pae-hermes).SID.Value
$PD = (Get-LocalUser pae-dsh).SID.Value
$AD = "S-1-5-21-2685768553-884237945-3896909734-500"
"$PH`n$PD`n$AD"
```

预期：三行 SID；`$AD` 末段为 **500**。

### 5.2 备份（**逐目标独立**，全部在盘符根执行）

```powershell
New-Item -ItemType Directory -Force D:\PAE-acl-backup | Out-Null

cd D:\
icacls "D:\HermesAgent\Data\profiles" /save "D:\PAE-acl-backup\hermes-profiles.acl" /T /C
icacls "D:\HermesAgent\Data"          /save "D:\PAE-acl-backup\hermes-data-root.acl"
cd C:\
icacls "C:\Users\Administrator\.dsh"  /save "D:\PAE-acl-backup\dsh-desktop-home.acl" /T /C
cd D:\
icacls "D:\HermesAgent\Data\config.yaml" /save "D:\PAE-acl-backup\file-config.acl"
icacls "D:\HermesAgent\Data\.env"        /save "D:\PAE-acl-backup\file-env.acl"
icacls "D:\HermesAgent\Data\auth.json"   /save "D:\PAE-acl-backup\file-auth.acl"
```

**校验（不通过就停）**：

```powershell
Get-ChildItem D:\PAE-acl-backup\*.acl | Select-Object Name,Length
```

预期：**6 个文件，Length 全部 > 0**。任一为 0 或缺失 → **立即停止，不执行后续任何步骤**。

> 相对路径规则：`/save` 记录相对当前目录的路径，**恢复必须在同一盘符根**。`dsh-desktop-home.acl` 是 `cd C:\` 存的，恢复也在 `C:\`。

### 5.3 新建目录（grant + deny）

```powershell
$dirs = "D:\PAE","D:\PAE\runtime","D:\PAE\runtime\hermes-home","D:\PAE\runtime\dsh-home",
        "D:\PAE\shared","D:\PAE\policy","D:\PAE\audit","D:\PAE\audit-anchor","D:\PAE\logs"
foreach ($d in $dirs) { New-Item -ItemType Directory -Force $d | Out-Null }

# 永远第一步：先给自己
foreach ($d in $dirs) { icacls $d /grant:r "*${AD}:(OI)(CI)F" | Out-Null }

# 各自的家（先 grant 再 deny）
icacls "D:\PAE\runtime\hermes-home" /grant "*${PH}:(OI)(CI)F" | Out-Null
icacls "D:\PAE\runtime\dsh-home"    /grant "*${PD}:(OI)(CI)F" | Out-Null
icacls "D:\PAE\runtime\hermes-home" /deny  "*${PD}:(OI)(CI)F" | Out-Null
icacls "D:\PAE\runtime\dsh-home"    /deny  "*${PH}:(OI)(CI)F" | Out-Null

# 只读区
foreach ($d in "D:\PAE\shared","D:\PAE\policy","D:\PAE\logs") {
  icacls $d /grant "*${PH}:(OI)(CI)RX" /grant "*${PD}:(OI)(CI)RX" | Out-Null
}
icacls "D:\PAE\policy" /deny "*${PH}:(OI)(CI)W" /deny "*${PD}:(OI)(CI)W" | Out-Null

# 审计：Agent 完全不可见
icacls "D:\PAE\audit"        /deny "*${PH}:(OI)(CI)F" /deny "*${PD}:(OI)(CI)F" | Out-Null
icacls "D:\PAE\audit-anchor" /deny "*${PH}:(OI)(CI)F" /deny "*${PD}:(OI)(CI)F" | Out-Null
```

**预期输出**（`icacls D:\PAE\runtime\hermes-home`）：

```
hermes-home DESKTOP-92SEIJ8\pae-hermes:(OI)(CI)(F)
            DESKTOP-92SEIJ8\Administrator:(OI)(CI)(F)
            DESKTOP-92SEIJ8\pae-dsh:(DENY)(OI)(CI)(F)
            NT AUTHORITY\SYSTEM:(OI)(CI)(F)
```

### 5.4 现有目录加锁（**逐个加、逐个验**）

```powershell
icacls "D:\HermesAgent\Data\profiles" /deny "*${PD}:(OI)(CI)F" | Out-Null   # AC-2
icacls "C:\Users\Administrator\.dsh"  /deny "*${PH}:(OI)(CI)F" | Out-Null   # AC-1
foreach ($f in "config.yaml",".env","auth.json") {                          # AC-3
  icacls "D:\HermesAgent\Data\$f" /deny "*${PH}:(F)" /deny "*${PD}:(F)" | Out-Null
}
```

**预期输出**（`icacls D:\HermesAgent\Data\profiles`）新增一行：`DESKTOP-92SEIJ8\pae-dsh:(DENY)(OI)(CI)(F)`

### 5.5 恢复演练（**小范围先试**，通过才允许正式回滚）

```powershell
New-Item -ItemType Directory -Force D:\PAE-acl-backup\drill | Out-Null
icacls "D:\PAE-acl-backup\drill" /grant:r "*${AD}:(OI)(CI)F" | Out-Null
cd D:\
icacls "D:\PAE-acl-backup\drill" /save "D:\PAE-acl-backup\drill.acl" /T /C
icacls "D:\PAE-acl-backup\drill" /deny  "*${PD}:(F)" | Out-Null    # 人为改坏
icacls "D:\" /restore "D:\PAE-acl-backup\drill.acl" /C             # 恢复
icacls "D:\PAE-acl-backup\drill"                                    # 确认 deny 消失
```

预期：恢复后无 `(DENY)` 行、无 `Failed processing`。**演练失败 → 停止全部后续操作。**

### 5.6 正式回滚（仅需要时）

```powershell
cd D:\
icacls "D:\" /restore "D:\PAE-acl-backup\hermes-profiles.acl" /C
icacls "D:\" /restore "D:\PAE-acl-backup\hermes-data-root.acl" /C
icacls "D:\" /restore "D:\PAE-acl-backup\file-config.acl" /C
icacls "D:\" /restore "D:\PAE-acl-backup\file-env.acl" /C
icacls "D:\" /restore "D:\PAE-acl-backup\file-auth.acl" /C
cd C:\
icacls "C:\" /restore "D:\PAE-acl-backup\dsh-desktop-home.acl" /C
Disable-LocalUser pae-hermes, pae-dsh
```

### 5.7 验证命令（verify）

```powershell
foreach ($p in "D:\PAE\runtime\hermes-home","D:\PAE\runtime\dsh-home","D:\PAE\shared",
               "D:\PAE\policy","D:\PAE\audit","D:\PAE\audit-anchor","D:\PAE\logs",
               "D:\HermesAgent\Data\profiles","C:\Users\Administrator\.dsh",
               "D:\HermesAgent\Data\config.yaml") { "== $p"; icacls $p }
```

| 路径 | 预期关键行 |
| --- | --- |
| `runtime\hermes-home` | `pae-hermes:(OI)(CI)(F)`；`pae-dsh:(DENY)…(F)` |
| `runtime\dsh-home` | `pae-dsh:(OI)(CI)(F)`；`pae-hermes:(DENY)…(F)` |
| `policy` | `pae-*:(OI)(CI)(RX)` 且**无** `(W)` |
| `audit` / `audit-anchor` | 两个 `pae-*:(DENY)…(F)` |
| `Data\profiles` | `pae-dsh:(DENY)(OI)(CI)(F)` |
| `Users\Administrator\.dsh` | `pae-hermes:(DENY)(OI)(CI)(F)` |
| `Data\config.yaml` | 两个 `pae-*:(DENY)(F)` |

---

## 6. 执行顺序与 UAC

| # | 动作 | UAC | 预计 |
| --- | --- | --- | --- |
| 0 | 开管理员 PowerShell 并全程不关 | 是 | — |
| 1 | 建两个标准账号（密码交互输入，不落盘） | 是 | 5 min |
| 2 | 解析 SID（§5.1） | 否 | 1 min |
| 3 | 备份 6 目标 + 校验（§5.2）**失败即停** | 是 | 5 min |
| 4 | 小范围 restore 演练（§5.5）**失败即停** | 是 | 5 min |
| 5 | 建目录 + grant/deny（§5.3） | 是 | 8 min |
| 6 | 现有目录加锁（§5.4） | 是 | 10 min |
| 7 | 计划任务（venv python 直调） | 是 | 10 min |
| 8 | 验收 V1–V12 | 是 | 25 min |
| 9 | 记录证据、更新 WORKSTREAMS | 否 | 5 min |

---

## 7. 防止自己失去访问权限（六道保险）

1. **先给自己 F，再给别人**（§5.3 第一行就是）。
2. **绝不对 `Administrator` 写 deny**；deny 只针对 `pae-*`。
3. **不在继承根上整体拒绝**；只对具体子路径加 ACE。
4. **全程保留管理员窗口**。
5. **预写救援命令**：
   ```powershell
   takeown /f "D:\PAE" /r /d y
   icacls "D:\PAE" /grant "*S-1-5-21-2685768553-884237945-3896909734-500:(OI)(CI)F" /T /C
   ```
6. **备份与 `D:\PAE` 都不设"拒绝删除"**，否则连回滚都做不了。

---

## 8. 验收 V1–V12（全过才进下一步）

| # | 验收 | 命令 | 预期 |
| --- | --- | --- | --- |
| V1 | 账号为标准用户 | `net localgroup Administrators` | 无 `pae-*` |
| V2 | SID 解析正确 | §5.1 | 三行 SID；`$AD` 末段 500 |
| V3 | 备份齐全 | §5.2 校验 | 6 个 .acl，长度全 > 0 |
| V4 | restore 演练通过 | §5.5 | 无 DENY 残留、无报错 |
| V5 | home ACL 正确 | §5.7 | 见 5.7 表 |
| V6 | **AC-1** | 以 `pae-hermes` 跑 `dir C:\Users\Administrator\.dsh` | `Access is denied` |
| V7 | **AC-2** | 以 `pae-dsh` 跑 `dir D:\HermesAgent\Data\profiles` | `Access is denied` |
| V8 | **AC-3** | 两个账号分别 `echo x >> D:\HermesAgent\Data\config.yaml` | `Access is denied` |
| V9 | 正向可用 | 以 `pae-hermes` 跑 `dir D:\HermesAgent\Data\installs` | 正常列出 |
| V10 | 执行实例能起 | `schtasks /run /tn PAE-hermes-exec` → 读输出里的 `whoami` | `pae-hermes` |
| V11 | **AC-4** | `tools/poc/ac4_lifecycle.py` 启停执行实例 | 退出码 0、无残留 |
| V12 | **AC-5** 两档 | ①Agent 账号 `UPDATE/DELETE` 审计 → 拒；②特权改一行 → `verify_audit` 报 `audit_chain_broken` | ①②拒 **且** ②检出；只检出 = PARTIAL |

**V12 前置**：Recorder 与 `verify_audit` 尚未实现（本轮只做设计）→ **W-1 通过 ≠ AC-5 通过**。

---

## 9. 风险与回退

| 风险 | 影响 | 缓解 | 回退 |
| --- | --- | --- | --- |
| 把自己锁出目录 | 高 | §7 六道保险 | `takeown` + `/grant` |
| 备份失败却继续 | 高 | §5.2 失败即停 | 停止，不执行后续 |
| 执行账号读不到运行时 | 中 | 只对 tools/installs/Source 授 RX，先 V9 | 补 grant |
| 计划任务用错解释器 | 中 | 用 store venv python 直调（P-0 实证） | 改任务命令 |
| OAuth 凭据仍共享 | 中 | 执行实例用 API-key 型 provider | 策略标 `shared` |

**总工时**：顺利 3–4 小时，排障另留 1 天。

---

## 10. 本轮状态

| 项 | 状态 |
| --- | --- |
| 方案 v2 编写 | **已编写** |
| P-0 兼容性检查 | **已执行并出证**（无害、零费用） |
| 审计机制重新设计 | **已完成设计**（MVP §5.2），未实现 |
| 账户创建 / ACL 修改 | **尚未实施** |
| AC-1…AC-5 | 仍 `BLOCKED`（AC-5 另依赖 CI-3.1） |

下次授权只需一句"按方案执行 W-1"，我从第 0 步开始并在每步后贴 V1–V12 的实际输出。

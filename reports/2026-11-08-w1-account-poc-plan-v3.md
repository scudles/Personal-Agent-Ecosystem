# W-1 实施方案 v3：Windows 独立账户 PoC（仅方案，未执行）

日期：2026-11-08（v3，按 Observer 第二轮审查修订）
作者：Hermes｜审阅：ChatGPT Observer / 用户（待）
状态：**方案稿。未创建账户、未修改 ACL、未执行任何系统级变更。** 需第三次明确授权。
历史：[v1](2026-11-08-w1-account-poc-plan.md) → [v2](2026-11-08-w1-account-poc-plan-v2.md) → 本文（v3）。v1/v2 保留作审查证据，不覆盖。

---

## 0. v2 → v3 修订对照表

| 编号 | Observer 要求 | v3 的处置 | 落在哪节 |
| --- | --- | --- | --- |
| **P0-1** | Hermes profiles 必须同时拒绝两个执行账号 | v2 只拒了 `pae-dsh`；v3 对 `pae-hermes` 也拒绝 | ACL-11 |
| **P0-2** | DSH `.dsh` 必须同时拒绝两个账号 | v2 只拒了 `pae-hermes`；v3 两个都拒 | ACL-12 |
| **P0-3** | 矩阵 / 命令 / 验收三者一致 | 新增**统一编号 ACL-01…ACL-18**，每条都绑「命令 ID + 验收 ID + AC」，见 §11 一致性表 | §4 / §5 / §6 / §11 |
| **P0-4** | 补齐 Hermes tools/installs/Source 的 RX | v2 矩阵里有、命令里缺；v3 补 grant 与执行验证 | ACL-13 / V13 |
| **P0-5** | 补齐 DSH 安装目录 RX | 同上 | ACL-14 / V14 |
| **P1** | 只读不能只靠 RX | 发现 **`D:\` 根把 `Authenticated Users:(M)` 继承下来**——新目录不切断继承就等于可写。v3 改为「切断继承 + 显式 RX + 显式 deny 写/删/改 ACL」 | §3 / ACL-07/08/09 |
| **P2** | 审计信任模型不能只是"两个目录名" | 引入**第三个主体 `pae-anchor`**；逐条回答五问；并写明「有管理员权限就挡不住」 | §7 |
| **P3** | 备份/恢复验收强化 | 每步查 `$LASTEXITCODE`、解析部分失败、双轨校验（icacls + Get-Acl JSON）、恢复后逐项比对、回滚顺序固定 | §8 / §9 |
| **P4** | 运行时授权逐一补齐 | 每条运行时路径都有 grant + verify + 实际执行测试 | §6 / §10 |

**新增授权需求（必须先拍板）**：P2 的结论要求**多一个账号 `pae-anchor`**（否则"Recorder 被攻陷"这个问题无解）。这超出原 W-1 的"两个账号"范围，见 §7.6。

---

## 1. 只读勘察结果（本轮实测，P1 的依据）

```
D:\                                        ← 继承源
  BUILTIN\Administrators:(F)  (OI)(CI)(IO)(F)
  NT AUTHORITY\SYSTEM:(F)     (OI)(CI)(IO)(F)
  NT AUTHORITY\Authenticated Users:(M)  (OI)(CI)(IO)(M)     ← 关键
  BUILTIN\Users:(RX)          (OI)(CI)(IO)(GR,GE)
```

`D:\HermesAgent\Data\tools`、`Data\installs`、`D:\HermesAgent\Source` 都是 `(I)` 继承来的同一套 ACE，其中包含 **`Authenticated Users:(I)(OI)(CI)(IO)(M)`**。

**含义（这是 v2 的一个实质漏洞）**：`pae-hermes` / `pae-dsh` 是本地标准用户，属于 `Authenticated Users`。如果在 `D:\PAE\*` 下新建目录**不切断继承**，它们会**继承到 Modify**——再给一条 RX 根本不构成只读。

另两条勘察结果：

| 路径 | 现状 | 影响 |
| --- | --- | --- |
| `C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness` | 只有 `SYSTEM` / `Administrators` / `Administrator` 三个 `(F)`，**没有 `Users:(RX)`** | `pae-dsh` 现在**读不到也执行不了** DSH → 必须显式授 RX（P0-5 的实证） |
| `C:\Users\Administrator\.dsh`、`D:\HermesAgent\Data\profiles` | 需在正式执行时逐条 `icacls` 回显并留证 | 用于 P0-1/P0-2 的双向拒绝 |

> 结论：**任何"新目录默认安全"的假设都不成立**。v3 的所有新目录一律 `/inheritance:r`，权限只能来自显式 ACE。

---

## 2. 主体与账户（三个）

| 主体 | 账号 | 角色 | 备注 |
| --- | --- | --- | --- |
| 用户 | `*…-500`（Administrator） | 最终授权 / 维护 | 已核实 RID 500 |
| Hermes 执行实例 | `pae-hermes` | 跑 Hermes ACP | API-key 型 provider（P-0 结论） |
| DSH 执行实例 | `pae-dsh` | 跑 DSH ACP | 自带 `DSH_HOME` |
| **Anchor 写入者** | **`pae-anchor`** | 只写 checkpoint，读审计尾 | **新增**，见 §7.6 |

---

## 3. 目录结构（v3）

```text
D:\PAE\
├── runtime\hermes-home\     # pae-hermes F
├── runtime\dsh-home\        # pae-dsh F
├── shared\                  # 两个执行账号：RX（禁写禁删）
├── policy\                  # 两个执行账号：RX（禁写禁删）
├── audit\                   # 只有 pae-recorder 追加；anchor 读；executor 完全不可见
├── audit-anchor\            # 只有 pae-anchor 追加；executor 完全不可见
└── logs\                    # 两个执行账号：RX（禁写禁删）
D:\PAE-verify\               # 仅用户可写；执行账号拒绝（验收证据落这里，防篡改）
```

> 注：v1/v2 把 Recorder 写成"Bridge 内的组件、以用户账号运行"。v3 起，**Recorder 也必须有独立身份**（`pae-recorder`）才能谈"被攻陷后能否重写"。若暂不建 `pae-recorder`，就必须在文档里承认：Recorder 与用户同权 → 其被攻陷等价于用户被攻陷。见 §7.6 的两个选项。

---

## 4. 权限矩阵 v3（统一编号）

权限缩写：`F`=完全、`RX`=读+执行、`R`=读、`AD`=追加/新建文件、`WD`=写数据、`DE`=删除、`DC`=删子项、`WDAC`=改权限、`WO`=改所有者。

| ID | 路径 | 用户(*…-500) | pae-hermes | pae-dsh | pae-anchor | 执行账号的显式 deny |
| --- | --- | --- | --- | --- | --- | --- |
| ACL-01 | `D:\PAE` | F | — | — | — | — |
| ACL-02 | `runtime\hermes-home` | F | **F** | deny F | deny F | — |
| ACL-03 | `runtime\dsh-home` | F | deny F | **F** | deny F | — |
| ACL-04 | `shared` | F | RX | RX | RX | WD,AD,WEA,WA,DE,DC,WDAC,WO |
| ACL-05 | `policy` | F | RX | RX | RX | WD,AD,WEA,WA,DE,DC,WDAC,WO |
| ACL-06 | `logs` | F | RX | RX | RX | WD,AD,WEA,WA,DE,DC,WDAC,WO |
| ACL-07 | `audit` | F | deny F | deny F | **R** | 全拒 |
| ACL-08 | `audit-anchor` | F | deny F | deny F | **R,AD** | 全拒 |
| ACL-09 | `D:\PAE-verify` | F | deny F | deny F | deny F | 全拒 |
| ACL-10 | `D:\PAE\audit`（Recorder 视角） | — | — | — | — | 见 ACL-07：`pae-recorder` 另授 `R,AD` |
| ACL-11 | `D:\HermesAgent\Data\profiles` | 不变 | **deny F** | **deny F** | deny F | — |
| ACL-12 | `C:\Users\Administrator\.dsh` | 不变 | **deny F** | **deny F** | deny F | — |
| ACL-13 | `D:\HermesAgent\Data\tools` / `installs` / `D:\HermesAgent\Source` | 不变 | **RX** | — | — | — |
| ACL-14 | `…\Programs\DeepSeek Harness` | 不变 | — | **RX** | — | — |
| ACL-15 | `Data\config.yaml` / `.env` / `auth.json` | 不变 | **deny F** | **deny F** | deny F | — |
| ACL-16 | `D:\HermesAgent\Data`（根） | 不变 | 不加 deny | 不加 deny | 不加 deny | — 避免锁死运行时 |
| ACL-17 | `audit` 明细文件 | 用户 F | — | — | — | Recorder: `R,AD`；无 `WD/DE/WDAC` |
| ACL-18 | `audit-anchor` 的 checkpoint 文件 | 用户 F | — | — | `R,AD` | 无 `WD/DE/WDAC` |

---

## 5. 实际命令清单（逐条对应 ACL 编号）

> 管理员 PowerShell。`$AD`=用户 SID、`$PH`/`$PD`/`$PA`/`$PR`=pae-* 的 SID。
> **每条命令后必须检查 `$LASTEXITCODE`**：`if ($LASTEXITCODE -ne 0) { throw "step failed" }`。建议包成 `function Step($name, $block)`，失败即停。

### 5.1 解析 SID

```powershell
$AD = (Get-LocalUser Administrator).SID.Value
$PH = (Get-LocalUser pae-hermes).SID.Value
$PD = (Get-LocalUser pae-dsh).SID.Value
$PA = (Get-LocalUser pae-anchor).SID.Value
$PR = (Get-LocalUser pae-recorder).SID.Value   # 若采纳 §7.6 选项 B
```

### 5.2 新建目录 + 切断继承 + 基线授权（ACL-01…09）

```powershell
$dirs = "D:\PAE","D:\PAE\runtime","D:\PAE\runtime\hermes-home","D:\PAE\runtime\dsh-home",
        "D:\PAE\shared","D:\PAE\policy","D:\PAE\audit","D:\PAE\audit-anchor","D:\PAE\logs","D:\PAE-verify"
foreach ($d in $dirs) { New-Item -ItemType Directory -Force $d | Out-Null }

# 关键：切断继承，否则会继承到 Authenticated Users:(M)
foreach ($d in $dirs) {
  icacls $d /inheritance:r | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "inheritance:r failed: $d" }
  icacls $d /grant:r "*${AD}:(OI)(CI)F" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "grant user failed: $d" }
}
```

**预期**（`icacls D:\PAE\policy`）：只有一行 `…Administrator:(OI)(CI)(F)`，**没有任何 `(I)` 继承项**。

### 5.3 执行账号的家（ACL-02 / ACL-03）

```powershell
icacls "D:\PAE\runtime\hermes-home" /grant "*${PH}:(OI)(CI)F" /deny "*${PD}:(OI)(CI)F" /deny "*${PA}:(OI)(CI)F"
icacls "D:\PAE\runtime\dsh-home"    /grant "*${PD}:(OI)(CI)F" /deny "*${PH}:(OI)(CI)F" /deny "*${PA}:(OI)(CI)F"
```

### 5.4 只读三目录（ACL-04/05/06，P1 的核心）

**不能只给 RX**。显式 deny 掉「写数据 / 建文件 / 删自身 / 删子项 / 改 ACL / 改所有者」：

```powershell
$roDeny = "(OI)(CI)(WD,AD,WEA,WA,DE,DC,WDAC,WO)"
foreach ($d in "D:\PAE\shared","D:\PAE\policy","D:\PAE\logs") {
  icacls $d /grant "*${PH}:(OI)(CI)RX" /grant "*${PD}:(OI)(CI)RX" /grant "*${PA}:(OI)(CI)RX" | Out-Null
  icacls $d /deny  "*${PH}:$roDeny"    /deny  "*${PD}:$roDeny"    /deny  "*${PA}:$roDeny" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "readonly dir failed: $d" }
}
```

**预期**（`icacls D:\PAE\policy`）：

```
D:\PAE\policy DESKTOP-92SEIJ8\Administrator:(OI)(CI)(F)
              DESKTOP-92SEIJ8\pae-hermes:(OI)(CI)(RX)
              DESKTOP-92SEIJ8\pae-hermes:(DENY)(OI)(CI)(WD,AD,WEA,WA,DE,DC,WDAC,WO)
              DESKTOP-92SEIJ8\pae-dsh:(OI)(CI)(RX)
              DESKTOP-92SEIJ8\pae-dsh:(DENY)(OI)(CI)(WD,AD,WEA,WA,DE,DC,WDAC,WO)
              DESKTOP-92SEIJ8\pae-anchor:(OI)(CI)(RX)
              …
```

### 5.5 审计与锚点（ACL-07/08/09 + 17/18）

```powershell
# 明细：Recorder 只能追加（R 用于算 prev_hash），Anchor 只读
icacls "D:\PAE\audit" /grant "*${PR}:(OI)(CI)(R,AD)" /grant "*${PA}:(OI)(CI)R" `
                      /deny  "*${PH}:(OI)(CI)F" /deny "*${PD}:(OI)(CI)F" /deny "*${PA}:(OI)(CI)(WD,AD,WEA,WA,DE,DC,WDAC,WO)"
# 锚点：只有 Anchor 能追加，Recorder 完全不可写
icacls "D:\PAE\audit-anchor" /grant "*${PA}:(OI)(CI)(R,AD)" `
                             /deny  "*${PR}:(OI)(CI)F" /deny "*${PH}:(OI)(CI)F" /deny "*${PD}:(OI)(CI)F"
# 验收证据目录：只有用户
icacls "D:\PAE-verify" /deny "*${PH}:(OI)(CI)F" /deny "*${PD}:(OI)(CI)F" /deny "*${PA}:(OI)(CI)F"
```

### 5.6 现有目录加锁（ACL-11 / 12 / 15，P0-1、P0-2 的修正）

```powershell
# ACL-11：Hermes profiles —— 两个执行账号都拒绝（v2 只拒了一个）
icacls "D:\HermesAgent\Data\profiles" /deny "*${PH}:(OI)(CI)F" /deny "*${PD}:(OI)(CI)F" /deny "*${PA}:(OI)(CI)F"
# ACL-12：桌面 DSH home —— 两个执行账号都拒绝（v2 只拒了一个）
icacls "C:\Users\Administrator\.dsh" /deny "*${PH}:(OI)(CI)F" /deny "*${PD}:(OI)(CI)F" /deny "*${PA}:(OI)(CI)F"
# ACL-15：桌面配置与凭据（文件级）
foreach ($f in "config.yaml",".env","auth.json") {
  icacls "D:\HermesAgent\Data\$f" /deny "*${PH}:(F)" /deny "*${PD}:(F)" /deny "*${PA}:(F)"
}
```

### 5.7 运行时授权（ACL-13 / 14，P0-4、P0-5）

```powershell
# Hermes 运行时（只读+执行）
foreach ($p in "D:\HermesAgent\Data\tools","D:\HermesAgent\Data\installs","D:\HermesAgent\Source") {
  icacls $p /grant "*${PH}:(OI)(CI)RX"
}
# DSH 安装目录（实测现在没有 Users 读权限，必须显式授）
icacls "C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness" /grant "*${PD}:(OI)(CI)RX"
```

---

## 6. 有效权限验证方案（不是"看 ACE 就觉得安全"）

每个目标做**三层验证**，三层都过才算只读/拒绝成立：

| 层 | 做什么 | 命令 | 判据 |
| --- | --- | --- | --- |
| L1 静态 | ACE 清单里**没有 `(I)` 继承项**，且 deny 覆盖 WD/AD/DE/DC/WDAC/WO | `icacls <path>` | 无 `(I)`；有对应 `(DENY)` 行 |
| L2 实际动作 | 以目标账号真的去写/删/改权限 | 计划任务跑 `cmd /c` 三条测试（见下） | 全部 `Access is denied` |
| L3 正向可用 | 以目标账号读得到、跑得起来 | `dir` / `python --version` / `dsh.cmd --version` | 正常输出 |

**L2 测试模板**（结果写到 `D:\PAE-verify`，执行账号写不进去，所以结果可信）：

```powershell
$cmd = 'cmd /c ( whoami & echo probe> D:\PAE\policy\probe.txt 2>&1 & del D:\PAE\policy\seed.txt 2>&1 & icacls D:\PAE\policy /grant *{PH}:(F) 2>&1 ) > D:\PAE-verify\acl-test.txt 2>&1'
schtasks /create /tn "PAE-VT" /tr $cmd /sc once /st 23:59 /ru pae-hermes /rp * /rl LIMITED
schtasks /run /tn "PAE-VT"
# 3 秒后读 D:\PAE-verify\acl-test.txt：应出现 3 次 Access is denied
```

**逐目标判据表**

| 目标 | 写文件 | 删文件 | 改 ACL | 读 |
| --- | --- | --- | --- | --- |
| `policy` / `shared` / `logs` | 拒 | 拒 | 拒 | 允许 |
| `audit` / `audit-anchor` / `PAE-verify` | 拒 | 拒 | 拒 | **拒** |
| 对方 home | 拒 | 拒 | 拒 | 拒 |
| `Data\profiles` / `.dsh` | 拒 | 拒 | 拒 | 拒 |
| `Data\tools` / `installs` / `Source`（pae-hermes） | 拒（RX） | 拒 | 拒 | 允许 |
| DSH 安装目录（pae-dsh） | 拒 | 拒 | 拒 | 允许 |

---

## 7. 审计信任模型（P2：五个问题，逐一回答）

### 7.1 Recorder 被攻陷后，能否同时重写 audit 和 anchor？

**在 v2 的设计下：能。** 因为 v2 里 Recorder 与 Anchor 只是两个目录名、同一个进程、同一个账号 —— 攻击者拿到该进程的权力就能改两边，锚点等于没有。

**v3 的修正**：把两者拆成**不同主体**——
- `pae-recorder`：对 `audit` 只有 `R,AD`（读+追加），**对 `audit-anchor` 完全无写**；
- `pae-anchor`：对 `audit` 只读，对 `audit-anchor` 只有 `R,AD`，**对 `audit` 无写**。

于是「只攻陷 Recorder」→ 能追加垃圾、能继续写明细，但**改不了既有 checkpoint**；重写历史会在下一个锚点比对时露馅。

**如实写明**：若攻击者同时拿到**管理员**权限，以上全部失效。审计的目标是"提高篡改门槛 + 保证可发现"，不是"防住管理员"。

### 7.2 谁拥有修改 checkpoint 的权限？

只有 `pae-anchor`（追加）与用户（完全）。`pae-recorder`、`pae-hermes`、`pae-dsh` 都没有——这条由 ACL-08 强制，不靠约定。

### 7.3 Observer 如何独立验证 checkpoint？

三条独立通道，全部只读：

1. **重算链**：从 `seq=1` 重算 `hash`，第一处不一致 → `audit_chain_broken@seq`；
2. **核对锚点**：每个 checkpoint 的 `(seq, hash)` 必须能在明细里找到同一行；
3. **核对 seq_local 连续性**：每个 Agent 的本地序号不得跳号（跳号=漏报）。

Observer 只被授予 `R`（audit + anchor + `verify_audit` 工具），**不依赖 Recorder 的任何自述**。它要结论，自己算。

### 7.4 如何防止 Recorder 重写历史后重算哈希链？

四层，前两层是硬约束、后两层是补救：

| 层 | 机制 | 拦住什么 |
| --- | --- | --- |
| 1 | 明细文件对 Recorder 只给 `AD`，不给 `WD/DE/DC` | 不能改旧行、不能截断、不能删了重建（ACL-17） |
| 2 | 锚点由另一主体持有（§7.1） | 即使明细被整体替换，锚点里的旧 `(seq,hash)` 对不上 |
| 3 | 链本身（`prev_hash`） | 改一行要重算其后全部，成本高且必然与锚点分叉 |
| 4 | 外部镜像（可选，后期）：把锚点哈希写到只读介质/另一台机 | 本地整库被毁后仍有旁证 |

**诚实结论**：前两层成立时，重写历史在技术上需要"同时拥有 Recorder 与 Anchor 两个身份"，而这已经越过了一次攻陷的边界。文档不得宣称"不可篡改"。

### 7.5 Recorder 落不了盘时，Bridge 怎么保证失败关闭？

四步，缺一不可：

1. **启动自检**：Recorder 启动时写一条 probe 记录 + `fsync` + 回读校验 hash，失败则**不进入 ready 状态**；
2. **准入闸门**：Bridge 每次接受新任务前查 `recorder.health = {ready, last_seq, lag_seconds}`；不 ready 就 **503 拒绝准入**，不放行"先干活后补账"；
3. **在途任务**：审计不可用时对在途任务发 `session/cancel`；若已有结果但无法入账，标 `unknown_execution`，交用户裁决；
4. **告警**：写入失败立即告警（本地提示 + `D:\PAE\logs`），不允许静默降级。

### 7.6 这带来一个新的授权需求（必须由用户拍板）

要让 §7.1 成立，需要**第三个身份**。两个选项：

| 选项 | 做法 | 代价 | 防护强度 |
| --- | --- | --- | --- |
| **A（推荐）** | 新建 `pae-anchor`（+ 可选 `pae-recorder`） | 多 1–2 个本地账号、多一套计划任务 | 达到"一次攻陷不够" |
| B | 只用 2 个账号，Anchor 由用户账号写 | 简单 | **Recorder 与用户同权 → 攻陷 Recorder 就能改锚点**，必须在文档里明确降级 |

**我不替用户决定**：默认按 A 设计（本文件命令已含 `$PA`），若选 B，§5.5 的 Anchor 授权要改写，并在 SECURITY 里降级表述。

---

## 8. 备份与恢复强化（P3）

### 8.1 每步检查退出码

`icacls /save` 成功返回 0；但**带 `/C` 时即使部分失败也可能返回 0**。所以：

```powershell
function Step($name, [scriptblock]$block) {
  & $block | Tee-Object -Append D:\PAE-acl-backup\oplog.txt
  if ($LASTEXITCODE -ne 0) { throw "STEP FAILED: $name (exit=$LASTEXITCODE)" }
}
```

规则：**先不带 `/C` 跑一次（快速失败）**，确认整棵树都能读，再带 `/C` 跑全量。

### 8.2 部分失败检测

`/C` 的部分失败只会体现在输出文本里（本地化，不能靠 grep 英文）。可靠做法：

- 记录 `icacls` 输出到 `oplog.txt`；
- **独立算数量**：`(Get-ChildItem $path -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object).Count`；
- 备份后对比 `.acl` 里的条目数（按 `\r\n` 计数近似）与目录项数；差异 > 0 → **停止**。

### 8.3 双轨校验（不只比长度）

```powershell
# 轨道 1：icacls .acl（用于恢复）
# 轨道 2：Get-Acl JSON（用于比对，独立于 icacls 文本格式）
Get-ChildItem "D:\HermesAgent\Data\profiles" -Recurse -Force -ErrorAction SilentlyContinue |
  ForEach-Object { [pscustomobject]@{ Path=$_.FullName; ACL=(Get-Acl $_.FullName).Sddl } } |
  Export-Clixml D:\PAE-acl-backup\acl-before.xml
```

恢复后用同一脚本导出 `acl-after.xml`，用 `Compare-Object` 比对 `Sddl` 字段。**逐项一致**才算恢复成功；只比文件大小是自欺欺人。

### 8.4 恢复后逐项比较

见 8.3；另外对三处关键路径单独 `icacls` 回显人工确认（`profiles`、`.dsh`、`config.yaml`）。

### 8.5 回滚顺序（固定，不能乱）

1. `schtasks /end` 所有 PAE 任务 → `schtasks /delete`；
2. 停 Bridge / Recorder / Anchor（若已运行）；
3. **恢复 ACL**（`icacls /restore`，先文件级再目录级）；
4. 用 8.3 的 JSON 比对验证；
5. `Disable-LocalUser`（先停用，别急删）；
6. 确认桌面 Hermes/DSH 正常后，再 `Remove-LocalUser`；
7. 最后按需删除 `D:\PAE`（保留备份与日志）。

**为什么账户最后删**：先删账号会让恢复出来的 ACL 里留下无法解析的 SID（`S-1-5-21-…` 孤儿项），排障时说不清是谁。

---

## 9. 验收清单 V1–V16（矩阵 ↔ 命令 ↔ 验收 一一对应）

| V | 验收 | 对应 ACL | 命令 | 预期 |
| --- | --- | --- | --- | --- |
| V1 | 账号为标准用户 | — | `net localgroup Administrators` | 无 `pae-*` |
| V2 | SID 解析 | — | §5.1 | 四/五个 SID，`$AD` 末段 500 |
| V3 | 新目录无继承 | ACL-01…09 | `icacls D:\PAE\policy` | **无 `(I)` 行** |
| V4 | 只读三目录静态正确 | ACL-04/05/06 | §5.4 | RX + 6 项 deny |
| V5 | 只读三目录实测拒绝 | ACL-04/05/06 | §6 L2 | 写/删/改权限三条全 `Access is denied` |
| V6 | 只读三目录实测可读 | ACL-04/05/06 | §6 L3 | `dir` 正常 |
| V7 | 审计对执行账号不可见 | ACL-07/08/09 | §6 L2 | 读也 `Access is denied` |
| V8 | **AC-1** | ACL-12 | pae-hermes 读 `.dsh` | 拒绝 |
| V9 | **AC-2** | ACL-11 | pae-dsh 读 `Data\profiles` | 拒绝 |
| V10 | **AC-3** | ACL-15 | 两个账号写 `config.yaml` | 拒绝（读也拒） |
| V11 | 双向拒绝（P0-1/2） | ACL-11/12 | 分别互换账号再测 | 两个方向都拒 |
| V12 | Hermes 运行时可用 | ACL-13 | pae-hermes 跑 `python.exe -c "import ruamel; print('ok')"` | 输出 ok |
| V13 | DSH 运行时可用 | ACL-14 | pae-dsh 跑 `dsh.cmd --version` | `0.2.1-rc.3` |
| V14 | **AC-4** | — | `ac4_lifecycle.py` | 退出码 0、无残留 |
| V15 | **AC-5 检出档** | ACL-07/08/17/18 | 特权改一行 → `verify_audit` | 报 `audit_chain_broken` |
| V16 | **AC-5 拒改档** | ACL-07/08 | 以 `pae-recorder` 试 `icacls`/删除 | 拒绝 |

**V15/V16 前置**：Recorder/Anchor/`verify_audit` 尚未实现 → **W-1 通过 ≠ AC-5 通过**，只能记 PARTIAL。

---

## 10. 运行时授权细节（P4）

| 主体 | 需要什么 | 命令 | 验证 |
| --- | --- | --- | --- |
| pae-hermes | 读+执行 `Data\tools`、`Data\installs`、`D:\HermesAgent\Source` | ACL-13 | `python.exe --version` 与 `import ruamel` 都要过（P-0 证明依赖在 venv 里） |
| pae-hermes | 写自己的 home、写 `TEMP`（指向 home 内） | ACL-02 | 启动后 `whoami` + 打印 `HERMES_HOME` |
| pae-dsh | 读+执行 DSH 安装目录 | ACL-14 | `dsh.cmd --version` |
| pae-dsh | 写自己的 `DSH_HOME` | ACL-03 | 启动后检查 `DSH_HOME` 内生成 `profiles\acp` |
| pae-anchor | 读 audit 尾 + 写 anchor | ACL-07/08 | 写一条 checkpoint 后 `Get-Content` 校验 |
| pae-recorder | 追加 audit | ACL-17 | 追加一条测试事件 + `fsync` 回读 |

**任务参数要求**（P-0 直接结论）：Hermes 执行实例的命令必须是
`"<store venv>\Scripts\python.exe" -m hermes_cli.main gateway run`
**不能**用 `hermes.exe`；`TEMP`/`TMP` 指向 `D:\PAE\runtime\hermes-home\tmp`。

---

## 11. 一致性核对表（矩阵 ↔ 命令 ↔ 验收）

| ACL | 矩阵条目 | 实施命令 | 验收 |
| --- | --- | --- | --- |
| ACL-01 | `D:\PAE` 用户 F | §5.2 | V3 |
| ACL-02 | hermes-home：PH F / PD·PA deny | §5.3 | V3, V7 |
| ACL-03 | dsh-home：PD F / PH·PA deny | §5.3 | V3, V11 |
| ACL-04 | shared RX + deny 写删改权限 | §5.4 | V4, V5, V6 |
| ACL-05 | policy 同上 | §5.4 | V4, V5, V6 |
| ACL-06 | logs 同上 | §5.4 | V4, V5, V6 |
| ACL-07 | audit：PR `R,AD`；PA `R`；PH/PD deny F | §5.5 | V7, V16 |
| ACL-08 | audit-anchor：PA `R,AD`；PR/PH/PD deny F | §5.5 | V7, V15 |
| ACL-09 | PAE-verify：仅用户 | §5.5 | V5（结果文件不可被改） |
| ACL-11 | profiles：PH/PD/PA deny F | §5.6 | V9, V11 |
| ACL-12 | `.dsh`：PH/PD/PA deny F | §5.6 | V8, V11 |
| ACL-13 | tools/installs/Source：PH RX | §5.7 | V12 |
| ACL-14 | DSH 安装目录：PD RX | §5.7 | V13 |
| ACL-15 | 三个配置文件：PH/PD/PA deny F | §5.6 | V10 |
| ACL-17 | audit 明细文件：PR `R,AD` | §5.5 | V15, V16 |
| ACL-18 | checkpoint 文件：PA `R,AD` | §5.5 | V15 |

**自检规则**：任何一条 ACL 在三列里缺一个，就视为方案不完整——这张表是 v3 的验收基线。

---

## 12. 状态与边界

| 项 | 状态 |
| --- | --- |
| v3 方案 | **已编写**（本文件） |
| 只读勘察（v3 新增） | **已执行**：`D:\` 继承 `Authenticated Users:(M)`；DSH 安装目录无 `Users` 读权限 |
| 审计信任模型 | **设计完成**（含第三主体），未实现 |
| 账户创建 / ACL 修改 | **尚未实施** |
| W-1 状态 | 仍为 `READY`（**不是** `AUTHORIZED`）；v3 待审 |

**本轮没有**：创建账户、修改 ACL、改桌面配置、安装软件、启动模型、产生费用。勘察只有 `icacls` 与 `Get-LocalUser` 只读查询。

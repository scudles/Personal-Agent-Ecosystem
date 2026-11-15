# V25 用户权限配置（secedit）安全验证设计

日期：2026-11-08｜作者：Hermes｜状态：**设计完成，未执行任何系统变更**
关联：[W-1 v5.1](2026-11-08-w1-account-poc-plan-v5.1.md) §8.1 与 §10（V25/V26）

---

## 1. 本轮已核实的事实（本机原始输出）

| 事实 | 证据 |
| --- | --- |
| `secedit.exe` 存在 | `C:\WINDOWS\system32\secedit` |
| **未提权时连导出都做不到** | `secedit /export /cfg %TEMP%\ur_before.inf /areas USER_RIGHTS` → **exit 740**（`ERROR_ELEVATION_REQUIRED`），目标文件未生成 |
| `secedit` 有原生命令 `validate` 与 `generaterollback` | `secedit /?` usage 行：`[/configure | /analyze | /import | /export | /validate | /generaterollback]` |
| 无提权时没有任何"读用户权限分配"的旁路 | `whoami /priv` 只列当前令牌特权，不列 `SeInteractiveLogonRight` 这类**分配**；`Get-LocalUser` 也不含 |

### 1.1 第一条事实的后果（很重要）

**没有基线就不能动。** 因为未提权时导出会直接 740，所以：

- V25 必须在**提权窗口**内完成"导出 → 生成回滚 → 校验 → 应用 → 复导出比对"全过程；
- 如果导出失败（任何原因），**整个 V25 立即 fail-closed**，不允许"先配了再说"；
- 这一条与 v5.1 §7 的"建号即禁用"衔接：账号在禁用状态也能配权限（按 SID 记），所以不需要为了配权限提前启用账户。

---

## 2. Observer 五问，逐条回答

### 问 1：新增用户权限时，是否完整保留系统原有授权主体？

**风险**：`[Privilege Rights]` 里每个权限是一串 SID。只写"要新增的那几个 SID"再导入，若 `secedit /configure` 是**替换语义**，原有主体会被清空（例如 `SeInteractiveLogonRight` 原有 `Administrators`、`Users` 全丢）。

**v25 的处置（不依赖语义判定）**：

> **每次导入的 INF 都是"原样导出后仅追加"的完整文件。**
> 这样无论 `secedit` 是"替换整个权限集合"还是"合并"，结果都一样正确——因为文件里本来就带着全部原有主体。

具体操作：导出完整 INF → 用脚本把目标 SID 追加到指定权限行的**末尾**（行内去重）→ 导入。**绝不手写只含新 SID 的片段 INF。**

### 问 2：Deny 策略是否会覆盖或意外删除原有安全策略？

分两层看：

| 层 | 结论 |
| --- | --- |
| **语义层** | `SeDenyInteractiveLogonRight` 与 `SeInteractiveLogonRight` 是**两个独立的权限**，不是同一个权限的两种取值。追加到 Deny 权限里**不会**从 Allow 权限里删人。用户仍在 `Users`（Allow 交互登录）里，但 Deny 优先 → 实际禁止登录。**这是我们想要的效果，且不需要改动 `SeInteractiveLogonRight`。** |
| **文件层** | 如果我们只追加 Deny 行、不动 Allow 行，那么导出的 INF 里 Allow 行原样保留 → 即便替换语义也不会丢。**但前提是追加时不误删行**，所以采用脚本处理 + 导入后 diff（§4）。 |

**额外约束**：传入 `/areas USER_RIGHTS`，**不传其它 area**。`SECURITYPOLICY`（密码策略、锁定策略）、`FILE SECURITY`（ACL）、`REGISTRY SECURITY` 一律不碰——碰了会连带改掉与本项目无关的系统设置。

### 问 3：执行前是否保存完整原始配置，执行后是否能结构化差异比较？

**执行前**（三件套，缺一不可）：

| 产物 | 命令 | 用途 |
| --- | --- | --- |
| `ur-baseline.inf` | `secedit /export /cfg … /areas USER_RIGHTS` | 原始分配，唯一权威基线 |
| `ur-rollback.inf` | `secedit /generaterollback /cfg <baseline> /rbk … /db …` | **原生回滚模板**（不是我们手工拼的） |
| `ur-baseline.json` | 由脚本解析 INF 得到 `{privilege: sorted[SID]}` | 用于结构化比对，避免逐行文本比对被顺序/空白干扰 |

**执行后**：再导出 `ur-after.inf`，解析成同构 JSON，与 `ur-baseline.json` 做**集合差**：

```
新增(SID∈after, ∉baseline)  /  丢失(SID∈baseline, ∉after)  /  未变
```

**判定**：

- `丢失` 集合**必须为空**；
- `新增` 集合**必须恰好等于**本次计划新增的 `(privilege, SID)` 对；
- 其它任何差异 → 视为失败，立即回滚。

> 只比"DENY 有没有出现"是不够的——那正是 v5 犯过的错（把"预期结果"当"完整性证明"）。

### 问 4：回滚是否能真正恢复原有用户权限，而不是仅撤销本次新增内容？

**不能靠"删掉我加的那几行"回滚**。理由：`secedit` 在导入时会规范化/重写整个权限段，只删新增项无法保证回到原始排序、原始 SID 形式（名称 vs `*SID`）。

**回滚三条路径（按优先级）**：

1. **原生回滚模板**（首选）：`secedit /configure /db … /cfg ur-rollback.inf /areas USER_RIGHTS` —— 由系统自己生成的反向值；
2. **基线整体回导**（等价手段）：`secedit /configure /db … /cfg ur-baseline.inf /areas USER_RIGHTS`；
3. **人工介入**（前两条都失败）：停止一切后续操作，交付 `ur-baseline.inf` + 差异报告，由用户在处理台恢复。

**回滚后必须复导出并做同 §3 的集合差**，要求"与基线零差异"才算成功。

### 问 5：导入失败、部分成功、异常中断时，是否有明确的失败关闭机制？

`secedit` 的退出码**不足以**证明成功（这是要防的坑）。所以判定采用**三重校验**：

| 检查 | 判据 |
| --- | --- |
| ① 退出码 | 非 0 → 立即回滚；0 也**不**视为成功，只是"允许进入下一步" |
| ② `INF` 语法预检 | 导入前 `secedit /validate <candidate.inf>`，非 0 → 不导入 |
| ③ 导入后复导出集合差 | `丢失` 非空 或 `新增` 与计划不符 → 判定部分成功 → 立即回滚 |

**异常中断**（进程被杀、UAC 弹窗被取消、断电）：
- 开工前先写一个 `D:\PAE-verify\v25-INFLIGHT` 标记文件（内容：时间、计划变更、基线路径）；
- 收工后（无论成败）删除该标记；
- **下次启动时若发现标记还在 → 视为"上次可能半应用"，先跑一次"复导出 + 与基线集合差"，不允许直接重试。**

这条是"崩溃一致性"的最低成本做法：不猜状态，先测状态。

---

## 3. 候选 INF 的生成规则（防手抖）

```powershell
# 只追加，不删除；行内去重；保留原有顺序
$plan = @{
  'SeDenyInteractiveLogonRight'       = @($PH,$PD,$PR,$PA)
  'SeDenyRemoteInteractiveLogonRight' = @($PH,$PD,$PR,$PA)
  'SeDenyNetworkLogonRight'           = @($PH,$PD,$PR,$PA)
  'SeBatchLogonRight'                 = @($PH,$PD,$PR,$PA)   # 必须给，否则 V26 起不来
}
```

规则：
1. 只修改 `[Privilege Rights]` 段中**已存在**的键；若某个键不存在（例如从未配置过 `SeDenyNetworkLogonRight`），**新增该行**并把原有主体（若有）保留；
2. SID 一律写成 `*S-1-5-21-…` 形式，与系统导出格式一致，避免名称解析差异；
3. 写完后逐行校验：每条权限的 SID 数 = 原有数 + 新增数（去重后）；
4. `SeBatchLogonRight` 默认只有 Administrators / Backup Operators 等，**标准用户没有** → 这一步不做，V26 计划任务会以 `0x80070569` 失败（R10）。

---

## 4. 结构化比对脚本设计（不落地文件，避免与实时输出混淆）

```powershell
function Read-UserRights([string]$inf) {
  $map = @{}
  $in = $false
  foreach ($line in Get-Content -LiteralPath $inf -ErrorAction Stop) {
    if ($line -match '^\s*\[(.+)\]\s*$') { $in = ($Matches[1] -eq 'Privilege Rights'); continue }
    if (-not $in) { continue }
    if ($line -match '^\s*(\w+)\s*=\s*(.*)$') {
      $k = $Matches[1]; $v = $Matches[2]
      $sids = @($v -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
      $map[$k] = $sids
    }
  }
  return $map
}

function Diff-UserRights($baseline, $after) {
  $keys = ($baseline.Keys + $after.Keys) | Sort-Object -Unique
  foreach ($k in $keys) {
    $b = @($baseline[$k]); $a = @($after[$k])
    $lost    = @($b | Where-Object { $_ -notin $a })
    $added   = @($a | Where-Object { $_ -notin $b })
    if ($lost.Count -or $added.Count) {
      [pscustomobject]@{ Privilege=$k; Lost=($lost -join ','); Added=($added -join ','); BaseCount=$b.Count; AfterCount=$a.Count }
    }
  }
}
```

判定逻辑（写成硬规则，不许人工"看着差不多"）：

```
LOST 非空            -> FAIL（原有主体被删）
ADDED 不在计划内      -> FAIL（改了不该改的）
ADDED 少于计划        -> FAIL（部分成功）
两个都为空            -> PASS
```

---

## 5. 测试设计（全部 PLANNED，需提权 + 授权）

| ID | 目的 | 做法 | 通过判据 | 风险 |
| --- | --- | --- | --- | --- |
| **T-0** | 导出可用性 | 提权窗口内 `secedit /export … /areas USER_RIGHTS` | exit 0 且 INF 非空 | 无（只读） |
| **T-1** | 幂等回导 | 用**原样导出的 baseline** 立即回导，再导出比对 | 集合差为空 → 证明"导出/导入是保真往返" | 低（不改有效值） |
| **T-2** | 语义判定（顺带） | T-1 中若出现 `丢失` → 说明是替换语义且导出不完整，方案要升级 | 任何 `丢失` 都算 FAIL，停止 | 低 |
| **T-3** | 语法预检 | 故意造一个坏 INF，`/validate` | 非 0，且**未**被应用 | 无（不导入） |
| **T-4** | 应用 + 校验 | 应用候选 INF，复导出比对 | `LOST=∅` 且 `ADDED=计划集` | 中（真实变更） |
| **T-5** | 回滚 | 用 `ur-rollback.inf` 回导，复导出比对 | 与基线零差异 | 中 |
| **T-6** | GPO 覆盖检查 | 应用后 `gpupdate /force`，再复导出 | 仍为零差异；否则说明被策略接管，需改用 GPO 路径 | 中 |
| **T-7** | 崩溃一致性 | 人为中断（杀进程），重跑时检测 `INFLIGHT` 标记 | 拒绝直接重试，先做集合差 | 低 |
| **T-8** | 登录权生效 | 用 `runas /user:pae-hermes` 与计划任务各试一次 | 交互登录失败、批处理登录成功 | 中 |

> T-8 同时验证 R10：若计划任务失败于 `0x80070569`，说明 `SeBatchLogonRight` 没生效。

---

## 6. 这套设计**不能**保证的东西（照实写）

| 项 | 说明 |
| --- | --- |
| 无法验证"替换 vs 合并"的确切语义 | T-1/T-2 只能在真实系统上试出来；本方案用"完整 INF"绕开对它的依赖，但**没有**证明语义本身 |
| 无法保证 GPO 环境下持久 | 若这些权限由域/本地 GPO 管理，`gpupdate` 会覆盖；T-6 只能**发现**，不能阻止 |
| 无法防住管理员 | 管理员随时可以改回；这是结构性的 |
| 无法保证"导出→导入"对所有 SID 保真 | 未解析的孤儿 SID 可能被重写为名称或反之；靠 `*SID` 形式 + 集合差发现 |
| 无法做到"零窗口" | 应用本身是原子的系统调用序列，但"应用后到校验完成"之间存在短暂不一致窗口；此窗口内若崩溃，靠 `INFLIGHT` 标记兜底 |

---

## 7. 与 V25 / V26 的依赖

```
V25 顺序（缺一不可）：
  T-0 导出基线
   → T-1 幂等回导验证（证明往返保真）
   → 生成候选 INF（§3 规则）
   → T-3 /validate
   → T-4 应用 + 集合差
   → T-6 gpupdate 后复验
   → T-8 登录权生效（含批处理登录）
   → 才允许启用账户（v5.1 §7 第 6 步）
   → 才允许 V26 控制器
```

任一步失败 → 走 §2 问 4 的回滚，且**不启用账户**（保持禁用，属于"失败即停"）。

---

## 8. 本轮状态

| 项 | 状态 |
| --- | --- |
| V25 安全流程设计 | **DESIGNED** |
| `secedit` 可执行性 | **VERIFIED**：未提权 → exit 740，无法导出 |
| 结构化比对脚本 | **DESIGNED**（未落盘为工具，逻辑见 §4） |
| T-0…T-8 | **PLANNED**（需提权 + 授权） |
| 系统权限是否被修改 | **没有**。本轮只有一次失败的 `/export`（未生成文件）与一次 `/?` |

> 结论：**V25 目前是"设计就绪、零执行"**。不能用本文档的存在暗示任何登录隔离已经生效。

# P-0：专属 Profile 兼容性验证报告（无害实测）

日期：2026-11-08
执行者：Hermes｜审查：ChatGPT Observer（待）
授权范围：**只做无害兼容性检查**。未创建账户、未改 ACL、未改现有桌面配置、未装软件、未启动真实模型任务、未产生费用。
证据文件：`D:\HermesAgent\Data\cache\scratch\p0-hermes-home\`、`p0-dsh-home\`、`p0-dsh-*.jsonl`（探针原始帧）

---

## 0. 先说结论（四档，不含糊）

| 问题 | 结论 | 等级 |
| --- | --- | --- |
| Hermes：`HERMES_HOME` 能否完全指向专属目录 | **能，但必须绕开 `hermes.exe` 启动器**，直接用 store venv 的 python 调用 | A 已验证 |
| Hermes：凭据能否独立加载 | **部分**：`.env` 只从该 home 读；但 **OAuth 会按 provider 回退到全局根 `auth.json`（只读）** | A 已验证（源码） |
| Hermes：是否回退到原桌面用户目录 | **会**：通过 `auth.json` 这条通道（不是文件写入，是读凭据） | A 已验证（源码） |
| DSH：`DSH_HOME` 是否实际生效 | **是** | A 已验证（实测） |
| DSH：模型/插件配置能否独立加载 | **部分**：profile bundle 与模型配置独立；**凭据是否也回退 `~/.dsh/.env` 未验证**（需 prompt，禁止） | C 待验证 |
| DSH：是否向原桌面目录写入私人状态 | **未观察到**（快照哈希不变、3 分钟内 0 文件变更） | A 已验证 |

---

## 1. 身份核实（Observer 第 4 条要求）

```
当前用户：DESKTOP-92SEIJ8\Administrator
SID     ：S-1-5-21-2685768553-884237945-3896909734-500     ← RID 500，内置 Administrator 本体
Enabled ：True
IsInRole(Administrator)：False                              ← 说明进程令牌被 UAC 过滤，当前未提权
```

三点说明：

1. **显示名确实就是 `Administrator`，RID=500**，不是"改名后的管理员"或另一个账号冒充。
2. `IsInRole=False` 与 RID 500 并不矛盾：Win11 默认开启 Admin Approval Mode，内置 Administrator 的令牌也是**过滤令牌**，除非提权。所以建号/改 ACL 仍需 UAC。
3. 因此 ACL 命令里**建议用 `*SID` 形式**（`icacls ... /grant:r "*S-1-5-21-...-500:(OI)(CI)F"`），避免"名称相同但解析到别的对象"这类问题；初次执行时先跑一次 `icacls` 回显核对解析结果。

---

## 2. Hermes 侧实测

### 2.1 用 `hermes.exe` 启动器 + 全新 home → **失败**

```powershell
$env:HERMES_HOME="D:\HermesAgent\Data\cache\scratch\p0-hermes-home"
hermes gateway status
```

```
ModuleNotFoundError: No module named 'ruamel'
  at D:\HermesAgent\Source\hermes_yaml.py:10
```

**原因**：启动器需要从 home 的 install state 解析「store 解释器」；全新 home 没有 install state，它退回了一个**没有依赖的 python**。POC-001 的 `ruamel` 失败就是同一条路径。

### 2.2 直接用 store venv 的 python → **成功**

```powershell
$env:HERMES_HOME="...\p0-hermes-home"
$env:HERMES_DISABLE_LAZY_INSTALLS="1"
D:\HermesAgent\Data\installs\<key>\environments\<gen>\venv\Scripts\python.exe -m hermes_cli.main gateway status
```

输出：`✗ Gateway is not running`，exit 0。写入全部落在新 home：

```
p0-hermes-home\SOUL.md
p0-hermes-home\logs\agent.log
p0-hermes-home\logs\.__agent.lock
p0-hermes-home\installs\83877ba9c77f9088\bootstrap\default.json
```

**结论**：`HERMES_HOME` 隔离**成立**，但执行实例的启动命令**不能写 `hermes.exe ...`**，必须写成 `"<store venv>\Scripts\python.exe" -m hermes_cli.main ...`（或先补 install state）。这条直接影响 W-1 的计划任务参数——这是本轮最值得记的一条。

### 2.3 凭据：`.env` 不回落，但 `auth.json` 会

- `.env`：`load_hermes_dotenv()` 只读 `home_path/.env`（+ 可选 project `.env` / `.op.env` / 外部 secret 源），**没有"回落到根 home 的 .env"**这条路。
- `auth.json`：`hermes_cli/auth.py` 明确写「profile 模式下按 provider 回退到 global-root `auth.json`（只读）」（`_global_root_auth_path()` / `provider_state(..., fallback)`）。
- 实测旁证：Phase 1 的 `bridge` profile 没有 `auth.json`、`.env` 为空，运行日志却打出 `credential pool: no available entries` —— 说明它**没有拿到**根凭据；这与"回退是 per-provider、且只对 OAuth 类 provider 生效"一致（该 profile 用的是 API-key provider）。

**结论（必须写进 W-1）**：**用 API-key 的 provider 可以做到凭据隔离；用 OAuth 的 provider 做不到**——执行实例会自动读到桌面账号的 OAuth。要彻底隔离，执行实例只能配 API-key 型 provider（如 opencode-go / deepseek），或接受这条共享。

---

## 3. DSH 侧实测

### 3.1 `DSH_HOME` 生效（实测）

用探针以 `DSH_HOME=...\p0-dsh-home` 启动 `--profile acp`，只做 `initialize`（无 prompt，无模型调用）：

```
[p0-dsh] pid 198524  protocolVersion 1  authMethods []  capabilities [mcpCapabilities, promptCapabilities, sessionCapabilities]
exit_code=0   elapsed=2.85s
```

新 home 里生成：

```
p0-dsh-home\.anonymous-user-id
p0-dsh-home\profiles\acp\cordis.yml / cordis.patch.yml / package.json / pnpm-workspace.yaml
```

### 3.2 没有写原桌面目录（实测）

- 探测前 `~/.dsh` 的 mtime 快照哈希：`106605c8…`
- 探测后：**同一个哈希**，且最近 3 分钟内变更文件数 = **0**

**结论**：`DSH_HOME` 隔离在这个动作范围内**成立**。

### 3.3 仍未验证（不能装作知道）

1. **凭据是否回退到 `~/.dsh/.env`**：要证明只能发一条 prompt 看是否鉴权成功——**需要费用，本轮禁止**。→ 标记 **C 待验证**，并写进 W-1 的"账户隔离后必须复测"清单。
2. **插件是否能独立加载**：本机 DSH 桌面装过插件，但 ACP profile 的 `package.json` 只有 `dsh-base + dsh-acp-app` 两个 bundle，`dependencies` 为空 → 静态看是独立的；**运行时是否读取桌面插件目录未验证**。

---

## 4. 对 W-1 方案的影响（已经写进 v2 计划）

1. 计划任务里的 Hermes 命令改为 **store venv python 直调**，不用 `hermes.exe`。
2. 执行实例的 provider **只用 API-key 型**；OAuth 型 provider 下"凭据隔离"不成立，必须在策略里标注 `credential.shared=true`。
3. DSH 的 `DSH_HOME` 可以放心用；但**凭据隔离要在账户落地后复测**（AC 之后追加一条）。
4. P-0 也说明：**"改 HERMES_HOME 就隔离了"是错的**——launcher 与凭据两条通道都会绕回原环境。

---

## 5. 边界声明

本轮没有：创建账户、修改 ACL、修改现有桌面配置、安装软件、启动真实模型任务、产生费用。
所有探测只写 `D:\HermesAgent\Data\cache\scratch\` 下的临时 home，未触碰桌面 Hermes/DSH 的数据。

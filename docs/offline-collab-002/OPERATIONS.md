# 新版离线协作候选操作

Task：TRB-OFFLINE-COLLAB-002。唯一负责人：Codex /root；MAG-001 ACTIVE保持。本入口打开独立虚构演示环境，不代表最终耐久或独立复核已经通过。

## 启动

在 `D:\TriReviewBridge` 双击 **打开新版协作工作台.cmd**，或运行：

```powershell
.\scripts\open-collab-workbench.ps1
```

原生候选为 `runtime\native\TriReviewBridge.UX.Collab.exe`，使用 `data\collab-002-preview` 下的独立配置、数据库、虚构材料和演示状态；回环端口固定为 **48736**。初次准备建立一个虚构项目、材料讨论及空的文字协作空间，绑定的全部参与者均为模拟对象。可以在空的“文字协作”空间尝试“让Hermes整理虚构颜色说明，DSH独立复核，ChatGPT暂不参与”。这只是离线模拟文字分工，不实施工程修改。

只准备虚构演示数据，不启动后台或窗口：

```powershell
.\runtime\node.exe .\scripts\open-collab-workbench.mjs --prepare-only
# PowerShell入口也支持：
.\scripts\open-collab-workbench.ps1 -PrepareOnly
```

只启动 / 复用该候选后台，不开窗口：

```powershell
.\runtime\node.exe .\scripts\open-collab-workbench.mjs --backend-only
```

已有演示状态时，启动器只读核对归属和模拟绑定；不会因为再次启动或旧的初始化原因而解除全局、单方、会话或绑定暂停，不重置历史、草稿或材料。暂停需要在已授权的离线界面中明确恢复。若留下未完成数据库、缺少状态、配置不匹配或48736端口被其他进程占用，入口保留现场并报错，不清空数据或停止其他服务。

## 停止该候选

关闭窗口只关闭该窗口，后台继续保留。窗口“设置与窗口 → 停止后台…”针对当前窗口连接的后台；在新版候选中使用它，只影响48736上的新候选。

也可从工程根目录运行下列命令。它只读取新候选的配置、核对固定端口和数据库名称，然后请求该候选停止；不会按进程名批量结束Node或WPF，不输出访问令牌：

```powershell
$previewConfig=Get-Content -LiteralPath '.\data\collab-002-preview\workbench-config.json' -Raw | ConvertFrom-Json
if($previewConfig.port -ne 48736 -or $previewConfig.databaseFile -ne 'collab-002-preview.sqlite'){throw '新版候选配置不匹配，未发出停止请求。'}
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:48736/api/service/stop' -Headers @{Authorization=('Bearer '+$previewConfig.token)} -ContentType 'application/json' -Body '{}'
```

停止后台不会删除消息、材料、审查、用户决定或已保存草稿。后台停止后的窗口会显示连接失败；重新打开仍连接同一独立配置，不自动重发UNKNOWN。

## 离线边界与证据

仅使用虚构材料和模拟Adapter。模拟可用不代表原生Agent在线；已排队、提交、收件、回复 / 任务完成、技术审议及用户实施授权分开。自然入口有明确的单动作和负责人后接一名复核者边界，其他条件链或不可靠语义保持未执行并保留备用入口。

本机校验、模拟字节收件、人工交付报告和真实收件分别记录；工程材料的普通文字审批不替代准确版本的Governance Host流程。真实Hermes、DeepSeek Harness、ChatGPT原会话、已有DeepSeek草稿、真实附件投递及凪均不在此入口的操作范围。解除真实暂停或新增真实接入必须另行取得明确授权，启动本候选不会授予这些能力。

自身生成的WPF `RenderTargetBitmap` 图像是原生渲染预览，不能称为Windows桌面截图。Computer Use对新UX应用的访问拒绝不由本入口绕过。首次使用者观察、真实Agent验证、独立复核和稳定性证据分别报告；可运行不等于这些项目已经通过。

## 回滚与并存

原UX预览 `data\ux-preview`、48735端口及 `打开UX协作工作台.cmd` 保留；旧离线入口 `打开离线协作验收版.cmd`、`runtime\native\TriReviewBridge.Offline.exe` 与 `desktop\OfflineWindow.xaml` 保留。回到这些既有入口即可继续旧候选，无需复制新版数据库覆盖旧库，也不删除新版历史或运行中的旧程序。

新版演示与一小时稳定性驱动的 `test-output\collab-002-soak-<runId>` 是不同环境。启动演示不创建耐久通过结论，不修改原预览 / 主库 / 原Agent配置；恢复需要时保留失败现场并依负责人确认的隔离备份处理，不在运行中覆盖旧exe或主库。

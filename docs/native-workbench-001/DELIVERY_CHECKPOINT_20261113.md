最新决定：原定时Codex接力路线已被用户否决并撤下；自动任务已删除，C/DSH保持暂停。连续会话尚未完成。[持续会话约束](CONTINUITY_REQUIREMENTS.md) 优先于下方历史阶段记录。

# 本轮交付检查点 — 2026-11-13

负责人：Codex。用户要求不为原生Agent咨询长期等待，本轮由Codex继续工程实施；原生Hermes首轮意见保留，DSH咨询草稿不发送，未完成的原生交叉复核不冒称完成。

## 实际完成

1. 修复ChatGPT接力执行器硬编码提权与当前Never权限的冲突。仅移除显式提权参数与说明，保留原会话身份、双cutover、durable begin、UNKNOWN禁重发门。7/7定向测试exit0；实际新工作台RPC空队列执行成功，原对话读取/发送均0。现有5分钟自动任务已更新新hash并恢复ACTIVE；移除已结束的一小时重复监测。
2. 推广DSH002候选13个精确文件至正式候选入口。旧SIM和旧CODEX二进制保持原SHA；未复制候选配置/数据库。已停后台和空输入窗口、完整备份两个Bridge profile，再替换并重启。首次备份遇旧窗口lock，发生在生产文件替换之前；关闭空输入旧窗口后重做完整备份成功。
3. 集成后只读核对两个Bridge数据库：integrity_check=ok；消息队列、原会话绑定和角色暂停均与备份一致。配置先保持原字节，随后单独增加DSH预期桌面窗口元数据（审计见dsh-desktop-metadata.json），未改原Session绑定、模型或权限。该元数据不是新鲜身份已验证。
4. 实际发现Sky外层应用ID与窗口app字段不同，修复driver目标选择，按固定窗口app/title筛选、app+id去重，返回ID不符拒绝。driver新增针对性测试后23/23，独立限定静态复核PASS；生产driver已升级r4。RPC本轮未改，先前3项通过不记为本轮重跑。
5. 原生WPF已重新打开并实际检查深色三栏、原消息与接收方状态。DSH明确显示Codex电脑接力及桌面依赖、暂停；UNKNOWN不显示成功。正式审批/附件/自主链未因本轮放开。

## 验证边界

- ChatGPT修复7/7属于模拟工具/隔离HTTP测试，另实际空队列RPC检查成功；本轮没有额外真实模型发送。
- DSH后端26/26、驱动r3的23/23属此前模拟证据；r4本轮driver定向23/23，独立复核为只读源码/断言/hash核对。未对DSH原会话发真实验证消息。
- 25个src文件与已测候选逐项SHA一致；不把二进制编译或模拟结果当真实原会话端到端证明。
- 既有一小时通过3600.0638504秒只覆盖当时Node/SQLite+模拟Adapter，不覆盖新DSH002或真实三方长期耐久。旧六向批次仍8/30。

## 还需真实使用前置与未完成项

- Hermes生产持续worker仍需用户本人在工作台读完许可说明后决定；新咨询不替代该许可。
- DSH临时接力仍暂停、身份未验证；现场必须是指定原主进度、空闲、无草稿，先准备核对，再明确启用。只有用户排队的普通文字和文字任务可投递。尚未有002真实成功回执。
- ChatGPT/DSH临时接力依赖Codex在线、工具、桌面和额度；独立原生接入并未完成。
- 三方原字节材料一致性、自动附件、正式工程审批/自主链仍未完整接入当前真实HYBRID空间。普通文字结果不能替代工程授权。
- 当前真实HYBRID候选限定指定原会话的单个授权协作空间；通用多项目/材料/治理在既有隔离离线入口，不将两者混称全部真实能力已开放。

## 代码、数据及回滚

生产变更包括13项集成清单、随后driver r4、ChatGPT executor与相应测试、操作/交付说明。无Schema ALTER、历史迁移、原生Agent重建或凪访问。

备份：D:\TriReviewBridge\backups\hybrid-desktop-relay-002-20261113T042002333Z（原文件、完整两profile、推广前状态、原配置和driver r3）。ChatGPT修复另有backups/chatgpt-executor-default-permissions-20261113T041148208Z。

回滚前暂停接力并停后台，按清单恢复文件。若已产生新消息/回执，先保留当前数据库，不能盲目用旧数据库覆盖，不能借回滚清UNKNOWN或重发。旧SIM/CODEX成品不需恢复，因为本轮未覆盖。

证据：evidence/hybrid-native-001/dsh-relay-002-promotion.json、dsh-relay-002-post-restart.json、dsh-desktop-metadata.json、chatgpt-default-permissions-proof.json；原生咨询evidence/native-consult-20261113/STATUS.json。

## 定时接力接入

现有5分钟heartbeat已加入独立DSH分支：只处理新工作台用户排队的普通文字/文字任务和用户身份准备请求；空队列不读UI、不启动sky或采样器，准备不自动启用，UNKNOWN禁重发。固定r4/Parser/RPC/IdleProbe/README哈希。Root实际D peek返回configured=true、paused=true、next=null、preparationRequested=false、UUID未观测。本轮未执行新D分支的真实桌面发送，不将登记heartbeat当作真实线路验收。生产H不由该任务自动启动。

最终限定独立复核：新增D接力配置与7个固定root文件hash匹配，无P0/P1；仅静态核对，未执行真实automation或原会话操作。已运行的本轮定向测试0失败；未执行的DSH真实线路及真实长稳明确留为未验证，不列作通过。完整变更路径见推广JSON的13项files，以及ChatGPT修复proof的hashes；r4 driver与最终双库核对见final-checkpoint-20261113.json。

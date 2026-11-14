# P1-HERMES-POLICY-PRESERVATION：静态调查与限定修复

2026-11-13。仅静态读取D:/TriReviewBridge既有文档和D:/HermesAgent/Source公开SDK/Gateway/协议源码；未import执行Hermes代码、未RPC、未读配置/凭证/日志/私密数据库，未触凪。源码版本存在不证明当前运行Gateway加载相同版本。

## 确认风险

`gateway/session_controls.py:660-668`：session.resume authorize后，对有session:control能力的local route调用refresh_resumed_policy；`attached=ref.session_id in self.subscriptions`仅同连接已attached时可跳过普通刷新。本候选helper每次新连，因此不能假设这个warm guard会保护原设置。

`gateway/session_policy_refresh.py:245-259`：idle本地Session新attach前可以commit配置刷新；`_commit_refresh:212-239`通过commit_refreshed_policy提交并发布新policy generation，不只是更新时间或内存句柄。

`session_policy_refresh.py:28-110`：可能跟随config更新reasoning默认/overrides、disabled/platform toolsets、MCP定义/凭证、terminal配置、max_turns、checkpoints；显式启动或会话picks按代码保留，model/provider设计上保留。**“未主动传model override”不能被描述为“原Session全部配置不变”。** `omit_messages`只影响历史读取，不关闭attach/刷新。原通用--ack-native-session-access不足以表达接受这个副作用。

## 是否存在无刷新且可替代的观察RPC

未找到同时满足“固定单Session、完整四项busy门、无attach/refresh/恢复副作用”的现成公开合同。不能发明no_restore/no_refresh参数，也不能换一个脚本重试同一resume。

- `session.active_list`：公开handler `gateway/session_active_list.py:23-46`不调用attach/refresh，借live_entries只枚举已warm条目；但current_session_id只设置current标识，不是过滤器，会返回全部可读会话。`_status:15-20`仅running时看prompts，其余只判断queued；pending UNKNOWN会落为idle，open_requests未完整投影。因此idle不能替代当前安全门，不能据此放行发送。
- `session.list(scope=live)`：`session_controls.py:561-607`经live_entries，不主动restore已不在内存条目；只给running等列表摘要，不完整呈现pending/prompts/open_requests。title查询分支的running甚至只表示在内存存在，不等于正在或未在执行。
- `session.info`：`session_controls.py:554-559`经authority.resolve→authorize（authority:341-343、200-239），cold时可能restore/touch；`session_local_inventory.py:192-205`构建tools/skills/git等inventory并有I/O。没有完整busy状态，不能称零副作用窄观察接口。
- `session.events.since`：`session_controls.py:739-751`经过authorize，返回事件环/open_requests并更新replay cursor，不是固定自己请求或完整安全快照。
- `prompt.receipt`：可按固定admission回收，不直接attach/refresh，但authorize仍可能restore/touch，include_result=true会在内存接触完整存储result。它解决单请求回收，不能在首次发送前证明Session整体idle。

## 本次限定修复

生产Adapter工厂默认allowPolicyRefresh=false；固定导出实例也默认锁，inspect/send/receipt调用均在spawn前拒绝。CLI只有同时解析两项显式ack才向工厂传true；helper CLI和可导入run默认也独立拒绝。--identity以及watch消费prepare走同一受锁Adapter，不能仅锁submit后让prepare先resume。

两项ack是操作者对已取得具体用户授权的声明，不能自动填写、不能当成用户授权本身。当前root尚未运行真实helper，也没有本任务新增policy-refresh授权。只有完成该具体决策或找到经验证无refresh且足够的通道，才能真实启用。纯fake tick/HTTP/soak无需也不会调用受锁Adapter，因此离线验证继续。

不改Gateway/SDK、Runtime配置、原Session；不把人工确认曾idle当永久动态busy证明，不因没有safeRPC就放宽门。下一步可保留Hermes生产阻塞并继续其他离线/人工交付能力；不能冒称Hermes已原生独立接通。
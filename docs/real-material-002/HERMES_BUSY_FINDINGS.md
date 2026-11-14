# Hermes busy 与限定回执接口：静态调查

日期：2026-11-13（Asia/Shanghai）。负责人：Codexroot。本轮只读 D:/TriReviewBridge 适配器和 D:/HermesAgent/Source 中公开Gateway/协议源码；未import/运行Hermes代码，未RPC/UI/发送，未读配置、凭证、原会话日志或私密数据库，未触凪，未改Runtime或接入代码。源码存在不证明当前运行Gateway加载了同一版本。

负责人提供的运行事实：H曾反复busy，后自然空闲；CH-01 forward仅提交一次，admissionId=`bd37ce0a573043a0a826ea910e7fab03`。普通read随后报告conflict；新的有界own回复读取因resume副作用及整历史读取被自动审查拒绝、未执行。本调查不以旧inspect/read或另一脚本重试该路径，不宣称已取到CH-01回复。

## 四字段不是普通完成历史

既有 `native/hermes-session.py:30` 对running/pending/prompts/open_requests做bool OR。这是“暂不宜追加输入”的保守门，并不等于CPU正在推理。

| 字段 | 安装源码定义 | 完成清理与结论 |
|---|---|---|
| running | gateway/session_controls.py:694，handle.execution_state=='running'；session_authority.py:331-339由pending started/unknown推导状态 | 真值不来自历史消息数量；unknown本身可能令running=false，但pending仍阻断 |
| pending | hermes_state_runtime.py:194-200默认仅queued/started/unknown；session_queued_controls.py:64-75另显示仍转交给当前claim的steering | 普通terminal被排除。steering/settling不是已确认可忽略的完成历史 |
| prompts | session_authority.py:389-397绑定活跃execution_generation；session_pending_controls.py:53-64清理失活/跨generation项 | approval/clarify仍在等，非累计提问历史 |
| open_requests | session_server_requests.py:125-134从进程内_open筛选同session、同event_stream、replay=true项 | resolve:87、withdraw:142、lock_answer:164、_ask:189会移除。等待可以是sudo/secret/clarify/其他UI请求，不能直接说都是模型运行 |

没有证据支持“历史完成项误判busy”，不能放宽门。也不能仅由已完成某一自有请求推断原Session整体idle；实际busy原因在本轮静态范围内UNKNOWN。bool OR还依赖合法完整schema；缺字段/类型异常不能视为安全空闲。

未来若在原获准通道上加入最小诊断，只保留running(bool)、pending按queued/started/unknown及steering计数、prompt按approval/clarify/other计数、open request按sudo/secret/clarify/other计数。不导pending.text/input_id、prompt.command/description/question/edit/choices、open_requests.params/answers或messages。这里只是建议，没有开发/运行诊断器。

## resume不等于零副作用snapshot

`gateway/session_controls.py:609-705` 的session.resume会authorize、attach订阅；658-668在允许条件下调用refresh_resumed_policy，669-674的omit_messages只省transcript，不能取消attach/其他行为；676调用_spawn_notice。

`gateway/session_policy_refresh.py:245-259` 明确可在idle本地Session附着前commit配置刷新；busy/其他失败可保留已存policy。`session_authority.py:357-403` 的attach还处理viewer、close与onboarding相关状态。因此只能按真实动作说“未主动传模型覆盖参数、未修改Runtime源码或主动覆盖配置”，不能泛称SDK snapshot零副作用。

## 现成窄RPC：prompt.receipt

已找到公开协议，**尚未调用**：

```text
method: prompt.receipt
params:
  session_id: 固定原Hermes Session ID
  admission_id: 已知本次提交的admissionId
  include_result: false / true（可省略）
```

公开合同 `tui_gateway/contracts/canonical.py:41-56`；没有input_id查找、field mask或no_restore参数，不虚构这些方法/参数。内部find_session_admission按request_id查询不等于公开RPC；prompt.submit幂等重试仍是提交入口，不能当纯读取替代。

返回基础字段：admission_id、ref{profile_id,session_id}、sequence、status(queued/started/unknown/terminal)、outcome、authority_epoch、execution_generation。include_result=true且terminal并有已存结果时，额外result/usage；terminal不自动等于completed，failed/interrupted/缺结果均须如实区分。

调用链：

- `session_controls.py:858-870` → `authority.receipt(actor,ref,admission_id)`，可选读取该已终结admission结果，没有直接resume/attach/policy刷新。
- `session_authority.py:781-794` 核对目标Session、原owner或control权限；按admission读取，锁内保持settling发布一致性。
- `session_results.py:112-119` 在只读DB上下文按单admission及固定state_meta结果key读取，不主动查询整段transcript。

### 不能称“零副作用、仅最终正文”的原因

1. 共用 `session_authority.py:200-239 authorize()`：Session不在内存时，210-228可能restore_local_session/restore_routed_session/mount_history/restore_api_session；238-239调用touch_restored。`session_retirement.py:112-127`在适用时取消/重设retirement计时器。`session_local_recovery.py:153-185`恢复会处理本地receipt/policy、压缩catch-up并加载store；不是有显式fail-if-cold的纯读取合同。当前是否一直warm、是否触发这些分支没有实测，不能保证。
2. `include_result=true`没有只取final_response的server-side field mask，会把整个已存result传回客户端。`hermes_state_terminal.py:18-49 compact_result`通常裁成当前turn suffix，但_compressed例外保留压缩替换snapshot，还可能含_turn_user_row.api_content；:80起load_result保留旧式存储结果。它可能包含工具内容、上下文或历史；客户端丢弃后再只导final_response不能说传输时未接触这些内容。
3. 不带include_result可取得更窄状态元数据，但不能恢复本次回复正文，也不能免除authorize的恢复/计时器分支。

## 其他现成入口与窄结论

session.info不是这四状态的完整单请求getter，同样authorize。`session.events.since`（session_controls.py:739-751）返回Session事件环及open_requests，不按admission筛选，更新连接replay cursor，并经过同一authorize；不能作为仅own回复替代。已核Gateway公开handler/合同未找到独立prompt.result、prompt.status或session.snapshot的零恢复、仅本次final_response接口。

**结论：存在更窄的按admission状态/结果RPC prompt.receipt；不存在由本次静态核对证明可无条件满足“无resume/attach/恢复副作用、只传本次正文”的现成接口。** 不据此执行RPC或换脚本绕过已拒绝动作。若未来考虑该候选，必须把authorize条件副作用和include_result的真实输入/输出范围如实交负责人及审批；当前先停真实SDK发送，等待合法路径或明确保留UNKNOWN。未开发任何新reader、Adapter或Runtime功能。

## 后续静态补充：直接只读SQLite投影（设计，未打开实际DB）

### 路径与物理边界

`hermes_state.py:181,201-204`默认路径为get_hermes_home()/state.db；`hermes_constants.py:194-201`遵从context-local override、HERMES_HOME和平台默认。既有Bridge适配器显式HOME=D:/HermesAgent/Data，因此**候选**是`D:/HermesAgent/Data/state.db`；当前原Gateway是否使用该主profile或served profile的另一个home，本轮未读配置/端点/DB，不能冒称已确认实际文件。未来必须用已有可信绑定明确指定唯一DB，不扫描profiles、不猜其他DB、不修改HERMES_HOME。不要import SessionDB/Runtime寻找路径；SessionDB构造可能涉及迁移、修复、建目录和其他维护。

可由SQLite标准库只读连接在数据库引擎内投影，而不调用Gateway authorize/resume/attach，因而不存在这些RPC的policy刷新/会话恢复调用链。但`json_extract`仍需SQLite内部读取/解析**被选中结果JSON**，数据库页/WAL页也可能包含同页其他数据；不把原blob交给应用，不等于物理从未接触它或实现逐字段OS隔离。若许可要求引擎内也不得接触原blob/同页数据，则该路线不满足，必须明确UNSUPPORTED。

连接候选采用URI mode=ro（hermes_state_holders.py:27-30亦如此），query_only=ON、明确只读事务、有限busy timeout及查询步数/返回长度限制；不自动重试其他文件、修复、checkpoint或更换journal。**mode=ro不能单独证明锁/SHM等所有辅助文件绝无创建或更新**；实际库/WAL只读打开条件需独立审查和fake测试，不足则UNKNOWN。不得用immutable=1掩盖活跃WAL变化，也不复制整个私密DB/WAL当“own导出”。本调查没有执行任何SQLite查询或编写reader。

### 表/键/字段

- `hermes_state_common.py:591-606`：session_admissions，admission_id唯一；request_id、target_session_id、principal_id、seq、status、outcome、owner_epoch、generation等。**没有原生提交/回复timestamp列**。
- 同文件640-643：state_meta(key PRIMARY KEY,value TEXT)。结果key来自`hermes_state_terminal.py:10`：`gateway.admission.result.v1.`+admission_id。
- `hermes_state_runtime.py:264-270`：encode_result(compact_result(...))与terminal状态在同一settlement事务写入。
- 最终文本固定JSON path为`$.result.final_response`。`hermes_state_terminal.py:58-77`的已知_stored v1仅把末尾assistant.content改为null，final_response仍保留原处；无须在应用中load_result或取messages恢复文本。
- compact_result通常标`$.result._messages_are_turn_suffix=true`；`_compressed`例外可能留历史，未知/旧格式从严拒绝。不返回messages、_turn_user_row、tool调用/结果、payload_json、lineage_json或整个value。

### 可审阅参数SQL（尚未执行/验证，不能当真实结果）

固定绑定参数：

```text
:aid = bd37ce0a573043a0a826ea910e7fab03
:sid = local-6f275933587b3c068cdbe3bea5633785fb8cacfb3a4c298855c66d931b6946d7
:rid = trb-real-links-20261112-001.CH-01.forward
:key = gateway.admission.result.v1. + :aid
:max_blob_bytes = 4194304
:max_reply_bytes = 65536
```

:rid本次映射已从源码核实：session_controls.py:822取submission_id优先否则input_id；:833传入Submission.request_id；session_authority.py:751-753传给admit_session_input；hermes_state_runtime.py:172起存入session_admissions.request_id。既有hermes-v2.py只传input_id=request[deliveryId]，故本次request_id就是上述封存值，不是JSON-RPC传输层request.id。其他请求不能据此猜值，不用模糊prompt查历史。一个只读事务内先执行状态查询；无唯一行或非terminal/completed就停止，不读结果：

```sql
SELECT admission_id, request_id, seq, status, outcome, owner_epoch, generation
FROM session_admissions
WHERE admission_id = :aid
  AND target_session_id = :sid
  AND request_id = :rid;
```

若第一步符合，再执行单key投影。CASE仅在已知结构时返回final_response，其他情况NULL=UNKNOWN；不SELECT原blob。这里接受无_stored的已裁后缀格式或已知v1/reply_ref编码；_stored.raw/未知版本/压缩/旧无后缀标记均拒绝：

```sql
SELECT CASE
  WHEN length(CAST(m.value AS BLOB)) <= :max_blob_bytes
       AND json_valid(m.value)
  THEN CASE WHEN
    json_type(m.value, '$.result') = 'object'
    AND json_type(m.value, '$.result._messages_are_turn_suffix') = 'true'
    AND (json_type(m.value, '$.result._compressed') IS NULL
         OR json_type(m.value, '$.result._compressed') IN ('null','false'))
    AND json_type(m.value, '$.result.final_response') = 'text'
    AND length(CAST(json_extract(m.value, '$.result.final_response') AS BLOB))
          BETWEEN 1 AND :max_reply_bytes
    AND (
      json_type(m.value, '$._stored') IS NULL
      OR (
        json_type(m.value, '$._stored') = 'object'
        AND (SELECT count(*) FROM json_each(m.value, '$._stored')) = 2
        AND json_type(m.value, '$._stored.v') = 'integer'
        AND json_extract(m.value, '$._stored.v') = 1
        AND json_type(m.value, '$._stored.reply_ref') = 'integer'
        AND json_extract(m.value, '$._stored.reply_ref') >= 0
        AND json_extract(m.value, '$._stored.reply_ref')
              < json_array_length(m.value, '$.result.messages')
        AND json_extract(m.value,
              '$.result.messages[' || json_extract(m.value, '$._stored.reply_ref') || '].role')
              = 'assistant'
        AND json_type(m.value,
              '$.result.messages[' || json_extract(m.value, '$._stored.reply_ref') || '].content')
              = 'null'
      )
    )
    THEN json_extract(m.value, '$.result.final_response')
    ELSE NULL END
  ELSE NULL END AS own_final_text
FROM state_meta AS m
WHERE m.key = :key
  AND EXISTS (
    SELECT 1 FROM session_admissions AS a
    WHERE a.admission_id = :aid AND a.target_session_id = :sid
      AND a.request_id = :rid AND a.status = 'terminal' AND a.outcome = 'completed'
  );
```

JSON路径/库版本不支持、schema不同、SQLite报错或没有结果一律UNKNOWN；不输出异常SQL值/原JSON片段，不回退SELECT value或遍历state_meta。不追retired tombstone、其他Session或历史。这个投影可取文本/状态，但不能凭admission.seq合成原生消息UUID或timestamp，也不能在不知道当前schema/路径/只读WAL条件时宣称可用。需要的话应另做仅虚构库的最小实现和必要复核，再申请该确切文件/单admission的真实读取；目前仅此静态SQL设计，未读实际数据。

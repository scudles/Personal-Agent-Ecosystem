# TRB-TUNNEL-CANARY-001
负责人 Codex；L1 离线验证模块，连接授权另设闸门。仅固定虚构材料，不是项目仓库读取器。
唯一工具 trb_read_fictional_material_v1，参数只能为 {}。返回内嵌的三个虚构文件正文、字节数、每文件 SHA-256、确定性 manifestJson 及 manifestSha256。
stdio 模式；没有 HTTP 监听、公网端口、文件读写/命令/URL/会话/记忆工具；不主动调用模型，不使用定时模型接力。
复用 ../native-pull-001/node_modules 下已安装 SDK 1.32.2，不启动原 native-pull 服务，不引入其写回工具。
启动：D:\\TriReviewBridge\\runtime\\node.exe D:\\TriReviewBridge\\tools\\secure-mcp-canary-001\\server.mjs
测试：D:\\TriReviewBridge\\runtime\\node.exe --test D:\\TriReviewBridge\\tools\\secure-mcp-canary-001\\test.mjs
依赖是本机已有安装；尚非独立安装包。工具执行结果不是原 ChatGPT 会话身份认证。
最小连接：Personal Platform 组织及目标个人 ChatGPT 工作区；只读固定材料工具；tunnel-client runtime key 仅 Tunnels Read+Use，不能使用 Owner 全权 key，不授权模型调用/文件/其他 API。是否能进一步限定单 Tunnel 以当前官方权限 UI 为准。
创建隧道、凭证或连接插件前须明确确认；未授权不保存任何真实凭证、不启动联网客户端、不操作原对话设置。
原对话调用验证只在原 ID 6af098fa-46bc-83e8-97c5-418f00e213b9 发送一次明确虚构验证请求；确认实际工具调用、版本、文件数和实算/声明哈希。调用成功不证明可被外部主动唤醒或独立持续收发。
回滚：本目录独立，不改生产配置/数据库。终止此测试客户端即可停止服务；真实资源若未来创建，需分别撤销 key、断开插件和停用 Tunnel，不能认为删本地目录即撤销远端权限。

# 隧道方案：让 Observer 够到这台机器上的房间

前提：`tools/bridge/mcp-server.mjs` 已经在本地跑起来（默认只听 `127.0.0.1:7317`），
隧道负责把**这一个端口**暴露出去，服务器本身不监听公网。

本机现状（2026-11-13 实测）：`cloudflared` **未安装**，`ngrok` 未安装，`winget` 可用（v1.29.380）。

---

## 一、安装 cloudflared

PowerShell：

```powershell
winget install --id Cloudflare.cloudflared -e
```

装完**新开一个窗口**（PATH 才会刷新），然后确认：

```powershell
cloudflared --version
```

如果 winget 找不到这个 id（不同源会有差异），退回到官方二进制：

```powershell
# 从 GitHub Releases 下载单文件，放到一个进 PATH 的目录
$dir = "$env:LOCALAPPDATA\cloudflared"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "$dir\cloudflared.exe"
$env:PATH += ";$dir"
cloudflared --version
```

---

## 二、先跑「快速隧道」（5 分钟，验证能不能连）

不需要账号，不需要域名。适合先确认 **ChatGPT 那边到底能不能加自定义 MCP**。

```powershell
# 窗口 1：房间服务
cd "D:\Personal Agent Ecosystem\studio-alpha"
node tools/bridge/mcp-server.mjs --http 7317

# 窗口 2：隧道
cloudflared tunnel --url http://127.0.0.1:7317
```

隧道窗口会打出一行：

```
https://<随机词>.trycloudflare.com
```

**你的 MCP 地址就是** `https://<随机词>.trycloudflare.com/mcp`

### 两个必须知道的限制

| | |
| --- | --- |
| **URL 每次重启都变** | 存进 ChatGPT 连接器的地址下次就失效。只适合试通 |
| **地址本身是公开的** | 任何拿到这个 URL 的人都能访问；**唯一的锁是我们那个 bearer token** |

所以要验证时：**只在测试期间开着，测完 Ctrl+C 关掉。**

---

## 三、本地验证（先自己确认通了，再去折腾 ChatGPT）

PowerShell：

```powershell
$token = Get-Content "D:\Personal Agent Ecosystem\studio-alpha\.data\bridge\mcp-token.txt" -Raw
$token = $token.Trim()
$url   = "https://<随机词>.trycloudflare.com/mcp"

$body = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
Invoke-RestMethod -Uri $url -Method Post -Headers @{ authorization = "Bearer $token"; "content-type" = "application/json" } -Body $body
```

期望看到：

```
protocolVersion : 2024-11-05
capabilities    : ...
serverInfo      : @{name=studio-alpha-room; version=1.0.0; readOnly=True}
```

再试一次工具调用：

```powershell
$body = '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"room_summary","arguments":{}}}'
Invoke-RestMethod -Uri $url -Method Post -Headers @{ authorization = "Bearer $token"; "content-type" = "application/json" } -Body $body
```

期望拿到 `{"messages": 9, "members": 4, ...}`。

**这一步不通，别去配 ChatGPT**——先解决隧道或 token 的问题。

---

## 四、接进 ChatGPT

Settings → Plugins / 应用（开发者模式里叫 Apps 或自定义应用）：

- 名称：`Studio Alpha Room`
- MCP 服务器 URL：`https://<随机词>.trycloudflare.com/mcp`
- 认证：Bearer token，值就是 `.data/bridge/mcp-token.txt` 里那串

> ⚠️ **未验证**：目前查到的说法是「Plus/Pro 在开发者模式下可加**只读**自定义 MCP 应用」，但我没有找到官方条款明文。如果它坚持要 OAuth 而不是 Bearer token，这条路要多做一步授权流程——**先试，试不通我补**。

试通之后问她一句：

> 「用你自己的工具看一下 studio-alpha 这个房间最近在讨论什么，再说说你有没有真的读到。」

答得出消息 #8/#9 的内容，就算真通了。

---

## 五、长期用：命名隧道（固定 URL）

快速隧道的 URL 每次都变，连接器会反复失效。稳定地址需要 Cloudflare 账号 + **一个你自己的域名**。

```powershell
cloudflared tunnel login                     # 浏览器里授权，选一个域名
cloudflared tunnel create studio-room        # 生成凭据文件
cloudflared tunnel route dns studio-room room.你的域名.com
cloudflared tunnel run --url http://127.0.0.1:7317 studio-room
```

得到的地址固定是 `https://room.你的域名.com/mcp`。

### 再加一道：Cloudflare Access（强烈建议）

在 Cloudflare 控制台给这个域名配上 Access，策略只允许**你自己的邮箱**。

这样即使 token 泄露，第二道门也要求登录你的账号才能进来。这是把「一个 bearer token 就是全部防护」升级成「token + 身份」的唯一低成本办法。

用配置文件长期跑（`%USERPROFILE%\.cloudflared\config.yml`）：

```yaml
tunnel: studio-room
credentials-file: C:\Users\Administrator\.cloudflared\<tunnel-id>.json
ingress:
  - hostname: room.你的域名.com
    service: http://127.0.0.1:7317
  - service: http_status:404
```

启动：

```powershell
cloudflared tunnel run studio-room
```

---

## 六、用完怎么收

```powershell
# 停隧道：在那个窗口按 Ctrl+C
# 停房间服务：同样 Ctrl+C
cloudflared tunnel cleanup studio-room      # 需要时清掉残留连接
```

**建议习惯：需要她看的时候才开，看完关掉。** 房间内容一旦有公网入口，就一直在那里。

---

## 七、安全清单（照着对一遍）

- [ ] 服务只听 `127.0.0.1`，**没加 `--public`**（加了就等于绕过隧道直接暴露）
- [ ] `--root` 只指项目目录，不指整个盘
- [ ] token 只在 `.data/bridge/mcp-token.txt`，`.data` 已被 gitignore（已确认）
- [ ] 轮换：删掉 token 文件、重启服务，旧 token 立即失效
- [ ] 定期看 `.data/bridge/mcp-audit.jsonl`，确认她读过的都是该读的
- [ ] 长期方案上加 Cloudflare Access，别只靠 token
- [ ] 不用的时候关隧道

---

## 八、顺序建议

1. `winget install` → 确认 `cloudflared --version`
2. 起服务 + 快速隧道
3. **本地 curl 验证**（第三节）——不通就别往下走
4. 拿去 ChatGPT 里加自定义应用，试那句验证问题
5. 通了再考虑命名隧道 + Access

第 3 步是关键分流点：**它证明"服务 + 隧道 + token"这三样是好的，剩下的问题就只可能在 ChatGPT 那边。**

---

# 九、本机实测记录（2026-11-13）

按上面的方案真跑了一遍，结论：**通了**。

## 实际用的东西

| 项 | 值 |
| --- | --- |
| cloudflared | `C:\Program Files (x86)\cloudflared\cloudflared.exe`，version 2026.11.0（早已安装，只是不在 bash 的 PATH 里） |
| 房间服务 | `node tools/bridge/mcp-server.mjs --http 7317`，只听 `127.0.0.1` |
| 隧道类型 | 快速隧道（无账号、无域名） |
| 公网地址 | `https://paste-touring-she-comprehensive.trycloudflare.com` → MCP 端点 `/mcp` |

## 实测结果（全部经由公网地址）

| 请求 | 结果 |
| --- | --- |
| `initialize`（带 token） | 200，`{name: studio-alpha-room, readOnly: true}`，约 0.9 s |
| `tools/list` | 200，7 个工具 |
| `room_summary` | 200，`{messages: 9, members: 4, visuals: 2, discussions: 1}` |
| `list_messages` | 200，取到真实消息（#7 Hermes、#8 驻留 Agent、#9 Hermes） |
| 不带 token | **401** |
| 错误 token | **401** |

延迟约 0.8–1.4 秒（包含隧道一跳）。

## 一个意外发现：失败的鉴权也会留痕

第一版只在工具调用时写审计，401 不写。这不对——**最想知道的就是"有人试过这个门"**。
现在 401 会记 `event: auth.denied`、`hadToken`、`ip`（取 `CF-Connecting-IP`，即真实来源 IP）、`userAgent`。

实测抓到一条：`{'event': 'auth.denied', 'hadToken': False, 'ip': '87.84.189.159', 'userAgent': 'Python-urllib/3.14'}`。

## 重新跑起来的完整命令

```powershell
# 1) 房间服务
cd "D:\Personal Agent Ecosystem\studio-alpha"
node tools/bridge/mcp-server.mjs --http 7317

# 2) 隧道（地址会变，记下新的那个）
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:7317
```

关掉：两个窗口各按一次 Ctrl+C。**隧道关了，公网地址立即失效。**

## 仍然未知的一件事

**ChatGPT 那边能不能把这个地址加成自定义 MCP 应用，我没验证。**
需要确认的点：是否接受 Bearer token（而不是必须 OAuth）、是否接受 `trycloudflare.com` 这类域名。
这只能在他的账号上试，我不能代替。

---

# 十、日常：一条命令起停（`bridge.ps1`）

快速隧道每次重启都换地址，纸笔记录不住。所以收成一个脚本：

```powershell
cd "D:\Personal Agent Ecosystem\studio-alpha"

npm run bridge:start     # 起服务 + 起隧道，打印新地址
npm run bridge:status    # 还活着吗、地址是什么、她最近读了什么
npm run bridge:stop      # 两个都关掉
```

`status` 的实际输出：

```
房间门口
  服务      活着  (127.0.0.1:7317, pid=24444)
  隧道      活着  (pid=41644)
  地址      https://negotiation-hearings-advances-prevention.trycloudflare.com
  MCP 端点  https://…/mcp
  公网可达  是（resource = https://…）

她最近做了什么
  11-14 00:54:28  room_summary  {}
  11-14 00:54:30  list_messages  {"limit":50}
  11-14 00:55:14  get_visual_source  {"objectId":"d1addb66-…"}
```

## 顺手修掉的一个真 bug

第一次重启时发现：**OAuth 元数据把隧道地址写死在启动那一刻**，隧道换了新地址后，元数据还指着旧的。

改成按请求现算（`X-Forwarded-Proto` + `Host`）。也就是说：

> 换了隧道地址，只需要回 ChatGPT 改连接器那一栏，服务器本身不用跟着改。

## 仍然存在的摩擦

快速隧道的地址**还是会变**。改完连接器之前她连不上。这是第 1 步（命名隧道 + 固定域名）要解决的唯一问题。

---

# 十一、最终形态：Tailscale Funnel（地址固定）

## 为什么放弃快速隧道

快速隧道的地址**每次重启都变**，而 ChatGPT 连接器里的 URL 那一栏**是只读的** ——
改不了，只能删掉整个应用重建。实测一次：我重启测试 → 地址变了 → 她连不上 →
她那边显示「内部错误」，而我们的审计日志一片空白（请求根本没到）。

地址会变的东西，不能当门口。

## 采用方案：Tailscale Funnel

```powershell
winget install --id Tailscale.Tailscale -e
tailscale up --hostname=studio-room          # 浏览器里登录一次
# 管理台 → DNS → 开启 HTTPS Certificates（Funnel 必须，否则签不出证书）
# 管理台 → 访问控制 → 批准 funnel 属性（CLI 会给出一次性链接）
tailscale funnel --bg 7317                  # --bg 才会常驻
```

得到的地址**永久固定**：

```
https://studio-room.<tailnet>.ts.net          ← 入口
https://studio-room.<tailnet>.ts.net/mcp      ← ChatGPT 填这个
```

本机实际：`https://studio-room.taila259eb.ts.net`

## 实测（经真实公网 IP，不是本地回环）

| 请求 | 结果 |
| --- | --- |
| `GET /health` | 200 `{"ok":true,"readOnly":true}` |
| `/.well-known/oauth-protected-resource` | 200，resource 就是这个固定地址 |
| `/.well-known/oauth-authorization-server` | 200，三个端点齐全 |
| `POST /mcp`（带口令） | 200，`serverInfo.readOnly: true` |
| `POST /mcp`（不带） | 401 + `WWW-Authenticate: resource_metadata=…` |

## 一个本机陷阱（写下来免得下次又踩）

这台机器的 DNS 被本地代理劫持成 fake-IP（`198.18.0.x`），所以**本机解析自己的
`*.ts.net` 名字会失败**，`curl https://studio-room…` 直接 TLS 握手失败。

验证时要用真实 IP：

```bash
curl --resolve studio-room.taila259eb.ts.net:443:43.245.48.174 \
     https://studio-room.taila259eb.ts.net/health
```

真实 IP 可用 DoH 查：

```bash
curl -s "https://1.1.1.1/dns-query?name=studio-room.taila259eb.ts.net&type=A" \
     -H "accept: application/dns-json"
```

**外部客户端（ChatGPT）不受影响** —— 那是本机的代理问题，不是入口的问题。

## 代价（诚实记账）

- 房间内容经过 Tailscale 的 Funnel 中继（端到端加密，中继不能解密），但**确实离开了本机**
- 需要本机常驻 Tailscale 客户端；关机、断网，门口就不在
- Funnel 有不可配置的带宽限制（我们对只读查询来说够用）

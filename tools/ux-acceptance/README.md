# 既有原生proof检查器

```powershell
.\runtime\node.exe tools/ux-acceptance/check-proof.mjs --proof evidence/offline-collab-002/native-integration.json --out evidence/ux-acceptance-tools-001/ux-proof-check-new-run.json
```

每次使用新的输出文件名。输出采用独占`wx`，已有文件、与输入相同的目标、固定Root以外的路径都会拒绝；不会覆盖旧证据。输出只允许在`evidence/ux-acceptance-tools-001/`或新的`test-output/`子路径中。

proof、来源、候选二进制、PNG和输出统一从盘符根目录逐层检查祖先的lstat与realpath；任何junction/符号链接拒绝，输入也不能从Root以外导入。读取仅允许单链接的普通文件，并限长、核对打开前后文件身份/大小/时间。JSON和单项源码最多4MiB，候选二进制64MiB，PNG16MiB；PNG还核对IHDR尺寸/颜色/位深、chunk边界/CRC及末尾IEND。

这些是本地文件路径及一致性检查，不是OS隔离，也不宣称抵御其他恶意进程持续并发篡改路径。工具没有窗口控制、显示设置修改、RPC、网络或命令执行能力。

成功结论`RECORDED_NATIVE_ASSERTIONS_CHECKED`只表示已有proof断言、预览文件和当前hash对应。失败项逐条保留。首次使用者、实际125%/150%DPI、文本可读性/键盘体验继续需要真人证据；不以PNG缩放补物理DPI，不把本工具当一小时耐久验收。

自有测试：

```powershell
.\runtime\node.exe --test tools/safe-local-files.test.mjs tools/ux-acceptance/check-proof.test.mjs tools/real-link-evidence/collector.test.mjs
```

路径负例仅使用新的假数据目录，包含真实junction、已有报告不改原bytes、输入输出冲突、越界、大小限制和非法PNG；不操作运行中的真实soak报告。

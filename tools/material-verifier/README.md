# Fixed canary material verifier

Local implementation for `TRB-READONLY-MATERIAL-VERIFIER-001`. This is not an installed Agent tool and does not establish receipt by an original Agent session. Root must complete independent review and caller/permission checks before any real Agent use.

The Windows CLI verifies only the existing five-file canary `d63d404e-1861-4aec-ab1f-277c63b3ecff / v1` at the directory pinned in `verify.mjs`. It accepts no path, command, manifest override, expected-hash override or fixture selector.

```powershell
.\runtime\node.exe .\tools\material-verifier\verify.mjs --nonce bounded-request-001
.\runtime\node.exe --test .\tools\material-verifier\verify.test.mjs
```

Nonce is an optional 1–128 character ASCII token (`A-Z a-z 0-9 . _ : -`), echoed only in JSON. Success exits0; refusal exits2 and emits `verified:false` plus a bounded error code. The helper uses only built-in filesystem reads and SHA-256. It does not write checked files, execute package code, launch a child process, access the network or call any Agent/SDK/UI.

Checks include every ancestor's link/resolved path, exact directory inventory, regular-file and single-hardlink requirements, bounded descriptor reads, identity/timestamp consistency before/after reads, exact Manifest fields/identity/canonical bytes, pinned size/hash of all five files and the canonical five-entry package hash. A changing file is read at most16,385 bytes before refusal. JSON separates `expected`, `declared` and `measured`; `originalSessionProven:false` and `realAgentReceipt:false` remain explicit.

`verifyFixtureForTests` is a module-only test surface, absent from the CLI. It accepts only UUIDv4 identifiers under this tool's own `fixtures/real-material-canary-001-<UUID>/package`, with the same fixed content/hash rules and an explicit `SELF_TEST` scope; it cannot select arbitrary paths or expected content. Test-created files remain in that isolated fixture folder for review.

Current local results:15 tests,14 passed,0 failed,1 skipped. Real Windows directory junctions at the package and an ancestor, plus a junction introduced between file reads, are exercised. The file-symlink fixture cannot be created under current Windows privileges (`EPERM`) and is explicitly skipped/uncovered, not reported as a passing control. No privilege change or bypass was attempted. See `evidence/material-verifier-001/IMPLEMENTATION_REPORT.json` and `tests-resumed.txt` for evidence and review status.

"""Read only the five explicitly mapped current canary attachments. Stdlib only.

No discovery, directory enumeration, network, subprocess, file writes or material
execution. The caller supplies paths from the user/native attachment tool.
"""
import sys
sys.dont_write_bytecode = True

import hashlib
import json
import os
import stat

EXPECTED_PACKAGE_ID = "d63d404e-1861-4aec-ab1f-277c63b3ecff"
EXPECTED_SNAPSHOT_ID = "1f7a3f49-8190-4650-a586-ff4706e17b8d"
EXPECTED_MANIFEST = "509a8e93d122b5ea596ee547dc8a7dccb8445f02e330aa9aa65e2318f29cbf7c"
EXPECTED_PACKAGE = "2fb8f259ac0c986b77b90c8fe7f9aa3c647e716c18168bd1b643ac7ea28206d8"
EXPECTED_FILES = [
    {"path": "README.txt", "sizeBytes": 174, "sha256": "87a757e5019fd9e6b7b0f9f2fe1fa0b0f0544e8086deab7b7c49bbe1e907d889"},
    {"path": "manifest.json", "sizeBytes": 755, "sha256": EXPECTED_MANIFEST},
    {"path": "manifest.sha256", "sizeBytes": 80, "sha256": "1025b22e098049e2b86adec6049f9c1a9fb76c8b056b6ff61b00cb19ba8169de"},
    {"path": "notes.txt", "sizeBytes": 160, "sha256": "93ba3bee995344faef94906ce9a8dab8b312d020605d8cbe66c6c3e1897f9bc8"},
    {"path": "orchard.json", "sizeBytes": 281, "sha256": "b9d3a2d7f5779246dc286d13e380e953c6649bdae85f7a6ad118de7d9e877528"},
]
MAX_FILE_BYTES = 2 * 1024 * 1024


def _canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _identity(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


def _path_identity(info):
    # Windows lstat and fstat can expose creation/change time differently.
    # Compare shared path/FD fields here; FD-to-FD stability still includes ctime.
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns)


def _read_one(path):
    before_path = os.lstat(path)
    if not stat.S_ISREG(before_path.st_mode) or before_path.st_size > MAX_FILE_BYTES:
        raise ValueError("not_a_bounded_regular_attachment")
    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(path, flags)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_size > MAX_FILE_BYTES or _path_identity(before_path) != _path_identity(before):
            raise ValueError("not_a_bounded_regular_attachment")
        chunks, size, digest = [], 0, hashlib.sha256()
        while True:
            chunk = os.read(fd, min(65536, MAX_FILE_BYTES + 1 - size))
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_FILE_BYTES:
                raise ValueError("attachment_exceeds_limit")
            digest.update(chunk)
            chunks.append(chunk)
        after = os.fstat(fd)
        if _identity(before) != _identity(after) or _path_identity(after) != _path_identity(os.lstat(path)) or size != before.st_size:
            raise ValueError("attachment_changed_during_read")
        return b"".join(chunks), digest.hexdigest(), (before.st_dev, before.st_ino)
    finally:
        os.close(fd)


def verify_paths(paths):
    result = {
        "format": "TRB_CHATGPT_ATTACHMENT_HASH_V1",
        "status": "UNSUPPORTED",
        "scope": "ONLY_FIVE_EXPLICIT_CURRENT_ATTACHMENT_PATHS",
        "mappingSource": "CALLER_SUPPLIED_NOT_DISCOVERED",
        "expected": {"packageId": EXPECTED_PACKAGE_ID, "version": 1, "snapshotId": EXPECTED_SNAPSHOT_ID,
                     "manifestSha256": EXPECTED_MANIFEST, "packageSha256": EXPECTED_PACKAGE, "files": EXPECTED_FILES},
        "declared": None,
        "measured": {"files": [], "manifestSha256": None, "packageSha256": None},
        "checks": {}, "errors": [], "allFiveMeasured": False,
        "platformObservationAuthenticated": False, "implementationAuthorized": False,
    }
    names = [entry["path"] for entry in EXPECTED_FILES]
    if not isinstance(paths, dict) or set(paths) != set(names):
        result["errors"].append("exact_five_explicit_paths_required_no_discovery")
        return result
    if any(not isinstance(paths[name], str) or not paths[name] or "\x00" in paths[name]
           or not os.path.isabs(paths[name]) for name in names):
        result["errors"].append("every_attachment_path_must_be_explicit_and_absolute")
        return result
    if len({os.path.normcase(os.path.abspath(paths[name])) for name in names}) != 5:
        result["errors"].append("five_distinct_attachment_paths_required")
        return result
    data, identities = {}, set()
    for name in names:
        try:
            raw, digest, identity = _read_one(paths[name])
            if identity in identities:
                raise ValueError("same_attachment_identity_reused")
            identities.add(identity)
            result["measured"]["files"].append({"path": name, "sizeBytes": len(raw), "sha256": digest})
            if name in ("manifest.json", "manifest.sha256"):
                data[name] = raw
        except (OSError, ValueError) as error:
            result["errors"].append({"file": name, "error": type(error).__name__, "reason": str(error)})
    if len(result["measured"]["files"]) != 5:
        return result
    result["allFiveMeasured"] = True
    measured = {entry["path"]: entry for entry in result["measured"]["files"]}
    result["measured"]["manifestSha256"] = measured["manifest.json"]["sha256"]
    result["measured"]["packageSha256"] = hashlib.sha256(_canonical(result["measured"]["files"])).hexdigest()
    result["checks"]["filesMatchFixedExpected"] = result["measured"]["files"] == EXPECTED_FILES
    result["checks"]["manifestHashMatchesExpected"] = result["measured"]["manifestSha256"] == EXPECTED_MANIFEST
    result["checks"]["packageHashMatchesExpected"] = result["measured"]["packageSha256"] == EXPECTED_PACKAGE
    try:
        manifest = json.loads(data["manifest.json"].decode("utf-8"))
        control = data["manifest.sha256"].decode("ascii")
        result["declared"] = {"packageId": manifest.get("packageId"), "version": manifest.get("version"),
                              "snapshotId": manifest.get("snapshotId"), "format": manifest.get("format"),
                              "payloadFileCount": manifest.get("payloadFileCount"), "payloadBytes": manifest.get("payloadBytes"),
                              "files": manifest.get("files"), "controlManifestSha256Line": control}
        result["checks"]["manifestIdentityMatchesExpected"] = (
            manifest.get("packageId") == EXPECTED_PACKAGE_ID and manifest.get("version") == 1
            and manifest.get("snapshotId") == EXPECTED_SNAPSHOT_ID and manifest.get("format") == "TRB_REAL_MATERIAL_CANARY_V1"
            and manifest.get("fictional") is True and manifest.get("payloadFileCount") == 3 and manifest.get("payloadBytes") == 615)
        declarations = manifest.get("files")
        payload_names = {"README.txt", "notes.txt", "orchard.json"}
        valid = isinstance(declarations, list) and len(declarations) == 3
        if valid:
            declared_names = [entry.get("path") for entry in declarations if isinstance(entry, dict)]
            valid = len(declared_names) == 3 and set(declared_names) == payload_names
        if valid:
            valid = all(entry.get("sizeBytes") == measured[entry["path"]]["sizeBytes"]
                        and entry.get("sha256") == measured[entry["path"]]["sha256"] for entry in declarations)
        result["checks"]["declaredPayloadMatchesMeasured"] = valid
        result["checks"]["controlMatchesMeasuredManifest"] = control == result["measured"]["manifestSha256"] + "  manifest.json\n"
    except (UnicodeError, ValueError, AttributeError, TypeError) as error:
        result["errors"].append({"file": "control_files", "error": type(error).__name__, "reason": "declared_metadata_not_parseable"})
        result["checks"]["declaredControlParseable"] = False
    result["status"] = "MEASURED_MATCH" if not result["errors"] and all(result["checks"].values()) else "MISMATCH"
    return result


def main(args=None):
    args = sys.argv[1:] if args is None else args
    if not args:
        report = verify_paths(None)
    elif len(args) == 2 and args[0] == "--paths-json":
        try:
            report = verify_paths(json.loads(args[1]))
        except (ValueError, TypeError):
            report = verify_paths(None)
            report["errors"].append("invalid_explicit_paths_json")
    else:
        report = verify_paths(None)
        report["errors"].append("usage: --paths-json <exact-five-attachment-path-map>")
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    return 0 if report["status"] == "MEASURED_MATCH" else 2 if report["status"] == "UNSUPPORTED" else 1


if __name__ == "__main__":
    sys.exit(main())

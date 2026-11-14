"""Read one explicitly supplied current ZIP attachment; never extract or discover."""
import sys
sys.dont_write_bytecode = True

import hashlib
import io
import json
import os
import stat
import zipfile

EXPECTED_PACKAGE_ID = "d63d404e-1861-4aec-ab1f-277c63b3ecff"
EXPECTED_SNAPSHOT_ID = "1f7a3f49-8190-4650-a586-ff4706e17b8d"
EXPECTED_MANIFEST = "509a8e93d122b5ea596ee547dc8a7dccb8445f02e330aa9aa65e2318f29cbf7c"
EXPECTED_PACKAGE = "2fb8f259ac0c986b77b90c8fe7f9aa3c647e716c18168bd1b643ac7ea28206d8"
EXPECTED_WRAPPER = "ca7e2cc97e6dc496936ba7c183585c11b27537b44f22afbabc2558f6834f8f4c"
EXPECTED_FILES = [
    {"path": "README.txt", "sizeBytes": 174, "sha256": "87a757e5019fd9e6b7b0f9f2fe1fa0b0f0544e8086deab7b7c49bbe1e907d889"},
    {"path": "manifest.json", "sizeBytes": 755, "sha256": EXPECTED_MANIFEST},
    {"path": "manifest.sha256", "sizeBytes": 80, "sha256": "1025b22e098049e2b86adec6049f9c1a9fb76c8b056b6ff61b00cb19ba8169de"},
    {"path": "notes.txt", "sizeBytes": 160, "sha256": "93ba3bee995344faef94906ce9a8dab8b312d020605d8cbe66c6c3e1897f9bc8"},
    {"path": "orchard.json", "sizeBytes": 281, "sha256": "b9d3a2d7f5779246dc286d13e380e953c6649bdae85f7a6ad118de7d9e877528"},
]
MAX_ZIP_BYTES = 2 * 1024 * 1024


def _canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _path_identity(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns)


def _fd_identity(info):
    return _path_identity(info) + (info.st_ctime_ns,)


def _read_zip_bytes(path):
    before_path = os.lstat(path)
    if not stat.S_ISREG(before_path.st_mode) or before_path.st_size > MAX_ZIP_BYTES:
        raise ValueError("zip_not_a_bounded_regular_file")
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0))
    try:
        before = os.fstat(fd)
        if _path_identity(before_path) != _path_identity(before) or not stat.S_ISREG(before.st_mode):
            raise ValueError("zip_changed_before_read")
        chunks, size = [], 0
        while True:
            chunk = os.read(fd, min(65536, MAX_ZIP_BYTES + 1 - size))
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_ZIP_BYTES:
                raise ValueError("zip_exceeds_limit")
            chunks.append(chunk)
        after = os.fstat(fd)
        if size != before.st_size or _fd_identity(before) != _fd_identity(after) or _path_identity(after) != _path_identity(os.lstat(path)):
            raise ValueError("zip_changed_during_read")
        return b"".join(chunks)
    finally:
        os.close(fd)


def verify_zip_path(path):
    result = {"format": "TRB_CHATGPT_ZIP_ATTACHMENT_HASH_V1", "status": "UNSUPPORTED",
              "scope": "ONE_EXPLICIT_CURRENT_ZIP_WITH_EXACT_FIXED_FIVE_MEMBERS",
              "expected": {"packageId": EXPECTED_PACKAGE_ID, "version": 1, "snapshotId": EXPECTED_SNAPSHOT_ID,
                           "manifestSha256": EXPECTED_MANIFEST, "packageSha256": EXPECTED_PACKAGE,
                           "wrapperSha256": EXPECTED_WRAPPER, "files": EXPECTED_FILES},
              "declared": None, "measured": {"wrapperSha256": None, "wrapperSizeBytes": None,
                                             "files": [], "manifestSha256": None, "packageSha256": None},
              "checks": {}, "errors": [], "allFiveMeasured": False,
              "platformObservationAuthenticated": False, "implementationAuthorized": False}
    if not isinstance(path, str) or not path or "\x00" in path or not os.path.isabs(path):
        result["errors"].append("explicit_absolute_zip_attachment_path_required_no_discovery")
        return result
    try:
        raw_zip = _read_zip_bytes(path)
    except (OSError, ValueError) as error:
        result["errors"].append({"error": type(error).__name__, "reason": str(error)})
        return result
    result["measured"]["wrapperSha256"] = hashlib.sha256(raw_zip).hexdigest()
    result["measured"]["wrapperSizeBytes"] = len(raw_zip)
    result["checks"]["wrapperHashMatchesExpected"] = result["measured"]["wrapperSha256"] == EXPECTED_WRAPPER
    expected = {entry["path"]: entry for entry in EXPECTED_FILES}
    controls = {}
    try:
        with zipfile.ZipFile(io.BytesIO(raw_zip), "r") as archive:
            infos = archive.infolist()  # Only this explicit ZIP's own central directory.
            names = [info.filename for info in infos]
            if len(names) != len(set(names)):
                result["errors"].append("duplicate_member_name")
            if len(infos) != 5 or set(names) != set(expected):
                result["errors"].append("exact_fixed_five_members_required")
            for info in infos:
                name = info.filename
                if "/" in name or "\\" in name or name in (".", "..") or info.is_dir():
                    result["errors"].append("unsafe_member_path_or_directory")
                if name not in expected:
                    result["errors"].append("non_fixed_member_name")
                if info.flag_bits & (1 | 64):
                    result["errors"].append("encrypted_member_not_allowed")
                if info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
                    result["errors"].append("unsupported_compression_method")
                kind = stat.S_IFMT(info.external_attr >> 16)
                if kind not in (0, stat.S_IFREG):
                    result["errors"].append("non_regular_zip_member")
                if name in expected and info.file_size != expected[name]["sizeBytes"]:
                    result["errors"].append("member_declared_size_mismatch")
                if info.compress_size > MAX_ZIP_BYTES or info.file_size > 1024 * 1024:
                    result["errors"].append("member_exceeds_limit")
            if result["errors"]:
                result["status"] = "MISMATCH"
                return result
            by_name = {info.filename: info for info in infos}
            for name in sorted(expected):
                limit = expected[name]["sizeBytes"]
                with archive.open(by_name[name], "r") as member:
                    raw = member.read(limit + 1)
                    if len(raw) != limit or member.read(1):
                        raise ValueError("member_actual_size_mismatch")
                result["measured"]["files"].append({"path": name, "sizeBytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()})
                if name in ("manifest.json", "manifest.sha256"):
                    controls[name] = raw
    except (zipfile.BadZipFile, OSError, ValueError, RuntimeError, NotImplementedError) as error:
        result["errors"].append({"error": type(error).__name__, "reason": str(error)})
        result["status"] = "MISMATCH"
        return result
    result["allFiveMeasured"] = len(result["measured"]["files"]) == 5
    result["measured"]["packageSha256"] = hashlib.sha256(_canonical(result["measured"]["files"])).hexdigest()
    measured = {entry["path"]: entry for entry in result["measured"]["files"]}
    result["measured"]["manifestSha256"] = measured["manifest.json"]["sha256"]
    result["checks"]["filesMatchFixedExpected"] = result["measured"]["files"] == EXPECTED_FILES
    result["checks"]["manifestHashMatchesExpected"] = result["measured"]["manifestSha256"] == EXPECTED_MANIFEST
    result["checks"]["packageHashMatchesExpected"] = result["measured"]["packageSha256"] == EXPECTED_PACKAGE
    try:
        manifest = json.loads(controls["manifest.json"].decode("utf-8"))
        control = controls["manifest.sha256"].decode("ascii")
        result["declared"] = {"packageId": manifest.get("packageId"), "version": manifest.get("version"), "snapshotId": manifest.get("snapshotId"),
                              "files": manifest.get("files"), "controlManifestSha256Line": control}
        result["checks"]["manifestIdentityMatchesExpected"] = manifest.get("packageId") == EXPECTED_PACKAGE_ID and manifest.get("version") == 1 and manifest.get("snapshotId") == EXPECTED_SNAPSHOT_ID and manifest.get("format") == "TRB_REAL_MATERIAL_CANARY_V1" and manifest.get("fictional") is True and manifest.get("payloadFileCount") == 3 and manifest.get("payloadBytes") == 615
        declarations = manifest.get("files")
        valid = isinstance(declarations, list) and len(declarations) == 3 and all(isinstance(entry, dict) for entry in declarations)
        if valid:
            valid = {entry.get("path") for entry in declarations} == {"README.txt", "notes.txt", "orchard.json"}
        if valid:
            valid = all(entry.get("sizeBytes") == measured[entry["path"]]["sizeBytes"] and entry.get("sha256") == measured[entry["path"]]["sha256"] for entry in declarations)
        result["checks"]["declaredPayloadMatchesMeasured"] = valid
        result["checks"]["controlMatchesMeasuredManifest"] = control == result["measured"]["manifestSha256"] + "  manifest.json\n"
    except (UnicodeError, ValueError, AttributeError, TypeError) as error:
        result["errors"].append({"error": type(error).__name__, "reason": "declared_metadata_not_parseable"})
        result["checks"]["declaredControlParseable"] = False
    result["status"] = "MEASURED_MATCH" if not result["errors"] and all(result["checks"].values()) else "MISMATCH"
    return result


def main(args=None):
    args = sys.argv[1:] if args is None else args
    report = verify_zip_path(args[1] if len(args) == 2 and args[0] == "--zip-path" else None)
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    return 0 if report["status"] == "MEASURED_MATCH" else 2 if report["status"] == "UNSUPPORTED" else 1


if __name__ == "__main__":
    sys.exit(main())

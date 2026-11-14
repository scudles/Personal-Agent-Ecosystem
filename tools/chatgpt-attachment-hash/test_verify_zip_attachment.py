"""Fresh fake ZIP tests. No original conversation, package or helper is changed."""
import base64
import importlib.util
import io
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch
import warnings
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


verifier = load("zip_attachment_verifier", HERE / "verify_zip_attachment.py")
fixture = load("fake_zip_canary_bytes", HERE / "fake_zip_fixture.py")
ORIGINAL = base64.b64decode(fixture.ZIP_BASE64)


def payloads():
    with zipfile.ZipFile(io.BytesIO(ORIGINAL), "r") as archive:
        return [(entry["path"], archive.read(entry["path"])) for entry in verifier.EXPECTED_FILES]


def make_zip(items, compression=zipfile.ZIP_STORED):
    output = io.BytesIO()
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        with zipfile.ZipFile(output, "w", compression=compression) as archive:
            for name, data in items:
                archive.writestr(name, data)
    return output.getvalue()


class ZipHashTests(unittest.TestCase):
    def setUp(self):
        (ROOT / "test-output").mkdir(exist_ok=True)
        self.folder = Path(tempfile.mkdtemp(prefix="fake-chatgpt-zip-hash-", dir=ROOT / "test-output"))
        self.path = self.folder / "native-opaque-archive-id.bin"
        self.path.write_bytes(ORIGINAL)

    def run_bytes(self, data):
        self.path.write_bytes(data)
        return verifier.verify_zip_path(str(self.path))

    def test_exact_public_fictional_wrapper_measures_five_original_bytes(self):
        result = verifier.verify_zip_path(str(self.path))
        self.assertEqual(result["status"], "MEASURED_MATCH")
        self.assertTrue(result["allFiveMeasured"])
        self.assertEqual(result["measured"]["wrapperSha256"], verifier.EXPECTED_WRAPPER)
        self.assertEqual(result["measured"]["packageSha256"], verifier.EXPECTED_PACKAGE)
        self.assertEqual(result["measured"]["manifestSha256"], verifier.EXPECTED_MANIFEST)
        self.assertEqual(len(result["measured"]["files"]), 5)
        self.assertFalse(result["platformObservationAuthenticated"])

    def test_missing_path_or_bytes_never_guesses_or_reports_a_match(self):
        for path in [None, "", "CANARY_ORIGINALS.zip", str(self.folder / "missing.zip")]:
            self.assertEqual(verifier.verify_zip_path(path)["status"], "UNSUPPORTED")

    def test_duplicate_extra_traversal_and_directory_members_stop_before_reading_members(self):
        items = payloads()
        variants = [items + [items[0]], items + [("other-private.txt", b"fake")],
                    [("../notes.txt" if name == "notes.txt" else name, data) for name, data in items],
                    [("notes.txt/" if name == "notes.txt" else name, data) for name, data in items]]
        for entries in variants:
            self.path.write_bytes(make_zip(entries))
            with patch.object(zipfile.ZipFile, "open", side_effect=AssertionError("no member read before allowlist")):
                result = verifier.verify_zip_path(str(self.path))
            self.assertEqual(result["status"], "MISMATCH")
            self.assertFalse(result["allFiveMeasured"])
            self.assertTrue(result["errors"])

    def test_encrypted_flag_stops_without_decrypting(self):
        data = bytearray(ORIGINAL)
        for signature, offset in [(b"PK\x03\x04", 6), (b"PK\x01\x02", 8)]:
            start = data.index(signature)
            data[start + offset] |= 1
        self.path.write_bytes(data)
        with patch.object(zipfile.ZipFile, "open", side_effect=AssertionError("no decrypt")):
            result = verifier.verify_zip_path(str(self.path))
        self.assertIn("encrypted_member_not_allowed", result["errors"])

    def test_symlink_member_is_rejected_without_extract(self):
        items = payloads()
        name, data = items[-1]
        info = zipfile.ZipInfo(name)
        info.create_system = 3
        info.external_attr = (stat.S_IFLNK | 0o777) << 16
        result = self.run_bytes(make_zip(items[:-1] + [(info, data)]))
        self.assertIn("non_regular_zip_member", result["errors"])

    def test_declared_oversize_stops_before_inflating_and_wrapper_size_is_bounded(self):
        items = [(name, b"x" * (1024 * 1024 + 1) if name == "notes.txt" else data) for name, data in payloads()]
        self.path.write_bytes(make_zip(items, zipfile.ZIP_DEFLATED))
        with patch.object(zipfile.ZipFile, "open", side_effect=AssertionError("no oversized inflate")):
            result = verifier.verify_zip_path(str(self.path))
        self.assertIn("member_exceeds_limit", result["errors"])
        self.assertEqual(self.run_bytes(b"x" * (verifier.MAX_ZIP_BYTES + 1))["status"], "UNSUPPORTED")

    def test_changed_same_length_payload_changes_measured_hash_and_not_expected(self):
        items = [(name, bytes([data[0] ^ 1]) + data[1:] if name == "notes.txt" else data) for name, data in payloads()]
        result = self.run_bytes(make_zip(items))
        self.assertEqual(result["status"], "MISMATCH")
        self.assertTrue(result["allFiveMeasured"])
        self.assertNotEqual(result["measured"]["packageSha256"], result["expected"]["packageSha256"])
        self.assertFalse(result["checks"]["declaredPayloadMatchesMeasured"])

    def test_control_hash_claim_cannot_fill_measured_manifest_hash(self):
        items = [(name, b"0" * 64 + b"  manifest.json\n" if name == "manifest.sha256" else data) for name, data in payloads()]
        result = self.run_bytes(make_zip(items))
        self.assertEqual(result["measured"]["manifestSha256"], verifier.EXPECTED_MANIFEST)
        self.assertTrue(result["declared"]["controlManifestSha256Line"].startswith("0" * 64))
        self.assertFalse(result["checks"]["controlMatchesMeasuredManifest"])

    def test_only_single_explicit_zip_read_no_directory_scan_or_extract(self):
        original_open, opened = os.open, []

        def audited_open(path, flags, *args, **kwargs):
            self.assertEqual(path, str(self.path))
            self.assertEqual(flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND), 0)
            opened.append(path)
            return original_open(path, flags, *args, **kwargs)

        with patch.object(verifier.os, "open", side_effect=audited_open), \
                patch.object(verifier.os, "listdir", side_effect=AssertionError("no discovery")), \
                patch.object(verifier.os, "scandir", side_effect=AssertionError("no discovery")), \
                patch.object(verifier.os, "walk", side_effect=AssertionError("no discovery")), \
                patch.object(zipfile.ZipFile, "extract", side_effect=AssertionError("no extract")), \
                patch.object(zipfile.ZipFile, "extractall", side_effect=AssertionError("no extract")):
            result = verifier.verify_zip_path(str(self.path))
        self.assertEqual(result["status"], "MEASURED_MATCH")
        self.assertEqual(len(opened), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)

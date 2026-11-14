"""Synthetic tests only; writes only fresh fake test-output directories."""
import base64
import ast
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


verifier = load_module("attachment_verifier", HERE / "verify_attachments.py")
fixtures = load_module("fake_canary_bytes", HERE / "fake_fixture.py")


class HashTests(unittest.TestCase):
    def setUp(self):
        (ROOT / "test-output").mkdir(exist_ok=True)
        self.folder = Path(tempfile.mkdtemp(prefix="fake-chatgpt-hash-", dir=ROOT / "test-output"))
        self.paths = {}
        for name, encoded in fixtures.FILES_BASE64.items():
            path = self.folder / name
            path.write_bytes(base64.b64decode(encoded))
            self.paths[name] = str(path)

    def test_fixed_fictional_bytes_are_actually_hashed(self):
        result = verifier.verify_paths(self.paths)
        self.assertEqual(result["status"], "MEASURED_MATCH")
        self.assertTrue(result["allFiveMeasured"])
        self.assertEqual(len(result["measured"]["files"]), 5)
        self.assertEqual(result["measured"]["manifestSha256"], verifier.EXPECTED_MANIFEST)
        self.assertEqual(result["measured"]["packageSha256"], verifier.EXPECTED_PACKAGE)
        self.assertNotIn("packageSha256", result["declared"])
        self.assertFalse(result["platformObservationAuthenticated"])
        self.assertFalse(result["implementationAuthorized"])

    def test_bytecode_cache_is_disabled_before_other_stdlib_imports(self):
        statements = ast.parse((HERE / "verify_attachments.py").read_text(encoding="utf-8")).body
        imports = [index for index, statement in enumerate(statements) if isinstance(statement, ast.Import)]
        self.assertEqual(statements[imports[0]].names[0].name, "sys")
        assignment = statements[imports[0] + 1]
        self.assertIsInstance(assignment, ast.Assign)
        self.assertEqual(ast.unparse(assignment.targets[0]), "sys.dont_write_bytecode")
        self.assertIs(assignment.value.value, True)
        self.assertLess(imports[0] + 1, imports[1])

    def test_no_mapping_missing_extra_or_relative_mapping_never_opens_files(self):
        cases = [None, {}, {key: value for key, value in self.paths.items() if key != "notes.txt"},
                 {**self.paths, "other-private.txt": "never-open-this"}, {**self.paths, "notes.txt": "notes.txt"}]
        for paths in cases:
            with patch.object(verifier.os, "open", side_effect=AssertionError("unexpected open")):
                result = verifier.verify_paths(paths)
            self.assertEqual(result["status"], "UNSUPPORTED")
            self.assertEqual(result["measured"]["files"], [])

    def test_missing_original_bytes_stay_unsupported_not_expected_as_measured(self):
        paths = {**self.paths, "notes.txt": str(self.folder / "missing.txt")}
        result = verifier.verify_paths(paths)
        self.assertEqual(result["status"], "UNSUPPORTED")
        self.assertEqual(len(result["measured"]["files"]), 4)
        self.assertIsNone(result["measured"]["packageSha256"])
        self.assertFalse(result["allFiveMeasured"])

    def test_payload_change_changes_measured_hash_and_package_hash(self):
        path = Path(self.paths["notes.txt"])
        path.write_bytes(path.read_bytes() + b"FICTIONAL CHANGE\n")
        result = verifier.verify_paths(self.paths)
        self.assertEqual(result["status"], "MISMATCH")
        measured = next(row for row in result["measured"]["files"] if row["path"] == "notes.txt")
        expected = next(row for row in result["expected"]["files"] if row["path"] == "notes.txt")
        self.assertNotEqual(measured["sha256"], expected["sha256"])
        self.assertNotEqual(result["measured"]["packageSha256"], result["expected"]["packageSha256"])
        self.assertFalse(result["checks"]["declaredPayloadMatchesMeasured"])

    def test_control_declaration_is_not_used_as_the_measured_manifest_hash(self):
        Path(self.paths["manifest.sha256"]).write_bytes(b"0" * 64 + b"  manifest.json\n")
        result = verifier.verify_paths(self.paths)
        self.assertEqual(result["status"], "MISMATCH")
        self.assertEqual(result["measured"]["manifestSha256"], verifier.EXPECTED_MANIFEST)
        self.assertTrue(result["declared"]["controlManifestSha256Line"].startswith("0" * 64))
        self.assertFalse(result["checks"]["controlMatchesMeasuredManifest"])

    def test_renamed_native_attachment_paths_use_only_explicit_mapping(self):
        changed = {}
        for index, name in enumerate(self.paths):
            renamed = self.folder / ("fiction-native-id-" + str(index) + ".bin")
            Path(self.paths[name]).rename(renamed)
            changed[name] = str(renamed)
        self.assertEqual(verifier.verify_paths(changed)["status"], "MEASURED_MATCH")

    def test_duplicate_paths_and_duplicate_file_identity_are_not_five_originals(self):
        duplicate = {**self.paths, "notes.txt": self.paths["README.txt"]}
        self.assertEqual(verifier.verify_paths(duplicate)["status"], "UNSUPPORTED")
        alias = self.folder / "fiction-hardlink.txt"
        os.link(self.paths["README.txt"], alias)
        result = verifier.verify_paths({**self.paths, "notes.txt": str(alias)})
        self.assertEqual(result["status"], "UNSUPPORTED")
        self.assertTrue(any("same_attachment_identity_reused" in str(error) for error in result["errors"]))

    def test_bounded_read_and_changed_file_fail_without_false_package_hash(self):
        Path(self.paths["notes.txt"]).write_bytes(b"x" * (verifier.MAX_FILE_BYTES + 1))
        result = verifier.verify_paths(self.paths)
        self.assertEqual(result["status"], "UNSUPPORTED")
        self.assertIsNone(result["measured"]["packageSha256"])

    def test_file_change_during_read_is_unsupported_not_a_stable_measurement(self):
        original_read = os.read
        changed = False

        def changing_read(fd, size):
            nonlocal changed
            data = original_read(fd, size)
            if not changed:
                changed = True
                path = Path(self.paths["README.txt"])
                path.write_bytes(path.read_bytes() + b"FICTIONAL RACE")
            return data

        with patch.object(verifier.os, "read", side_effect=changing_read):
            result = verifier.verify_paths(self.paths)
        self.assertEqual(result["status"], "UNSUPPORTED")
        self.assertIsNone(result["measured"]["packageSha256"])
        self.assertTrue(any("changed_during_read" in str(error) for error in result["errors"]))

    def test_only_explicit_five_read_only_opens_and_no_directory_discovery(self):
        original_open = os.open
        opened = []

        def audited_open(path, flags, *args, **kwargs):
            self.assertIn(path, self.paths.values())
            self.assertEqual(flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND), 0)
            opened.append(path)
            return original_open(path, flags, *args, **kwargs)

        with patch.object(verifier.os, "open", side_effect=audited_open), \
                patch.object(verifier.os, "listdir", side_effect=AssertionError("no discovery")), \
                patch.object(verifier.os, "scandir", side_effect=AssertionError("no discovery")), \
                patch.object(verifier.os, "walk", side_effect=AssertionError("no discovery")), \
                patch.object(verifier.os, "system", side_effect=AssertionError("no shell")):
            result = verifier.verify_paths(self.paths)
        self.assertEqual(result["status"], "MEASURED_MATCH")
        self.assertEqual(opened, [self.paths[row["path"]] for row in verifier.EXPECTED_FILES])

    def test_malformed_manifest_is_measured_but_never_declared_or_expected_match(self):
        Path(self.paths["manifest.json"]).write_bytes(b"[]")
        result = verifier.verify_paths(self.paths)
        self.assertEqual(result["status"], "MISMATCH")
        self.assertTrue(result["allFiveMeasured"])
        self.assertFalse(result["checks"]["declaredControlParseable"])


if __name__ == "__main__":
    unittest.main(verbosity=2)

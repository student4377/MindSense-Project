from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

import sys


sys.path.insert(0, str(Path(__file__).resolve().parent))

from media_features import FeatureExtractionError, fetch_media_source, media_tool_status, transcribe_audio_to_english  # noqa: E402


class MediaFeatureSecurityTests(unittest.TestCase):
    def tearDown(self) -> None:
        os.environ.pop("MINDSENSE_ALLOW_LOCAL_MEDIA_PATHS", None)
        os.environ.pop("MINDSENSE_ENABLE_AUDIO_TRANSCRIPT", None)

    def test_media_tool_status_includes_limits(self) -> None:
        status = media_tool_status()

        self.assertIn("ffmpeg", status)
        self.assertIn("openface", status)
        self.assertIn("limits", status)
        self.assertIn("audio_transcript", status)
        self.assertIn("max_media_mb", status["limits"])
        self.assertIn("download_timeout_seconds", status["limits"])
        self.assertIn("command_timeout_seconds", status["limits"])
        self.assertIn("model", status["audio_transcript"])
        self.assertIn("task", status["audio_transcript"])

    def test_local_media_paths_are_blocked_by_default(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            media_path = Path(temp_dir) / "sample.webm"
            media_path.write_bytes(b"test")

            with self.assertRaises(FeatureExtractionError):
                fetch_media_source(str(media_path), Path(temp_dir), "input.webm")

    def test_local_media_paths_can_be_enabled_for_trusted_local_testing(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            media_path = Path(temp_dir) / "sample.webm"
            media_path.write_bytes(b"test")
            os.environ["MINDSENSE_ALLOW_LOCAL_MEDIA_PATHS"] = "true"

            resolved = fetch_media_source(str(media_path), Path(temp_dir), "input.webm")

            self.assertEqual(resolved, media_path)

    def test_audio_transcript_can_be_disabled(self) -> None:
        os.environ["MINDSENSE_ENABLE_AUDIO_TRANSCRIPT"] = "false"

        result = transcribe_audio_to_english(Path("missing.wav"))

        self.assertFalse(result["enabled"])
        self.assertEqual(result["text"], "")


if __name__ == "__main__":
    unittest.main()

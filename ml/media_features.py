from __future__ import annotations

import os
import shutil
import subprocess
import urllib.request
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import numpy as np
import pandas as pd

from dataset import read_csv_auto, resample_sequence


AUDIO_EGEMAPS_COLUMNS = [
    "Loudness_sma3",
    "alphaRatio_sma3",
    "hammarbergIndex_sma3",
    "slope0-500_sma3",
    "slope500-1500_sma3",
    "spectralFlux_sma3",
    "mfcc1_sma3",
    "mfcc2_sma3",
    "mfcc3_sma3",
    "mfcc4_sma3",
    "F0semitoneFrom27.5Hz_sma3nz",
    "jitterLocal_sma3nz",
    "shimmerLocaldB_sma3nz",
    "HNRdBACF_sma3nz",
    "logRelF0-H1-H2_sma3nz",
    "logRelF0-H1-A3_sma3nz",
    "F1frequency_sma3nz",
    "F1bandwidth_sma3nz",
    "F1amplitudeLogRelF0_sma3nz",
    "F2frequency_sma3nz",
    "F2amplitudeLogRelF0_sma3nz",
    "F3frequency_sma3nz",
    "F3amplitudeLogRelF0_sma3nz",
]

AUDIO_MFCC_COLUMNS = [f"pcm_fftMag_mfcc[{index}]" for index in range(13)]
AUDIO_MFCC_COLUMNS += [f"pcm_fftMag_mfcc_de[{index}]" for index in range(13)]
AUDIO_MFCC_COLUMNS += [f"pcm_fftMag_mfcc_de_de[{index}]" for index in range(13)]

VIDEO_OPENFACE_COLUMNS = [
    "pose_Tx",
    "pose_Ty",
    "pose_Tz",
    "pose_Rx",
    "pose_Ry",
    "pose_Rz",
    "gaze_0_x",
    "gaze_0_y",
    "gaze_0_z",
    "gaze_1_x",
    "gaze_1_y",
    "gaze_1_z",
    "gaze_angle_x",
    "gaze_angle_y",
    "AU01_r",
    "AU02_r",
    "AU04_r",
    "AU05_r",
    "AU06_r",
    "AU07_r",
    "AU09_r",
    "AU10_r",
    "AU12_r",
    "AU14_r",
    "AU15_r",
    "AU17_r",
    "AU20_r",
    "AU23_r",
    "AU25_r",
    "AU26_r",
    "AU45_r",
    "AU01_c",
    "AU02_c",
    "AU04_c",
    "AU05_c",
    "AU06_c",
    "AU07_c",
    "AU09_c",
    "AU10_c",
    "AU12_c",
    "AU14_c",
    "AU15_c",
    "AU17_c",
    "AU20_c",
    "AU23_c",
    "AU25_c",
    "AU26_c",
    "AU28_c",
    "AU45_c",
]


class FeatureExtractionError(RuntimeError):
    pass


TRUE_VALUES = {"1", "true", "yes", "on"}
DEFAULT_DOWNLOAD_TIMEOUT_SECONDS = 30
DEFAULT_COMMAND_TIMEOUT_SECONDS = 180
DEFAULT_MAX_MEDIA_BYTES = 100 * 1024 * 1024
DEFAULT_AUDIO_TRANSCRIPT_MODEL = "base"


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in TRUE_VALUES


def _env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def local_media_paths_allowed() -> bool:
    return _env_bool("MINDSENSE_ALLOW_LOCAL_MEDIA_PATHS")


def max_media_bytes() -> int:
    return max(1, _env_int("MINDSENSE_MAX_MEDIA_BYTES", DEFAULT_MAX_MEDIA_BYTES))


def download_timeout_seconds() -> int:
    return max(1, _env_int("MINDSENSE_MEDIA_DOWNLOAD_TIMEOUT_SECONDS", DEFAULT_DOWNLOAD_TIMEOUT_SECONDS))


def command_timeout_seconds() -> int:
    return max(1, _env_int("MINDSENSE_MEDIA_COMMAND_TIMEOUT_SECONDS", DEFAULT_COMMAND_TIMEOUT_SECONDS))


def audio_transcript_enabled() -> bool:
    return _env_bool("MINDSENSE_ENABLE_AUDIO_TRANSCRIPT", True)


def audio_transcript_model_name() -> str:
    return os.environ.get("MINDSENSE_WHISPER_MODEL", DEFAULT_AUDIO_TRANSCRIPT_MODEL).strip() or DEFAULT_AUDIO_TRANSCRIPT_MODEL


def audio_transcript_task() -> str:
    task = os.environ.get("MINDSENSE_WHISPER_TASK", "translate").strip().lower()
    return task if task in {"translate", "transcribe"} else "translate"


def whisper_device() -> str:
    configured = os.environ.get("MINDSENSE_WHISPER_DEVICE")
    if configured:
        return configured.strip()
    try:
        import torch
    except ImportError:
        return "cpu"
    return "cuda" if torch.cuda.is_available() else "cpu"


def whisper_compute_type(device: str) -> str:
    configured = os.environ.get("MINDSENSE_WHISPER_COMPUTE_TYPE")
    if configured:
        return configured.strip()
    return "float16" if device == "cuda" else "int8"


def _first_existing(paths: list[Path]) -> Path | None:
    for path in paths:
        if path.exists():
            return path
    return None


def find_ffmpeg() -> Path | None:
    env_path = os.environ.get("MINDSENSE_FFMPEG_BIN")
    if env_path and Path(env_path).exists():
        return Path(env_path)

    path_match = shutil.which("ffmpeg")
    if path_match:
        return Path(path_match)

    local_appdata = os.environ.get("LOCALAPPDATA")
    candidates: list[Path] = []
    if local_appdata:
        candidates.extend(Path(local_appdata).glob("Microsoft/WinGet/Packages/Gyan.FFmpeg*/**/ffmpeg.exe"))
    candidates.extend(
        [
            Path(r"C:\Program Files\ffmpeg\bin\ffmpeg.exe"),
            Path(r"C:\ffmpeg\bin\ffmpeg.exe"),
        ]
    )
    return _first_existing(candidates)


def find_openface() -> Path | None:
    env_path = os.environ.get("MINDSENSE_OPENFACE_BIN")
    if env_path and Path(env_path).exists():
        return Path(env_path)

    path_match = shutil.which("FeatureExtraction")
    if path_match:
        return Path(path_match)

    return _first_existing(
        [
            Path(r"C:\Tools\OpenFace\FeatureExtraction.exe"),
            Path(r"C:\OpenFace\FeatureExtraction.exe"),
            Path(r"C:\Program Files\OpenFace\FeatureExtraction.exe"),
        ]
    )


def media_tool_status() -> dict[str, Any]:
    ffmpeg = find_ffmpeg()
    openface = find_openface()
    return {
        "ffmpeg": {"available": ffmpeg is not None, "path": str(ffmpeg) if ffmpeg else None},
        "openface": {"available": openface is not None, "path": str(openface) if openface else None},
        "limits": {
            "max_media_mb": round(max_media_bytes() / (1024 * 1024), 2),
            "download_timeout_seconds": download_timeout_seconds(),
            "command_timeout_seconds": command_timeout_seconds(),
            "local_media_paths_allowed": local_media_paths_allowed(),
        },
        "audio_transcript": {
            "enabled": audio_transcript_enabled(),
            "model": audio_transcript_model_name(),
            "task": audio_transcript_task(),
        },
    }


def download_media_file(source: str, destination: Path) -> Path:
    byte_limit = max_media_bytes()
    request = urllib.request.Request(source, headers={"User-Agent": "MindSense-ML-API/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=download_timeout_seconds()) as response:
            content_length = response.headers.get("Content-Length")
            if content_length and int(content_length) > byte_limit:
                raise FeatureExtractionError(
                    f"Media file is too large. Limit is {byte_limit // (1024 * 1024)} MB."
                )

            total = 0
            with destination.open("wb") as file:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > byte_limit:
                        raise FeatureExtractionError(
                            f"Media file is too large. Limit is {byte_limit // (1024 * 1024)} MB."
                        )
                    file.write(chunk)
    except FeatureExtractionError:
        raise
    except Exception as exc:  # pragma: no cover - network failures are environment-specific.
        raise FeatureExtractionError(f"Could not download media file: {exc}") from exc
    return destination


def fetch_media_source(source: str | None, work_dir: Path, filename: str) -> Path:
    work_dir = work_dir.resolve()
    if not source:
        raise FeatureExtractionError(f"Missing media source for {filename}.")

    parsed = urlparse(source)
    if parsed.scheme in {"http", "https"}:
        destination = work_dir / filename
        return download_media_file(source, destination)

    file_path = Path(source)
    if file_path.exists() and local_media_paths_allowed():
        return file_path
    if file_path.exists():
        raise FeatureExtractionError(
            "Local media paths are disabled. Set MINDSENSE_ALLOW_LOCAL_MEDIA_PATHS=true only for trusted local testing."
        )

    raise FeatureExtractionError(
        "Media source is not a local file or signed URL. Pass voice_url/video_url from Supabase signed URLs."
    )


def run_command(command: list[str], cwd: Path | None = None) -> None:
    try:
        result = subprocess.run(
            command,
            cwd=str(cwd) if cwd else None,
            capture_output=True,
            text=True,
            timeout=command_timeout_seconds(),
        )
    except subprocess.TimeoutExpired as exc:
        raise FeatureExtractionError(f"Media tool timed out after {command_timeout_seconds()} seconds: {command[0]}") from exc
    if result.returncode != 0:
        stderr = result.stderr.strip() or result.stdout.strip()
        raise FeatureExtractionError(stderr or f"Command failed: {' '.join(command)}")


def convert_audio_to_wav(input_path: Path, work_dir: Path) -> Path:
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        raise FeatureExtractionError("FFmpeg is required for browser media conversion but was not found.")

    input_path = input_path.resolve()
    work_dir = work_dir.resolve()
    output_path = work_dir / "voice_16khz_mono.wav"
    run_command([str(ffmpeg), "-y", "-i", str(input_path), "-vn", "-ac", "1", "-ar", "16000", str(output_path)])
    return output_path


def convert_video_to_mp4(input_path: Path, work_dir: Path) -> Path:
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        raise FeatureExtractionError("FFmpeg is required for browser media conversion but was not found.")

    input_path = input_path.resolve()
    work_dir = work_dir.resolve()
    output_path = work_dir / "video_openface.mp4"
    run_command([str(ffmpeg), "-y", "-i", str(input_path), "-an", "-vcodec", "libx264", "-pix_fmt", "yuv420p", str(output_path)])
    return output_path


def _clean_dataframe_columns(df: pd.DataFrame) -> pd.DataFrame:
    cleaned = df.copy()
    cleaned.columns = [str(column).strip() for column in cleaned.columns]
    return cleaned


def dataframe_to_sequence(df: pd.DataFrame, columns: list[str]) -> tuple[np.ndarray, list[str]]:
    cleaned = _clean_dataframe_columns(df)
    if "success" in cleaned.columns:
        cleaned = cleaned[cleaned["success"].fillna(0).astype(float) >= 1]
    if "confidence" in cleaned.columns:
        cleaned = cleaned[cleaned["confidence"].fillna(0).astype(float) >= 0.8]

    missing: list[str] = []
    values: list[np.ndarray] = []
    for column in columns:
        if column in cleaned.columns:
            numeric = pd.to_numeric(cleaned[column], errors="coerce").replace([np.inf, -np.inf], np.nan).fillna(0.0)
            values.append(numeric.to_numpy(dtype=np.float32))
        else:
            missing.append(column)
            values.append(np.zeros(len(cleaned), dtype=np.float32))

    if not values or len(cleaned) == 0:
        raise FeatureExtractionError("No valid feature frames were extracted.")

    return np.stack(values, axis=1).astype(np.float32), missing


def downsample_frames(values: np.ndarray, max_frames: int) -> np.ndarray:
    if values.shape[0] > max_frames:
        idx = np.linspace(0, values.shape[0] - 1, max_frames).astype(int)
        return values[idx]
    return values


def extract_egemaps(wav_path: Path, max_frames: int) -> tuple[np.ndarray, dict[str, Any]]:
    try:
        import opensmile
    except ImportError as exc:
        raise FeatureExtractionError("Python package opensmile is not installed in the ML environment.") from exc

    smile = opensmile.Smile(
        feature_set=opensmile.FeatureSet.eGeMAPSv02,
        feature_level=opensmile.FeatureLevel.LowLevelDescriptors,
    )
    df = smile.process_file(str(wav_path)).reset_index(drop=True)
    values, missing = dataframe_to_sequence(df, AUDIO_EGEMAPS_COLUMNS)
    return downsample_frames(values, max_frames), {"missing_columns": missing, "frames": int(values.shape[0])}


def extract_mfcc(wav_path: Path, target_frames: int) -> tuple[np.ndarray, dict[str, Any]]:
    try:
        import librosa
    except ImportError as exc:
        raise FeatureExtractionError("Python package librosa is not installed in the ML environment.") from exc

    signal, sample_rate = librosa.load(str(wav_path), sr=16000, mono=True)
    if signal.size == 0:
        raise FeatureExtractionError("Audio file did not contain readable samples.")

    mfcc = librosa.feature.mfcc(y=signal, sr=sample_rate, n_mfcc=13, n_fft=512, hop_length=160, win_length=400, center=False)
    delta = librosa.feature.delta(mfcc)
    delta_delta = librosa.feature.delta(mfcc, order=2)
    values = np.concatenate([mfcc, delta, delta_delta], axis=0).T.astype(np.float32)
    values = resample_sequence(values, target_frames)
    return values, {"frames": int(values.shape[0]), "columns": AUDIO_MFCC_COLUMNS}


def transcribe_audio_to_english(wav_path: Path) -> dict[str, Any]:
    if not audio_transcript_enabled():
        return {"enabled": False, "available": False, "text": "", "reason": "disabled"}

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return {
            "enabled": True,
            "available": False,
            "text": "",
            "reason": "faster-whisper is not installed",
        }

    device = whisper_device()
    compute_type = whisper_compute_type(device)
    model_name = audio_transcript_model_name()
    task = audio_transcript_task()
    try:
        model = WhisperModel(model_name, device=device, compute_type=compute_type)
        segments, info = model.transcribe(
            str(wav_path),
            task=task,
            beam_size=3,
            vad_filter=True,
        )
        text = " ".join(segment.text.strip() for segment in segments if segment.text.strip()).strip()
        return {
            "enabled": True,
            "available": True,
            "text": text,
            "task": task,
            "model": model_name,
            "device": device,
            "compute_type": compute_type,
            "language": getattr(info, "language", None),
            "language_probability": float(getattr(info, "language_probability", 0.0) or 0.0),
        }
    except Exception as exc:  # pragma: no cover - model download/runtime depends on environment.
        return {
            "enabled": True,
            "available": False,
            "text": "",
            "task": task,
            "model": model_name,
            "device": device,
            "compute_type": compute_type,
            "reason": str(exc),
        }


def extract_audio_features(media_path: Path, work_dir: Path, max_frames: int, use_mfcc: bool = True) -> tuple[np.ndarray, dict[str, Any]]:
    work_dir = work_dir.resolve()
    work_dir.mkdir(parents=True, exist_ok=True)
    wav_path = convert_audio_to_wav(media_path, work_dir)
    transcript_info = transcribe_audio_to_english(wav_path)
    egemaps, egemaps_info = extract_egemaps(wav_path, max_frames)
    if not use_mfcc:
        return egemaps.astype(np.float32), {"egemaps": egemaps_info, "mfcc": None, "transcript": transcript_info}

    mfcc, mfcc_info = extract_mfcc(wav_path, egemaps.shape[0])
    audio = np.concatenate([egemaps, mfcc], axis=1).astype(np.float32)
    return audio, {"egemaps": egemaps_info, "mfcc": mfcc_info, "transcript": transcript_info, "feature_dim": int(audio.shape[1])}


def extract_video_features(media_path: Path, work_dir: Path, max_frames: int) -> tuple[np.ndarray, dict[str, Any]]:
    openface = find_openface()
    if not openface:
        raise FeatureExtractionError("OpenFace FeatureExtraction.exe was not found.")

    work_dir = work_dir.resolve()
    work_dir.mkdir(parents=True, exist_ok=True)
    video_path = convert_video_to_mp4(media_path, work_dir)
    output_dir = work_dir / "openface"
    output_dir.mkdir(parents=True, exist_ok=True)
    run_command(
        [
            str(openface),
            "-f",
            str(video_path),
            "-out_dir",
            str(output_dir),
            "-aus",
            "-gaze",
            "-pose",
        ],
        cwd=openface.parent,
    )

    csv_files = sorted(output_dir.glob("*.csv"))
    if not csv_files:
        raise FeatureExtractionError("OpenFace completed but did not produce a CSV feature file.")

    df = read_csv_auto(csv_files[0])
    values, missing = dataframe_to_sequence(df, VIDEO_OPENFACE_COLUMNS)
    values = downsample_frames(values, max_frames)
    return values.astype(np.float32), {
        "feature_file": str(csv_files[0]),
        "frames": int(values.shape[0]),
        "feature_dim": int(values.shape[1]),
        "missing_columns": missing,
    }

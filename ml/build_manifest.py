from __future__ import annotations

import argparse
import csv
from collections import Counter
from pathlib import Path


DEFAULT_DATA_ROOT = Path.home() / "Desktop" / "Model_Training"

SPLIT_FILES = {
    "train": "train_split.csv",
    "dev": "dev_split.csv",
    "test": "test_split.csv",
}

REQUIRED_COLUMNS = [
    "participant_id",
    "split",
    "phq_score",
    "transcript_path",
    "audio_features_path",
    "video_features_path",
]

OPTIONAL_COLUMNS = [
    "audio_mfcc_path",
    "audio_boaw_egemaps_path",
    "audio_boaw_mfcc_path",
    "video_bovw_pose_gaze_aus_path",
    "gender",
    "phq_binary",
    "ptsd_score",
    "ptsd_severity",
    "phq_8_no_interest",
    "phq_8_depressed",
    "phq_8_sleep",
    "phq_8_tired",
    "phq_8_appetite",
    "phq_8_failure",
    "phq_8_concentrating",
    "phq_8_moving",
    "phq_8_total",
    "age",
    "depression_label",
    "ptsd_label",
]


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(path)

    with path.open("r", newline="", encoding="utf-8-sig") as file:
        return list(csv.DictReader(file))


def first_existing(paths: list[Path]) -> str:
    for path in paths:
        if path.exists():
            return str(path)
    return ""


def read_detailed_labels(split_dir: Path) -> dict[str, dict[str, str]]:
    detailed_path = split_dir / "Detailed_PHQ8_Labels.csv"
    if not detailed_path.exists():
        return {}

    detailed: dict[str, dict[str, str]] = {}
    for row in read_csv_rows(detailed_path):
        participant_id = str(row.get("Participant_ID", "")).strip()
        if not participant_id:
            continue
        detailed[participant_id] = {
            "phq_8_no_interest": row.get("PHQ_8NoInterest", ""),
            "phq_8_depressed": row.get("PHQ_8Depressed", ""),
            "phq_8_sleep": row.get("PHQ_8Sleep", ""),
            "phq_8_tired": row.get("PHQ_8Tired", ""),
            "phq_8_appetite": row.get("PHQ_8Appetite", ""),
            "phq_8_failure": row.get("PHQ_8Failure", ""),
            "phq_8_concentrating": row.get("PHQ_8Concentrating", ""),
            "phq_8_moving": row.get("PHQ_8Moving", ""),
            "phq_8_total": row.get("PHQ_8Total", ""),
        }
    return detailed


def read_extended_labels(split_dir: Path) -> dict[str, dict[str, str]]:
    extended_path = split_dir / "detailed_lables.csv"
    if not extended_path.exists():
        return {}

    extended: dict[str, dict[str, str]] = {}
    for row in read_csv_rows(extended_path):
        participant_id = str(row.get("Participant", "")).strip()
        if not participant_id:
            continue
        extended[participant_id] = {
            "age": row.get("age", ""),
            "depression_label": row.get("Depression_label", ""),
            "ptsd_label": row.get("PTSD_label", ""),
        }
    return extended


def build_row(data_root: Path, split: str, split_row: dict[str, str], detailed: dict[str, dict[str, str]], extended: dict[str, dict[str, str]]) -> dict[str, str]:
    participant_id = str(split_row.get("Participant_ID", "")).strip()
    participant_folder = f"{participant_id}_P"

    text_dir = data_root / "Text" / participant_folder
    audio_dir = data_root / "Audio" / participant_folder
    video_dir = data_root / "Video" / participant_folder

    row = {
        "participant_id": participant_id,
        "split": split,
        "phq_score": str(split_row.get("PHQ_Score", "")).strip(),
        "transcript_path": first_existing([text_dir / f"{participant_id}_Transcript.csv"]),
        "audio_features_path": first_existing(
            [
                audio_dir / f"{participant_id}_OpenSMILE2.3.0_egemaps.csv",
                video_dir / f"{participant_id}_OpenSMILE2.3.0_egemaps.csv",
            ]
        ),
        "video_features_path": first_existing(
            [
                video_dir / f"{participant_id}_OpenFace2.1.0_Pose_gaze_AUs.csv",
                audio_dir / f"{participant_id}_OpenFace2.1.0_Pose_gaze_AUs.csv",
            ]
        ),
        "audio_mfcc_path": first_existing(
            [
                audio_dir / f"{participant_id}_OpenSMILE2.3.0_mfcc.csv",
                video_dir / f"{participant_id}_OpenSMILE2.3.0_mfcc.csv",
            ]
        ),
        "audio_boaw_egemaps_path": first_existing(
            [
                audio_dir / f"{participant_id}_BoAW_openSMILE_2.3.0_eGeMAPS.csv",
                video_dir / f"{participant_id}_BoAW_openSMILE_2.3.0_eGeMAPS.csv",
            ]
        ),
        "audio_boaw_mfcc_path": first_existing(
            [
                audio_dir / f"{participant_id}_BoAW_openSMILE_2.3.0_MFCC.csv",
                video_dir / f"{participant_id}_BoAW_openSMILE_2.3.0_MFCC.csv",
            ]
        ),
        "video_bovw_pose_gaze_aus_path": first_existing(
            [
                video_dir / f"{participant_id}_BoVW_openFace_2.1.0_Pose_Gaze_AUs.csv",
                audio_dir / f"{participant_id}_BoVW_openFace_2.1.0_Pose_Gaze_AUs.csv",
            ]
        ),
        "gender": str(split_row.get("Gender", "")).strip(),
        "phq_binary": str(split_row.get("PHQ_Binary", "")).strip(),
        "ptsd_score": str(split_row.get("PCL-C (PTSD)", "")).strip(),
        "ptsd_severity": str(split_row.get("PTSD Severity", "")).strip(),
        **detailed.get(participant_id, {}),
        **extended.get(participant_id, {}),
    }

    for column in OPTIONAL_COLUMNS:
        row.setdefault(column, "")
    return row


def missing_required(row: dict[str, str]) -> list[tuple[str, str]]:
    missing: list[tuple[str, str]] = []
    for column in REQUIRED_COLUMNS:
        value = str(row.get(column, "")).strip()
        if not value:
            missing.append((column, ""))
            continue
        if column.endswith("_path") and not Path(value).exists():
            missing.append((column, value))
    return missing


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def build_manifest(args: argparse.Namespace) -> None:
    data_root = Path(args.data_root).expanduser().resolve()
    split_dir = Path(args.split_dir).expanduser().resolve() if args.split_dir else data_root
    output_path = Path(args.output).expanduser().resolve()
    missing_path = Path(args.missing_output).expanduser().resolve() if args.missing_output else output_path.with_name("manifest_missing_files.csv")

    detailed = read_detailed_labels(split_dir)
    extended = read_extended_labels(split_dir)
    manifest_rows: list[dict[str, str]] = []
    missing_rows: list[dict[str, str]] = []

    for split, filename in SPLIT_FILES.items():
        for split_row in read_csv_rows(split_dir / filename):
            row = build_row(data_root, split, split_row, detailed, extended)
            missing = missing_required(row)
            if missing:
                for column, expected_path in missing:
                    missing_rows.append(
                        {
                            "participant_id": row.get("participant_id", ""),
                            "split": split,
                            "missing_column": column,
                            "expected_path": expected_path,
                        }
                    )
                continue
            manifest_rows.append(row)

    fieldnames = REQUIRED_COLUMNS + OPTIONAL_COLUMNS
    write_csv(output_path, fieldnames, manifest_rows)
    write_csv(missing_path, ["participant_id", "split", "missing_column", "expected_path"], missing_rows)

    counts = Counter(row["split"] for row in manifest_rows)
    print(f"Wrote manifest: {output_path}")
    print(f"Wrote missing-file report: {missing_path}")
    print(f"Training-ready rows: {len(manifest_rows)}")
    for split in SPLIT_FILES:
        print(f"  {split}: {counts.get(split, 0)}")
    print(f"Missing required file entries: {len(missing_rows)}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build an aligned MindSense/DAIC-WOZ participant manifest.")
    parser.add_argument("--data-root", default=str(DEFAULT_DATA_ROOT), help="Folder containing Text, Audio, Video, and usually split CSVs.")
    parser.add_argument("--split-dir", default="", help="Folder containing train_split.csv, dev_split.csv, test_split.csv, and label CSVs. Defaults to --data-root.")
    parser.add_argument("--output", default=str(DEFAULT_DATA_ROOT / "manifest.csv"), help="Output manifest CSV path.")
    parser.add_argument("--missing-output", default="", help="Output CSV path for skipped rows with missing required files.")
    return parser.parse_args()


if __name__ == "__main__":
    build_manifest(parse_args())

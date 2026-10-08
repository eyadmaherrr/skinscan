"""
Reproducibly build models/*.onnx from the official MediaPipe model files.

    python -m venv .venv && .venv/bin/pip install -r scripts/convert/requirements.txt
    .venv/bin/python scripts/convert/convert_models.py            # downloads the sources
    .venv/bin/python scripts/convert/convert_models.py --source-dir path/to/downloads

Source files are verified against pinned SHA-256 checksums before
conversion, and models/manifest.json records the checksums of both the
sources and the generated ONNX files (the server refuses to load a model
whose checksum does not match the manifest).
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import pathlib
import urllib.request
import zipfile

import onnx

from tflite_to_onnx import convert

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "models"

SOURCES = {
    "face_landmarker.task": {
        "url": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
        "sha256": "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff",
    },
    "selfie_multiclass_256x256.tflite": {
        "url": "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
        "sha256": "c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0",
    },
}

MODELS = {
    "faceDetector": {
        "file": "face_detector.onnx",
        "source": "face_landmarker.task",
        "member": "face_detector.tflite",
        "name": "MediaPipe BlazeFace (short range)",
        "license": "Apache-2.0",
        "modelCard": "https://storage.googleapis.com/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20(Short%20Range).pdf",
    },
    "faceLandmarks": {
        "file": "face_landmarks.onnx",
        "source": "face_landmarker.task",
        "member": "face_landmarks_detector.tflite",
        "name": "MediaPipe Face Mesh V2 (478 landmarks)",
        "license": "Apache-2.0",
        "modelCard": "https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Face%20Mesh%20V2.pdf",
    },
    "faceSegmenter": {
        "file": "face_segmenter.onnx",
        "source": "selfie_multiclass_256x256.tflite",
        "member": None,
        "name": "MediaPipe Selfie Multiclass Segmentation (256x256)",
        "license": "Apache-2.0",
        "modelCard": "https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Multiclass%20Segmentation.pdf",
    },
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_source(name: str, source_dir: pathlib.Path | None) -> bytes:
    spec = SOURCES[name]
    if source_dir and (source_dir / name).exists():
        data = (source_dir / name).read_bytes()
    else:
        print(f"downloading {spec['url']}")
        with urllib.request.urlopen(spec["url"], timeout=120) as r:
            data = r.read()
    digest = sha256(data)
    if digest != spec["sha256"]:
        raise SystemExit(f"checksum mismatch for {name}: {digest}")
    return data


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=pathlib.Path)
    args = parser.parse_args()

    sources = {name: load_source(name, args.source_dir) for name in SOURCES}
    OUT.mkdir(exist_ok=True)
    manifest = {"generatedBy": "scripts/convert/convert_models.py", "models": {}}
    for key, spec in MODELS.items():
        data = sources[spec["source"]]
        if spec["member"]:
            data = zipfile.ZipFile(io.BytesIO(data)).read(spec["member"])
        model = convert(data)
        path = OUT / spec["file"]
        onnx.save(model, path)
        out_bytes = path.read_bytes()
        manifest["models"][key] = {
            "file": spec["file"],
            "sha256": sha256(out_bytes),
            "name": spec["name"],
            "license": spec["license"],
            "modelCard": spec["modelCard"],
            "source": {
                "url": SOURCES[spec["source"]]["url"],
                "sha256": SOURCES[spec["source"]]["sha256"],
                "member": spec["member"],
                "memberSha256": sha256(data),
            },
        }
        print(f"{key}: {spec['file']} ({len(out_bytes) / 1e6:.1f} MB)")
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()

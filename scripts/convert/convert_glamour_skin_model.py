"""
Export script for Glamour AI Skin Model to ONNX.

Source repository:
  https://huggingface.co/AishaBaliyan/glamour-ai-skin-model

Model details:
  - Architecture: ViTForImageClassification (Google ViT-Base patch16 224)
  - License: MIT License (Commercial and private use permitted)
  - Input: 1x3x224x224 RGB Float32 (NCHW)
  - Normalization: Mean [0.5, 0.5, 0.5], Std [0.5, 0.5, 0.5]
  - Classes: [0: "dry", 1: "normal", 2: "oily"]
  - Checkpoint: model.safetensors (85.8M parameters, ~343 MB)

Usage:
  pip install torch transformers onnx safetensors
  python scripts/convert/convert_glamour_skin_model.py

Output:
  models/optional/glamour_skin_type.onnx
  models/optional/glamour_skin_type.json
"""

from __future__ import annotations
import hashlib
import json
import os
import pathlib
import sys

def export_glamour_model():
    try:
        import torch
        from transformers import AutoModelForImageClassification, ViTImageProcessor
    except ImportError:
        print("Please install required dependencies: pip install torch transformers onnx")
        sys.exit(1)

    repo_id = "AishaBaliyan/glamour-ai-skin-model"
    root_dir = pathlib.Path(__file__).resolve().parents[2]
    out_dir = root_dir / "models" / "optional"
    out_dir.mkdir(parents=True, exist_ok=True)
    onnx_path = out_dir / "glamour_skin_type.onnx"
    json_path = out_dir / "glamour_skin_type.json"

    print(f"Loading {repo_id} from Hugging Face...")
    model = AutoModelForImageClassification.from_pretrained(repo_id)
    model.eval()

    dummy_input = torch.randn(1, 3, 224, 224, dtype=torch.float32)

    print(f"Exporting to ONNX at {onnx_path}...")
    torch.onnx.export(
        model,
        dummy_input,
        str(onnx_path),
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["logits"],
        dynamic_axes={"input": {0: "batch_size"}, "logits": {0: "batch_size"}},
    )

    with open(onnx_path, "rb") as f:
        sha256 = hashlib.sha256(f.read()).hexdigest()

    metadata = {
        "modelName": "Glamour AI Skin Model",
        "repo": f"https://huggingface.co/{repo_id}",
        "license": "MIT",
        "architecture": "ViTForImageClassification (vit-base-patch16-224)",
        "labels": ["dry", "normal", "oily"],
        "inputSize": [1, 3, 224, 224],
        "normalization": {
            "mean": [0.5, 0.5, 0.5],
            "std": [0.5, 0.5, 0.5]
        },
        "onnx": "glamour_skin_type.onnx",
        "onnxSha256": sha256
    }

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"Successfully exported Glamour AI model! SHA256: {sha256}")

if __name__ == "__main__":
    export_glamour_model()


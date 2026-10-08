# Models

| File | Model | Licence |
|---|---|---|
| `face_detector.onnx` | MediaPipe BlazeFace (short range), Google LLC | Apache-2.0 |
| `face_landmarks.onnx` | MediaPipe Face Mesh V2, Google LLC | Apache-2.0 |
| `face_segmenter.onnx` | MediaPipe Selfie Multiclass Segmentation (256x256), Google LLC | Apache-2.0 |

These files were converted from Google's official TFLite releases to ONNX by
`scripts/convert/convert_models.py`; the weights were not modified. Source
URLs and SHA-256 checksums (original and converted) are in `manifest.json`.
The Apache License 2.0 text is in `LICENSE-MediaPipe-Apache-2.0.txt`.
See `docs/AI_SOURCES.md` for model cards, fairness data and limitations.

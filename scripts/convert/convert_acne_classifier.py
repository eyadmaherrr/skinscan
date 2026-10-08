"""
Convert the optional acne-severity classifier (Hugging Face
`afscomercial/dermatologic`, torchvision ResNet-50, 4 classes level0–level3)
to ONNX for the Node.js runtime.

    python scripts/convert/convert_acne_classifier.py path/to/pytorch_model.bin

LICENSING: the weights are tagged MIT, but the training dataset is not named
and the labels (level0–level3) match ACNE04, whose terms forbid commercial
use. The converted model is written to models/optional/ (git-ignored) and the
app only uses it when SKINSCAN_ACNE_SEVERITY_MODEL is set. Confirm the data
licence with the model author before enabling it in production.

The checkpoint is read with scripts/convert/safe_torch_load.py, which never
executes code from the pickle. Batch-norm layers are folded into the
convolutions and ImageNet normalisation is built into the graph, so the
model takes NHWC RGB in [0, 1] at 224x224 and returns class probabilities.
"""

from __future__ import annotations

import hashlib
import json
import pathlib
import sys

import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

from safe_torch_load import load_state_dict

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "models" / "optional"
EPS = 1e-5
SOURCE = {
    "repo": "https://huggingface.co/afscomercial/dermatologic",
    "file": "pytorch_model.bin",
    "sha256": "71a9075d20e585c4182626846ac0343ae23050bbf52be62b4d393ccc41ac5b24",
    "labels": ["level0", "level1", "level2", "level3"],
}


class Builder:
    def __init__(self, sd):
        self.sd = sd
        self.nodes = []
        self.inits = []
        self.n = 0

    def name(self, base):
        self.n += 1
        return f"{base}_{self.n}"

    def const(self, arr, base):
        name = self.name(base)
        self.inits.append(numpy_helper.from_array(np.asarray(arr), name))
        return name

    def conv_bn(self, x, conv, bn, stride=1, pad=0, relu=True):
        w = self.sd[f"{conv}.weight"].astype(np.float32)
        gamma = self.sd[f"{bn}.weight"]
        beta = self.sd[f"{bn}.bias"]
        mean = self.sd[f"{bn}.running_mean"]
        var = self.sd[f"{bn}.running_var"]
        scale = gamma / np.sqrt(var + EPS)
        wf = (w * scale[:, None, None, None]).astype(np.float32)
        bf = (beta - mean * scale).astype(np.float32)
        k = w.shape[2]
        out = self.name(conv.replace(".", "_"))
        self.nodes.append(
            helper.make_node(
                "Conv",
                [x, self.const(wf, "w"), self.const(bf, "b")],
                [out],
                kernel_shape=[k, k],
                strides=[stride, stride],
                pads=[pad, pad, pad, pad],
            )
        )
        if relu:
            r = self.name("relu")
            self.nodes.append(helper.make_node("Relu", [out], [r]))
            return r
        return out

    def bottleneck(self, x, prefix, stride):
        y = self.conv_bn(x, f"{prefix}.conv1", f"{prefix}.bn1")
        y = self.conv_bn(y, f"{prefix}.conv2", f"{prefix}.bn2", stride=stride, pad=1)
        y = self.conv_bn(y, f"{prefix}.conv3", f"{prefix}.bn3", relu=False)
        if f"{prefix}.downsample.0.weight" in self.sd:
            x = self.conv_bn(x, f"{prefix}.downsample.0", f"{prefix}.downsample.1", stride=stride, relu=False)
        s = self.name("add")
        self.nodes.append(helper.make_node("Add", [y, x], [s]))
        r = self.name("relu")
        self.nodes.append(helper.make_node("Relu", [s], [r]))
        return r

    def build(self):
        # NHWC RGB [0,1] -> NCHW, ImageNet normalisation.
        self.nodes.append(helper.make_node("Transpose", ["image"], ["nchw"], perm=[0, 3, 1, 2]))
        mean = np.array([0.485, 0.456, 0.406], np.float32).reshape(1, 3, 1, 1)
        std = np.array([0.229, 0.224, 0.225], np.float32).reshape(1, 3, 1, 1)
        self.nodes.append(helper.make_node("Sub", ["nchw", self.const(mean, "mean")], ["centred"]))
        self.nodes.append(helper.make_node("Div", ["centred", self.const(std, "std")], ["normed"]))
        x = self.conv_bn("normed", "conv1", "bn1", stride=2, pad=3)
        p = self.name("pool")
        self.nodes.append(helper.make_node("MaxPool", [x], [p], kernel_shape=[3, 3], strides=[2, 2], pads=[1, 1, 1, 1]))
        x = p
        for layer, blocks in enumerate([3, 4, 6, 3], start=1):
            for b in range(blocks):
                stride = 2 if (b == 0 and layer > 1) else 1
                x = self.bottleneck(x, f"layer{layer}.{b}", stride)
        g = self.name("gap")
        self.nodes.append(helper.make_node("GlobalAveragePool", [x], [g]))
        f = self.name("flat")
        self.nodes.append(helper.make_node("Flatten", [g], [f], axis=1))
        logits = "logits"
        self.nodes.append(
            helper.make_node(
                "Gemm",
                [f, self.const(self.sd["fc.weight"].astype(np.float32), "fcw"), self.const(self.sd["fc.bias"].astype(np.float32), "fcb")],
                [logits],
                transB=1,
            )
        )
        self.nodes.append(helper.make_node("Softmax", [logits], ["probabilities"], axis=1))
        graph = helper.make_graph(
            self.nodes,
            "acne_severity_resnet50",
            [helper.make_tensor_value_info("image", TensorProto.FLOAT, [1, 224, 224, 3])],
            [helper.make_tensor_value_info("probabilities", TensorProto.FLOAT, [1, 4])],
            self.inits,
        )
        model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 13)], producer_name="skinscan-convert")
        model.ir_version = 7
        onnx.checker.check_model(model)
        return model


def main():
    src = pathlib.Path(sys.argv[1])
    digest = hashlib.sha256(src.read_bytes()).hexdigest()
    if digest != SOURCE["sha256"]:
        raise SystemExit(f"unexpected checkpoint checksum {digest}")
    sd = load_state_dict(str(src))
    if tuple(sd["fc.weight"].shape) != (4, 2048):
        raise SystemExit("unexpected classifier head")
    model = Builder(sd).build()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / "acne_severity.onnx"
    onnx.save(model, out)
    meta = {**SOURCE, "onnx": out.name, "onnxSha256": hashlib.sha256(out.read_bytes()).hexdigest()}
    (OUT_DIR / "acne_severity.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()

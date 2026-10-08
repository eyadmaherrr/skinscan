"""
Minimal TFLite -> ONNX converter for the MediaPipe models used by the skin scan.

Only the operators those models use are supported; anything else raises an
error rather than being converted approximately. Tensors keep TFLite's NHWC
layout; convolution-type ops are wrapped in NHWC<->NCHW transposes, which
ONNX Runtime's transpose optimizer removes when the model is loaded.

Requires only numpy, onnx and the `tflite` flatbuffer schema package
(see requirements.txt) — no TensorFlow.
"""

from __future__ import annotations

import math
import re

import numpy as np
import onnx
import tflite
from onnx import TensorProto, helper, numpy_helper
from tflite.BuiltinOperator import BuiltinOperator

OPSET = 13
OPNAMES = {v: k for k, v in BuiltinOperator.__dict__.items() if not k.startswith("_")}
DTYPES = {0: np.float32, 1: np.float16, 2: np.int32, 3: np.uint8, 4: np.int64, 9: np.int8, 7: np.int16}
SAME, VALID = 0, 1
TO_NCHW = [0, 3, 1, 2]
TO_NHWC = [0, 2, 3, 1]


class UnsupportedOp(Exception):
    pass


def _options(op, cls):
    table = op.BuiltinOptions()
    if table is None:
        return None
    opt = cls()
    opt.Init(table.Bytes, table.Pos)
    return opt


def _same_pads(size: int, k: int, s: int, d: int = 1) -> tuple[int, int]:
    out = math.ceil(size / s)
    total = max((out - 1) * s + (k - 1) * d + 1 - size, 0)
    return total // 2, total - total // 2


class Converter:
    def __init__(self, buf: bytes):
        self.model = tflite.Model.GetRootAsModel(buf, 0)
        if self.model.SubgraphsLength() != 1:
            raise UnsupportedOp("only single-subgraph models are supported")
        self.g = self.model.Subgraphs(0)
        self.nodes: list[onnx.NodeProto] = []
        self.initializers: dict[str, onnx.TensorProto] = {}
        self.consts: dict[int, np.ndarray] = {}
        self.counter = 0
        for i in range(self.g.TensorsLength()):
            data = self._buffer(i)
            if data is not None:
                self.consts[i] = data

    # ----------------------------------------------------------------- helpers
    def _tensor(self, i):
        return self.g.Tensors(i)

    def shape(self, i) -> list[int]:
        return [int(v) for v in self._tensor(i).ShapeAsNumpy()]

    def name(self, i) -> str:
        raw = self._tensor(i).Name().decode()
        return f"t{i}_" + re.sub(r"[^A-Za-z0-9_]", "_", raw)[-40:]

    def _buffer(self, i):
        t = self._tensor(i)
        b = self.model.Buffers(t.Buffer())
        if b is None or b.DataLength() == 0:
            return None
        dtype = DTYPES.get(t.Type())
        if dtype is None:
            raise UnsupportedOp(f"tensor type {t.Type()}")
        arr = np.frombuffer(b.DataAsNumpy().tobytes(), dtype=dtype)
        shape = self.shape(i)
        arr = arr.reshape(shape) if shape else arr.reshape(())
        q = t.Quantization()
        if q is not None and q.ScaleLength() > 0 and dtype in (np.int8, np.uint8, np.int16):
            scale = q.ScaleAsNumpy().astype(np.float32)
            zero = q.ZeroPointAsNumpy().astype(np.float32)
            axis = q.QuantizedDimension()
            if scale.size > 1:
                bshape = [1] * arr.ndim
                bshape[axis] = scale.size
                scale = scale.reshape(bshape)
                zero = zero.reshape(bshape)
            arr = (arr.astype(np.float32) - zero) * scale
        return arr

    def tmp(self, base: str) -> str:
        self.counter += 1
        return f"{base}__{self.counter}"

    def const(self, value: np.ndarray, base: str = "c") -> str:
        name = self.tmp(base)
        self.initializers[name] = numpy_helper.from_array(np.asarray(value), name)
        return name

    def inp(self, i) -> str:
        """Name of tensor i as a graph value, materialising constants as float32/int64 initializers."""
        name = self.name(i)
        if i in self.consts and name not in self.initializers:
            v = self.consts[i]
            if v.dtype == np.float16:
                v = v.astype(np.float32)
            self.initializers[name] = numpy_helper.from_array(v, name)
        return name

    def add(self, op_type: str, inputs: list[str], outputs: list[str], **attrs) -> None:
        self.nodes.append(helper.make_node(op_type, inputs, outputs, name=self.tmp(op_type), **attrs))

    def activation(self, src: str, dst: str, fused: int) -> None:
        if fused == 0:
            self.add("Identity", [src], [dst])
        elif fused == 1:
            self.add("Relu", [src], [dst])
        elif fused == 3:
            self.add("Clip", [src, self.const(np.float32(0)), self.const(np.float32(6))], [dst])
        elif fused == 2:
            self.add("Clip", [src, self.const(np.float32(-1)), self.const(np.float32(1))], [dst])
        elif fused == 4:
            self.add("Tanh", [src], [dst])
        else:
            raise UnsupportedOp(f"fused activation {fused}")

    def nchw(self, name: str) -> str:
        out = self.tmp(name + "_nchw")
        self.add("Transpose", [name], [out], perm=TO_NCHW)
        return out

    def nhwc(self, src: str, dst: str) -> None:
        self.add("Transpose", [src], [dst], perm=TO_NHWC)

    # --------------------------------------------------------------- operators
    def convert(self) -> onnx.ModelProto:
        for k in range(self.g.OperatorsLength()):
            op = self.g.Operators(k)
            oc = self.model.OperatorCodes(op.OpcodeIndex())
            code = max(oc.BuiltinCode(), oc.DeprecatedBuiltinCode())
            opname = OPNAMES.get(code, str(code))
            ins = [int(v) for v in op.InputsAsNumpy()]
            outs = [int(v) for v in op.OutputsAsNumpy()]
            handler = getattr(self, f"op_{opname}", None)
            if handler is None:
                raise UnsupportedOp(opname)
            handler(op, ins, outs)

        inputs = [
            helper.make_tensor_value_info(self.name(i), TensorProto.FLOAT, self.shape(i))
            for i in (int(v) for v in self.g.InputsAsNumpy())
        ]
        outputs = [
            helper.make_tensor_value_info(self.name(i), TensorProto.FLOAT, self.shape(i))
            for i in (int(v) for v in self.g.OutputsAsNumpy())
        ]
        graph = helper.make_graph(self.nodes, "converted", inputs, outputs, list(self.initializers.values()))
        model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", OPSET)], producer_name="skin-scan-tflite2onnx")
        model.ir_version = 7
        onnx.checker.check_model(model)
        return model

    def op_DEQUANTIZE(self, op, ins, outs):
        if ins[0] in self.consts:
            self.consts[outs[0]] = self.consts[ins[0]].astype(np.float32)
        else:
            self.add("Cast", [self.inp(ins[0])], [self.name(outs[0])], to=TensorProto.FLOAT)

    def _conv(self, op, ins, outs, depthwise: bool):
        opt = _options(op, tflite.DepthwiseConv2DOptions if depthwise else tflite.Conv2DOptions)
        x = ins[0]
        _, h, w, cin = self.shape(x)
        wt = self.consts[ins[1]].astype(np.float32)
        if depthwise:
            _, kh, kw, cout = wt.shape
            weight = wt.reshape(kh, kw, cout).transpose(2, 0, 1)[:, None, :, :]
            group = cin
        else:
            cout, kh, kw, _ = wt.shape
            weight = wt.transpose(0, 3, 1, 2)
            group = 1
        sh, sw = opt.StrideH(), opt.StrideW()
        dh, dw = opt.DilationHFactor(), opt.DilationWFactor()
        if opt.Padding() == SAME:
            pt, pb = _same_pads(h, kh, sh, dh)
            pl, pr = _same_pads(w, kw, sw, dw)
        else:
            pt = pb = pl = pr = 0
        inputs = [self.nchw(self.inp(x)), self.const(weight, "w")]
        if len(ins) > 2 and ins[2] >= 0:
            bias = self.consts.get(ins[2])
            inputs.append(self.const(bias.astype(np.float32), "b") if bias is not None else self.inp(ins[2]))
        conv = self.tmp("conv")
        self.add("Conv", inputs, [conv], kernel_shape=[kh, kw], strides=[sh, sw], dilations=[dh, dw],
                 pads=[pt, pl, pb, pr], group=group)
        act = self.tmp("act")
        self.activation(conv, act, opt.FusedActivationFunction())
        self.nhwc(act, self.name(outs[0]))

    def op_CONV_2D(self, op, ins, outs):
        self._conv(op, ins, outs, depthwise=False)

    def op_DEPTHWISE_CONV_2D(self, op, ins, outs):
        self._conv(op, ins, outs, depthwise=True)

    def op_TRANSPOSE_CONV(self, op, ins, outs):
        opt = _options(op, tflite.TransposeConvOptions)
        out_shape = [int(v) for v in self.consts[ins[0]]]
        wt = self.consts[ins[1]].astype(np.float32)  # [O, KH, KW, I]
        x = ins[2]
        _, h, w, _ = self.shape(x)
        cout, kh, kw, _ = wt.shape
        sh, sw = opt.StrideH(), opt.StrideW()
        pads, out_pad = [], []
        for size, k, s, target in ((h, kh, sh, out_shape[1]), (w, kw, sw, out_shape[2])):
            total = (size - 1) * s + k - target
            if opt.Padding() == VALID:
                total = max(total, 0)
            if total >= 0:
                pads.append((total // 2, total - total // 2))
                out_pad.append(0)
            else:
                pads.append((0, 0))
                out_pad.append(-total)
        inputs = [self.nchw(self.inp(x)), self.const(wt.transpose(3, 0, 1, 2), "w")]
        if len(ins) > 3 and ins[3] >= 0:
            inputs.append(self.const(self.consts[ins[3]].astype(np.float32), "b"))
        conv = self.tmp("deconv")
        self.add("ConvTranspose", inputs, [conv], kernel_shape=[kh, kw], strides=[sh, sw],
                 pads=[pads[0][0], pads[1][0], pads[0][1], pads[1][1]], output_padding=out_pad)
        act = self.tmp("act")
        self.activation(conv, act, opt.FusedActivationFunction() if opt else 0)
        self.nhwc(act, self.name(outs[0]))

    def op_MAX_POOL_2D(self, op, ins, outs):
        opt = _options(op, tflite.Pool2DOptions)
        _, h, w, _ = self.shape(ins[0])
        kh, kw, sh, sw = opt.FilterHeight(), opt.FilterWidth(), opt.StrideH(), opt.StrideW()
        if opt.Padding() == SAME:
            pt, pb = _same_pads(h, kh, sh)
            pl, pr = _same_pads(w, kw, sw)
        else:
            pt = pb = pl = pr = 0
        pool = self.tmp("pool")
        self.add("MaxPool", [self.nchw(self.inp(ins[0]))], [pool], kernel_shape=[kh, kw], strides=[sh, sw],
                 pads=[pt, pl, pb, pr])
        act = self.tmp("act")
        self.activation(pool, act, opt.FusedActivationFunction())
        self.nhwc(act, self.name(outs[0]))

    def _binary(self, op, ins, outs, onnx_op, opt_cls):
        opt = _options(op, opt_cls)
        tmp = self.tmp(onnx_op.lower())
        self.add(onnx_op, [self.inp(ins[0]), self.inp(ins[1])], [tmp])
        self.activation(tmp, self.name(outs[0]), opt.FusedActivationFunction() if opt else 0)

    def op_ADD(self, op, ins, outs):
        self._binary(op, ins, outs, "Add", tflite.AddOptions)

    def op_MUL(self, op, ins, outs):
        self._binary(op, ins, outs, "Mul", tflite.MulOptions)

    def op_RELU(self, op, ins, outs):
        self.add("Relu", [self.inp(ins[0])], [self.name(outs[0])])

    def op_PRELU(self, op, ins, outs):
        self.add("PRelu", [self.inp(ins[0]), self.inp(ins[1])], [self.name(outs[0])])

    def op_LOGISTIC(self, op, ins, outs):
        self.add("Sigmoid", [self.inp(ins[0])], [self.name(outs[0])])

    def op_PAD(self, op, ins, outs):
        p = self.consts[ins[1]].astype(np.int64)
        pads = np.concatenate([p[:, 0], p[:, 1]])
        self.add("Pad", [self.inp(ins[0]), self.const(pads, "pads")], [self.name(outs[0])], mode="constant")

    def op_RESHAPE(self, op, ins, outs):
        shape = np.array(self.shape(outs[0]), dtype=np.int64)
        self.add("Reshape", [self.inp(ins[0]), self.const(shape, "shape")], [self.name(outs[0])])

    def op_TRANSPOSE(self, op, ins, outs):
        perm = [int(v) for v in self.consts[ins[1]]]
        self.add("Transpose", [self.inp(ins[0])], [self.name(outs[0])], perm=perm)

    def op_CONCATENATION(self, op, ins, outs):
        opt = _options(op, tflite.ConcatenationOptions)
        rank = len(self.shape(outs[0]))
        axis = opt.Axis() % rank
        tmp = self.tmp("concat")
        self.add("Concat", [self.inp(i) for i in ins], [tmp], axis=axis)
        self.activation(tmp, self.name(outs[0]), opt.FusedActivationFunction())

    def op_SOFTMAX(self, op, ins, outs):
        opt = _options(op, tflite.SoftmaxOptions)
        x = self.inp(ins[0])
        beta = opt.Beta() if opt else 1.0
        if abs(beta - 1.0) > 1e-6:
            scaled = self.tmp("beta")
            self.add("Mul", [x, self.const(np.float32(beta))], [scaled])
            x = scaled
        self.add("Softmax", [x], [self.name(outs[0])], axis=-1)

    def op_SUM(self, op, ins, outs):
        opt = _options(op, tflite.ReducerOptions)
        axes = np.array(self.consts[ins[1]], dtype=np.int64).reshape(-1)
        self.add("ReduceSum", [self.inp(ins[0]), self.const(axes, "axes")], [self.name(outs[0])],
                 keepdims=1 if opt and opt.KeepDims() else 0)

    def _resize(self, op, ins, outs, mode, opt_cls):
        opt = _options(op, opt_cls)
        n, _, _, c = self.shape(ins[0])
        nh, nw = [int(v) for v in self.consts[ins[1]]]
        if opt.HalfPixelCenters():
            # For nearest, TF's half-pixel rule floor((x + 0.5) / s) equals ONNX half_pixel + round_prefer_ceil.
            ctm = "half_pixel"
        elif opt.AlignCorners():
            ctm = "align_corners"
        else:
            ctm = "asymmetric"
        attrs = {"mode": mode, "coordinate_transformation_mode": ctm}
        if mode == "nearest":
            attrs["nearest_mode"] = "round_prefer_ceil" if (opt.AlignCorners() or opt.HalfPixelCenters()) else "floor"
        sizes = self.const(np.array([n, c, nh, nw], dtype=np.int64), "sizes")
        tmp = self.tmp("resize")
        self.add("Resize", [self.nchw(self.inp(ins[0])), "", "", sizes], [tmp], **attrs)
        self.nhwc(tmp, self.name(outs[0]))

    def op_RESIZE_BILINEAR(self, op, ins, outs):
        self._resize(op, ins, outs, "linear", tflite.ResizeBilinearOptions)

    def op_RESIZE_NEAREST_NEIGHBOR(self, op, ins, outs):
        self._resize(op, ins, outs, "nearest", tflite.ResizeNearestNeighborOptions)


def convert(buf: bytes) -> onnx.ModelProto:
    return Converter(buf).convert()

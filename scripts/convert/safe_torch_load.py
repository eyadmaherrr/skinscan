"""
Safe reader for PyTorch `.bin`/`.pt` checkpoints (zip format) without PyTorch.

A PyTorch checkpoint is a zip archive whose `data.pkl` is a Python pickle. A
normal unpickler can execute arbitrary code, so this reader only allows the
handful of callables that describe tensors (the same idea as PyTorch's
`torch.load(weights_only=True)`); anything else aborts the load. Tensor
bytes are read directly from the archive into numpy arrays.
"""

from __future__ import annotations

import io
import pickle
import zipfile
from collections import OrderedDict

import numpy as np

_STORAGE_DTYPES = {
    "FloatStorage": np.float32,
    "DoubleStorage": np.float64,
    "HalfStorage": np.float16,
    "LongStorage": np.int64,
    "IntStorage": np.int32,
    "ShortStorage": np.int16,
    "CharStorage": np.int8,
    "ByteStorage": np.uint8,
    "BoolStorage": np.bool_,
}


class _StorageType:
    def __init__(self, name: str):
        if name not in _STORAGE_DTYPES:
            raise pickle.UnpicklingError(f"unsupported storage type {name}")
        self.dtype = _STORAGE_DTYPES[name]


def _rebuild_tensor_v2(storage, storage_offset, size, stride, requires_grad=False, backward_hooks=None, metadata=None):
    itemsize = storage.dtype.itemsize
    view = np.lib.stride_tricks.as_strided(
        storage[storage_offset:],
        shape=tuple(size),
        strides=tuple(s * itemsize for s in stride),
    )
    return np.array(view, copy=True)


def _rebuild_parameter(data, requires_grad=False, backward_hooks=None):
    return data


class _RestrictedUnpickler(pickle.Unpickler):
    def __init__(self, data: bytes, archive: zipfile.ZipFile, prefix: str):
        super().__init__(io.BytesIO(data))
        self._archive = archive
        self._prefix = prefix
        self._cache: dict[str, np.ndarray] = {}

    def find_class(self, module, name):
        if (module, name) == ("collections", "OrderedDict"):
            return OrderedDict
        if (module, name) == ("torch._utils", "_rebuild_tensor_v2"):
            return _rebuild_tensor_v2
        if (module, name) == ("torch._utils", "_rebuild_parameter"):
            return _rebuild_parameter
        if module == "torch" and name in _STORAGE_DTYPES:
            return _StorageType(name)
        raise pickle.UnpicklingError(f"refusing to load {module}.{name}")

    def persistent_load(self, pid):
        if not (isinstance(pid, tuple) and pid and pid[0] == "storage"):
            raise pickle.UnpicklingError("unexpected persistent id")
        _, storage_type, key, _location, _numel = pid
        if key not in self._cache:
            raw = self._archive.read(f"{self._prefix}/data/{key}")
            self._cache[key] = np.frombuffer(raw, dtype=storage_type.dtype)
        return self._cache[key]


def load_state_dict(path: str) -> "OrderedDict[str, np.ndarray]":
    with zipfile.ZipFile(path) as archive:
        pkl = next(n for n in archive.namelist() if n.endswith("/data.pkl"))
        prefix = pkl[: -len("/data.pkl")]
        byteorder = archive.read(f"{prefix}/byteorder").decode() if f"{prefix}/byteorder" in archive.namelist() else "little"
        if byteorder != "little":
            raise ValueError("big-endian checkpoints are not supported")
        state = _RestrictedUnpickler(archive.read(pkl), archive, prefix).load()
    if not isinstance(state, dict):
        raise ValueError("checkpoint is not a state dict")
    return state


if __name__ == "__main__":
    import sys

    sd = load_state_dict(sys.argv[1])
    for k, v in sd.items():
        print(k, tuple(v.shape), v.dtype)

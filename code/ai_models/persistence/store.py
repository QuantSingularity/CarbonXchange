import os
import tempfile
from pathlib import Path
from typing import Any, Union

import joblib


def atomic_dump(obj: Any, path: Union[str, Path]) -> Path:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=target.parent, suffix=".tmp")
    os.close(fd)
    try:
        joblib.dump(obj, tmp_path)
        os.replace(tmp_path, target)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
    return target


def load_bundle(path: Union[str, Path]) -> Any:
    return joblib.load(path)

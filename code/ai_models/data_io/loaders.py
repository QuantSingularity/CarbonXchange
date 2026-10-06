from pathlib import Path
from typing import Any, Dict, Iterable, Union

import pandas as pd

from ..preprocessing import prepare_frame


def load_price_frame(path: Union[str, Path]) -> pd.DataFrame:
    return prepare_frame(pd.read_csv(path))


def frame_from_records(records: Iterable[Dict[str, Any]]) -> pd.DataFrame:
    return prepare_frame(pd.DataFrame(list(records)))

import numpy as np
import pandas as pd
import pytest
from ai_models.data_io import generate_synthetic_prices
from ai_models.exceptions import InsufficientDataError
from ai_models.preprocessing import (
    build_features,
    feature_names,
    make_target,
    prepare_frame,
    training_matrix,
)


def test_prepare_frame_aliases_and_cleaning():
    raw = pd.DataFrame(
        {
            "date": ["2024-01-02", "2024-01-01", "2024-01-01", "2024-01-03"],
            "close": [11.0, 10.0, 10.5, -1.0],
            "trading_volume": [5, None, 7, 9],
        }
    )
    frame = prepare_frame(raw)
    assert list(frame.columns) == ["timestamp", "price", "volume"]
    assert len(frame) == 2
    assert frame["timestamp"].is_monotonic_increasing
    assert (frame["price"] > 0).all()


def test_prepare_frame_requires_columns():
    with pytest.raises(ValueError):
        prepare_frame(pd.DataFrame({"timestamp": ["2024-01-01"], "price": [1.0]}))


def test_empty_frame_raises():
    with pytest.raises(InsufficientDataError):
        prepare_frame(pd.DataFrame())


def test_features_are_deterministic():
    frame = generate_synthetic_prices(200, seed=3)
    first = build_features(frame)
    second = build_features(frame)
    pd.testing.assert_frame_equal(first, second)
    assert list(first.columns) == feature_names()
    assert not np.isinf(first.to_numpy(dtype=float)).any()


def test_features_do_not_use_future_values():
    frame = generate_synthetic_prices(200, seed=3)
    full = build_features(frame)
    truncated = build_features(frame.iloc[:150])
    pd.testing.assert_frame_equal(
        full.iloc[:150].reset_index(drop=True),
        truncated.reset_index(drop=True),
    )


def test_target_is_next_step_log_return():
    frame = generate_synthetic_prices(50, seed=1)
    target = make_target(frame)
    expected = np.log(frame["price"].iloc[1] / frame["price"].iloc[0])
    assert target.iloc[0] == pytest.approx(expected)
    assert np.isnan(target.iloc[-1])


def test_training_matrix_has_no_missing_values():
    X, y, price = training_matrix(generate_synthetic_prices(300, seed=2))
    assert not X.isna().any().any()
    assert not y.isna().any()
    assert len(X) == len(y) == len(price)

import os

import pytest
from ai_models.persistence import atomic_dump, load_bundle


class Unpicklable:
    def __reduce__(self):
        raise ValueError("cannot serialize")


def test_round_trip_creates_parent_directories(tmp_path):
    target = tmp_path / "nested" / "bundle.joblib"
    atomic_dump({"value": 3}, target)
    assert load_bundle(target) == {"value": 3}


def test_replaces_existing_file_and_leaves_no_temporary_files(tmp_path):
    target = tmp_path / "bundle.joblib"
    atomic_dump({"version": 1}, target)
    atomic_dump({"version": 2}, target)
    assert load_bundle(target) == {"version": 2}
    assert sorted(os.listdir(tmp_path)) == ["bundle.joblib"]


def test_failed_dump_keeps_previous_artifact(tmp_path):
    target = tmp_path / "bundle.joblib"
    atomic_dump({"version": 1}, target)
    with pytest.raises(ValueError):
        atomic_dump({"broken": Unpicklable()}, target)
    assert load_bundle(target) == {"version": 1}
    assert sorted(os.listdir(tmp_path)) == ["bundle.joblib"]

from typing import Any, Dict

from sklearn.compose import TransformedTargetRegressor
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.feature_selection import SelectKBest, f_regression
from sklearn.linear_model import ElasticNet
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import RobustScaler, StandardScaler
from sklearn.svm import SVR

from ..config import RANDOM_STATE

MAX_SELECTED_FEATURES = 30


def build_estimators() -> Dict[str, Any]:
    return {
        "random_forest": RandomForestRegressor(
            n_estimators=150,
            max_depth=8,
            min_samples_split=8,
            min_samples_leaf=4,
            random_state=RANDOM_STATE,
            n_jobs=1,
        ),
        "gradient_boosting": GradientBoostingRegressor(
            n_estimators=120,
            learning_rate=0.05,
            max_depth=3,
            subsample=0.8,
            random_state=RANDOM_STATE,
        ),
        "elastic_net": ElasticNet(
            alpha=0.05, l1_ratio=0.5, random_state=RANDOM_STATE, max_iter=5000
        ),
        "svr": SVR(kernel="rbf", C=1.0, gamma="scale", epsilon=0.1),
        "neural_network": MLPRegressor(
            hidden_layer_sizes=(64, 32),
            alpha=0.01,
            learning_rate="adaptive",
            early_stopping=True,
            max_iter=400,
            random_state=RANDOM_STATE,
        ),
    }


def build_pipeline(estimator: Any, n_features: int) -> TransformedTargetRegressor:
    return TransformedTargetRegressor(
        regressor=Pipeline(
            [
                ("scaler", RobustScaler()),
                (
                    "select",
                    SelectKBest(f_regression, k=min(MAX_SELECTED_FEATURES, n_features)),
                ),
                ("model", estimator),
            ]
        ),
        transformer=StandardScaler(),
    )

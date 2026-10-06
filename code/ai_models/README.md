# ai_models

Machine learning package behind the CarbonXchange forecasting features. It trains an ensemble that forecasts carbon credit prices, a demand model, and serves both to the Flask backend through `backend/src/services/forecasting_service.py`.

## Layout

```
ai_models/
  __init__.py            public API and package version
  config.py              file names, limits and environment driven paths
  exceptions.py          AIModelError, InsufficientDataError, ModelNotTrainedError
  preprocessing/         frame cleaning and leak free feature engineering
  data_io/               CSV loaders and synthetic data generators
  forecasting/           estimators, ensemble training, multi step predictor
  demand/                demand model
  evaluation/            metrics and ensemble weighting
  persistence/           atomic artifact writing and loading
  training/              command line entry points (python -m ai_models.training.*)
  training_scripts/      thin wrappers kept for existing shell scripts
  models/                trained artifacts, generated and git ignored
  data/                  training datasets, generated or supplied, git ignored
  tests/unit/            unit tests
  tests/integration/     training command line tests
  docs/model_card.md     intended use, evaluation protocol and limitations
  Makefile               install, lint, format, test and train targets
  pyproject.toml         pytest and ruff configuration
```

## Quick start

Run from the `code` directory so that `ai_models` is importable.

```
pip install -r ai_models/requirements-dev.txt
python -m ai_models.training.preprocess
python -m ai_models.training.price
python -m ai_models.training.demand
python -m pytest ai_models
```

From inside `ai_models`, `make install`, `make train` and `make test` do the same.

Price training reads `data/market_prices.csv` with columns `timestamp`, `price` and `volume` (the aliases `date`, `close` and `trading_volume` are accepted). When the file is missing it falls back to synthetic data and logs a warning. Synthetic models are for demonstrations only.

## Configuration

| Variable        | Purpose                                | Default            |
| --------------- | -------------------------------------- | ------------------ |
| `AI_MODELS_DIR` | Where artifacts are written and loaded | `ai_models/models` |
| `AI_DATA_DIR`   | Where datasets are read and generated  | `ai_models/data`   |

The backend adds `FEATURE_AI_FORECASTING`, `AI_FORECAST_DEFAULT_HORIZON`, `AI_FORECAST_MAX_HORIZON` and `AI_FORECAST_HISTORY_DAYS`.

## Backend integration

`ForecastingService` builds a daily price and volume series from `PriceHistory` candles (falling back to settled trades), calls `PricePredictor.forecast`, and exposes the result under `/api/forecast`. Admins can retrain through `POST /api/forecast/train`. The predictor reloads artifacts automatically when the file on disk changes, so a retrain needs no restart. If the package cannot be imported the backend keeps running with forecasting disabled.

## Training protocol

1. Features are computed from past observations only and the target is the next step log return.
2. The last 20 percent of the series, in time order, is held out and never used for fitting or model selection.
3. Each estimator is scored with time series cross validation on the training part, then on the holdout.
4. Ensemble weights are inverse cross validation error, so the holdout stays unseen by the weighting.
5. Final models are refitted on all data and saved atomically together with metadata and holdout metrics.

## Extending

Add an estimator in `forecasting/estimators.py`, add a feature in `preprocessing/features.py`, or add a command in `training/`. Keep new features free of future information, because `tests/unit/test_preprocessing.py` checks that truncating the series does not change earlier feature rows.

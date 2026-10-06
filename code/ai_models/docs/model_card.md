# Model card: carbon credit price forecast and demand model

## Purpose

Decision support inside CarbonXchange. The price model gives a statistical estimate of the next days of a credit symbol's price with an uncertainty band. The demand model estimates demand from price, volume and season. Neither output is financial advice and neither should place orders automatically.

## Price model

- Target: next step log return, converted to price paths by compounding.
- Estimators: random forest, gradient boosting, elastic net, support vector regression and a small neural network, each wrapped with robust scaling, univariate feature selection and target standardisation.
- Ensemble: weighted by inverse time series cross validation error.
- Inputs: 38 features covering lagged returns, momentum, moving average ratios, volatility, return skew and kurtosis, volume ratios, RSI, Bollinger position, MACD, range position and calendar terms.
- Multi step forecasts feed each predicted price back in as the next observation and hold volume at its recent average.
- Interval: 95 percent band from holdout residual standard deviation scaled by the square root of the horizon. This assumes independent, roughly normal errors and will understate risk in volatile regimes.

## Demand model

Random forest on price, volume and a season label with one hot encoding. Trained on a random split because rows are not a time series.

## Evaluation

Metrics are stored in the artifact metadata and returned by `GET /api/forecast/status`: return MSE, MAE and R squared, price MAE, RMSE and MAPE, and directional accuracy on the chronological holdout. Always compare directional accuracy and return R squared with a naive zero return baseline, which is also stored as `baseline_return_mae`.

## Known limitations

- Minimum 80 observations to forecast and 150 usable samples to train.
- Carbon credit markets are thin, so daily series built from a few trades are noisy.
- Models trained on synthetic data have no predictive value and exist only so the feature can be demonstrated.
- No retraining schedule or drift monitoring is included. Retrain after structural market changes and watch the stored holdout metrics.
- Artifacts are pickled with joblib. Only load files produced by your own training runs, and keep the scikit-learn version aligned with the one recorded in the metadata.

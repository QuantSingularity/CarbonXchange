import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ai_models.forecasting import ForecastingModel
from ai_models.training.price import main

AdvancedForecastingModel = ForecastingModel

if __name__ == "__main__":
    raise SystemExit(main())

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ai_models.training.preprocess import main

if __name__ == "__main__":
    raise SystemExit(main())

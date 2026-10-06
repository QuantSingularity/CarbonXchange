.PHONY: install lint format test test-unit test-integration preprocess train-price train-demand train clean

PYTHON ?= python3

install:
	$(PYTHON) -m pip install -r requirements-dev.txt

lint:
	$(PYTHON) -m ruff check .

format:
	$(PYTHON) -m ruff format .
	$(PYTHON) -m ruff check --fix .

test:
	$(PYTHON) -m pytest

test-unit:
	$(PYTHON) -m pytest tests/unit

test-integration:
	$(PYTHON) -m pytest tests/integration -m integration

preprocess:
	$(PYTHON) -m ai_models.training.preprocess

train-price:
	$(PYTHON) -m ai_models.training.price

train-demand:
	$(PYTHON) -m ai_models.training.demand

train: preprocess train-price train-demand

clean:
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
	rm -rf .pytest_cache .ruff_cache

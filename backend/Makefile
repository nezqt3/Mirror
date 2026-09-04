.PHONY: install dev test test-integration test-ai lint format migrate migration worker

install:
	python -m pip install -e '.[dev]'

dev:
	uvicorn mirror.main:app --reload

test:
	pytest -q --cov=mirror

test-integration:
	RUN_DB_INTEGRATION=1 pytest -q tests/test_worker_integration.py

test-ai:
	python scripts/check_ai.py

lint:
	ruff check src tests
	mypy src

format:
	ruff check --fix src tests
	ruff format src tests

migrate:
	alembic upgrade head

migration:
	alembic revision --autogenerate -m "$(name)"

worker:
	celery -A mirror.worker.celery_app:celery_app worker --loglevel=INFO

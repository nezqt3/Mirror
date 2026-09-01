.PHONY: install dev test lint format migrate migration worker

install:
	python -m pip install -e '.[dev]'

dev:
	uvicorn mirror.main:app --reload

test:
	pytest -q --cov=mirror

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


FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

WORKDIR /app

RUN addgroup --system mirror && adduser --system --ingroup mirror mirror
COPY backend/pyproject.toml ./
COPY backend/src ./src
RUN --mount=type=cache,target=/root/.cache/pip pip install .

COPY backend/alembic.ini ./
COPY backend/alembic ./alembic
COPY backend/scripts ./scripts
COPY backend/examples ./examples

USER mirror
EXPOSE 8000
CMD ["uvicorn", "mirror.main:app", "--host", "0.0.0.0", "--port", "8000"]

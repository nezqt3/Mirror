FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

WORKDIR /app

RUN addgroup --system mirror && adduser --system --ingroup mirror mirror
COPY pyproject.toml ./
COPY src ./src
COPY alembic.ini ./
COPY alembic ./alembic
COPY scripts ./scripts
COPY examples ./examples
RUN pip install --no-cache-dir .

USER mirror
EXPOSE 8000
CMD ["uvicorn", "mirror.main:app", "--host", "0.0.0.0", "--port", "8000"]

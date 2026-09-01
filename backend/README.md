# Mirror Backend

Backend MVP для Focus Sessions: приём activity events, асинхронный анализ завершённой
сессии, отчёты и развитие Mirror Character.

## Быстрый старт

```bash
cp .env.example .env
docker compose up -d postgres redis minio
python -m venv .venv && source .venv/bin/activate
make install
make migrate
make dev
```

API будет доступен на `http://localhost:8000`, Swagger — на `/docs`.
В отдельном терминале запустите `make worker` для обработки завершённых сессий.

Основной MVP flow уже отражён в API:

1. `POST /api/v1/users` → регистрация;
2. `POST /api/v1/auth/login` → access/refresh tokens;
3. `POST /api/v1/sessions` → старт Focus Session;
4. `POST /api/v1/sessions/{id}/events:batch` → пакет событий клиента;
5. `POST /api/v1/sessions/{id}/finish` → постановка анализа в очередь;
6. `GET /api/v1/sessions/{id}/report` → получение результата.

`SessionAnalyzer` сейчас является детерминированным baseline. Подключение конкретного
multimodal LLM делается отдельным адаптером за этим интерфейсом, без изменения HTTP API.

## Архитектурные границы

- `api/` — сборка HTTP router и общие dependencies;
- `core/` — конфигурация, безопасность и логирование;
- `db/` — SQLAlchemy infrastructure;
- `modules/` — бизнес-домены, каждый со своими model/schema/service/router;
- `services/` — адаптеры внешних систем (S3, AI provider);
- `worker/` — фоновые Celery-задачи.

Raw screenshots не кладутся в PostgreSQL: БД хранит только object key и метаданные.
Desktop-клиент загружает файл по presigned URL. Blacklist/incognito-фильтрация должна
выполняться до отправки данных, а сервер повторно валидирует разрешённый event payload.

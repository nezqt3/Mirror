# Mirror Backend

Backend MVP для Focus Sessions: приём activity events, асинхронный анализ завершённой
сессии, отчёты и развитие Mirror Character.

## Запуск для разработки

```bash
cp .env.example .env
docker compose up -d --build
```

Compose сам ждёт PostgreSQL, запускает одноразовую Alembic-миграцию и только после её успешного
завершения стартует API и worker. API доступен на `http://localhost:8000`, Swagger — на `/docs`.
Проверить состояние и логи:

```bash
docker compose ps
docker compose logs -f api worker
```

При создании Focus Session frontend может передать `analysis_locale: "en"` или
`analysis_locale: "zh-CN"`. Значение по умолчанию — `en`; оно фиксируется на сессии и задаёт язык
всех текстовых значений AI-отчёта. JSON-поля при этом всегда остаются английскими.

В dev-compose API использует hot reload: изменения внутри `src/` подхватываются автоматически.
Worker видит тот же актуальный `src/`, но Celery нужно перезапустить:

```bash
docker compose restart worker
```

Изменения `.env` требуют пересоздания контейнеров:

```bash
docker compose up -d --force-recreate api worker
```

Изменения `pyproject.toml`, Dockerfile, миграций, `scripts/` или `examples/` требуют rebuild:

```bash
docker compose up -d --build --force-recreate api worker
```

## Запуск в production

Production compose не публикует PostgreSQL, Redis и MinIO наружу, не использует bind mounts или
`--reload`, включает restart policy и сохраняет Redis queue в отдельном volume.

```bash
cp .env.production.example .env.production
# Замените все CHANGE_ME, задайте новый Groq API key и URL-encode пароль внутри DATABASE_URL

docker compose -p mirror-prod --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose -p mirror-prod --env-file .env.production -f docker-compose.prod.yml ps
```

Production compose также выполняет миграцию отдельным одноразовым контейнером до старта API и
worker. Если миграция завершилась с ошибкой, приложение не стартует; диагностика:

```bash
docker compose -p mirror-prod --env-file .env.production -f docker-compose.prod.yml logs migrate
```

После изменения production-кода соберите новый image и пересоздайте сервисы:

```bash
docker compose -p mirror-prod --env-file .env.production -f docker-compose.prod.yml up -d --build
```

На нескольких серверах следует публиковать image с неизменяемым `IMAGE_TAG` и запускать именно
его, а не собирать исходники на каждом сервере.

Основной MVP flow уже отражён в API:

1. `POST /api/v1/users` → регистрация;
2. `POST /api/v1/auth/login` → access/refresh tokens;
3. `POST /api/v1/sessions` → старт Focus Session;
4. `GET /api/v1/sessions/current` → текущая сессия через Redis с DB fallback;
5. `POST /api/v1/sessions/{id}/events:batch` → пакет событий клиента;
6. `POST /api/v1/sessions/{id}/finish` → постановка анализа в очередь;
7. `GET /api/v1/sessions/{id}/report` → получение результата.

Production batch соответствует `packages/contracts/src/raw-activity.ts`: верхний объект содержит
`schemaVersion`, `sessionId`, `sentAt` и `events`. Backend строго проверяет данные каждого
события, совпадение session/user ID, запрещает лишние поля и отклоняет incognito-события.
Готовый пример для Swagger находится в `examples/raw-event-batch.json`. Старый компактный
формат `{ "events": [...] }` временно принимается для обратной совместимости.

По умолчанию используется детерминированный baseline. Для production-анализа через Groq
и `openai/gpt-oss-120b` укажите в `.env`:

```dotenv
AI_ENABLED=true
AI_PROVIDER_URL=https://api.groq.com/openai/v1
AI_API_KEY=gsk_...
AI_MODEL=openai/gpt-oss-120b
AI_REASONING_EFFORT=medium
```

Адаптер использует Strict Structured Outputs, скрытый reasoning и серверный расчёт времени,
переключений и наград. Проверить реальный AI-вызов на синтетической сессии можно командой:

```bash
make test-ai
```

Проверить реальный AI на конкретном языке:

```bash
python scripts/check_ai.py --scenario deep_work_success --locale en
python scripts/check_ai.py --scenario deep_work_success --locale zh-CN
```

Прогнать сразу три сценария качества модели:

```bash
python scripts/check_ai.py --all
```

Полный публичный pipeline `HTTP → PostgreSQL → Redis → worker → Groq → report`:

```bash
python scripts/check_pipeline.py
```

Команда выводит тот же компактный JSON, который возвращает endpoint отчёта. Обычные тесты
не расходуют API-токены и используют mock transport:

```bash
make test
```

Полный тест `worker → PostgreSQL → report → character rewards` запускается отдельно и
использует локальную тестовую запись, которую удаляет после проверки:

```bash
make test-integration
```

Реальный HTTP integration-тест без моков регистрирует пользователя, получает JWT, передаёт его в
защищённые endpoints, проверяет Redis ID, raw batch, worker и итоговый report:

```bash
make test-api-integration
```

Этот тест ожидает уже запущенный `docker compose`. При `AI_ENABLED=false` worker использует
детерминированный baseline; реальный Groq проверяется отдельно через `scripts/check_ai.py`.

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

Redis хранит только быстрый указатель `active_session:{user_id} → session_id` и Celery-задачи.
Полные Focus Sessions, activity events и отчёты остаются в PostgreSQL. При cache miss endpoint
`/sessions/current` восстанавливает указатель из БД.

Discipline меняется максимум один раз за локальный календарный день завершённой Focus Session:
первый день и каждый следующий день серии дают `+1`; пропуск сбрасывает streak и снимает по
одному очку за пропущенный день, максимум `-5` за одно обновление. Простое открытие приложения
не начисляет Discipline.

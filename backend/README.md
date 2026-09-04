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

from fastapi import APIRouter

from mirror.modules.auth.router import router as auth_router
from mirror.modules.characters.router import router as characters_router
from mirror.modules.events.router import router as events_router
from mirror.modules.reports.router import router as reports_router
from mirror.modules.sessions.router import router as sessions_router
from mirror.modules.users.router import router as users_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(sessions_router)
api_router.include_router(events_router)
api_router.include_router(reports_router)
api_router.include_router(characters_router)

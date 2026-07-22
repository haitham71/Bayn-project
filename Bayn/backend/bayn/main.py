"""App entry point. Run: uvicorn bayn.main:app --reload"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from bayn.common.exceptions import AppException
from bayn.core.config import settings
from bayn.features.identity.router import router as identity_router
# imported so their tables register on Base.metadata for migrations
from bayn.features.catalog.models import Industry, Skill, Specialization, UserSkill, UserSpecialization
from bayn.features.catalog.router import catalog_router, profile_router
from bayn.features.projects.models import Project, ProjectFile, ProjectMembership, ProjectTeamSlot
from bayn.features.projects.router import projects_router
from bayn.features.meetings.models import Meeting, MeetingAttendance, MeetingRequest
from bayn.features.meetings.router import router as meetings_router
from bayn.features.contracts.models import Contract
from bayn.features.contracts.router import router as contracts_router
from bayn.features.tasks.models import Task, TaskEditor
from bayn.features.tasks.router import router as tasks_router
from bayn.features.dashboard.router import router as dashboard_router
from bayn.features.chat.models import Conversation, ConversationMember, Message
from bayn.features.chat.router import router as chat_router
from bayn.features.notifications.models import Notification
from bayn.features.notifications.router import router as notifications_router
from bayn.features.analytics.router import router as analytics_router

app = FastAPI(
    title="Beyn API",
    description="Identity & Authentication Service",
    version="1.0.0",
)


# allow_origin_regex covers local dev (any localhost port Vite lands on);
# allow_origins covers the deployed frontend, read from FRONTEND_URL in .env
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# turns any AppException raised in a service into a uniform JSON error response
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


app.include_router(identity_router)
app.include_router(catalog_router)
app.include_router(profile_router)
app.include_router(projects_router)
app.include_router(meetings_router)
app.include_router(contracts_router)
app.include_router(tasks_router)
app.include_router(dashboard_router)
app.include_router(chat_router)
app.include_router(notifications_router)
app.include_router(analytics_router)


@app.get("/health", tags=["System"])
async def health_check() -> dict:
    # used by Docker and load balancers to check the app is up
    return {"status": "ok"}

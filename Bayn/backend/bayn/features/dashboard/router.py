"""Dashboard router: team roster and task stats for a project's dashboard."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.core.database import get_db
from bayn.core.i18n import get_locale
from bayn.features.dashboard import service
from bayn.features.dashboard.schemas import ProjectDashboardResponse
from bayn.features.identity.dependencies import get_current_active_user
from bayn.features.identity.models import User

router = APIRouter(prefix="/projects", tags=["Dashboard"])


@router.get(
    "/{project_id}/dashboard",
    response_model=ProjectDashboardResponse,
    summary="Team roster and task stats for a project's dashboard",
)
async def get_project_dashboard(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> ProjectDashboardResponse:
    return await service.get_project_dashboard(db, project_id, current_user.id, locale)

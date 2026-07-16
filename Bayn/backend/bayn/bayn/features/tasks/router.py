"""Tasks router"""
import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.core.database import get_db
from bayn.core.i18n import get_locale
from bayn.features.identity.dependencies import get_current_active_user
from bayn.features.identity.models import User
from bayn.features.tasks import service

router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.post("/assign", status_code=status.HTTP_201_CREATED, summary="Assign a task to a user")
async def assign_task(
    task_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return await service.assign_task(db, task_id, user_id)
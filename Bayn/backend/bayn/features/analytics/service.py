"""Analytics service: platform-wide counts for the public landing page."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.features.identity.models import User
from bayn.features.projects.models import Project

from .schemas import AnalyticsOverviewResponse


async def get_overview(db: AsyncSession) -> AnalyticsOverviewResponse:
    # Cheap COUNT(*) queries — no rows are loaded.
    users = await db.scalar(
        select(func.count()).select_from(User).where(User.deleted_at.is_(None))
    )
    ideas = await db.scalar(select(func.count()).select_from(Project))

    # Formed teams currently mirror the idea count (one team per idea).
    return AnalyticsOverviewResponse(users=users or 0, ideas=ideas or 0, teams=ideas or 0)

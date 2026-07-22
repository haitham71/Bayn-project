"""Analytics router: public platform-wide counts for the landing page."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.core.database import get_db
from bayn.features.analytics import service
from bayn.features.analytics.schemas import AnalyticsOverviewResponse

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get(
    "/overview",
    response_model=AnalyticsOverviewResponse,
    summary="Platform-wide counts (users, ideas, teams) for the landing page",
)
async def get_overview(db: AsyncSession = Depends(get_db)) -> AnalyticsOverviewResponse:
    return await service.get_overview(db)

"""Schemas for the public analytics/overview endpoint."""

from pydantic import BaseModel


class AnalyticsOverviewResponse(BaseModel):
    users: int
    ideas: int
    teams: int

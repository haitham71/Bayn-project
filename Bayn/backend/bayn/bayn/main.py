"""App entry point. Run: uvicorn bayn.main:app --reload"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from bayn.common.exceptions import AppException
from bayn.features.identity.router import router as identity_router
# imported so their tables register on Base.metadata for migrations
from bayn.features.catalog.models import Industry, Skill, Specialization, UserSkill, UserSpecialization  # noqa: F401
from bayn.features.catalog.router import catalog_router, profile_router


app = FastAPI(
    title="Beyn API",
    description="Identity & Authentication Service",
    version="1.0.0",
)


# turns any AppException raised in a service into a uniform JSON error response
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


app.include_router(identity_router)
app.include_router(catalog_router)
app.include_router(profile_router)


@app.get("/health", tags=["System"])
async def health_check() -> dict:
    # used by Docker and load balancers to check the app is up
    return {"status": "ok"}

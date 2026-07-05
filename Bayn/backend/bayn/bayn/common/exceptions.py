"""
Application exceptions raised by the service layer.

Services raise these instead of HTTPException so they stay HTTP-agnostic;
the handler in main.py maps each to its status_code.
"""

from bayn.core.i18n import DEFAULT_LOCALE, t


class AppException(Exception):
    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class NotFoundError(AppException):
    def __init__(self, message: str | None = None, locale: str = DEFAULT_LOCALE):
        super().__init__(message or t("common", "not_found", locale), status_code=404)


class ConflictError(AppException):
    def __init__(self, message: str | None = None, locale: str = DEFAULT_LOCALE):
        super().__init__(message or t("common", "already_exists", locale), status_code=409)


class ValidationError(AppException):
    def __init__(self, message: str | None = None, locale: str = DEFAULT_LOCALE):
        super().__init__(message or t("common", "invalid_data", locale), status_code=400)


class UnauthorizedError(AppException):
    def __init__(self, message: str | None = None, locale: str = DEFAULT_LOCALE):
        super().__init__(message or t("common", "authentication_required", locale), status_code=401)


class ForbiddenError(AppException):
    def __init__(self, message: str | None = None, locale: str = DEFAULT_LOCALE):
        super().__init__(message or t("common", "no_permission", locale), status_code=403)


# ── Identity-specific ─────────────────────────────────────────────────────────

class UserAlreadyExistsError(ConflictError):
    def __init__(self, message: str | None = None, locale: str = DEFAULT_LOCALE):
        super().__init__(message or t("identity", "user_already_exists", locale), locale=locale)


class InvalidCredentialsError(UnauthorizedError):
    def __init__(self, message: str | None = None, locale: str = DEFAULT_LOCALE):
        super().__init__(message or t("identity", "invalid_credentials", locale), locale=locale)


class InvalidTokenError(UnauthorizedError):
    def __init__(self, message: str | None = None, locale: str = DEFAULT_LOCALE):
        super().__init__(message or t("identity", "invalid_token", locale), locale=locale)

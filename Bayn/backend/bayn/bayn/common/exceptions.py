"""
Application exceptions raised by the service layer.

Services raise these instead of HTTPException so they stay HTTP-agnostic;
the handler in main.py maps each to its status_code.
"""


class AppException(Exception):
    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status_code=404)


class ConflictError(AppException):
    def __init__(self, message: str = "Resource already exists"):
        super().__init__(message, status_code=409)


class ValidationError(AppException):
    def __init__(self, message: str = "Invalid request data"):
        super().__init__(message, status_code=400)


class UnauthorizedError(AppException):
    def __init__(self, message: str = "Authentication required"):
        super().__init__(message, status_code=401)


class ForbiddenError(AppException):
    def __init__(self, message: str = "You do not have permission"):
        super().__init__(message, status_code=403)


# ── Identity-specific ─────────────────────────────────────────────────────────

class UserAlreadyExistsError(ConflictError):
    def __init__(self, message: str = "Email or username already in use"):
        super().__init__(message)


class InvalidCredentialsError(UnauthorizedError):
    def __init__(self, message: str = "Invalid email or password"):
        super().__init__(message)


class InvalidTokenError(UnauthorizedError):
    def __init__(self, message: str = "Invalid or expired token"):
        super().__init__(message)

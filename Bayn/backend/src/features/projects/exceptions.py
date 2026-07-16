"""project_exceptions.py
Centralized custom app exceptions using nested localization string targets."""

from fastapi import status
from bayn.common.exceptions import AppException 

class ProjectNotFoundException(AppException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            message="projects.not_found"
        )

class ProjectOwnershipException(AppException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            message="projects.not_owner"
        )

class ProjectAlreadyExistsException(AppException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            message="projects.already_exists"
        )
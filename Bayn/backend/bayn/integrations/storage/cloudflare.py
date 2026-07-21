"""
Cloudflare R2 storage — user avatars, project files, and meeting recordings.

R2 is S3-compatible, so we use boto3 with a custom endpoint.
We store the object key (e.g. "avatars/uuid.jpg") in the DB, not the full URL,
so the URL can be regenerated if the domain or bucket changes.
"""

import uuid

import boto3
from botocore.exceptions import ClientError, NoCredentialsError

from bayn.core.config import settings


AVATAR_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
AVATAR_EXT_BY_CONTENT_TYPE = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024
AVATARS_FOLDER = "avatars"

# project attachments/deliverables — broader than avatars, still a fixed allowlist
FILE_CONTENT_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "text/plain",
    "text/csv",
    "image/jpeg",
    "image/png",
    "image/webp",
}
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024
FILES_FOLDER = "files"

# meeting recordings pulled from Daily.co after a call ends
MEETING_RECORDING_CONTENT_TYPES = {"video/mp4", "video/webm", "audio/mp4", "audio/webm"}
MEETINGS_FOLDER = "meetings"


class StorageError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class InvalidFileError(StorageError):
    """Wrong type or too large — a client error, not a server one."""
    pass


class CloudflareR2Client:

    def __init__(self) -> None:
        # lazy init: local/dev environments may not have R2 credentials
        self._client = None

    def _get_client(self):
        if self._client is None:
            if not all([
                settings.R2_ACCOUNT_ID,
                settings.R2_ACCESS_KEY_ID,
                settings.R2_SECRET_ACCESS_KEY,
            ]):
                raise StorageError(
                    "R2 credentials not configured. "
                    "Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env"
                )

            endpoint_url = f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

            # R2 ignores region but boto3 requires one; "auto" is the R2 convention
            self._client = boto3.client(
                "s3",
                endpoint_url=endpoint_url,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                region_name="auto",
            )

        return self._client

    def _put(self, key: str, file_bytes: bytes, content_type: str, error_verb: str) -> str:
        try:
            # put_object overwrites silently if the key already exists
            self._get_client().put_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
            )
        except (ClientError, NoCredentialsError) as e:
            raise StorageError(f"Failed to {error_verb}: {e}") from e
        return key

    def _delete(self, key: str, error_verb: str) -> None:
        # S3/R2 delete_object doesn't error on a missing key
        try:
            self._get_client().delete_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
        except (ClientError, NoCredentialsError) as e:
            raise StorageError(f"Failed to {error_verb}: {e}") from e

    def get_public_url(self, key: str) -> str:
        if not settings.R2_PUBLIC_URL:
            raise StorageError("R2_PUBLIC_URL not configured in .env")
        base_url = settings.R2_PUBLIC_URL.rstrip("/")
        return f"{base_url}/{key}"

    # ── Avatars ──────────────────────────────────────────────────────────────

    def _validate_avatar(self, file_bytes: bytes, content_type: str) -> None:
        if content_type not in AVATAR_CONTENT_TYPES:
            allowed = ", ".join(AVATAR_CONTENT_TYPES)
            raise InvalidFileError(f"File type '{content_type}' not allowed. Allowed types: {allowed}")
        if len(file_bytes) > MAX_AVATAR_SIZE_BYTES:
            size_mb = len(file_bytes) / (1024 * 1024)
            raise InvalidFileError(f"File size {size_mb:.1f}MB exceeds maximum allowed size of 5MB")

    def upload_avatar(self, user_id: uuid.UUID, file_bytes: bytes, content_type: str) -> str:
        self._validate_avatar(file_bytes, content_type)
        # keyed by user_id so each user has exactly one avatar; re-upload overwrites it
        ext = AVATAR_EXT_BY_CONTENT_TYPE[content_type]
        key = f"{AVATARS_FOLDER}/{user_id}.{ext}"
        return self._put(key, file_bytes, content_type, "upload avatar")

    def delete_avatar(self, avatar_key: str) -> None:
        self._delete(avatar_key, "delete avatar")

    def get_avatar_url(self, avatar_key: str) -> str:
        return self.get_public_url(avatar_key)

    # ── Project files ────────────────────────────────────────────────────────

    def _validate_project_file(self, file_bytes: bytes, content_type: str) -> None:
        if content_type not in FILE_CONTENT_TYPES:
            allowed = ", ".join(sorted(FILE_CONTENT_TYPES))
            raise InvalidFileError(f"File type '{content_type}' not allowed. Allowed types: {allowed}")
        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            size_mb = len(file_bytes) / (1024 * 1024)
            raise InvalidFileError(f"File size {size_mb:.1f}MB exceeds maximum allowed size of 20MB")

    def upload_project_file(
        self, project_id: uuid.UUID, file_bytes: bytes, content_type: str
    ) -> str:
        self._validate_project_file(file_bytes, content_type)
        # unique per upload — a project can have any number of files, unlike avatars
        key = f"{FILES_FOLDER}/{project_id}/{uuid.uuid4()}"
        return self._put(key, file_bytes, content_type, "upload project file")

    def delete_project_file(self, file_key: str) -> None:
        self._delete(file_key, "delete project file")

    def get_project_file_url(self, file_key: str) -> str:
        return self.get_public_url(file_key)

    # ── Meeting recordings ───────────────────────────────────────────────────

    def upload_meeting_recording(
        self, meeting_id: uuid.UUID, file_bytes: bytes, content_type: str
    ) -> str:
        ext = content_type.split("/")[-1]
        key = f"{MEETINGS_FOLDER}/{meeting_id}.{ext}"
        return self._put(key, file_bytes, content_type, "upload meeting recording")

    def get_meeting_recording_url(self, recording_key: str) -> str:
        return self.get_public_url(recording_key)


r2_client = CloudflareR2Client()

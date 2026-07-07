"""
Cloudflare R2 storage for user avatars.

R2 is S3-compatible, so we use boto3 with a custom endpoint.
We store the object key (e.g. "avatars/uuid.jpg") in the DB, not the full URL,
so the URL can be regenerated if the domain or bucket changes.
"""

import uuid

import boto3
from botocore.exceptions import ClientError, NoCredentialsError

from bayn.core.config import settings


ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
CONTENT_TYPE_TO_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024
AVATARS_FOLDER = "avatars"


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

    def _validate_avatar(self, file_bytes: bytes, content_type: str) -> None:
        if content_type not in ALLOWED_CONTENT_TYPES:
            allowed = ", ".join(ALLOWED_CONTENT_TYPES)
            raise InvalidFileError(f"File type '{content_type}' not allowed. Allowed types: {allowed}")

        if len(file_bytes) > MAX_AVATAR_SIZE_BYTES:
            size_mb = len(file_bytes) / (1024 * 1024)
            raise InvalidFileError(f"File size {size_mb:.1f}MB exceeds maximum allowed size of 5MB")

    def _build_avatar_key(self, user_id: uuid.UUID, content_type: str) -> str:
        # keyed by user_id so each user has exactly one avatar; re-upload overwrites it
        ext = CONTENT_TYPE_TO_EXT[content_type]
        return f"{AVATARS_FOLDER}/{user_id}.{ext}"

    def upload_avatar(self, user_id: uuid.UUID, file_bytes: bytes, content_type: str) -> str:
        self._validate_avatar(file_bytes, content_type)
        avatar_key = self._build_avatar_key(user_id, content_type)

        try:
            # put_object overwrites silently if the key already exists
            self._get_client().put_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=avatar_key,
                Body=file_bytes,
                ContentType=content_type,
            )
        except (ClientError, NoCredentialsError) as e:
            raise StorageError(f"Failed to upload avatar: {e}") from e

        return avatar_key

    def delete_avatar(self, avatar_key: str) -> None:
        # S3/R2 delete_object doesn't error on a missing key
        try:
            self._get_client().delete_object(Bucket=settings.R2_BUCKET_NAME, Key=avatar_key)
        except (ClientError, NoCredentialsError) as e:
            raise StorageError(f"Failed to delete avatar: {e}") from e

    def get_avatar_url(self, avatar_key: str) -> str:
        if not settings.R2_PUBLIC_URL:
            raise StorageError("R2_PUBLIC_URL not configured in .env")

        base_url = settings.R2_PUBLIC_URL.rstrip("/")
        return f"{base_url}/{avatar_key}"


r2_client = CloudflareR2Client()

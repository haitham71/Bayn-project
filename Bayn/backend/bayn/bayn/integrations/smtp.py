"""SMTP integration client — outgoing email.

Mirrors the structure of integrations/authentica.py and calendar.py: a
singleton client, custom exceptions, and a thin async method the service
layer calls without needing to know SMTP details.

Uses aiosmtplib for a real async connection (add to requirements.txt if
not already present) instead of wrapping smtplib in a thread.
"""

import aiosmtplib
from email.message import EmailMessage

from bayn.core.config import settings


class EmailError(Exception):
    """Raised when the message could not be sent."""


class EmailClient:
    def __init__(self) -> None:
        self.host = settings.SMTP_HOST
        self.port = settings.SMTP_PORT
        self.username = settings.SMTP_USERNAME
        self.password = settings.SMTP_PASSWORD
        self.from_address = settings.EMAIL_FROM

    async def send_email(
        self,
        to: str,
        subject: str,
        body: str,
        html_body: str | None = None,
    ) -> None:
        message = EmailMessage()
        message["From"] = self.from_address
        message["To"] = to
        message["Subject"] = subject
        message.set_content(body)

        if html_body:
            message.add_alternative(html_body, subtype="html")

        try:
            await aiosmtplib.send(
                message,
                hostname=self.host,
                port=self.port,
                username=self.username,
                password=self.password,
                start_tls=True,
            )
        except aiosmtplib.SMTPException as exc:
            raise EmailError(f"Failed to send email to {to}: {exc}") from exc


email_client = EmailClient()

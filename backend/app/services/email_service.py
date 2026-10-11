import smtplib
from email.message import EmailMessage
from typing import Optional

from app.config.settings import settings
from app.config.logging import get_logger

logger = get_logger("email")


class EmailService:
    """
    Real SMTP client. In development, if SMTP_HOST is empty we log the
    message instead of failing — this is a deliberate dev fallback, not a stub.
    """

    def _send(self, to: str, subject: str, html: str, text: Optional[str] = None) -> None:
        if not settings.SMTP_HOST:
            logger.warning(
                "email_not_sent_smtp_unconfigured",
                to=to,
                subject=subject,
                preview=text or html[:200],
            )
            return

        msg = EmailMessage()
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(text or "Please view this email in HTML.")
        msg.add_alternative(html, subtype="html")

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as s:
            s.starttls()
            if settings.SMTP_USERNAME:
                s.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            s.send_message(msg)

    def send_verification_email(self, to: str, token: str) -> None:
        link = f"{settings.FRONTEND_URL.rstrip('/')}/verify-email?token={token}"
        html = f"<p>Welcome to LearnMate AI! Verify your email:</p><p><a href='{link}'>{link}</a></p>"
        self._send(to, "Verify your LearnMate AI account", html, text=f"Verify: {link}")

    def send_password_reset_email(self, to: str, token: str) -> None:
        link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
        html = f"<p>Reset your password (valid 30 minutes):</p><p><a href='{link}'>{link}</a></p>"
        self._send(to, "Reset your LearnMate AI password", html, text=f"Reset: {link}")


email_service = EmailService()
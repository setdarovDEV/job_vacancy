# accounts/tasks.py
from celery import shared_task
from django.core.mail import send_mail
from headhunter_backend.settings import DEFAULT_FROM_EMAIL

@shared_task
def send_verification_email_task(email, code):
    send_mail(
        subject="Tasdiqlash kodi",
        message=f"Sizning 2FA kodingiz: {code}",
        from_email=DEFAULT_FROM_EMAIL,
        recipient_list=[email],
    )

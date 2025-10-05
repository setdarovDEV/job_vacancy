# accounts/signals.py
from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.utils import timezone
from django.dispatch import receiver

@receiver(user_logged_in)
def on_user_login(sender, request, user, **kwargs):
    user.is_online = True
    user.last_seen = timezone.now()
    user.save(update_fields=["is_online", "last_seen"])

@receiver(user_logged_out)
def on_user_logout(sender, request, user, **kwargs):
    user.is_online = False
    user.last_seen = timezone.now()
    user.save(update_fields=["is_online", "last_seen"])

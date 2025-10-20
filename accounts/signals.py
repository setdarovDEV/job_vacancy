from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.utils import timezone
from django.dispatch import receiver
import threading

def _update_status(user, status):
    user.is_online = status
    user.last_seen = timezone.now()
    user.save(update_fields=["is_online", "last_seen"])

@receiver(user_logged_in)
def on_user_login(sender, request, user, **kwargs):
    threading.Thread(target=_update_status, args=(user, True)).start()

@receiver(user_logged_out)
def on_user_logout(sender, request, user, **kwargs):
    threading.Thread(target=_update_status, args=(user, False)).start()

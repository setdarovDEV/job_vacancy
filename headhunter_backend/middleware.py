# headhunter_backend/middleware.py
from django.conf import settings

class MediaCORPMiddleware:
    """
    /media/ fayllarga Cross-Origin-Resource-Policy headerini qo'shib beradi,
    shunda brauzer ularni localhost:5173 dan ham bloklamaydi.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # faqat media fayllar uchun header qo'shamiz
        try:
            media_url = settings.MEDIA_URL or "/media/"
        except Exception:
            media_url = "/media/"

        if request.path.startswith(media_url):
            # ❗️ Muhim: cross-origin qilsak, boshqa originlardan img sifatida yuklash mumkin bo‘ladi
            response["Cross-Origin-Resource-Policy"] = "cross-origin"

        return response

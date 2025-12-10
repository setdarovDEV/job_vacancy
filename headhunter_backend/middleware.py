# headhunter_backend/middleware.py
from django.conf import settings


class MediaCORSMiddleware:
    """
    Media fayllar uchun CORS va CORP headers qo'shadi.
    Frontenddan (localhost:5173, production) rasm yuklashni ta'minlaydi.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # ✅ Media URL aniqlash
        try:
            media_url = settings.MEDIA_URL or "/media/"
        except Exception:
            media_url = "/media/"

        # ✅ Faqat media fayllar uchun
        if request.path.startswith(media_url):
            # ✅ CORS headers - asosiy muammo shu edi!
            response['Access-Control-Allow-Origin'] = '*'
            response['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
            response['Access-Control-Allow-Headers'] = 'Origin, Content-Type, Accept, Authorization'
            response['Access-Control-Expose-Headers'] = 'Content-Type, Content-Length, Content-Disposition'

            # ✅ CORP header - cross-origin yuklanishiga ruxsat
            response['Cross-Origin-Resource-Policy'] = 'cross-origin'

            # ✅ Cache control
            response['Cache-Control'] = 'public, max-age=31536000'

        return response
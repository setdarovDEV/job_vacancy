"""
Optimized Django settings for headhunter_backend project.
"""

import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse
import dj_database_url
import dotenv
import sys

BASE_DIR = Path(__file__).resolve().parent.parent

# ✅ Test ishga tushganda .env.test faylni yuklaymiz
if "pytest" in sys.argv[0]:
    dotenv.load_dotenv(os.path.join(Path(__file__).resolve().parent.parent, ".env.test"))
else:
    dotenv.load_dotenv(os.path.join(Path(__file__).resolve().parent, ".env"))

# --------------------------------------------------
# ✅ Basic settings
# --------------------------------------------------
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret")
DEBUG = os.environ.get("DEBUG", "0") == "1"
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

RENDER_URL = os.environ.get("RENDER_EXTERNAL_URL", "").rstrip("/")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "").rstrip("/")

if RENDER_URL:
    try:
        parsed = urlparse(RENDER_URL)
        if parsed.hostname:
            ALLOWED_HOSTS.append(parsed.hostname)
    except Exception:
        pass

# --------------------------------------------------
# ✅ Applications
# --------------------------------------------------
INSTALLED_APPS = [
    # Django core
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "whitenoise.runserver_nostatic",
    "django.contrib.staticfiles",

    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "corsheaders",
    "channels",
    "drf_orjson_renderer",
    "silk",

    # Local apps
    "accounts",
    "companies",
    "vacancies",
    "resume",
    "community",
    "chats",
    "applications",
]

# --------------------------------------------------
# ✅ Middleware
# --------------------------------------------------
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.gzip.GZipMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "silk.middleware.SilkyMiddleware",
    "headhunter_backend.middleware.MediaCORPMiddleware",
]

ROOT_URLCONF = "headhunter_backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "headhunter_backend.wsgi.application"
ASGI_APPLICATION = "headhunter_backend.asgi.application"

# --------------------------------------------------
# ✅ Database (DigitalOcean SSL)
# --------------------------------------------------
DATABASES = {}

db_url = os.environ.get("DATABASE_URL")

if db_url:
    DATABASES["default"] = dj_database_url.parse(
        db_url,
        conn_max_age=600,
        ssl_require=True,
    )
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("DB_NAME"),
            "USER": os.environ.get("DB_USER"),
            "PASSWORD": os.environ.get("DB_PASSWORD"),
            "HOST": os.environ.get("DB_HOST"),
            "PORT": os.environ.get("DB_PORT"),
            "OPTIONS": {
                "sslmode": os.environ.get("DB_SSLMODE", "require"),
            },
            "CONN_HEALTH_CHECKS": True,
        }
    }

DATABASES["default"]["CONN_HEALTH_CHECKS"] = True

# --------------------------------------------------
# ✅ Cache (Simple LocMem - Redis o'chirildi)
# --------------------------------------------------
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "unique-headhunter-cache"
    }
}

SESSION_ENGINE = "django.contrib.sessions.backends.db"

# --------------------------------------------------
# ✅ REST Framework
# --------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_RENDERER_CLASSES": [
        "drf_orjson_renderer.renderers.ORJSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.FormParser",
        "rest_framework.parsers.MultiPartParser",
    ],
}

# --------------------------------------------------
# ✅ JWT config
# --------------------------------------------------
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=5),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=31),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

AUTH_USER_MODEL = "accounts.CustomUser"

# --------------------------------------------------
# ✅ Static / Media
# --------------------------------------------------
STATIC_URL = os.environ.get("STATIC_URL", "/static/")
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
WHITENOISE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days cache

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# --------------------------------------------------
# ✅ Email (Gmail SMTP)
# --------------------------------------------------
EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp-relay.brevo.com")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", 587))
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "True") == "True"
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER)
EMAIL_TIMEOUT = 30  # ✅ Timeout qo'shish

# --------------------------------------------------
# ✅ CORS Settings (MEDIA FILES UCHUN TUZATILGAN)
# --------------------------------------------------

CORS_ALLOW_CREDENTIALS = True

# ✅ CORS_ALLOW_ALL_ORIGINS
CORS_ALLOW_ALL_ORIGINS = True  # Development uchun

# ✅ Base allowed origins
CORS_ALLOWED_ORIGINS = [
    # Development - HTTP
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",

    # Production - HTTPS
    "https://jobvacancy-api.duckdns.org",
]

# ✅ Add production origins from environment
env_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "")
if env_origins:
    for origin in env_origins.split(","):
        origin = origin.strip()
        if origin and origin not in CORS_ALLOWED_ORIGINS:
            CORS_ALLOWED_ORIGINS.append(origin)

# ✅ Add FRONTEND_URL if provided
if FRONTEND_URL and FRONTEND_URL not in CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS.append(FRONTEND_URL)

# ✅ CSRF Settings
CSRF_TRUSTED_ORIGINS = [
    o.replace("http://", "https://") for o in CORS_ALLOWED_ORIGINS
]

if RENDER_URL:
    CSRF_TRUSTED_ORIGINS.append(RENDER_URL)
if FRONTEND_URL:
    CSRF_TRUSTED_ORIGINS.append(FRONTEND_URL)

CSRF_TRUSTED_ORIGINS.extend([
    "https://jobvacancy-api.duckdns.org",
    "http://jobvacancy-api.duckdns.org",
])

CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_USE_SESSIONS = False

# ✅ CORS headers - MEDIA FILES UCHUN TUZATILGAN!
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    "cache-control",  # ✅ QO'SHILDI
    "pragma",  # ✅ QO'SHILDI
]

# ✅ CORS expose headers - MEDIA FILES UCHUN!
CORS_EXPOSE_HEADERS = [
    "content-type",
    "x-csrftoken",
    "content-disposition",  # ✅ Media files uchun
    "content-length",  # ✅ Media files uchun
    "cache-control",  # ✅ Media files uchun
    "etag",  # ✅ Media files uchun
]

# ✅ CORS methods
CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

# ✅ CORS preflight cache
CORS_PREFLIGHT_MAX_AGE = 86400  # 24 hours
# --------------------------------------------------
# ✅ Channels (WebSocket)
# --------------------------------------------------
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer"  # Simple in-memory for development
    }
}

# If you have Redis in production, use this instead:
# CHANNEL_LAYERS = {
#     "default": {
#         "BACKEND": "channels_redis.core.RedisChannelLayer",
#         "CONFIG": {"hosts": [os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/1")]},
#     }
# }

# --------------------------------------------------
# ✅ Internationalization
# --------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = os.environ.get("TIME_ZONE", "Asia/Tashkent")
USE_I18N = True
USE_TZ = True

# --------------------------------------------------
# ✅ Miscellaneous
# --------------------------------------------------
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_X_FORWARDED_HOST = True
SITE_ID = 1
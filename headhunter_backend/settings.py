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
    "django_redis",             # ⚡ Cache
    "drf_orjson_renderer",      # ⚡ Super fast JSON
    'silk',

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
    "django.middleware.gzip.GZipMiddleware",        # ⚡ Compress responses
    "whitenoise.middleware.WhiteNoiseMiddleware",   # ⚡ Static optimization
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    'silk.middleware.SilkyMiddleware',
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
import dj_database_url

DATABASES = {}

db_url = os.environ.get("DATABASE_URL")

if db_url:
    # Agar DATABASE_URL bo‘lsa, uni parse qilamiz
    DATABASES["default"] = dj_database_url.parse(
        db_url,
        conn_max_age=600,
        ssl_require=True,
    )
else:
    # Agar DATABASE_URL bo‘lmasa, env variable’lardan o‘qiymiz
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
# ✅ Redis Cache
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
        "drf_orjson_renderer.renderers.ORJSONRenderer",  # ⚡ orjson
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser',
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
WHITENOISE_MAX_AGE = 60 * 60 * 24 * 30  # ⚡ 30 days cache

MEDIA_ROOT = '/opt/render/project/src/media'
MEDIA_URL = '/media/'

# --------------------------------------------------
# ✅ Email
# --------------------------------------------------
# Email settings
EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER)

# --------------------------------------------------
# ✅ Security
# --------------------------------------------------
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_HTTPONLY = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = False

# ✅ Localhost'ni qo'shish
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",  # ✅ MUHIM!
    "http://127.0.0.1:5173",  # ✅ MUHIM!
]

# ✅ CSRF sozlamalari
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",  # ✅ MUHIM!
    "http://127.0.0.1:5173",  # ✅ MUHIM!
    "https://jobvacancy-api.duckdns.org",
]

# ✅ Cookie sozlamalari
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = False  # Development uchun
CSRF_COOKIE_SECURE = False     # Development uchun

# --------------------------------------------------
# ✅ CORS / CSRF
# --------------------------------------------------
SITE_ID = 1

LOCAL_ORIGINS = [
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:5173", "http://127.0.0.1:5173",
]
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()
] or LOCAL_ORIGINS
CORS_ALLOW_ALL_ORIGINS = os.environ.get("CORS_ALLOW_ALL_ORIGINS", "False") == "True"

CSRF_TRUSTED_ORIGINS = [
    o.replace("http://", "https://") for o in CORS_ALLOWED_ORIGINS
]
if RENDER_URL:
    CSRF_TRUSTED_ORIGINS.append(RENDER_URL)
if FRONTEND_URL:
    CSRF_TRUSTED_ORIGINS.append(FRONTEND_URL)

# DuckDNS domenini qo'shish
CSRF_TRUSTED_ORIGINS.extend([
    'https://jobvacancy-api.duckdns.org',
    'http://jobvacancy-api.duckdns.org',
])

# CSRF cookie sozlamalari
CSRF_COOKIE_HTTPONLY = False  # Admin uchun muhim!
CSRF_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_USE_SESSIONS = False

# --------------------------------------------------
# ✅ Channels (WebSocket)
# --------------------------------------------------
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/1")]},
    }
}

# --------------------------------------------------
# ✅ i18n / tz
# --------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = os.environ.get("TIME_ZONE", "Asia/Tashkent")
USE_I18N = True
USE_TZ = True

# --------------------------------------------------
# ✅ Misc
# --------------------------------------------------
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
WHITENOISE_MAX_AGE = 60 * 60 * 24 * 30  # 30 kun

USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
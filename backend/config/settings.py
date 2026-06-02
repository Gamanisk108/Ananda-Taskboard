"""
Django settings for Ananda Taskboard.

Env-driven and DB-agnostic: SQLite by default, Postgres via DATABASE_URL later
with no code change. Secrets come from the environment in production.
"""

import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def env(key, default=None):
    return os.environ.get(key, default)


def env_bool(key, default=False):
    val = os.environ.get(key)
    if val is None:
        return default
    return val.lower() in ("1", "true", "yes", "on")


# --- Core -------------------------------------------------------------------
SECRET_KEY = env(
    "DJANGO_SECRET_KEY",
    "django-insecure-dev-only-0riek0a2z+9y3c!#6*95fkw_j7r@71y1aofui+7yv",
)
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = [h for h in env("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h]
CSRF_TRUSTED_ORIGINS = [o for o in env("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if o]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third-party
    "rest_framework",
    "corsheaders",
    # local apps
    "accounts",
    "projects",
    "tasks",
    "permissions",
    "notifications",
    "exporting",
    "events",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

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

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# --- Database (DB-agnostic) -------------------------------------------------
# Default SQLite. Set DATABASE_URL=postgres://... later to switch with no code change.
DATABASE_URL = env("DATABASE_URL")
if DATABASE_URL:
    # Minimal parser to avoid an extra dependency; supports postgres URLs.
    from urllib.parse import urlparse

    u = urlparse(DATABASE_URL)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": u.path.lstrip("/"),
            "USER": u.username or "",
            "PASSWORD": u.password or "",
            "HOST": u.hostname or "",
            "PORT": str(u.port or ""),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- Custom user (email login) ----------------------------------------------
AUTH_USER_MODEL = "accounts.User"

# --- i18n / time ------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"          # storage is UTC; app-level display tz below
USE_I18N = True
USE_TZ = True

# Business timezone for the daily push & "today" semantics. Default PST.
APP_TIMEZONE = env("APP_TIMEZONE", "America/Los_Angeles")
# Admin-set daily push time (local APP_TIMEZONE), default 08:00.
DAILY_PUSH_HOUR = int(env("DAILY_PUSH_HOUR", "8"))
DAILY_PUSH_MINUTE = int(env("DAILY_PUSH_MINUTE", "0"))

# --- Static -----------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- DRF + JWT --------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "ROTATE_REFRESH_TOKENS": True,
}

# --- CORS (frontend dev server) ---------------------------------------------
CORS_ALLOWED_ORIGINS = [
    o for o in env("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o
]

# --- Web Push (VAPID) -------------------------------------------------------
VAPID_PUBLIC_KEY = env("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = env("VAPID_PRIVATE_KEY", "")
VAPID_CLAIM_EMAIL = env("VAPID_CLAIM_EMAIL", "mailto:admin@example.com")

# --- Scheduled-job auth (GitHub Actions cron → daily-push) ------------------
DAILY_PUSH_SECRET = env("DAILY_PUSH_SECRET", "dev-daily-push-secret")

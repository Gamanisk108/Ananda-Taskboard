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
ALLOWED_HOSTS = [h for h in env("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,.onrender.com").split(",") if h]
CSRF_TRUSTED_ORIGINS = [o for o in env("DJANGO_CSRF_TRUSTED_ORIGINS", "https://*.onrender.com").split(",") if o]

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
    "translations",
    "feedback",
    "attachments",
    "ai",
    "sharing",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # serve static in production
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "permissions.middleware.OrgContextMiddleware",  # sets request.org from X-Org-Id
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
    # Minimal parser to avoid an extra dependency; supports postgres URLs incl.
    # an ?sslmode= query (required by hosted Postgres like Neon/Supabase).
    from urllib.parse import parse_qs, urlparse

    u = urlparse(DATABASE_URL)
    q = parse_qs(u.query)
    options = {}
    sslmode = (q.get("sslmode") or [None])[0]
    # Default to requiring SSL for non-local hosts (Neon/Supabase/etc.).
    if not sslmode and u.hostname not in ("localhost", "127.0.0.1", "", None):
        sslmode = "require"
    if sslmode:
        options["sslmode"] = sslmode
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": u.path.lstrip("/"),
            "USER": u.username or "",
            "PASSWORD": u.password or "",
            "HOST": u.hostname or "",
            "PORT": str(u.port or ""),
            "OPTIONS": options,
            # Reuse connections for 10 min, but verify each is still alive at the
            # start of every request (Django 4.1+). Neon (and other serverless
            # Postgres) suspend on idle and drop pooled connections; without a
            # health check the first request after idle hits a dead connection
            # and 500s (then recovers) — exactly the intermittent /api/statuses
            # 500 seen on the deploy. CONN_HEALTH_CHECKS reconnects transparently.
            "CONN_MAX_AGE": 600,
            "CONN_HEALTH_CHECKS": True,
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
# Manifest/compressed static storage only in production (needs collectstatic);
# in dev/tests Django's default finders serve static without a manifest.
if not DEBUG:
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
    }
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
    # Per-view ScopedRateThrottle scopes (only applied where set on the view).
    "DEFAULT_THROTTLE_RATES": {
        "password_reset": env("PASSWORD_RESET_RATE", "10/hour"),
    },
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

# --- Email (password reset, notifications) ----------------------------------
# Dev default: print emails to the server console — no service or secret needed,
# so the reset link is visible in the backend terminal. To go live, set
# EMAIL_BACKEND to the SMTP backend and EMAIL_HOST_PASSWORD to a Resend API key
# (smtp.resend.com / user "resend"); no code change required.
EMAIL_BACKEND = env("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", "smtp.resend.com")
EMAIL_PORT = int(env("EMAIL_PORT", "587"))
EMAIL_HOST_USER = env("EMAIL_HOST_USER", "resend")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", "")  # Resend API key in production
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "Ananda Taskboard <onboarding@resend.dev>")
# Only used by the file-based email backend (handy for local/E2E: emails are
# written to this directory instead of sent). Ignored by console/SMTP backends.
EMAIL_FILE_PATH = env("EMAIL_FILE_PATH", str(BASE_DIR / "sent_emails"))
# Public base URL of the SPA — used to build password-reset links in emails.
FRONTEND_URL = env("FRONTEND_URL", "http://localhost:5173").rstrip("/")
# Password-reset links are valid for 1 hour (matches the UI + email copy).
PASSWORD_RESET_TIMEOUT = int(env("PASSWORD_RESET_TIMEOUT", "3600"))
# Org invitations are valid for 14 days.
INVITE_TIMEOUT_DAYS = int(env("INVITE_TIMEOUT_DAYS", "14"))

# --- Web Push (VAPID) -------------------------------------------------------
VAPID_PUBLIC_KEY = env("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = env("VAPID_PRIVATE_KEY", "")
VAPID_CLAIM_EMAIL = env("VAPID_CLAIM_EMAIL", "mailto:admin@example.com")

# --- Scheduled-job auth (GitHub Actions cron → daily-push) ------------------
DAILY_PUSH_SECRET = env("DAILY_PUSH_SECRET", "dev-daily-push-secret")

# --- Media uploads (Cloudflare R2, S3-compatible) ---------------------------
# Bucket stays private; files are served via authenticated presigned redirects.
R2_ENDPOINT_URL = env("R2_ENDPOINT_URL", "")  # https://<account>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID = env("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = env("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET = env("R2_BUCKET", "taskboard-media")
ATTACH_MAX_PER_TARGET = int(env("ATTACH_MAX_PER_TARGET", "5"))
ATTACH_MAX_IMAGE = int(env("ATTACH_MAX_IMAGE_BYTES", str(2 * 1024 * 1024)))   # 2 MB
ATTACH_MAX_DOC = int(env("ATTACH_MAX_DOC_BYTES", str(5 * 1024 * 1024)))       # 5 MB
ATTACH_MAX_VIDEO = int(env("ATTACH_MAX_VIDEO_BYTES", str(25 * 1024 * 1024)))  # 25 MB

# --- Error monitoring (Sentry; dormant until SENTRY_DSN is set) --------------
# Phase-12 observability: production failures should surface without a manual
# log audit. Free-tier friendly: low traces sample, no PII.
SENTRY_DSN = env("SENTRY_DSN", "")
if SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=float(env("SENTRY_TRACES_RATE", "0.05")),
        send_default_pii=False,
        environment=env("SENTRY_ENV", "production"),
    )

# AI task generation (Claude). Key is server-only — never sent to the client.
# Feature is inert (endpoint returns 503) unless ANTHROPIC_API_KEY is set.
# Social login — Google ID-token audience. Public Client ID (no secret needed for
# the GIS flow). Feature is inert until set.
GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID", "")
# Google Identity Services opens a sign-in popup that must postMessage its result
# back to our page. Django 4+ defaults COOP to "same-origin", which severs that
# channel and leaves the popup hanging white. Allow popups while keeping COOP.
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin-allow-popups"
# Render terminates TLS and forwards over http with X-Forwarded-Proto: https.
# Trust that header so request.is_secure()/build_absolute_uri() produce https
# URLs — required for share-card og:image (unfurlers reject http images) and
# correct for any absolute URL (e.g. reset/verify email links). No SSL-redirect
# is configured, so there's no loop risk.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY", "")
AI_MODEL = env("AI_MODEL", "claude-haiku-4-5-20251001")
AI_MAX_TASKS = int(env("AI_MAX_TASKS", "25"))            # cap per generation
AI_MAX_FILE_MB = int(env("AI_MAX_FILE_MB", "10"))        # per-file upload guard
AI_MAX_FILES = int(env("AI_MAX_FILES", "8"))             # files per generation

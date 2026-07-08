"""Web Push send wrapper. No-ops gracefully when VAPID keys aren't configured
(dev), and prunes dead subscriptions when the push service rejects them."""

import json
import logging
from concurrent.futures import ThreadPoolExecutor

from django.conf import settings

logger = logging.getLogger("taskboard.push")

# No Celery/Redis on the free tier — a module-level pool is the correct
# weight for fire-and-forget best-effort pushes off the request thread.
_push_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="webpush")


def send_web_push(subscription, payload: dict) -> bool:
    """Send one push. Returns True if sent, False if skipped/failed. Deletes the
    subscription on 404/410 (gone)."""
    if not (settings.VAPID_PRIVATE_KEY and settings.VAPID_PUBLIC_KEY):
        logger.info("VAPID not configured; skipping push to %s", subscription.endpoint[:40])
        return False
    try:
        from pywebpush import WebPushException, webpush

        webpush(
            subscription_info=subscription.as_subscription_info(),
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_CLAIM_EMAIL},
            timeout=10,
        )
        return True
    except WebPushException as exc:  # type: ignore[name-defined]
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status in (404, 410):
            subscription.delete()  # endpoint is gone — prune it
        logger.warning("push failed (%s) for %s", status, subscription.endpoint[:40])
        return False
    except Exception:
        logger.exception("unexpected push error")
        return False


def _run(subscription, payload: dict) -> None:
    """Pool-thread entrypoint: send, then close this thread's DB connection
    (Django opens one per thread; a pool thread that never closes it leaks)."""
    try:
        send_web_push(subscription, payload)
    finally:
        from django.db import connection

        connection.close()


def send_web_push_async(subscription, payload: dict) -> None:
    """Fire-and-forget: queue one push onto the shared pool so the caller (a
    request-handling thread) never blocks on the outbound HTTPS call."""
    _push_pool.submit(_run, subscription, payload)

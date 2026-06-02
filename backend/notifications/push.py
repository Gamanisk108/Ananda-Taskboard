"""Web Push send wrapper. No-ops gracefully when VAPID keys aren't configured
(dev), and prunes dead subscriptions when the push service rejects them."""

import json
import logging

from django.conf import settings

logger = logging.getLogger("taskboard.push")


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

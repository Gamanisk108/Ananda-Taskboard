"""
Event layer (the clean seam from brief §9).

v1 just records events to the log. The point is that every task lifecycle change
flows through ONE place, so outbound webhooks / Zapier can be added later (Phase 2)
without touching call sites. Do NOT inline these notifications elsewhere.
"""

import logging

logger = logging.getLogger("taskboard.events")

# Canonical event names — keep this list authoritative.
TASK_CREATED = "task.created"
TASK_UPDATED = "task.updated"
TASK_APPROVED = "task.approved"
TASK_REJECTED = "task.rejected"
TASK_STATUS_CHANGED = "task.status_changed"
COMMENT_ADDED = "comment.added"


def emit(event_name, payload=None):
    """Fire a domain event: log it, then fan out to any matching outbound
    webhooks (Phase 2). Fire-and-forget — must never raise into the request path.
    """
    payload = payload or {}
    try:
        logger.info("event=%s payload=%s", event_name, payload)
    except Exception:
        pass
    try:
        _dispatch_webhooks(event_name, payload)
    except Exception:  # webhooks must never break the request
        logger.exception("webhook dispatch failed")


def _dispatch_webhooks(event_name, payload):
    """POST the event to each matching active webhook. Best-effort, short timeout.

    Synchronous for simplicity at in-house scale; a real queue is the Phase-3
    upgrade if volume grows. Skips entirely when no webhooks are configured."""
    import json
    from urllib import request as urlrequest

    from .models import Webhook

    hooks = [h for h in Webhook.objects.filter(active=True) if h.matches(event_name)]
    if not hooks:
        return
    body = json.dumps({"event": event_name, "data": payload}).encode("utf-8")
    for hook in hooks:
        try:
            req = urlrequest.Request(
                hook.url, data=body, headers={"Content-Type": "application/json"}, method="POST"
            )
            urlrequest.urlopen(req, timeout=3)  # noqa: S310 (admin-configured URL)
        except Exception:
            logger.warning("webhook POST failed: %s", hook.url[:60])

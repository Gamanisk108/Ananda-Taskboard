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
    """Fire a domain event. v1: structured log only.

    Phase 2 will fan this out to registered outbound webhooks. Callers must not
    assume delivery — this is fire-and-forget and must never raise into the
    request path.
    """
    try:
        logger.info("event=%s payload=%s", event_name, payload or {})
    except Exception:  # never let telemetry break the request
        pass

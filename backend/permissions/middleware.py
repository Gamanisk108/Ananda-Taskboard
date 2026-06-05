"""Attaches the active organization to each request from the `X-Org-Id` header.

The SPA stores the user's chosen org and sends its id on every API call; this
middleware resolves it to `request.org` (an Organization or None). It does NOT
enforce membership — the engine's per-org gate does that with `request.user`,
which DRF authenticates later per-view. A missing/blank/unknown header → None
(legacy/global behavior).
"""


class OrgContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.org = self._resolve(request)
        return self.get_response(request)

    @staticmethod
    def _resolve(request):
        raw = (request.headers.get("X-Org-Id") or "").strip()
        if not raw:
            return None
        from accounts.models import Organization
        try:
            return Organization.objects.filter(id=int(raw)).first()
        except (TypeError, ValueError):
            return None

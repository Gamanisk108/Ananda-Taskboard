"""Import endpoint: admin-only, two-phase (preview dry-run, then commit).

Accepts either a pasted `content` string (CSV/TSV/JSON, e.g. copied from Google
Sheets) or an uploaded `file` (also .xlsx). Preview returns per-row actions +
the projects/sub-projects that would be auto-created; commit applies the import,
honouring per-row `decisions` (overwrite / create / skip)."""

import json

from rest_framework.response import Response
from rest_framework.views import APIView

from permissions.drf import IsAdmin

from . import import_data


class ImportView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        action = request.data.get("action", "preview")
        fmt = (request.data.get("fmt") or "").lower()

        upload = request.FILES.get("file")
        if upload:
            raw = upload.read()
            if not fmt:
                fmt = upload.name.rsplit(".", 1)[-1].lower() if "." in upload.name else "csv"
            content = raw if fmt == "xlsx" else raw.decode("utf-8-sig", errors="replace")
        else:
            content = request.data.get("content", "") or ""
            fmt = fmt or "csv"
            if fmt == "xlsx" and isinstance(content, str):
                import base64
                try:
                    content = base64.b64decode(content)
                except Exception:
                    return Response({"detail": "xlsx content must be base64-encoded."}, status=400)

        try:
            rows = import_data.parse(fmt, content)
        except Exception as e:  # malformed input → clean 400
            return Response({"detail": f"Could not parse the {fmt or 'file'}: {e}"}, status=400)

        org = getattr(request, "org", None)
        try:
            if action == "commit":
                decisions = request.data.get("decisions") or {}
                if isinstance(decisions, str):
                    decisions = json.loads(decisions or "{}")
                if request.data.get("stream"):
                    # Stream NDJSON progress for big imports so the UI shows a live bar.
                    return self._stream_commit(request.user, rows, decisions, org)
                if rows:
                    self._checkpoint()
                return Response(import_data.commit(request.user, rows, decisions, org))
            return Response(import_data.preview(rows, org))
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

    @staticmethod
    def _checkpoint():
        """Snapshot the whole board before changing anything, so a bad import is one
        click to undo from Restore points."""
        from django.utils import timezone
        from restore_service import save_point
        save_point(f"Before import — {timezone.now().strftime('%Y-%m-%d %H:%M')}", auto=True)

    def _stream_commit(self, user, rows, decisions, org):
        """Run the commit inside one transaction, streaming {done,total} progress
        lines (NDJSON) and a final {…,result}. Any error rolls the whole import back
        and is reported as a trailing {error} line (the 200 stream has already begun,
        so we can't switch to a 4xx)."""
        from django.db import transaction
        from django.http import StreamingHttpResponse

        def gen():
            try:
                with transaction.atomic():
                    if rows:
                        self._checkpoint()
                    for evt in import_data._commit_iter(user, rows, decisions, org):
                        yield json.dumps(evt) + "\n"
            except Exception as e:   # transaction has rolled back; tell the client
                yield json.dumps({"error": str(e)}) + "\n"

        resp = StreamingHttpResponse(gen(), content_type="application/x-ndjson")
        resp["Cache-Control"] = "no-cache"
        resp["X-Accel-Buffering"] = "no"   # let events flush through any proxy buffer
        return resp

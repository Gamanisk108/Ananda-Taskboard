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

        try:
            if action == "commit":
                decisions = request.data.get("decisions") or {}
                if isinstance(decisions, str):
                    decisions = json.loads(decisions or "{}")
                return Response(import_data.commit(request.user, rows, decisions))
            return Response(import_data.preview(rows))
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

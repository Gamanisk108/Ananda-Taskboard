"""AI task generation endpoint. POST /api/ai/generate (multipart):
prompt + optional files → Claude proposes tasks mapped to the org's real projects/
members. Returns proposals only (no tasks created here — the client confirms in the
review popup, then creates via the normal /api/tasks path). Guarded by a per-user
daily cap; inert (503) unless ANTHROPIC_API_KEY is configured.
"""

import base64

from django.conf import settings
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import extract, generator
from .models import AiGeneration, DAILY_LIMIT, can_generate, remaining_today


class GenerateTasksView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        org = getattr(request, "org", None)
        if org is None:
            raise ValidationError({"detail": "No active organization."})
        if not settings.ANTHROPIC_API_KEY:
            return Response({"detail": "AI task generation isn't configured yet."}, status=503)

        user = request.user
        if not can_generate(user, org):
            return Response(
                {"detail": f"You've reached today's limit of {DAILY_LIMIT} AI generations. Try again tomorrow.",
                 "remaining": 0},
                status=429,
            )

        prompt = (request.data.get("prompt") or "").strip()
        files = request.FILES.getlist("files")
        if not prompt and not files:
            raise ValidationError({"detail": "Add a prompt or at least one document."})
        if len(files) > settings.AI_MAX_FILES:
            raise ValidationError({"detail": f"Too many files (max {settings.AI_MAX_FILES})."})

        documents, images = [], []
        max_bytes = settings.AI_MAX_FILE_MB * 1024 * 1024
        for idx, f in enumerate(files):
            if f.size > max_bytes:
                raise ValidationError({"detail": f"“{f.name}” is too large (max {settings.AI_MAX_FILE_MB} MB)."})
            data = f.read()
            if extract.is_image(f.name):
                images.append((idx, extract.image_media_type(f.name), base64.b64encode(data).decode("ascii")))
            elif extract.is_supported(f.name):
                documents.append((f.name, extract.extract_text(f.name, data)))
            else:
                raise ValidationError({"detail": f"“{f.name}” is an unsupported file type."})

        projects = self._projects_for(user, org)
        members = self._members_for(org)
        result = generator.propose_tasks(
            prompt, documents, projects, members, images=images, n_files=len(files)
        )

        AiGeneration.objects.create(
            user=user, organization=org, num_tasks=len(result["tasks"]), num_files=len(files)
        )
        from permissions.models import audit
        audit(user, "ai.generate", f"Generated {len(result['tasks'])} task(s) via AI")
        result["remaining"] = remaining_today(user, org)
        return Response(result)

    @staticmethod
    def _projects_for(user, org):
        """Projects/sub-projects to offer the model: an admin's whole org, else the
        member's visible tree. The /api/tasks save still enforces real post rights."""
        from permissions.engine import is_org_admin, visible_project_ids, visible_subproject_ids
        from projects.models import Project
        admin = is_org_admin(user, org)
        if admin:
            qs = Project.objects.filter(organization=org).prefetch_related("subprojects")
            sub_ids = None
        else:
            qs = Project.objects.filter(id__in=visible_project_ids(user, org)).prefetch_related("subprojects")
            sub_ids = set(visible_subproject_ids(user, org))
        out = []
        for p in qs:
            subs = [s for s in p.subprojects.all() if sub_ids is None or s.id in sub_ids]
            out.append({"id": p.id, "name": p.name,
                        "subprojects": [{"id": s.id, "name": s.name} for s in subs]})
        return out

    @staticmethod
    def _members_for(org):
        from accounts.models import Membership
        return [
            {"id": m.user_id, "name": (m.user.name or m.user.email)}
            for m in Membership.objects.filter(organization=org, is_active=True).select_related("user")
        ]

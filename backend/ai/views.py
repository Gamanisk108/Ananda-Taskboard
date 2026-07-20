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
from .models import DAILY_LIMIT, remaining_today, reserve_generation


class GenerateTasksView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        org = getattr(request, "org", None)
        if org is None:
            raise ValidationError({"detail": "No active organization."})
        if not settings.ANTHROPIC_API_KEY:
            return Response({"detail": "AI task generation isn't configured yet."}, status=503)

        user = request.user
        # Reserve a daily slot up front (atomic, race-safe). Refunded on failure.
        gen = reserve_generation(user, org)
        if gen is None:
            return Response(
                {"detail": f"You've reached today's limit of {DAILY_LIMIT} AI generations. Try again tomorrow.",
                 "remaining": 0},
                status=429,
            )

        # Past this point the slot is reserved — refund it on ANY failure (bad
        # input, model/timeout error) so only successful generations count.
        try:
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

            from django.utils import timezone
            today = timezone.now().strftime("%Y-%m-%d (%A)")
            projects = self._projects_for(user, org)
            members = self._members_for(org)

            # Optional focused breakdown: the client opened ONE existing task and wants
            # subtasks for it. Validate the user may add subtasks there, then force routing.
            target_task = None
            raw_target = request.data.get("target_task_id")
            if raw_target not in (None, "", "null"):
                target_task = self._target_task(user, org, raw_target)

            existing_tasks = (
                [{"id": target_task["id"], "title": target_task["title"],
                  "project": "", "subproject": ""}]
                if target_task else self._existing_tasks_for(user, org)
            )
            result = generator.propose_tasks(
                prompt, documents, projects, members, images=images, n_files=len(files),
                today=today, existing_tasks=existing_tasks, target_task=target_task,
            )
        except Exception:
            gen.delete()   # refund the reserved slot
            raise

        gen.num_tasks = len(result["tasks"])
        gen.num_files = len(files)
        gen.save(update_fields=["num_tasks", "num_files"])
        from permissions.models import audit
        audit(user, "ai.generate", f"Generated {len(result['tasks'])} task(s) via AI", organization=org)
        result["remaining"] = remaining_today(user, org)
        # The candidate list lets the review UI relabel/re-point a routed row.
        result["existing_tasks"] = existing_tasks
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

    # Cap on how many existing tasks we describe to the model — enough to route
    # against, bounded so the system prompt stays small and cheap.
    EXISTING_TASK_LIMIT = 200

    @classmethod
    def _existing_tasks_for(cls, user, org):
        """Open (non-archived) tasks the user can SEE, newest first — the routing
        candidates. The /api/subtasks save still enforces who may add subtasks where."""
        from permissions.engine import visible_tasks_q
        from tasks.models import Task
        qs = (
            Task.objects.filter(visible_tasks_q(user, org), archived_at__isnull=True)
            .select_related("subproject__project")
            .order_by("-id")
            .distinct()[: cls.EXISTING_TASK_LIMIT]
        )
        return [
            {"id": t.id, "title": t.title[:120],
             "project": t.subproject.project.name, "subproject": t.subproject.name}
            for t in qs
        ]

    @staticmethod
    def _target_task(user, org, raw_id):
        """Resolve + authorize a focused-breakdown target. Must be a task the user can
        see AND add subtasks to (admin or member on its sub-project)."""
        from permissions.engine import can_act_as_member, is_org_admin, visible_tasks_q
        from tasks.models import Task
        try:
            tid = int(raw_id)
        except (TypeError, ValueError):
            raise ValidationError({"detail": "Invalid task."})
        task = Task.objects.filter(visible_tasks_q(user, org), pk=tid).select_related("subproject").first()
        if task is None:
            raise ValidationError({"detail": "That task isn't available."})
        if not (is_org_admin(user, org) or can_act_as_member(user, task.subproject_id, org)):
            raise ValidationError({"detail": "You can't add subtasks to that task."})
        return {"id": task.id, "title": task.title, "details": (task.details or "")[:2000]}

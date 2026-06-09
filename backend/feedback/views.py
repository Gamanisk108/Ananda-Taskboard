"""Help Us flow endpoints: create a problem report / feature suggestion, then
notify the platform owner(s) by email (best-effort — the record is the truth)."""

from django.conf import settings
from django.core.mail import send_mail
from rest_framework import status as http
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User

from .models import MAX_SCREENSHOT_CHARS, FeatureSuggestion, ProblemReport


def _bad(msg):
    return Response({"detail": msg}, status=http.HTTP_400_BAD_REQUEST)


def _notify_owners(subject: str, body: str):
    to = list(User.objects.filter(is_superuser=True, is_active=True).values_list("email", flat=True))
    if to:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, to, fail_silently=True)


class ReportProblemView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = (request.data.get("message") or "").strip()
        if not message:
            return _bad("Tell us what happened — that's the only required field.")
        if len(message) > 4000:
            return _bad("Reports are limited to 4000 characters.")
        severity = request.data.get("severity") or ProblemReport.Severity.MINOR
        if severity not in ProblemReport.Severity.values:
            return _bad("Unknown severity.")
        screenshot = request.data.get("screenshot") or ""
        if screenshot:
            if not screenshot.startswith("data:image/"):
                return _bad("Screenshot must be an image.")
            if len(screenshot) > MAX_SCREENSHOT_CHARS:
                return _bad("Screenshot is too large — please retry; it should compress automatically.")
        tech = request.data.get("tech")
        report = ProblemReport.objects.create(
            user=request.user,
            organization=getattr(request, "org", None),
            message=message,
            where=(request.data.get("where") or "")[:60],
            severity=severity,
            tech=tech if isinstance(tech, dict) else {},
            screenshot=screenshot,
        )
        _notify_owners(
            f"[Taskboard] Problem report {report.ref} ({report.get_severity_display()})",
            f"From: {request.user.name or request.user.email} <{request.user.email}>\n"
            f"Where: {report.where or '—'}\nSeverity: {report.get_severity_display()}\n\n"
            f"{report.message}\n\nTech: {report.tech or '—'}\n"
            f"Screenshot attached in-app record: {'yes' if report.screenshot else 'no'}",
        )
        return Response({"ref": report.ref}, status=http.HTTP_201_CREATED)


class SuggestFeatureView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        idea = (request.data.get("idea") or "").strip()
        if not idea:
            return _bad("The one-line idea is required.")
        if len(idea) > 300:
            return _bad("Keep the idea to one line (300 characters).")
        suggestion = FeatureSuggestion.objects.create(
            user=request.user,
            organization=getattr(request, "org", None),
            idea=idea,
            detail=(request.data.get("detail") or "").strip()[:4000],
            area=(request.data.get("area") or "")[:60],
            notify_when_shipped=bool(request.data.get("notify_when_shipped")),
        )
        _notify_owners(
            f"[Taskboard] Feature suggestion FS-{suggestion.id}",
            f"From: {request.user.name or request.user.email} <{request.user.email}>\n"
            f"Area: {suggestion.area or '—'}\nNotify when shipped: {suggestion.notify_when_shipped}\n\n"
            f"{suggestion.idea}\n\n{suggestion.detail or ''}",
        )
        return Response({"ok": True}, status=http.HTTP_201_CREATED)

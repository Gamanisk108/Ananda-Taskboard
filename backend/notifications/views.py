from django.conf import settings
from rest_framework import status as http
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from permissions.drf import IsAdmin

from .daily import run_daily_push
from .models import AppSettings, PushSubscription


class PushConfigView(APIView):
    """Exposes the public VAPID key the browser needs to subscribe."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"vapid_public_key": settings.VAPID_PUBLIC_KEY})


class SubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        endpoint = request.data.get("endpoint")
        keys = request.data.get("keys", {})
        if not endpoint or not keys.get("p256dh") or not keys.get("auth"):
            return Response({"detail": "Invalid subscription."}, status=http.HTTP_400_BAD_REQUEST)
        PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={"user": request.user, "p256dh": keys["p256dh"], "auth": keys["auth"]},
        )
        return Response(status=http.HTTP_201_CREATED)

    def delete(self, request):
        endpoint = request.data.get("endpoint")
        PushSubscription.objects.filter(user=request.user, endpoint=endpoint).delete()
        return Response(status=http.HTTP_204_NO_CONTENT)


class AppSettingsView(APIView):
    """Admin-editable app settings (daily push time + timezone). In-app so the
    Django admin is never needed."""

    permission_classes = [IsAdmin]

    def _data(self):
        s = AppSettings.load()
        return {"daily_push_hour": s.daily_push_hour, "daily_push_minute": s.daily_push_minute, "timezone": s.timezone}

    def get(self, request):
        return Response(self._data())

    def patch(self, request):
        s = AppSettings.load()
        for field in ("daily_push_hour", "daily_push_minute", "timezone"):
            if field in request.data:
                setattr(s, field, request.data[field])
        # basic validation
        if not (0 <= s.daily_push_hour <= 23 and 0 <= s.daily_push_minute <= 59):
            return Response({"detail": "Invalid time."}, status=http.HTTP_400_BAD_REQUEST)
        try:
            from zoneinfo import ZoneInfo
            ZoneInfo(s.timezone)
        except Exception:
            return Response({"detail": "Invalid timezone."}, status=http.HTTP_400_BAD_REQUEST)
        s.save()
        return Response(self._data())


class DailyPushJobView(APIView):
    """Secret-gated endpoint the GitHub Actions cron calls each morning."""

    permission_classes = [AllowAny]

    def post(self, request):
        secret = request.headers.get("X-Daily-Push-Secret")
        if not secret or secret != settings.DAILY_PUSH_SECRET:
            return Response(status=http.HTTP_403_FORBIDDEN)
        result = run_daily_push(send=True)
        # piggyback the daily cron: purge expired Trash + save a daily restore point
        from trashbin import purge_expired
        from restore_service import daily_autosave

        result["purged"] = purge_expired()
        from tasks.archiving import archive_completed

        result["archived"] = archive_completed()
        rp = daily_autosave()
        result["restore_point"] = rp.id
        return Response(result)

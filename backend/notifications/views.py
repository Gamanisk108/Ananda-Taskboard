from django.conf import settings
from rest_framework import status as http
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .daily import run_daily_push
from .models import PushSubscription


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


class DailyPushJobView(APIView):
    """Secret-gated endpoint the GitHub Actions cron calls each morning."""

    permission_classes = [AllowAny]

    def post(self, request):
        secret = request.headers.get("X-Daily-Push-Secret")
        if not secret or secret != settings.DAILY_PUSH_SECRET:
            return Response(status=http.HTTP_403_FORBIDDEN)
        result = run_daily_push(send=True)
        return Response(result)

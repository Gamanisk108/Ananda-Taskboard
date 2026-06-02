from rest_framework import viewsets

from permissions.drf import IsAdmin

from .models import Webhook
from .serializers import WebhookSerializer


class WebhookViewSet(viewsets.ModelViewSet):
    """Admin management of outbound webhooks (Zapier etc.)."""

    queryset = Webhook.objects.all()
    serializer_class = WebhookSerializer
    permission_classes = [IsAdmin]

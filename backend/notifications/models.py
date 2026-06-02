from django.conf import settings
from django.db import models


class PushSubscription(models.Model):
    """A Web Push endpoint for one of a user's devices. A user may have several;
    invalid ones are pruned when the push service returns 404/410."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_subscriptions")
    endpoint = models.URLField(max_length=600, unique=True)
    p256dh = models.CharField(max_length=200)
    auth = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def as_subscription_info(self):
        return {"endpoint": self.endpoint, "keys": {"p256dh": self.p256dh, "auth": self.auth}}

    def __str__(self):
        return f"push for {self.user} ({self.endpoint[:40]}…)"

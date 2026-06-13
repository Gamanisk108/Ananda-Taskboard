"""AI task generation — usage log + daily rate guard.

One AiGeneration row per successful generation. Two jobs: (1) enforce a per-user,
per-day cap so a paid LLM call can't be hammered, and (2) feed the Activity-tab
audit. No raw prompt/document text is stored here (privacy — see brainstorm doc).
"""

from django.conf import settings
from django.db import models
from django.utils import timezone

# Max generations per user per org per (UTC) day. Bounds Anthropic spend.
DAILY_LIMIT = 20


class AiGeneration(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_generations")
    organization = models.ForeignKey("accounts.Organization", on_delete=models.CASCADE, related_name="ai_generations")
    num_tasks = models.PositiveIntegerField(default=0)   # tasks the model proposed
    num_files = models.PositiveIntegerField(default=0)   # source files uploaded
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "organization", "created_at"])]

    def __str__(self):
        return f"AI gen by {self.user_id} @ org {self.organization_id} ({self.num_tasks} tasks)"


def generations_today(user, org):
    """Count this user's generations in this org for the current UTC day."""
    return AiGeneration.objects.filter(
        user=user, organization=org, created_at__date=timezone.now().date()
    ).count()


def remaining_today(user, org):
    return max(0, DAILY_LIMIT - generations_today(user, org))


def can_generate(user, org):
    return generations_today(user, org) < DAILY_LIMIT


def reserve_generation(user, org):
    """Atomically claim a daily slot: lock this user's row, re-check the count, and
    insert the AiGeneration in one transaction so two concurrent requests can't both
    slip past the cap (TOCTOU). Returns the row, or None if the cap is reached.
    Caller fills num_tasks/num_files after the (slow, unlocked) model call — and
    should delete the row to refund the slot if generation fails."""
    from django.db import transaction

    User = user.__class__
    with transaction.atomic():
        # Serialize all of THIS user's generation attempts (no-op lock on SQLite,
        # real row lock on Postgres/Neon in prod).
        User.objects.select_for_update().filter(pk=user.pk).first()
        if generations_today(user, org) >= DAILY_LIMIT:
            return None
        return AiGeneration.objects.create(user=user, organization=org)

from django.db import models


class Webhook(models.Model):
    """An outbound webhook (e.g. a Zapier 'Catch Hook' URL). When a matching
    domain event fires, the payload is POSTed here. `events` is a comma-separated
    list of event names, or blank/'*' for all."""

    url = models.URLField(max_length=600)
    events = models.CharField(max_length=300, blank=True, default="", help_text="comma-separated, blank = all")
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def matches(self, event_name):
        if not self.active:
            return False
        if not self.events.strip() or self.events.strip() == "*":
            return True
        return event_name in [e.strip() for e in self.events.split(",") if e.strip()]

    def __str__(self):
        return f"{self.url[:50]} [{self.events or '*'}]"

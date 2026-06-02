from django.contrib import admin

from .models import Webhook


@admin.register(Webhook)
class WebhookAdmin(admin.ModelAdmin):
    list_display = ("url", "events", "active", "created_at")
    list_filter = ("active",)

from django.contrib import admin

from .models import FeatureSuggestion, ProblemReport


@admin.register(ProblemReport)
class ProblemReportAdmin(admin.ModelAdmin):
    list_display = ("ref", "severity", "where", "user", "organization", "created_at")
    list_filter = ("severity",)
    search_fields = ("message", "user__email")


@admin.register(FeatureSuggestion)
class FeatureSuggestionAdmin(admin.ModelAdmin):
    list_display = ("idea", "area", "user", "organization", "notify_when_shipped", "created_at")
    search_fields = ("idea", "detail", "user__email")

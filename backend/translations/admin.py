from django.contrib import admin

from .models import TranslationOverride, TranslationSuggestion


@admin.register(TranslationSuggestion)
class TranslationSuggestionAdmin(admin.ModelAdmin):
    list_display = ("key", "locale", "text", "user", "updated_at")
    list_filter = ("locale",)
    search_fields = ("key", "text", "user__email")


@admin.register(TranslationOverride)
class TranslationOverrideAdmin(admin.ModelAdmin):
    list_display = ("key", "locale", "text", "approved_by", "approved_at")
    list_filter = ("locale",)
    search_fields = ("key", "text")

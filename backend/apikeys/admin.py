from django.contrib import admin

from .models import ApiKey


@admin.register(ApiKey)
class ApiKeyAdmin(admin.ModelAdmin):
    list_display = ("prefix", "name", "scope", "organization", "created_by", "status", "last_used_at", "created_at")
    list_filter = ("scope", "organization")
    search_fields = ("name", "prefix")
    readonly_fields = ("prefix", "hashed_key", "created_at", "last_used_at")

    def has_add_permission(self, request):
        # Keys must be minted via ApiKey.generate() (which produces the secret +
        # hash). The admin "Add" form can't populate those, so disable it.
        return False

    @admin.display(description="Status")
    def status(self, obj):
        return obj.status

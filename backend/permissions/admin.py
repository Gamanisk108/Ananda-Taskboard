from django.contrib import admin

from .models import AccessGrant


@admin.register(AccessGrant)
class AccessGrantAdmin(admin.ModelAdmin):
    list_display = ("__str__", "level", "created_at")
    list_filter = ("level",)
    autocomplete_fields = ()
    raw_id_fields = ("user", "group", "subproject", "project")

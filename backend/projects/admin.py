from django.contrib import admin

from .models import Project, SubProject


class SubProjectInline(admin.TabularInline):
    model = SubProject
    extra = 0
    fields = ("name", "color", "members_post_without_approval", "is_default")


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "color", "subproject_count")
    search_fields = ("name",)
    inlines = [SubProjectInline]

    @admin.display(description="Sub-projects")
    def subproject_count(self, obj):
        return obj.subprojects.count()


@admin.register(SubProject)
class SubProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "color", "members_post_without_approval", "is_default")
    list_filter = ("members_post_without_approval", "is_default", "project")
    search_fields = ("name", "project__name")

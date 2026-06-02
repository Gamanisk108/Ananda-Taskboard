from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserCreationForm

from .models import Group, User


class UserCreateForm(UserCreationForm):
    class Meta:
        model = User
        fields = ("email", "name", "role")


class UserAdmin(BaseUserAdmin):
    add_form = UserCreateForm
    model = User
    list_display = ("email", "name", "role", "is_active", "is_staff")
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("email", "name")
    ordering = ("name", "email")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("name", "role")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "name", "role", "password1", "password2")}),
    )


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("name", "member_count")
    search_fields = ("name",)
    filter_horizontal = ("members",)

    @admin.display(description="Members")
    def member_count(self, obj):
        return obj.members.count()


admin.site.register(User, UserAdmin)

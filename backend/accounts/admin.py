from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserCreationForm

from .models import Group, Membership, Organization, Tier, User


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
    list_display = ("name", "organization", "member_count")
    list_filter = ("organization",)
    search_fields = ("name",)
    filter_horizontal = ("members",)

    @admin.display(description="Members")
    def member_count(self, obj):
        return obj.members.count()


class MembershipInline(admin.TabularInline):
    """See/edit a user's org memberships right on the user page."""

    model = Membership
    extra = 0
    autocomplete_fields = ("organization", "tier")


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "city", "country", "is_active", "created_by", "created_at")
    list_filter = ("is_active", "country")
    search_fields = ("name", "city", "country")


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "organization", "role", "tier", "is_active", "created_at")
    list_filter = ("role", "is_active", "organization")
    search_fields = ("user__email", "user__name", "organization__name")
    autocomplete_fields = ("user", "organization", "tier")


@admin.register(Tier)
class TierAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "default_sees")
    list_filter = ("organization", "default_sees")
    search_fields = ("name",)


# Full platform control: the User page surfaces each person's org memberships.
UserAdmin.inlines = [MembershipInline]
UserAdmin.search_fields = ("email", "name")
admin.site.register(User, UserAdmin)

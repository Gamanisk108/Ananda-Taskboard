from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from permissions.drf import IsAdmin

from .models import SUPPORTED_LANGUAGES, Group, Tier, User
from .serializers import GroupSerializer, TierSerializer, UserSerializer, UserWriteSerializer


class EmailTokenObtainSerializer(TokenObtainPairSerializer):
    """SimpleJWT keyed on the User model's USERNAME_FIELD (email)."""

    username_field = "email"


class LoginView(TokenObtainPairView):
    serializer_class = EmailTokenObtainSerializer


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = UserSerializer(request.user).data
        try:
            from permissions.tree import visible_tree

            data["tree"] = visible_tree(request.user)
        except (ImportError, ModuleNotFoundError):
            data["tree"] = {"projects": [], "show_global_overview": False}
        # Group NAMES (not membership) so any user can filter by group; the
        # member-expansion happens server-side (task list ?assignee_group=).
        data["groups"] = list(Group.objects.values("id", "name"))
        return Response(data)

    def patch(self, request):
        """Self-service: a user updates THEIR OWN preferences — UI language, theme,
        and whether they personally receive the daily push. (App-wide settings like
        the push schedule/timezone stay admin-only on AppSettingsView.)"""
        user = request.user
        updates = []
        if "language" in request.data:
            lang = (request.data.get("language") or "").strip()
            if lang and lang not in SUPPORTED_LANGUAGES:
                raise ValidationError({"language": "Unsupported language."})
            user.language = lang
            updates.append("language")
        if "theme" in request.data:
            theme = (request.data.get("theme") or "").strip()
            if len(theme) > 20:
                raise ValidationError({"theme": "Invalid theme."})
            user.theme = theme
            updates.append("theme")
        if "daily_push_enabled" in request.data:
            user.daily_push_enabled = bool(request.data.get("daily_push_enabled"))
            updates.append("daily_push_enabled")
        if updates:
            user.save(update_fields=updates)
        return Response(UserSerializer(user).data)


class UsersView(APIView):
    """GET: active users + their accessible sub-project ids (any authenticated
    user — powers the assignee picker). POST: admin creates a team member."""

    def get_permissions(self):
        return [IsAdmin()] if self.request.method == "POST" else [IsAuthenticated()]

    def get(self, request):
        from permissions.engine import visible_subproject_ids

        out = []
        for u in User.objects.filter(is_active=True):
            out.append({
                "id": u.id, "name": u.name, "email": u.email, "is_admin": u.is_admin,
                "role": u.role, "is_active": u.is_active, "tier": u.tier_id,
                "subproject_ids": visible_subproject_ids(u),
            })
        return Response(out)

    def post(self, request):
        ser = UserWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        return Response(UserSerializer(user).data, status=201)


class UserDetailView(APIView):
    """Admin edit a member: name, role, active, or reset password."""

    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response(status=404)
        # Guard against an admin locking themselves out.
        if user.id == request.user.id:
            if request.data.get("role") == User.Role.MEMBER or request.data.get("is_active") is False:
                raise PermissionDenied("You can't demote or deactivate your own admin account.")
        ser = UserWriteSerializer(user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        # Audit role/tier/active changes (permission-relevant); ignore name/password.
        from permissions.models import audit
        who = user.name or user.email
        if "role" in request.data:
            audit(request.user, "user.role", f"Set {who} role = {user.role}")
        if "tier" in request.data:
            audit(request.user, "user.tier", f"Set {who} tier = {user.tier.name if user.tier else 'none'}")
        if "is_active" in request.data:
            audit(request.user, "user.active", f"{'Enabled' if user.is_active else 'Disabled'} {who}")
        return Response(UserSerializer(user).data)


class GroupViewSet(viewsets.ModelViewSet):
    """Admin management of Groups (named user collections for bulk grants)."""

    queryset = Group.objects.prefetch_related("members").all()
    serializer_class = GroupSerializer
    permission_classes = [IsAdmin]


class TierViewSet(viewsets.ModelViewSet):
    """Admin management of permission Tiers (reusable templates for members)."""

    queryset = Tier.objects.all()
    serializer_class = TierSerializer
    permission_classes = [IsAdmin]

    def perform_create(self, serializer):
        from permissions.models import audit
        tier = serializer.save()
        audit(self.request.user, "tier.create", f"Created tier '{tier.name}'")

    def perform_update(self, serializer):
        from permissions.models import audit
        tier = serializer.save()
        audit(self.request.user, "tier.update", f"Updated tier '{tier.name}'")

    def perform_destroy(self, instance):
        from permissions.models import audit
        audit(self.request.user, "tier.delete", f"Deleted tier '{instance.name}'")
        instance.delete()


# ── Self-service password reset ────────────────────────────────────────────────
# Two public (unauthenticated) endpoints. They use Django's signed-token
# machinery (default_token_generator) — no extra DB table — and never reveal
# whether an email belongs to a real account (no enumeration).

def _send_reset_email(user):
    """Email a one-hour reset link pointing at the SPA's ?reset deep-link."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    link = f"{settings.FRONTEND_URL}/?reset&uid={uid}&token={token}"
    greeting = f"Hello {user.name}," if user.name else "Hello,"
    body = (
        f"{greeting}\n\n"
        "We received a request to reset your Ananda Taskboard password.\n"
        "Use the link below to choose a new one (it expires in 1 hour):\n\n"
        f"{link}\n\n"
        "If you didn't request this, you can safely ignore this email — "
        "your password won't change.\n"
    )
    send_mail(
        "Reset your Ananda Taskboard password",
        body,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=True,
    )


class PasswordResetRequestView(APIView):
    """POST {email}: start a reset. Always 200 with the same body whether or not
    the email matches an account, so it can't be used to probe for users."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if email:
            user = User.objects.filter(email=email, is_active=True).first()
            if user:
                _send_reset_email(user)
        return Response({"detail": "If that account exists, a reset link is on its way."})


class PasswordResetConfirmView(APIView):
    """POST {uid, token, password}: finish a reset. 400 'invalid' for a bad or
    expired link; 400 {password: [...]} if the new password fails validation."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        user = self._user_from_uid(request.data.get("uid") or "")
        token = request.data.get("token") or ""
        if user is None or not default_token_generator.check_token(user, token):
            return Response({"detail": "invalid"}, status=400)
        password = request.data.get("password") or ""
        try:
            validate_password(password, user)
        except DjangoValidationError as exc:
            return Response({"password": list(exc.messages)}, status=400)
        user.set_password(password)
        user.save(update_fields=["password"])
        return Response({"detail": "ok"})

    @staticmethod
    def _user_from_uid(uid):
        try:
            pk = force_str(urlsafe_base64_decode(uid))
            return User.objects.filter(pk=pk, is_active=True).first()
        except (TypeError, ValueError, OverflowError):
            return None

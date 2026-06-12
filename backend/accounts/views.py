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

from permissions.drf import IsAdmin, IsSuperUser

from .models import (
    SUPPORTED_LANGUAGES,
    Group,
    Invitation,
    Membership,
    Organization,
    Tier,
    User,
    ensure_default_tiers,
)
from .serializers import (
    GroupSerializer,
    InvitationSerializer,
    SignupSerializer,
    TierSerializer,
    UserSerializer,
    UserWriteSerializer,
)
from .tokens import email_verification_token


class EmailTokenObtainSerializer(TokenObtainPairSerializer):
    """SimpleJWT keyed on the User model's USERNAME_FIELD (email)."""

    username_field = "email"


class LoginView(TokenObtainPairView):
    serializer_class = EmailTokenObtainSerializer


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from permissions.engine import is_org_admin

        org = getattr(request, "org", None)
        data = UserSerializer(request.user).data
        # Admin status is per active org (a signup admin is role=member globally).
        data["is_admin"] = is_org_admin(request.user, org)
        # Platform owner: gates the metadata-only stats view (NOT org data access).
        data["is_superuser"] = request.user.is_superuser
        data["memberships"] = self._memberships(request.user)
        data["active_org"] = org.id if org else None
        try:
            from permissions.tree import visible_tree

            data["tree"] = visible_tree(request.user, org)
        except (ImportError, ModuleNotFoundError):
            data["tree"] = {"projects": [], "show_global_overview": False}
        # Group NAMES (not membership) so any user can filter by group; scoped to
        # the active org. Member-expansion happens server-side (task list).
        groups = Group.objects.all()
        if org is not None:
            groups = groups.filter(organization=org)
        data["groups"] = list(groups.values("id", "name"))
        return Response(data)

    @staticmethod
    def _memberships(user):
        """The orgs this user actually belongs to. The platform owner gets NO
        special cross-org access here — only their real memberships (org data
        stays private); platform-wide metadata lives at /api/platform/orgs."""
        rows = Membership.objects.filter(user=user, is_active=True).select_related("organization")
        return [
            {"org_id": m.organization_id, "name": m.organization.name,
             "city": m.organization.city, "state": m.organization.state,
             "country": m.organization.country,
             "role": m.role, "tier": m.tier_id}
            for m in rows
        ]

    def patch(self, request):
        """Self-service: a user updates THEIR OWN preferences — UI language, theme,
        and whether they personally receive the daily push. (App-wide settings like
        the push schedule/timezone stay admin-only on AppSettingsView.)"""
        user = request.user
        updates = []
        if "name" in request.data:
            name = (request.data.get("name") or "").strip()
            if not name:
                raise ValidationError({"name": "Name can't be empty."})
            user.name = name[:200]
            updates.append("name")
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
        if "deadline_reminders" in request.data:
            user.deadline_reminders = bool(request.data.get("deadline_reminders"))
            updates.append("deadline_reminders")
        if "assignment_changes" in request.data:
            user.assignment_changes = bool(request.data.get("assignment_changes"))
            updates.append("assignment_changes")
        if updates:
            user.save(update_fields=updates)
        return Response(UserSerializer(user).data)


class DeleteAccountView(APIView):
    """Self-service account deletion (store-readiness + GDPR-style hygiene).
    Password re-auth required. Personal data CASCADEs (push subscriptions,
    grants, personal events/holidays, translation suggestions, memberships);
    shared team content (tasks, comments, reports) is disassociated via
    SET_NULL — the FK audit 2026-06-10 confirmed every User FK is one of the
    two. Guard rails: the platform owner can't self-delete, and neither can
    the SOLE active admin of an org that still has other active members
    (that would orphan the org)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        password = request.data.get("password") or ""
        if not user.check_password(password):
            raise ValidationError({"password": "That isn't your password."})
        if user.is_superuser:
            raise ValidationError({"detail": "The platform owner account can't delete itself."})
        # Sole-admin guard, per org.
        for m in Membership.objects.filter(user=user, is_active=True, role="admin"):
            org = m.organization
            other_admins = Membership.objects.filter(
                organization=org, role="admin", is_active=True
            ).exclude(user=user).exists()
            other_members = Membership.objects.filter(
                organization=org, is_active=True
            ).exclude(user=user).exists()
            if other_members and not other_admins:
                raise ValidationError({
                    "detail": f"You're the only admin of “{org.name}”. "
                              "Promote another admin (Team → Members) before deleting your account."
                })
        user.delete()
        return Response({"detail": "Account deleted."})


class ChangePasswordView(APIView):
    """Authenticated self-service password change (distinct from the emailed
    reset flow): verify the current password, then set a validated new one."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        current = (request.data.get("current_password") or "")
        new = (request.data.get("new_password") or "")
        if not current or not new:
            raise ValidationError({"detail": "Both current and new passwords are required."})
        if not user.check_password(current):
            raise ValidationError({"current_password": "That isn't your current password."})
        try:
            validate_password(new, user)
        except DjangoValidationError as exc:
            raise ValidationError({"new_password": list(exc.messages)})
        user.set_password(new)
        user.save(update_fields=["password"])
        return Response({"detail": "Password updated."})


class UsersView(APIView):
    """GET: active users + their accessible sub-project ids (any authenticated
    user — powers the assignee picker). POST: admin creates a team member."""

    def get_permissions(self):
        return [IsAdmin()] if self.request.method == "POST" else [IsAuthenticated()]

    def get(self, request):
        from permissions.engine import visible_subproject_ids

        org = getattr(request, "org", None)
        if org is not None:
            members = {m.user_id: m for m in Membership.objects.filter(organization=org)}
            users = User.objects.filter(id__in=members.keys(), is_active=True)
        else:
            members = {}
            users = User.objects.filter(is_active=True)
        out = []
        for u in users:
            m = members.get(u.id)
            role = m.role if m else u.role
            out.append({
                "id": u.id, "name": u.name, "email": u.email, "is_admin": role == "admin",
                "role": role, "is_active": u.is_active, "tier": (m.tier_id if m else u.tier_id),
                "subproject_ids": visible_subproject_ids(u, org),
            })
        return Response(out)

    def post(self, request):
        ser = UserWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        # Attach the new member to the active org (their per-org role/tier).
        org = getattr(request, "org", None)
        if org is not None:
            Membership.objects.get_or_create(
                user=user, organization=org,
                defaults={"role": user.role, "tier_id": user.tier_id, "is_active": True},
            )
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
        # Mirror per-org role/tier/active onto the membership for the active org.
        org = getattr(request, "org", None)
        if org is not None:
            m = Membership.objects.filter(user=user, organization=org).first()
            if m:
                if "role" in request.data:
                    m.role = user.role
                if "tier" in request.data:
                    m.tier_id = user.tier_id
                if "is_active" in request.data:
                    m.is_active = user.is_active
                m.save()
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
    """Admin management of Groups (named user collections for bulk grants),
    scoped to the active org."""

    queryset = Group.objects.prefetch_related("members").all()
    serializer_class = GroupSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        org = getattr(self.request, "org", None)
        qs = Group.objects.prefetch_related("members")
        return qs.filter(organization=org) if org is not None else qs

    def perform_create(self, serializer):
        serializer.save(organization=getattr(self.request, "org", None))


class TierViewSet(viewsets.ModelViewSet):
    """Admin management of permission Tiers (reusable templates for members),
    scoped to the active org."""

    queryset = Tier.objects.all()
    serializer_class = TierSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        org = getattr(self.request, "org", None)
        return Tier.objects.filter(organization=org) if org is not None else Tier.objects.all()

    def perform_create(self, serializer):
        from permissions.models import audit
        tier = serializer.save(organization=getattr(self.request, "org", None))
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

def _user_from_uid(uid, *, active_only=True):
    """Decode a urlsafe-base64 user id from a reset/verify link → User or None.
    `active_only=False` is used during signup verification (account still inactive)."""
    try:
        pk = force_str(urlsafe_base64_decode(uid))
        qs = User.objects.filter(pk=pk)
        if active_only:
            qs = qs.filter(is_active=True)
        return qs.first()  # inside try: a non-numeric pk raises ValueError here
    except (TypeError, ValueError, OverflowError):
        return None


def _send_reset_email(user):
    """Email a one-hour reset link pointing at the SPA's ?reset deep-link.
    Localized to the user's stored language (English fallback)."""
    from .emails import send_reset

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    send_reset(user, f"{settings.FRONTEND_URL}/?reset&uid={uid}&token={token}")


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
        user = _user_from_uid(request.data.get("uid") or "")
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


# ── Self-serve signup + email verification ─────────────────────────────────────
# A person creates their own account AND a new organization (which they admin).
# Both stay inactive until they click the verification link; an inactive user
# can't log in (SimpleJWT rejects inactive), which is the spam/abuse gate.

def _send_verification_email(user):
    """Email a verification link pointing at the SPA's ?verify deep-link."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = email_verification_token.make_token(user)
    link = f"{settings.FRONTEND_URL}/?verify&uid={uid}&token={token}"
    greeting = f"Hello {user.name}," if user.name else "Hello,"
    body = (
        f"{greeting}\n\n"
        "Welcome to Ananda Taskboard! Confirm your email to activate your account "
        "and team (the link expires in 1 hour):\n\n"
        f"{link}\n\n"
        "If you didn't sign up, you can safely ignore this email.\n"
    )
    send_mail(
        "Verify your Ananda Taskboard account",
        body,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=True,
    )


class SignupView(APIView):
    """POST {organization, name, email, password, city, state, country}: create an
    inactive User + inactive Organization + an admin Membership, then email a
    verification link. 201 regardless of delivery."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        ser = SignupSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        user = User.objects.create_user(
            email=d["email"], name=d["name"], password=d["password"], is_active=False
        )
        org = Organization.objects.create(
            name=d["organization"], city=d.get("city", ""), state=d.get("state", ""),
            country=d.get("country", ""), created_by=user, is_active=False,
        )
        ensure_default_tiers(org)
        Membership.objects.create(
            user=user, organization=org, role=Membership.Role.ADMIN, is_active=True
        )
        _send_verification_email(user)
        return Response(
            {"detail": "Account created. Check your email to verify and activate it."},
            status=201,
        )


class PlatformStatsView(APIView):
    """Platform owner only: a metadata-only directory of every org — NEVER the
    contents of an org's tasks. Surfaces org name/location, admin contacts,
    project/sub-project/task counts, and the member roster with role + tier. This
    is the ONLY cross-org visibility the superuser has; org data stays private."""

    permission_classes = [IsSuperUser]

    def get(self, request):
        from projects.models import Project, SubProject
        from tasks.models import Task

        out = []
        for org in Organization.objects.all().order_by("name"):
            memberships = (
                Membership.objects.filter(organization=org)
                .select_related("user", "tier")
                .order_by("role", "user__name")  # admins first (a < m)
            )
            members = [
                {
                    "name": m.user.name or m.user.email,
                    "email": m.user.email,
                    "role": m.role,
                    "tier": (m.tier.name if m.tier else None),
                    "active": m.is_active,
                }
                for m in memberships
            ]
            admins = [{"name": x["name"], "email": x["email"]} for x in members if x["role"] == "admin"]
            out.append({
                "id": org.id,
                "name": org.name,
                "city": org.city,
                "state": org.state,
                "country": org.country,
                "is_active": org.is_active,
                "created_at": org.created_at.isoformat(),
                "admins": admins,
                "counts": {
                    "projects": Project.objects.filter(organization=org).count(),
                    "subprojects": SubProject.objects.filter(project__organization=org).count(),
                    "tasks": Task.objects.filter(subproject__project__organization=org).count(),
                    "members": len(members),
                },
                "members": members,
            })
        return Response(out)


# ── Org invitations ────────────────────────────────────────────────────────────
# An org admin invites an email at a role + tier. The emailed token authorizes
# acceptance, which creates the Membership (and the User, if new). Localized to
# the recipient's language when they already have an account.

def _send_invite_email(inv):
    from .emails import send_invite

    link = f"{settings.FRONTEND_URL}/?invite={inv.id}&token={inv.token}"
    existing = User.objects.filter(email=inv.email).first()
    send_invite(
        inv, link,
        recipient_name=(existing.name if existing else ""),
        recipient_lang=(existing.language if existing else ""),
    )


class InvitationViewSet(viewsets.ModelViewSet):
    """Org admin: create / list / revoke invitations for the active org."""

    serializer_class = InvitationSerializer
    permission_classes = [IsAdmin]
    http_method_names = ["get", "post", "delete", "options"]

    def get_queryset(self):
        org = getattr(self.request, "org", None)
        if org is None:
            return Invitation.objects.none()
        return (
            Invitation.objects.filter(organization=org, status=Invitation.Status.PENDING)
            .select_related("tier", "invited_by")
        )

    def create(self, request, *args, **kwargs):
        from .models import _invite_token

        org = getattr(request, "org", None)
        if org is None:
            return Response({"detail": "No active organization."}, status=400)
        email = (request.data.get("email") or "").strip().lower()
        if not email:
            raise ValidationError({"email": "Email is required."})
        role = request.data.get("role") or Membership.Role.MEMBER
        if role not in (Membership.Role.ADMIN, Membership.Role.MEMBER):
            raise ValidationError({"role": "Invalid role."})
        tier_id = request.data.get("tier")
        if role == Membership.Role.ADMIN:
            tier_id = None  # admins ignore tiers
        elif tier_id and not Tier.objects.filter(id=tier_id, organization=org).exists():
            raise ValidationError({"tier": "Unknown tier for this organization."})
        if Membership.objects.filter(user__email=email, organization=org, is_active=True).exists():
            raise ValidationError({"email": "That person is already a member of this organization."})

        inv, _ = Invitation.objects.update_or_create(
            organization=org, email=email, status=Invitation.Status.PENDING,
            defaults={"role": role, "tier_id": tier_id, "invited_by": request.user, "token": _invite_token()},
        )
        _send_invite_email(inv)
        return Response(InvitationSerializer(inv).data, status=201)

    def perform_destroy(self, instance):
        instance.status = Invitation.Status.REVOKED
        instance.save(update_fields=["status"])


def _valid_invite(pk, token):
    inv = Invitation.objects.select_related("organization", "tier").filter(pk=pk).first()
    if not inv or inv.token != token or inv.status != Invitation.Status.PENDING or inv.is_expired:
        return None
    return inv


class InvitationPreviewView(APIView):
    """Public, token-gated: what an invite is for, so the accept screen can choose
    sign-up (no account) vs join (existing account)."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, pk):
        inv = _valid_invite(pk, request.query_params.get("token") or "")
        if inv is None:
            return Response({"detail": "invalid"}, status=400)
        return Response({
            "organization": inv.organization.name,
            "email": inv.email,
            "role": inv.role,
            "account_exists": User.objects.filter(email=inv.email).exists(),
        })


def _grant_invite_access(user, inv):
    """Create the invite's initial AccessGrants so the new member lands with
    something to see. Each entry: {"scope": "subproject"|"project", "id", "level"}.
    Entries outside the invite's org are ignored (hard isolation)."""
    from permissions.models import AccessGrant
    from projects.models import Project, SubProject

    for entry in (inv.access or []):
        if not isinstance(entry, dict):
            continue
        scope, sid = entry.get("scope"), entry.get("id")
        level = "viewer" if entry.get("level") == "viewer" else "member"
        if not sid:
            continue
        if scope == "subproject" and SubProject.objects.filter(
            id=sid, project__organization=inv.organization
        ).exists():
            AccessGrant.objects.get_or_create(user=user, subproject_id=sid, defaults={"level": level})
        elif scope == "project" and Project.objects.filter(
            id=sid, organization=inv.organization
        ).exists():
            AccessGrant.objects.get_or_create(user=user, project_id=sid, defaults={"level": level})


class InvitationAcceptView(APIView):
    """Public, token-gated: accept an invite → create the Membership (and the User,
    if new — which auto-logs them in since they just set a password)."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, pk):
        inv = _valid_invite(pk, request.data.get("token") or "")
        if inv is None:
            return Response({"detail": "invalid"}, status=400)
        user = User.objects.filter(email=inv.email).first()
        new_account = user is None
        if new_account:
            name = (request.data.get("name") or "").strip()
            if not name:
                raise ValidationError({"name": "Name is required."})
            password = request.data.get("password") or ""
            try:
                validate_password(password)
            except DjangoValidationError as exc:
                return Response({"password": list(exc.messages)}, status=400)
            user = User.objects.create_user(email=inv.email, name=name, password=password, is_active=True)

        Membership.objects.get_or_create(
            user=user, organization=inv.organization,
            defaults={"role": inv.role, "tier": inv.tier, "is_active": True},
        )
        _grant_invite_access(user, inv)
        from django.utils import timezone
        inv.status = Invitation.Status.ACCEPTED
        inv.accepted_at = timezone.now()
        inv.save(update_fields=["status", "accepted_at"])

        out = {"detail": "ok", "account_exists": not new_account,
               "email": inv.email, "org_id": inv.organization_id}
        if new_account:
            from rest_framework_simplejwt.tokens import RefreshToken
            refresh = RefreshToken.for_user(user)
            out["access"] = str(refresh.access_token)
            out["refresh"] = str(refresh)
        return Response(out)


class VerifyEmailView(APIView):
    """POST {uid, token}: activate the account + the org(s) it created. 400
    'invalid' for a bad or expired link."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        user = _user_from_uid(request.data.get("uid") or "", active_only=False)
        token = request.data.get("token") or ""
        if user is None or not email_verification_token.check_token(user, token):
            return Response({"detail": "invalid"}, status=400)
        if not user.is_active:
            user.is_active = True
            user.save(update_fields=["is_active"])
        # Activate any org this user created during signup.
        Organization.objects.filter(created_by=user, is_active=False).update(is_active=True)
        return Response({"detail": "ok"})

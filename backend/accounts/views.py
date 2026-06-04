from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
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
        return Response(data)

    def patch(self, request):
        """Self-service: a user updates their own preferences (currently the UI
        language). Validated against the supported set so only known locales stick."""
        if "language" in request.data:
            lang = (request.data.get("language") or "").strip()
            if lang and lang not in SUPPORTED_LANGUAGES:
                raise ValidationError({"language": "Unsupported language."})
            request.user.language = lang
            request.user.save(update_fields=["language"])
        return Response(UserSerializer(request.user).data)


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

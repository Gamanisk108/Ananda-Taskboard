from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import User
from .serializers import UserSerializer


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


class UsersView(APIView):
    """Active users plus the sub-project ids each can access — lets the task
    assignee picker show everyone while graying out who lacks access to the
    chosen sub-project."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from permissions.engine import visible_subproject_ids

        out = []
        for u in User.objects.filter(is_active=True):
            out.append({
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "is_admin": u.is_admin,
                "subproject_ids": visible_subproject_ids(u),  # admin → all
            })
        return Response(out)

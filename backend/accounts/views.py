from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

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
        # The visible project/sub-project tree + overview-tab flags are computed
        # by the permission engine (build step 4) and merged in here. The key is
        # present now with a stable shape so the frontend can rely on it; it stays
        # empty until projects + grants exist.
        try:
            from permissions.tree import visible_tree

            data["tree"] = visible_tree(request.user)
        except (ImportError, ModuleNotFoundError):
            data["tree"] = {"projects": [], "show_global_overview": False}
        return Response(data)

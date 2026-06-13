from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    ChangePasswordView,
    DeleteAccountView,
    GroupViewSet,
    InvitationAcceptView,
    InvitationPreviewView,
    InvitationViewSet,
    LoginView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    PlatformStatsView,
    SignupView,
    TierViewSet,
    TransferOwnershipView,
    UserDetailView,
    UsersView,
    VerifyEmailView,
)

router = DefaultRouter(trailing_slash=False)
router.register("groups", GroupViewSet, basename="group")
router.register("tiers", TierViewSet, basename="tier")
router.register("invitations", InvitationViewSet, basename="invitation")

urlpatterns = [
    path("auth/login", LoginView.as_view(), name="login"),
    path("auth/refresh", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/password/request", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("auth/password/confirm", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("auth/password/change", ChangePasswordView.as_view(), name="password-change"),
    path("auth/signup", SignupView.as_view(), name="signup"),
    path("auth/verify", VerifyEmailView.as_view(), name="verify-email"),
    # Public, token-gated invite preview + accept (before the router's detail routes).
    path("invitations/<int:pk>/preview", InvitationPreviewView.as_view(), name="invitation-preview"),
    path("invitations/<int:pk>/accept", InvitationAcceptView.as_view(), name="invitation-accept"),
    path("me", MeView.as_view(), name="me"),
    path("me/delete", DeleteAccountView.as_view(), name="me-delete"),
    path("platform/orgs", PlatformStatsView.as_view(), name="platform-orgs"),
    path("users", UsersView.as_view(), name="users"),
    path("users/<int:pk>", UserDetailView.as_view(), name="user-detail"),
    path("users/<int:pk>/transfer-ownership", TransferOwnershipView.as_view(), name="user-transfer-ownership"),
] + router.urls

from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import GroupViewSet, LoginView, MeView, TierViewSet, UserDetailView, UsersView

router = DefaultRouter(trailing_slash=False)
router.register("groups", GroupViewSet, basename="group")
router.register("tiers", TierViewSet, basename="tier")

urlpatterns = [
    path("auth/login", LoginView.as_view(), name="login"),
    path("auth/refresh", TokenRefreshView.as_view(), name="token_refresh"),
    path("me", MeView.as_view(), name="me"),
    path("users", UsersView.as_view(), name="users"),
    path("users/<int:pk>", UserDetailView.as_view(), name="user-detail"),
] + router.urls

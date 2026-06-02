from rest_framework.routers import DefaultRouter

from .views import AccessGrantViewSet

router = DefaultRouter(trailing_slash=False)
router.register("grants", AccessGrantViewSet, basename="grant")

urlpatterns = router.urls

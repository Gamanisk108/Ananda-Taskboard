from rest_framework.routers import DefaultRouter

from .views import AccessGrantViewSet, ExclusionViewSet

router = DefaultRouter(trailing_slash=False)
router.register("grants", AccessGrantViewSet, basename="grant")
router.register("exclusions", ExclusionViewSet, basename="exclusion")

urlpatterns = router.urls

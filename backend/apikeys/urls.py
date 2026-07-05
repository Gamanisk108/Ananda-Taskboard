from rest_framework.routers import DefaultRouter

from .views import ApiKeyViewSet

router = DefaultRouter(trailing_slash=False)
router.register("apikeys", ApiKeyViewSet, basename="apikey")

urlpatterns = router.urls

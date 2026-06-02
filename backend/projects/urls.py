from rest_framework.routers import DefaultRouter

from .views import ProjectViewSet, SubProjectViewSet

router = DefaultRouter(trailing_slash=False)
router.register("projects", ProjectViewSet, basename="project")
router.register("subprojects", SubProjectViewSet, basename="subproject")

urlpatterns = router.urls

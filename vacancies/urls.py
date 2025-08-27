from rest_framework.routers import DefaultRouter
from .views import JobPostViewSet

router = DefaultRouter()
router.register(r'jobposts', JobPostViewSet, basename='jobpost')

urlpatterns = router.urls

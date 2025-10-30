from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .serializers import JobSeekerProfileView, EmployerProfileView
from .views import PostViewSet, CommentViewSet, PostLikeView

router = DefaultRouter()
router.register(r"posts", PostViewSet, basename="post")

post_comments = CommentViewSet.as_view({
    "get": "list",
    "post": "create"
})
comment_detail = CommentViewSet.as_view({
    "get": "retrieve",
    "patch": "partial_update",
    "delete": "destroy",
})

urlpatterns = [
    path("", include(router.urls)),
    path("posts/<int:post_pk>/comments/", post_comments, name="post-comments"),
    path("posts/<int:post_pk>/comments/<int:pk>/", comment_detail, name="comment-detail"),
    path("posts/<int:pk>/like/", PostLikeView.as_view(), name="post-like"),
    path("community/jobseeker-profile/<uuid:id>/", JobSeekerProfileView.as_view(), name="jobseeker-profile"),
    path("community/employer-profile/<uuid:id>/", EmployerProfileView.as_view(), name="employer-profile"),
]

from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from .models import Post, Comment
from .serializers import PostSerializer, CommentSerializer
from .permissions import IsAuthorOrReadOnly


@method_decorator(cache_page(5), name="list")  # 🔥 5 sekundlik cache: feed tezlashadi
class PostViewSet(viewsets.ModelViewSet):
    """
    Postlar uchun CRUD + share API
    """
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_fields = ["author"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]
    search_fields = ["content", "author__username", "author__first_name", "author__last_name"]

    def get_queryset(self):
        """
        Yengil, tez ishlaydigan queryset — faqat kerakli maydonlar bilan.
        """
        return (
            Post.objects
            .select_related("author")
            .prefetch_related("likes")
            .only(
                "id", "author__id", "author__username",
                "author__first_name", "author__last_name",
                "author__profile_image", "content", "image",
                "created_at", "updated_at", "shares_count", "comments_count"
            )
            .order_by("-created_at")
        )

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    # 🔹 share post — atomik inkrement
    @action(detail=True, methods=["post"], url_path="share", permission_classes=[permissions.IsAuthenticated])
    def share(self, request, pk=None):
        post = self.get_object()
        with transaction.atomic():
            Post.objects.filter(pk=post.pk).update(shares_count=F("shares_count") + 1)
            post.refresh_from_db(fields=["shares_count"])
        return Response({"shares_count": post.shares_count}, status=status.HTTP_200_OK)


class CommentViewSet(viewsets.ModelViewSet):
    """
    Postlar uchun kommentlar CRUD.
    """
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]

    def get_queryset(self):
        post_id = self.kwargs["post_pk"]
        return (
            Comment.objects
            .filter(post_id=post_id)
            .select_related("author")
            .only("id", "content", "created_at", "author__id", "author__username")
            .order_by("-created_at")
        )

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def perform_create(self, serializer):
        post_id = self.kwargs["post_pk"]
        serializer.save(author=self.request.user, post_id=post_id)


class PostLikeView(APIView):
    """
    POST /posts/<id>/like/ — like yoki unlike
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        post = get_object_or_404(Post.objects.only("id"), pk=pk)

        # ✅ Transaktsion tarzda toggle qilish
        with transaction.atomic():
            if post.likes.filter(id=request.user.id).exists():
                post.likes.remove(request.user)
                liked = False
            else:
                post.likes.add(request.user)
                liked = True

        # likes_count tez qaytishi uchun signal kutmasdan hisoblaymiz
        count = post.likes.count()
        return Response({"liked": liked, "likes_count": count}, status=status.HTTP_200_OK)

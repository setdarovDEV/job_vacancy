from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from .filters import JobPostFilter
from .models import JobPost, JobPostRating
from .serializers import JobPostSerializer
from rest_framework.pagination import PageNumberPagination

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from rest_framework import status


class TenPerPagePagination(PageNumberPagination):
    page_size = 10

class JobPostViewSet(viewsets.ModelViewSet):
    queryset = JobPost.objects.all().order_by("-created_at")
    serializer_class = JobPostSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = JobPostFilter
    search_fields = ['title']

    def get_queryset(self):
        return JobPost.objects.filter(budget_min__isnull=False, budget_max__isnull=False).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(employer=self.request.user)

    @action(detail=True, methods=['post'], url_path='rate')
    def rate(self, request, pk=None):
        job_post = self.get_object()
        stars = int(request.data.get('stars', 0))
        if stars < 1 or stars > 5:
            return Response({"detail": "Stars 1 dan 5 gacha bo‘lishi kerak"}, status=400)

        rating, created = JobPostRating.objects.update_or_create(
            job_post=job_post,
            user=request.user,
            defaults={"stars": stars}
        )
        return Response({"detail": "Baholangandi ✅"}, status=200)

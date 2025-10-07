# vacancies/views.py
from django.db.models import Q
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend

from .filters import JobPostFilter
from .models import JobPost, JobPostRating, PlanChoices, SavedJob
from .serializers import JobPostSerializer  # ichki serializer (CRUD uchun)
from .serializers import JobPostPublicSerializer  # public ro‘yxatlar uchun


class TenPerPagePagination(PageNumberPagination):
    page_size = 10


class JobPostViewSet(viewsets.ModelViewSet):
    queryset = JobPost.objects.all().select_related("employer").order_by("-created_at")  # << opt.
    serializer_class = JobPostSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = JobPostFilter
    search_fields = ['title', 'description', 'location', 'company__name']
    pagination_class = TenPerPagePagination

    def get_queryset(self):
        base = JobPost.objects.all().select_related("employer").order_by("-created_at")
        if self.action in ("list", "recent", "featured"):
            base = base.filter(budget_min__isnull=False, budget_max__isnull=False)
        return base

    def get_serializer_class(self):
        if self.action in ("list", "recent", "featured"):
            return JobPostPublicSerializer
        return JobPostSerializer

    def get_permissions(self):
        # create, rate, save — auth kerak; qolganlari ochiq
        if self.action in ("create", "rate", "save_vacancy"):
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        serializer.save(employer=self.request.user)

    @action(detail=False, methods=["get"], url_path="featured", permission_classes=[permissions.AllowAny])
    def featured(self, request):
        qs = self.get_queryset().filter(plan__in=[PlanChoices.PRO, PlanChoices.PREMIUM]).order_by("-created_at")[:10]
        ser = JobPostPublicSerializer(qs, many=True, context={"request": request})
        return Response(ser.data, status=200)

    @action(detail=False, methods=["get"], url_path="recent", permission_classes=[permissions.AllowAny])
    def recent(self, request):
        qs = self.get_queryset().order_by("-created_at")
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = JobPostPublicSerializer(page, many=True, context={"request": request})
            return self.get_paginated_response(ser.data)
        ser = JobPostPublicSerializer(qs, many=True, context={"request": request})
        return Response(ser.data, status=200)

    @action(detail=True, methods=['post'], url_path='rate', permission_classes=[permissions.IsAuthenticated])
    def rate(self, request, pk=None):
        job_post = self.get_object()
        try:
            stars = int(request.data.get('stars', 0))
        except Exception:
            return Response({"detail": "stars noto‘g‘ri format"}, status=400)

        if stars < 1 or stars > 5:
            return Response({"detail": "Stars 1 dan 5 gacha bo‘lishi kerak"}, status=400)

        JobPostRating.objects.update_or_create(
            job_post=job_post,
            user=request.user,
            defaults={"stars": stars}
        )
        return Response({"detail": "Baholangandi ✅"}, status=200)

    @action(detail=True, methods=['post', 'delete'], url_path='save', permission_classes=[permissions.IsAuthenticated])
    def save_vacancy(self, request, pk=None):
        job_post = self.get_object()
        user = request.user

        if request.method == "POST":
            SavedJob.objects.get_or_create(user=user, job_post=job_post)
            return Response({"message": "Vacancy saved ✅", "is_saved": True}, status=200)

        # DELETE
        SavedJob.objects.filter(user=user, job_post=job_post).delete()
        return Response({"message": "Vacancy unsaved ❌", "is_saved": False}, status=200)


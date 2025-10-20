from django.db import transaction
from django.db.models import Q, Count, Avg
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend

from .filters import JobPostFilter
from .models import JobPost, JobPostRating, PlanChoices, SavedJob
from .serializers import JobPostSerializer, JobPostPublicSerializer


class TenPerPagePagination(PageNumberPagination):
    page_size = 10


@method_decorator(cache_page(10), name="list")
class JobPostViewSet(viewsets.ModelViewSet):
    """
    Vakansiyalar uchun CRUD, filter, rating, save va company bo‘yicha qidiruv.
    """
    serializer_class = JobPostSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = JobPostFilter
    search_fields = ["title", "description", "location", "company__name"]
    pagination_class = TenPerPagePagination

    def get_queryset(self):
        """
        Optimal queryset:
        - only() va select_related() ishlatilgan
        - faqat aktiv vakansiyalar (budget_min/budget_max mavjud)
        """
        qs = (
            JobPost.objects
            .select_related("employer", "company")
            .only(
                "id", "title", "employer__id", "employer__username",
                "company__id", "company__name", "location", "skills",
                "budget_min", "budget_max", "plan", "is_remote", "created_at", "description",
                "is_filled", "deadline", "duration"
            )
            .filter(budget_min__isnull=False, budget_max__isnull=False)
            .order_by("-created_at")
        )
        return qs

    def get_serializer_class(self):
        if self.action in ("list", "recent", "featured", "by_company"):
            return JobPostPublicSerializer
        return JobPostSerializer

    def get_permissions(self):
        if self.action in ("create", "rate", "save_vacancy"):
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        serializer.save(employer=self.request.user)

    # === FEATURED ===
    @action(detail=False, methods=["get"], url_path="featured")
    def featured(self, request):
        qs = (
            self.get_queryset()
            .filter(plan__in=[PlanChoices.PRO, PlanChoices.PREMIUM])
            .order_by("-created_at")[:20]
        )
        ser = JobPostPublicSerializer(qs, many=True, context={"request": request})
        return Response(ser.data, status=200)

    # === RECENT ===
    @action(detail=False, methods=["get"], url_path="recent")
    def recent(self, request):
        qs = self.get_queryset().order_by("-created_at")[:30]
        page = self.paginate_queryset(qs)
        ser = JobPostPublicSerializer(page or qs, many=True, context={"request": request})
        return self.get_paginated_response(ser.data) if page else Response(ser.data, status=200)

    # === RATE (baholash) ===
    @action(detail=True, methods=["post"], url_path="rate", permission_classes=[permissions.IsAuthenticated])
    def rate(self, request, pk=None):
        job_post = self.get_object()
        try:
            stars = int(request.data.get("stars", 0))
        except Exception:
            return Response({"detail": "stars noto‘g‘ri formatda"}, status=400)

        if not (1 <= stars <= 5):
            return Response({"detail": "Stars 1 dan 5 gacha bo‘lishi kerak"}, status=400)

        with transaction.atomic():
            JobPostRating.objects.update_or_create(
                job_post=job_post,
                user=request.user,
                defaults={"stars": stars},
            )
        avg = job_post.ratings.aggregate(a=Avg("stars"))["a"] or 0
        return Response({"detail": "Baholangandi ✅", "average_stars": round(avg, 2)}, status=200)

    # === SAVE / UNSAVE ===
    @action(detail=True, methods=["post", "delete"], url_path="save", permission_classes=[permissions.IsAuthenticated])
    def save_vacancy(self, request, pk=None):
        job_post = self.get_object()
        user = request.user
        with transaction.atomic():
            if request.method == "POST":
                SavedJob.objects.get_or_create(user=user, job_post=job_post)
                return Response({"message": "Vacancy saved ✅", "is_saved": True}, status=200)
            SavedJob.objects.filter(user=user, job_post=job_post).delete()
            return Response({"message": "Vacancy unsaved ❌", "is_saved": False}, status=200)

    # === BY COMPANY ===
    @action(detail=False, methods=["get"], url_path="by-company/(?P<company_id>[^/.]+)")
    def by_company(self, request, company_id=None):
        """
        Berilgan company_id asosida shu kompaniyaga tegishli vakansiyalarni qaytaradi.
        Faqat is_filled=False bo‘lganlari.
        """
        qs = (
            JobPost.objects
            .filter(company_id=company_id, is_filled=False)
            .select_related("company", "employer")
            .only(
                "id", "title", "location", "plan", "is_remote",
                "budget_min", "budget_max", "created_at", "employer__id", "company__id", "company__name"
            )
            .order_by("-created_at")
        )
        page = self.paginate_queryset(qs)
        ser = JobPostPublicSerializer(page or qs, many=True, context={"request": request})
        return self.get_paginated_response(ser.data) if page else Response(ser.data, status=200)

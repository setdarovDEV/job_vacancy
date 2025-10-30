from django.db import transaction
from django.db.models import Avg, Count, Value
from django.db.models.functions import Coalesce
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, permissions, status, filters as drf_filters
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response

from .filters import CompanyFilter
from .models import (
    Company, CompanyReview, CompanyPhoto,
    InterviewExperience, CompanyFollow
)
from .serializers import (
    CompanySerializer,
    CompanyReviewSerializer,
    CompanyPhotoSerializer,
    InterviewExperienceSerializer
)
from .permissions import IsOwnerOrReadOnly


class TenPerPage(PageNumberPagination):
    page_size = 10


@method_decorator(cache_page(15), name="list")
class CompanyViewSet(viewsets.ModelViewSet):
    """
    Kompaniyalar uchun CRUD, filter, follow, review, photo, interview, va stats endpointlari.
    """
    serializer_class = CompanySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    filter_backends = [DjangoFilterBackend, drf_filters.SearchFilter, drf_filters.OrderingFilter]
    search_fields = ["name", "industry", "location", "description"]
    filterset_class = CompanyFilter
    ordering_fields = ["avg_rating", "followers_count", "vacancies_count", "created_at", "name"]
    ordering = ["-followers_count", "id"]
    pagination_class = TenPerPage
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        """
        Real-time statistikalar bilan kompaniyalar.
        vacancies_count — har doim JobPost modeli orqali sanaladi.
        """
        from vacancies.models import JobPost
        from django.db.models import Avg, Count, Value
        from django.db.models.functions import Coalesce

        qs = (
            Company.objects
            .select_related("owner")
            .annotate(
                reviews_count=Count("reviews", distinct=True),
                followers_count=Count("follows", distinct=True),
                avg_rating=Coalesce(Avg("reviews__rating"), Value(0.0)),
            )
            .order_by("-followers_count", "id")
        )

        # 🟢 kompaniya egasiga qarab job sonini hisoblaymiz
        owner_ids = list(qs.values_list("owner_id", flat=True))
        job_counts = dict(
            JobPost.objects
            .filter(owner_id__in=owner_ids)
            .values("owner_id")
            .annotate(count=Count("id"))
            .values_list("owner_id", "count")
        )

        for c in qs:
            c.vacancies_count = job_counts.get(c.owner_id, 0)

        # 🔹 faqat o‘zining kompaniyalari kerak bo‘lsa
        if self.request.user.is_authenticated and self.request.query_params.get("mine") == "1":
            qs = qs.filter(owner=self.request.user)
        return qs

    def get_serializer_context(self):
        """Serializerga request uzatamiz, rasm URL to‘liq bo‘lishi uchun"""
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    # === REVIEWS ===
    @action(detail=True, methods=["get", "post"], url_path="reviews")
    def reviews(self, request, pk=None):
        company = self.get_object()

        if request.method == "GET":
            qs = company.reviews.select_related("user").only(
                "id", "rating", "text", "country", "created_at",
                "user__id", "user__first_name", "user__last_name"
            ).order_by("-created_at")
            page = self.paginate_queryset(qs)
            ser = CompanyReviewSerializer(page or qs, many=True)
            return self.get_paginated_response(ser.data) if page else Response(ser.data)

        if not request.user.is_authenticated:
            return Response({"detail": "Avtorizatsiya talab qilinadi."}, status=401)

        if CompanyReview.objects.filter(company=company, user=request.user).exists():
            return Response({"detail": "Siz allaqachon sharh qoldirgansiz."}, status=400)

        serializer = CompanyReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            serializer.save(company=company, user=request.user)
        return Response(serializer.data, status=201)

    # === PHOTOS ===
    @action(detail=True, methods=["get", "post"], url_path="photos")
    def photos(self, request, pk=None):
        company = self.get_object()

        if request.method == "GET":
            qs = company.photos.only("id", "image", "caption", "created_at").order_by("-created_at")
            page = self.paginate_queryset(qs)
            ser = CompanyPhotoSerializer(page or qs, many=True, context={"request": request})
            return self.get_paginated_response(ser.data) if page else Response(ser.data)

        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)

        serializer = CompanyPhotoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            serializer.save(company=company)
        return Response(serializer.data, status=201)

    # === INTERVIEWS ===
    @action(detail=True, methods=["get", "post"], url_path="interviews")
    def interviews(self, request, pk=None):
        company = self.get_object()

        if request.method == "GET":
            qs = company.interviews.select_related("user").only(
                "id", "title", "difficulty", "text", "created_at",
                "user__id", "user__first_name", "user__last_name"
            ).order_by("-created_at")
            page = self.paginate_queryset(qs)
            ser = InterviewExperienceSerializer(page or qs, many=True)
            return self.get_paginated_response(ser.data) if page else Response(ser.data)

        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)

        serializer = InterviewExperienceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            serializer.save(company=company, user=request.user)
        return Response(serializer.data, status=201)

    # === FOLLOW / UNFOLLOW ===
    @action(detail=True, methods=["post"], url_path="toggle-follow", permission_classes=[permissions.IsAuthenticated])
    def toggle_follow(self, request, pk=None):
        company = self.get_object()
        with transaction.atomic():
            follow_qs = CompanyFollow.objects.filter(company=company, user=request.user)
            if follow_qs.exists():
                follow_qs.delete()
                is_following = False
            else:
                CompanyFollow.objects.create(company=company, user=request.user)
                is_following = True

        count = CompanyFollow.objects.filter(company=company).count()
        return Response({"is_following": is_following, "followers_count": count}, status=200)

    # === STATS ===
    @action(detail=True, methods=["get"], url_path="stats")
    def stats(self, request, pk=None):
        company = self.get_object()
        is_following = (
            request.user.is_authenticated
            and CompanyFollow.objects.filter(company=company, user=request.user).exists()
        )
        data = {
            "reviews_count": company.reviews.count(),
            "followers_count": company.follows.count(),
            "vacancies_count": company.job_posts.count(),
            "avg_rating": round(company.reviews.aggregate(a=Avg("rating"))["a"] or 0, 2),
            "interviews_count": company.interviews.count(),
            "photos_count": company.photos.count(),
            "is_following": is_following,
        }
        return Response(data, status=200)

    # === TOP COMPANIES ===
    @action(detail=False, methods=["get"], url_path="top")
    def top(self, request):
        limit = int(request.query_params.get("limit", 5))
        qs = (
            Company.objects
            .annotate(
                reviews_count=Count("reviews", distinct=True),
                followers_count=Count("follows", distinct=True),
                vacancies_count=Count("job_posts", distinct=True),
                avg_rating=Coalesce(Avg("reviews__rating"), Value(0.0)),
            )
            .only("id", "name", "industry", "location", "logo")
            .order_by("-followers_count", "id")[:limit]
        )
        ser = self.get_serializer(qs, many=True, context={"request": request})
        return Response(ser.data, status=200)

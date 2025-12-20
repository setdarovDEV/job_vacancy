from django.db import transaction
from django.db.models import Avg, Count, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page, never_cache
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, permissions, status, filters as drf_filters
from rest_framework.decorators import action, api_view
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from vacancies.models import JobPost
from vacancies.serializers import JobPostSerializer
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
        from vacancies.models import JobPost

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

        company_ids = [c.id for c in qs]
        vacancy_counts = dict(
            JobPost.objects.filter(company_id__in=company_ids)
            .values_list("company_id")
            .annotate(count=Count("id"))
        )
        for c in qs:
            c.vacancies_count = vacancy_counts.get(c.id, 0)

        if self.request.user.is_authenticated and self.request.query_params.get("mine") == "1":
            qs = qs.filter(owner=self.request.user)
        return qs

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    # === REVIEWS ===
    @action(
        detail=True,
        methods=["get", "post"],
        url_path="reviews",
        permission_classes=[IsAuthenticatedOrReadOnly],
    )
    def reviews(self, request, pk=None):
        company = self.get_object()

        if request.method == "GET":
            qs = CompanyReview.objects.filter(company=company).order_by("-created_at")
            serializer = CompanyReviewSerializer(qs, many=True, context={"request": request})
            return Response(serializer.data)

        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required"}, status=403)

        # 🔧 bu tekshiruvni to‘g‘ri joyga o‘tkazamiz
        existing = CompanyReview.objects.filter(company=company, user=request.user).first()
        if existing:
            return Response({"detail": "Siz allaqachon bu kompaniyaga izoh qoldirgansiz."}, status=400)

        # 🔧 company va user ni faqat bu yerda set qilamiz
        serializer = CompanyReviewSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save(company=company, user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

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

    @action(detail=True, methods=["get"], url_path="vacancies")
    def vacancies(self, request, pk=None):
        company = self.get_object()

        # 🔹 Faqat shu kompaniyani yaratgan userning vakansiyalari
        qs = JobPost.objects.filter(employer=company.owner).order_by("-created_at")

        page = self.paginate_queryset(qs)
        ser = JobPostSerializer(page or qs, many=True, context={"request": request})

        return self.get_paginated_response(ser.data) if page else Response(ser.data)

    @api_view(['GET'])
    @permission_classes([IsAuthenticatedOrReadOnly])
    def mobile_company_reviews(request, company_id):
        company = get_object_or_404(Company, id=company_id)
        reviews = CompanyReview.objects.filter(company=company).select_related('user').order_by('-created_at')

        data = []
        for review in reviews:
            item = {
                'id': review.id,
                'user': str(review.user.id),
                'user_name': f"{review.user.first_name} {review.user.last_name}".strip() or review.user.username,
                'rating': review.rating,
                'text': review.text,
                'country': review.country,
                'created_at': review.created_at.isoformat(),
            }

            # Avatar URL
            if review.user.profile_image:
                item['user_avatar'] = request.build_absolute_uri(review.user.profile_image.url)
            else:
                item['user_avatar'] = None

            data.append(item)

        return Response(data)
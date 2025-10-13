from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Avg, Count, Value
from django.db.models.functions import Coalesce
from django.db.models import Q

from .models import Company, CompanyReview, CompanyPhoto, InterviewExperience, CompanyFollow
from .serializers import (
    CompanySerializer,
    CompanyReviewSerializer,
    CompanyPhotoSerializer,
    InterviewExperienceSerializer
)
from .permissions import IsOwnerOrReadOnly


class CompanyViewSet(viewsets.ModelViewSet):
    serializer_class = CompanySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'industry', 'location', 'description']

    def get_queryset(self):
        """
        Annotatsiyalarni qo‘llab, SearchFilter ham ishlaydigan versiya.
        """
        qs = super().get_queryset() if hasattr(super(), 'get_queryset') else Company.objects.all()
        qs = qs.annotate(
            reviews_count=Count('reviews', distinct=True),
            followers_count=Count('follows', distinct=True),
            vacancies_count=Count('job_posts', distinct=True),
            avg_rating=Coalesce(Avg('reviews__rating'), Value(0.0)),
        )

        # 🔍 Custom fallback — agar SearchFilter ishlamasa, qo‘lda filter
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(industry__icontains=search)
                | Q(location__icontains=search)
                | Q(description__icontains=search)
            )

        # 🔹 Faqat ownerning kompaniyalari (mine=1)
        if self.request.user.is_authenticated and self.request.query_params.get('mine') == '1':
            qs = qs.filter(owner=self.request.user)

        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    # ---- Reviews ----
    @action(detail=True, methods=['get', 'post'], url_path='reviews',
            permission_classes=[permissions.IsAuthenticatedOrReadOnly])
    def reviews(self, request, pk=None):
        company = self.get_object()
        if request.method == 'GET':
            qs = company.reviews.order_by('-created_at')
            page = self.paginate_queryset(qs)
            ser = CompanyReviewSerializer(page or qs, many=True)
            if page is not None:
                return self.get_paginated_response(ser.data)
            return Response(ser.data)

        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)
        serializer = CompanyReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(company=company, user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # ---- Photos ----
    @action(detail=True, methods=['get', 'post'], url_path='photos',
            permission_classes=[permissions.IsAuthenticatedOrReadOnly])
    def photos(self, request, pk=None):
        company = self.get_object()
        if request.method == 'GET':
            qs = company.photos.order_by('-created_at')
            page = self.paginate_queryset(qs)
            ser = CompanyPhotoSerializer(page or qs, many=True)
            if page is not None:
                return self.get_paginated_response(ser.data)
            return Response(ser.data)

        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)
        serializer = CompanyPhotoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(company=company)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # ---- Interviews ----
    @action(detail=True, methods=['get', 'post'], url_path='interviews',
            permission_classes=[permissions.IsAuthenticatedOrReadOnly])
    def interviews(self, request, pk=None):
        company = self.get_object()
        if request.method == 'GET':
            qs = company.interviews.order_by('-created_at')
            page = self.paginate_queryset(qs)
            ser = InterviewExperienceSerializer(page or qs, many=True)
            if page is not None:
                return self.get_paginated_response(ser.data)
            return Response(ser.data)

        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)
        serializer = InterviewExperienceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(company=company, user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # ---- Follow / Unfollow ----
    @action(detail=True, methods=['post'], url_path='follow', permission_classes=[permissions.IsAuthenticated])
    def follow(self, request, pk=None):
        company = self.get_object()
        _, created = CompanyFollow.objects.get_or_create(company=company, user=request.user)
        followers_count = CompanyFollow.objects.filter(company=company).count()
        return Response({
            "followed": True,
            "followers_count": followers_count,
            "is_following": True
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='unfollow', permission_classes=[permissions.IsAuthenticated])
    def unfollow(self, request, pk=None):
        company = self.get_object()
        CompanyFollow.objects.filter(company=company, user=request.user).delete()
        followers_count = CompanyFollow.objects.filter(company=company).count()
        return Response({
            "followed": False,
            "followers_count": followers_count,
            "is_following": False
        }, status=status.HTTP_200_OK)

    # ---- Stats ----
    @action(detail=True, methods=['get'], url_path='stats')
    def stats(self, request, pk=None):
        company = self.get_object()
        is_following = False
        if request.user.is_authenticated:
            is_following = CompanyFollow.objects.filter(company=company, user=request.user).exists()

        data = {
            "reviews_count": company.reviews.count(),
            "followers_count": company.follows.count(),
            "vacancies_count": company.job_posts.count(),
            "avg_rating": round(company.reviews.aggregate(a=Avg('rating'))['a'] or 0, 2),
            "interviews_count": company.interviews.count(),
            "photos_count": company.photos.count(),
            "is_following": is_following,
        }
        return Response(data)

    @action(detail=False, methods=['get'], url_path='top')
    def top(self, request):
        limit = int(request.query_params.get('limit', 5))
        qs = (Company.objects
              .annotate(
                  reviews_count=Count('reviews', distinct=True),
                  followers_count=Count('follows', distinct=True),
                  vacancies_count=Count('job_posts', distinct=True),
                  avg_rating=Coalesce(Avg('reviews__rating'), Value(0.0)),
              )
              .order_by('-followers_count', 'id')[:limit])
        ser = self.get_serializer(qs, many=True, context={'request': request})
        return Response(ser.data)

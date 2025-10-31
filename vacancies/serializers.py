from rest_framework import serializers
from rest_framework.pagination import PageNumberPagination

from applications.models import JobApplication
from companies.serializers import CompanySerializer
from .models import JobPost, PlanChoices, SavedJob
from django.utils.timesince import timesince
from companies.models import Company
from django.utils.functional import cached_property
from django.utils import timezone

class JobPostSerializer(serializers.ModelSerializer):
    average_stars = serializers.SerializerMethodField()
    user_rating = serializers.SerializerMethodField()
    timeAgo = serializers.SerializerMethodField()
    budget = serializers.SerializerMethodField()
    ratings_count = serializers.SerializerMethodField()
    company = serializers.SerializerMethodField()
    otherVacancies = serializers.SerializerMethodField()

    # 🔥 Yangi maydonlar:
    is_applied = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()

    class Meta:
        model = JobPost
        fields = '__all__'
        read_only_fields = ['employer', 'created_at']

    # ----- Yangi funksiya: foydalanuvchi allaqachon apply qilganmi? -----
    def get_is_applied(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        # related_name mavjud bo‘lsa (applications)
        return JobApplication.objects.filter(job_post=obj, applicant=user).exists()

    # ----- Yangi funksiya: foydalanuvchi saqlaganmi (bookmark)? -----
    def get_is_saved(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        try:
            return SavedJob.objects.filter(job_post=obj, user=user).exists()
        except Exception:
            return False

    def get_average_stars(self, obj):
        return obj.average_stars

    def get_user_rating(self, obj):
        request = self.context.get("request", None)
        if request and not request.user.is_anonymous:
            rating = obj.ratings.filter(user=request.user).first()
            return rating.stars if rating else 0
        return 0

    def get_timeAgo(self, obj):
        return timesince(obj.created_at).split(',')[0] + " назад"

    def get_budget(self, obj):
        if obj.budget_min and obj.budget_max:
            return f"{obj.budget_min} - {obj.budget_max} USD"
        elif obj.budget_min:
            return f"{obj.budget_min}+ USD"
        elif obj.budget_max:
            return f"до {obj.budget_max} USD"
        return "Не указано"

    def get_ratings_count(self, obj):
        return obj.ratings.count()

    def get_company(self, obj):
        company = Company.objects.filter(owner=obj.employer).first()
        if company:
            return CompanySerializer(company, context=self.context).data
        return None

    def get_otherVacancies(self, obj):
        other_qs = (
            obj.__class__.objects
            .filter(employer=obj.employer, is_filled=False)
            .exclude(id=obj.id)[:5]
        )
        return [{"id": v.id, "title": v.title} for v in other_qs]

class TenPerPagePagination(PageNumberPagination):
    page_size = 50

class JobPostPublicSerializer(serializers.ModelSerializer):
    # Mobil uchun “sodda” maydonlar
    budget = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()
    payment_verified = serializers.SerializerMethodField()
    published_ago = serializers.SerializerMethodField()
    timeAgo = serializers.SerializerMethodField()  # backward compatibility
    ratings_count = serializers.SerializerMethodField()
    company = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()

    class Meta:
        model = JobPost
        fields = [
            "id", "title", "description", "skills", "location",
            "rating", "payment_verified", "budget", "published_ago", "timeAgo",
            "ratings_count", "is_remote", "duration", "deadline", "plan", "created_at", "is_saved", "company", "is_draft"
            # kerak bo‘lsa qo‘sh: "average_stars"
        ]
        read_only_fields = fields

    def _fmt_usd(self, v):
        # 1234.00 -> 1234$
        try:
            s = str(v)
            if s.endswith(".00"):
                s = s[:-3]
            return f"{s}$"
        except Exception:
            return f"{v}$"

    def get_budget(self, obj):
        if obj.budget_min and obj.budget_max:
            return f"{self._fmt_usd(obj.budget_min)}–{self._fmt_usd(obj.budget_max)}"
        elif obj.budget_min:
            return f"от {self._fmt_usd(obj.budget_min)}"
        elif obj.budget_max:
            return f"до {self._fmt_usd(obj.budget_max)}"
        return "—"

    def get_rating(self, obj):
        # o‘rtacha yulduz (0..5)
        return obj.average_stars

    def get_payment_verified(self, obj):
        # oddiy qoida: Pro yoki Premium bo‘lsa — verified
        return obj.plan in (PlanChoices.PRO, PlanChoices.PREMIUM)

    def get_published_ago(self, obj):
        # “Опубликовано 2 часа назад”
        return f"Опубликовано {timesince(obj.created_at, timezone.now()).split(',')[0]} назад"

    def get_timeAgo(self, obj):
        # eski nom (agar frontdagi eski kod kerak bo‘lsa)
        return self.get_published_ago(obj)

    def get_ratings_count(self, obj):
        return obj.ratings.count()

    def get_company(self, obj):
        company = Company.objects.filter(owner=obj.employer).first()
        return CompanySerializer(company, context=self.context).data if company else None

    def get_is_saved(self, obj):
        request = self.context.get("request")
        if not request or request.user.is_anonymous:
            return False
        return obj.saved_by.filter(user=request.user).exists()

class SavedJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedJob
        fields = ["id", "job_post", "saved_at"]
        read_only_fields = ["id", "saved_at"]

class JobPostMiniSerializer(serializers.ModelSerializer):
    budget = serializers.SerializerMethodField()

    class Meta:
        model = JobPost
        fields = ['id', 'title', 'budget', 'location', 'created_at']

    def get_budget(self, obj):
        if obj.budget_min and obj.budget_max:
            return f"{obj.budget_min} - {obj.budget_max} USD"
        return "Не указано"

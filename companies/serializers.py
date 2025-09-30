from rest_framework import serializers
from .models import Company, CompanyReview, CompanyFollow, CompanyPhoto, InterviewExperience

# ==== Helper avg rating
from django.db.models import Avg, Count

class CompanySerializer(serializers.ModelSerializer):
    # Frontend kartalar va “Obzor” uchun statistikalar
    reviews_count = serializers.IntegerField(read_only=True)
    followers_count = serializers.IntegerField(read_only=True)
    vacancies_count = serializers.IntegerField(read_only=True)
    avg_rating = serializers.DecimalField(max_digits=3, decimal_places=2, read_only=True)
    logo = serializers.SerializerMethodField()
    is_following    = serializers.SerializerMethodField()


    # Ortiqcha: eski hisob-kitoblar (hire-rate va boshqalar)
    jobpost_count = serializers.SerializerMethodField()
    open_jobpost_count = serializers.SerializerMethodField()
    hire_rate = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = '__all__'
        read_only_fields = ['owner', 'created_at']

    # Agar senga JobPost modeli company FK bilan ulangan bo‘lsa — shu branch ishlaydi.
    def get_jobpost_count(self, obj):
        try:
            from vacancies.models import JobPost
            return JobPost.objects.filter(company=obj).count()
        except Exception:
            # eski kodingda user’ga bog‘langan bo‘lsa — fallback
            return obj.owner.job_posts.count()

    def get_open_jobpost_count(self, obj):
        try:
            from vacancies.models import JobPost
            return JobPost.objects.filter(company=obj, is_filled=False).count()
        except Exception:
            return obj.owner.job_posts.filter(is_filled=False).count()

    def get_hire_rate(self, obj):
        try:
            from vacancies.models import JobPost
            total = JobPost.objects.filter(company=obj).count()
            filled = JobPost.objects.filter(company=obj, is_filled=True).count()
        except Exception:
            total = obj.owner.job_posts.count()
            filled = obj.owner.job_posts.filter(is_filled=True).count()
        if total == 0:
            return "0%"
        return f"{round((filled / total) * 100)}%"

    def get_is_following(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return CompanyFollow.objects.filter(company=obj, user=user).exists()

    def get_logo(self, obj):
        if not obj.logo:
            return None
        request = self.context.get("request")
        url = obj.logo.url  # '/media/company_logos/a.jpg'
        return request.build_absolute_uri(url) if request else url


class CompanyReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = CompanyReview
        fields = ['id', 'company', 'user', 'user_name', 'rating', 'text', 'country', 'created_at']
        read_only_fields = ['user', 'company', 'created_at']


class CompanyPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyPhoto
        fields = ['id', 'company', 'image', 'caption', 'created_at']
        read_only_fields = ['company', 'created_at']


class InterviewExperienceSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = InterviewExperience
        fields = ['id', 'company', 'user', 'user_name', 'title', 'difficulty', 'text', 'created_at']
        read_only_fields = ['user', 'company', 'created_at']

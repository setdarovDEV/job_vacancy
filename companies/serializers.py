from rest_framework import serializers
from .models import Company, CompanyReview, CompanyFollow, CompanyPhoto, InterviewExperience
from django.db.models import Avg, Count

class CompanySerializer(serializers.ModelSerializer):
    reviews_count = serializers.IntegerField(read_only=True)
    followers_count = serializers.IntegerField(read_only=True)
    vacancies_count = serializers.IntegerField(read_only=True)
    avg_rating = serializers.DecimalField(max_digits=3, decimal_places=2, read_only=True)

    # 🟢 Asl fayl maydon (fayl saqlanadi)
    logo = serializers.ImageField(required=False, allow_null=True, use_url=False)

    # 🟢 Faqat o‘qish uchun to‘liq URL
    logo_url = serializers.SerializerMethodField(read_only=True)

    is_following = serializers.SerializerMethodField()
    jobpost_count = serializers.SerializerMethodField()
    open_jobpost_count = serializers.SerializerMethodField()
    hire_rate = serializers.SerializerMethodField()
    vacancies = serializers.SerializerMethodField()  # ✅ qo‘shamiz

    class Meta:
        model = Company
        fields = '__all__'
        read_only_fields = ['owner', 'created_at']

    # 🔹 Rasm uchun to‘liq URL
    def get_logo_url(self, obj):
        request = self.context.get('request')
        if obj.logo:
            url = obj.logo.url
            abs_url = request.build_absolute_uri(url) if request else url
            return abs_url.replace("http://", "https://")
        # 🔹 default logo
        return request.build_absolute_uri("/media/defaults/company_default.png") if request else None

    # 🔹 User follow holati
    def get_is_following(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return CompanyFollow.objects.filter(company=obj, user=user).exists()

    # 🔹 Statistika helperlar
    def get_jobpost_count(self, obj):
        try:
            from vacancies.models import JobPost
            return JobPost.objects.filter(company=obj).count()
        except Exception:
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

    def get_vacancies(self, obj):
        from vacancies.models import JobPost
        qs = JobPost.objects.filter(company=obj).order_by('-created_at')[:3]  # 🔹 faqat so‘nggi 3 ta
        from vacancies.serializers import JobPostMiniSerializer
        return JobPostMiniSerializer(qs, many=True, context=self.context).data

# ✅ Review Serializer with validation & fallback name
class CompanyReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = CompanyReview
        fields = ['id', 'company', 'user', 'user_name', 'rating', 'text', 'country', 'created_at']
        read_only_fields = ['user', 'company', 'created_at']

    def get_user_name(self, obj):
        full = obj.user.get_full_name().strip()
        return full or obj.user.username

    def validate_rating(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Reyting 1 dan 5 gacha bo‘lishi kerak.")
        return value


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

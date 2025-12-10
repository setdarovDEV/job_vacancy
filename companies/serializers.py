# companies/serializers.py
from django.db import IntegrityError
from rest_framework import serializers
from .models import Company, CompanyReview, CompanyFollow, CompanyPhoto, InterviewExperience
from django.db.models import Avg, Count


class CompanySerializer(serializers.ModelSerializer):
    reviews_count = serializers.IntegerField(read_only=True)
    followers_count = serializers.IntegerField(read_only=True)
    avg_rating = serializers.DecimalField(max_digits=3, decimal_places=2, read_only=True)

    # ✅ MUHIM O'ZGARISH - logo endi to'liq URL qaytaradi!
    logo = serializers.SerializerMethodField(read_only=True)
    logo_file = serializers.ImageField(write_only=True, required=False, allow_null=True)

    banner = serializers.SerializerMethodField(read_only=True)
    banner_file = serializers.ImageField(write_only=True, required=False, allow_null=True)

    is_following = serializers.SerializerMethodField()
    jobpost_count = serializers.SerializerMethodField()
    open_jobpost_count = serializers.SerializerMethodField()
    hire_rate = serializers.SerializerMethodField()
    vacancies = serializers.SerializerMethodField()
    vacancies_count = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            'id', 'owner', 'name', 'industry', 'website', 'location',
            'logo', 'logo_file', 'banner', 'banner_file',
            'description', 'created_at',
            'reviews_count', 'followers_count', 'avg_rating',
            'is_following', 'jobpost_count', 'open_jobpost_count',
            'hire_rate', 'vacancies', 'vacancies_count'
        ]
        read_only_fields = ['owner', 'created_at']

    def get_logo(self, obj):
        """✅ To'liq URL qaytarish"""
        if not obj.logo:
            # ✅ Default rasm
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri("/media/defaults/company_default.png")
            return None

        request = self.context.get('request')
        if request:
            url = obj.logo.url
            abs_url = request.build_absolute_uri(url)
            return abs_url.replace("http://", "https://")

        # ✅ Fallback - agar request yo'q bo'lsa
        return f"https://jobvacancy-api.duckdns.org{obj.logo.url}"

    def get_banner(self, obj):
        """✅ Banner uchun ham"""
        if not obj.banner:
            return None

        request = self.context.get('request')
        if request:
            url = obj.banner.url
            abs_url = request.build_absolute_uri(url)
            return abs_url.replace("http://", "https://")

        return f"https://jobvacancy-api.duckdns.org{obj.banner.url}"

    def create(self, validated_data):
        """✅ logo_file va banner_file ni to'g'ri saqlash"""
        logo_file = validated_data.pop('logo_file', None)
        banner_file = validated_data.pop('banner_file', None)

        company = Company.objects.create(**validated_data)

        if logo_file:
            company.logo = logo_file
        if banner_file:
            company.banner = banner_file

        company.save()
        return company

    def update(self, instance, validated_data):
        """✅ Update uchun ham"""
        logo_file = validated_data.pop('logo_file', None)
        banner_file = validated_data.pop('banner_file', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if logo_file:
            instance.logo = logo_file
        if banner_file:
            instance.banner = banner_file

        instance.save()
        return instance

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
        qs = JobPost.objects.filter(company=obj).order_by('-created_at')[:3]
        from vacancies.serializers import JobPostMiniSerializer
        return JobPostMiniSerializer(qs, many=True, context=self.context).data

    def get_vacancies_count(self, obj):
        return obj.job_posts.count()


# ✅ Review Serializer
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
            raise serializers.ValidationError("Reyting 1 dan 5 gacha bo'lishi kerak.")
        return value

    def create(self, validated_data):
        request = self.context.get("request")
        validated_data["user"] = request.user
        try:
            return super().create(validated_data)
        except IntegrityError:
            raise serializers.ValidationError(
                {"detail": "Siz allaqachon bu kompaniyaga izoh qoldirgansiz."}
            )


# ✅ Photo Serializer
class CompanyPhotoSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField(read_only=True)
    image_file = serializers.ImageField(write_only=True, required=True)

    class Meta:
        model = CompanyPhoto
        fields = ['id', 'company', 'image', 'image_file', 'caption', 'created_at']
        read_only_fields = ['company', 'created_at']

    def get_image(self, obj):
        """✅ To'liq URL"""
        if obj.image:
            request = self.context.get('request')
            if request:
                url = obj.image.url
                abs_url = request.build_absolute_uri(url)
                return abs_url.replace("http://", "https://")
            return f"https://jobvacancy-api.duckdns.org{obj.image.url}"
        return None

    def create(self, validated_data):
        image_file = validated_data.pop('image_file')
        photo = CompanyPhoto.objects.create(**validated_data)
        photo.image = image_file
        photo.save()
        return photo


# ✅ Interview Serializer
class InterviewExperienceSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = InterviewExperience
        fields = ['id', 'company', 'user', 'user_name', 'title', 'difficulty', 'text', 'created_at']
        read_only_fields = ['user', 'company', 'created_at']
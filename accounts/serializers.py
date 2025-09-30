from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from headhunter_backend.settings import DEFAULT_FROM_EMAIL
from .models import CustomUser, EmailVerificationCode, LanguageSkill, Education, PortfolioMedia, PortfolioProject, \
    Skill, Certificate, WorkExperience, SkillAnswer
from django.core.mail import send_mail
import random
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class RegisterStepOneSerializer(serializers.ModelSerializer):
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = CustomUser
        fields = ['first_name', 'last_name', 'username', 'password', 'confirm_password']
        extra_kwargs = {'password': {'write_only': True}}

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError("Parollar mos emas")
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        return CustomUser.objects.create_user(**validated_data)

class RegisterStepTwoEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, email):
        if CustomUser.objects.filter(email=email).exists():
            raise serializers.ValidationError("Bu email allaqachon ishlatilgan")
        return email

    def save(self, **kwargs):
        user = self.context['user']
        email = self.validated_data['email']

        # emailni userga yozamiz
        user.email = email
        user.save()

        # random 6 xonali kod yaratamiz
        code = f"{random.randint(100000, 999999)}"

        # kodni saqlaymiz
        EmailVerificationCode.objects.update_or_create(
            user=user,
            defaults={'code': code}
        )

        # ✅ email yuboramiz
        send_mail(
            subject="Tasdiqlash kodingiz",
            message=f"Sizning 2FA tasdiqlash kodingiz: {code}",
            from_email=DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,  # ❗ BU joyga e'tibor
        )

class RegisterStepThreeVerifyCodeSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=6)

    def validate(self, data):
        user = self.context['user']
        try:
            code_obj = EmailVerificationCode.objects.get(user=user, code=data['code'])
        except EmailVerificationCode.DoesNotExist:
            raise serializers.ValidationError("Invalid or expired code")

        user.is_email_verified = True
        user.save()
        code_obj.delete()
        return data

class RegisterStepFourRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=[("JOB_SEEKER", "Job Seeker"), ("EMPLOYER", "Employer")])

    def save(self, **kwargs):
        user = self.context['user']
        user.role = self.validated_data['role']
        user.save()
        return user

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = CustomUser.USERNAME_FIELD

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user

        if not user.is_email_verified:
            raise serializers.ValidationError("Email tasdiqlanmagan.")

        data.update({
            'user_id': user.id,
            'username': user.username,
            'role': user.role,
        })
        return data

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(username=data['username'], password=data['password'])
        if not user:
            raise serializers.ValidationError("Login yoki parol noto‘g‘ri!")

        refresh = RefreshToken.for_user(user)
        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }

class ProfileImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['profile_image']

    def update(self, instance, validated_data):
        # Eski rasm bo‘lsa o‘chiramiz
        if validated_data.get("profile_image") and instance.profile_image:
            instance.profile_image.delete(save=False)

        return super().update(instance, validated_data)


class LanguageSkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = LanguageSkill
        fields = ['id', 'language', 'level']

class EducationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Education
        fields = '__all__'
        read_only_fields = ['user']

class CustomUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name',
            'profile_image', 'title', 'salary_usd', 'about_me'  # 🆕 qo‘shildi
        ]

class PortfolioMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortfolioMedia
        fields = ['id', 'file', 'file_type', 'project']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if request:
            data['file'] = request.build_absolute_uri(instance.file.url)
        return data

class PortfolioProjectSerializer(serializers.ModelSerializer):
    media_files = PortfolioMediaSerializer(many=True, read_only=True)

    class Meta:
        model = PortfolioProject
        fields = ['id', 'user', 'title', 'description', 'skills', 'media_files', 'created_at']
        read_only_fields = ['user']

class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ['id', 'name']

class SkillAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = SkillAnswer
        fields = ['id', 'user', 'skill', 'answer']
        read_only_fields = ['user']


class BulkSkillSerializer(serializers.Serializer):
    skills = serializers.ListField(child=serializers.CharField(max_length=100))

class CertificateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Certificate
        fields = '__all__'
        read_only_fields = ['user']

class WorkExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkExperience
        fields = '__all__'
        read_only_fields = ['user']

class UserPublicSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ("id", "username", "first_name", "last_name", "full_name", "avatar_url")

    def get_full_name(self, obj):
        return f"{obj.first_name or ''} {obj.last_name or ''}".strip()

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        avatar = getattr(obj, "avatar", None)
        if not avatar:
            return None
        url = avatar.url
        return request.build_absolute_uri(url) if request else url

def abs_url(request, raw):
    if not raw:
        return ""
    raw = str(raw)
    if raw.startswith("http"):
        return raw
    if request is None:
        return raw
    base = request.build_absolute_uri("/")[:-1]
    return f"{base}{raw}"


class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    bio = serializers.SerializerMethodField()
    position = serializers.SerializerMethodField()
    skills = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ["id", "full_name", "avatar", "bio", "position", "skills"]

    # --- helpers ---
    def _first(self, *vals):
        for v in vals:
            if v:
                return v
        return None

    def get_full_name(self, obj):
        fn = getattr(obj, "full_name", None)
        if callable(fn):
            try:
                v = fn()
                if v:
                    return v
            except Exception:
                pass
        if isinstance(fn, str) and fn:
            return fn
        return f"{getattr(obj,'first_name','')} {getattr(obj,'last_name','')}".strip() or "—"

    def get_avatar(self, obj):
        request = self.context.get("request")
        prof = getattr(obj, "profile", None)
        candidates = [
            getattr(obj, "avatar", None),
            getattr(obj, "photo", None),
            getattr(obj, "image", None),
            getattr(obj, "profile_image", None),
            getattr(prof, "avatar", None) if prof else None,
            getattr(prof, "photo", None) if prof else None,
            getattr(prof, "image", None) if prof else None,
            getattr(prof, "profile_image", None) if prof else None,
        ]
        for c in candidates:
            if c:
                return abs_url(request, getattr(c, "url", c))
        return ""

    def get_bio(self, obj):
        prof = getattr(obj, "profile", None)
        return self._first(
            getattr(obj, "bio", None),
            getattr(obj, "about", None),
            getattr(obj, "summary", None),
            getattr(prof, "about_me", None) if prof else None,
            getattr(prof, "bio", None) if prof else None,
            getattr(prof, "about", None) if prof else None,
            getattr(prof, "description", None) if prof else None,
            getattr(prof, "headline", None) if prof else None,
            getattr(prof, "summary", None) if prof else None,
        ) or "—"

    def get_position(self, obj):
        prof = getattr(obj, "profile", None)
        return (
            getattr(prof, "position", None)
            or getattr(prof, "title", None)
            or getattr(obj, "title", None)
            or "—"
        )

    def get_skills(self, obj):
        prof = getattr(obj, "profile", None)
        sk = getattr(obj, "skills", None)
        if hasattr(sk, "all"):
            return list(sk.values_list("name", flat=True))
        if prof:
            psk = getattr(prof, "skills", None)
            if hasattr(psk, "all"):
                return list(psk.values_list("name", flat=True))
            if isinstance(psk, str):
                return [s for s in psk.replace(",", " ").split() if s]
            if isinstance(psk, list):
                return psk
        return []
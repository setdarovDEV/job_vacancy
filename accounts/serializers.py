import os
import random

from django.contrib.auth import authenticate
from django.core.mail import send_mail
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

# from headhunter_backend.settings import DEFAULT_FROM_EMAIL
from .models import CustomUser, EmailVerificationCode, LanguageSkill, Education, PortfolioMedia, PortfolioProject, \
    Skill, Certificate, WorkExperience, SkillAnswer


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

    def save(self, **kwargs):
        user = self.context['user']
        email = self.validated_data['email']

        user.email = email
        user.save(update_fields=["email"])
        code = f"{random.randint(100000, 999999)}"

        EmailVerificationCode.objects.update_or_create(
            user=user,
            defaults={'code': code}
        )

        # ✅ Resend orqali yuborish
        print(f"📧 Sending email to {email} with code: {code}")
        try:
            send_verification_email(
                email=email,
                code=code,
                subject="Job Vacancy - Ro'yxatdan o'tish kodi",
                title="Ro'yxatdan o'tish"
            )
            print(f"✅ Email sent successfully!")
        except Exception as e:
            print(f"❌ Email error: {e}")
            raise serializers.ValidationError(f"Email yuborishda xato: {str(e)}")

        return {"detail": "Tasdiqlash kodi yuborildi"}

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
            raise serializers.ValidationError("Login yoki parol noto'g'ri!")

        # ❗️email tasdiqlanmaganini tekshirish
        if not user.is_email_verified:
            raise serializers.ValidationError("Email tasdiqlanmagan.")

        refresh = RefreshToken.for_user(user)

        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "role": user.role or "JOB_SEEKER",
            "username": user.username,
            "user_id": str(user.id),
        }


class ProfileImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['profile_image']

    def update(self, instance, validated_data):
        # Eski rasm bo'lsa o'chiramiz
        if validated_data.get("profile_image") and instance.profile_image:
            instance.profile_image.delete(save=False)

        return super().update(instance, validated_data)


# serializers.py
class PortfolioMediaSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PortfolioMedia
        fields = ['id', 'file', 'file_type', 'file_url']
        read_only_fields = ['id', 'file_url']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and hasattr(obj.file, 'url'):
            if request:
                return request.build_absolute_uri(obj.file.url)
            # fallback: agar request yo'q bo'lsa ham nisbiy yo'lni qaytarmaymiz
            from django.conf import settings
            base = os.environ.get("RENDER_EXTERNAL_URL", "").rstrip("/")
            return f"{base}{obj.file.url}" if base else obj.file.url
        return None


class PortfolioProjectSerializer(serializers.ModelSerializer):
    media_files = serializers.SerializerMethodField()

    class Meta:
        model = PortfolioProject
        fields = ['id', 'user', 'title', 'description', 'skills', 'created_at', 'media_files']
        read_only_fields = ['id', 'user', 'created_at']

    def get_media_files(self, obj):
        # 👇 MUHIM: context=self.context bilan ichki serializerga requestni beramiz
        qs = obj.media_files.all().order_by('-id')
        return PortfolioMediaSerializer(qs, many=True, context=self.context).data


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
            'profile_image', 'title', 'salary_usd', 'about_me'  # 🆕 qo'shildi
        ]


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
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = ['id', 'name', 'organization', 'issue_date', 'file', 'file_url']
        read_only_fields = ['id', 'user', 'file_url']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and hasattr(obj.file, 'url'):
            return request.build_absolute_uri(obj.file.url) if request else obj.file.url
        return None


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
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "full_name",
            "avatar_url",
            "role",  # ✅ muhim: roleni qaytaramiz
            "is_online",
            "last_seen",
        )

    def get_full_name(self, obj):
        return f"{obj.first_name or ''} {obj.last_name or ''}".strip() or obj.username

    def get_avatar_url(self, obj):
        """
        Profil rasmi uchun to'liq URL qaytaradi (agar mavjud bo'lsa)
        """
        request = self.context.get("request")

        # 🔹 To'g'ri maydon — bizda avatar emas, profile_image
        if obj.profile_image:
            try:
                url = obj.profile_image.url
                return request.build_absolute_uri(url) if request else url
            except Exception:
                return None
        return None


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


# accounts/serializers.py
# serializers.py
class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    skills = serializers.SerializerMethodField()
    languages = serializers.SerializerMethodField()
    educations = serializers.SerializerMethodField()
    certificates = serializers.SerializerMethodField()
    portfolio = serializers.SerializerMethodField()
    experiences = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            "id", "username", "role", "full_name", "avatar",
            "title", "about_me", "salary_usd", "work_hours_per_week",
            "is_online", "last_seen", "latitude", "longitude",
            "skills", "languages", "educations", "certificates",
            "portfolio", "experiences",
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name or ''} {obj.last_name or ''}".strip() or obj.username

    def get_avatar(self, obj):
        request = self.context.get("request")
        if obj.profile_image:
            url = obj.profile_image.url
            return request.build_absolute_uri(url) if request else url
        return None

    def get_skills(self, obj):
        skills = getattr(obj, "pref_skills", None)
        if skills is not None:
            return [s.name for s in skills]
        return [s.name for s in obj.skills.all()]

    def get_languages(self, obj):
        langs = getattr(obj, "pref_languages", None)
        if langs is not None:
            return LanguageSkillSerializer(langs, many=True).data
        return LanguageSkillSerializer(obj.languages.all(), many=True).data

    def get_educations(self, obj):
        edus = getattr(obj, "pref_educations", None)
        if edus is not None:
            return EducationSerializer(edus, many=True).data
        return EducationSerializer(obj.educations.all(), many=True).data

    def get_certificates(self, obj):
        certs = getattr(obj, "pref_certificates", None)
        if certs is not None:
            return CertificateSerializer(certs, many=True, context=self.context).data
        return CertificateSerializer(obj.certificates.all(), many=True, context=self.context).data

    def get_portfolio(self, obj):
        projects = getattr(obj, "pref_portfolio", None)
        if projects is not None:
            return PortfolioProjectSerializer(projects, many=True, context=self.context).data
        return PortfolioProjectSerializer(obj.portfolio_projects.all(), many=True, context=self.context).data

    def get_experiences(self, obj):
        exp = getattr(obj, "pref_experiences", None)
        if exp is not None:
            return WorkExperienceSerializer(exp, many=True).data
        return WorkExperienceSerializer(obj.experiences.all(), many=True).data


def send_verification_email(email, code, subject="Job Vacancy - Tasdiqlash kodi", title="Ro'yxatdan o'tish"):
    """
    Resend.com orqali universal email yuborish funksiyasi
    """
    import resend
    from django.conf import settings

    api_key = settings.RESEND_API_KEY
    if not api_key:
        print("⚠️ RESEND_API_KEY topilmadi!")
        raise Exception("RESEND_API_KEY sozlanmagan!")

    resend.api_key = api_key

    try:
        params = {
            "from": "Job Vacancy <onboarding@resend.dev>",
            "to": [email],
            "subject": subject,
            "html": f"""
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #3066BE 0%, #4A90E2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
                        <h2 style="color: white; margin: 0; text-align: center;">Job Vacancy Platform</h2>
                    </div>
                    <div style="background: #f8f9fa; padding: 40px; border-radius: 0 0 10px 10px;">
                        <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                            Assalomu alaykum! <strong>{title}</strong> uchun quyidagi kodni kiriting:
                        </p>
                        <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
                            <p style="color: #666; margin: 0 0 10px 0; font-size: 14px;">Tasdiqlash kodi:</p>
                            <h1 style="color: #3066BE; font-size: 48px; letter-spacing: 10px; margin: 10px 0; font-weight: bold;">{code}</h1>
                        </div>
                        <p style="color: #666; font-size: 14px; margin-top: 30px; text-align: center;">
                            ⏰ Bu kod <strong>30 daqiqa</strong> amal qiladi.
                        </p>
                        <p style="color: #999; font-size: 12px; margin-top: 20px; text-align: center; border-top: 1px solid #ddd; padding-top: 20px;">
                            Agar bu so'rovni siz yubormagan bo'lsangiz, ushbu xabarni e'tiborsiz qoldiring.
                        </p>
                    </div>
                </div>
            """
        }
        response = resend.Emails.send(params)
        print(f"✅ Resend email yuborildi: {response}")
        return response
    except Exception as e:
        print(f"❌ Resend email yuborishda xato: {str(e)}")
        raise
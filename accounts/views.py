import random
import threading
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.views.decorators.cache import cache_page
from jwt.utils import force_bytes
from django.core.cache import cache
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import (
    IsAuthenticated, IsAuthenticatedOrReadOnly, AllowAny
)
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions, viewsets, generics, serializers
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from headhunter_backend.settings import DEFAULT_FROM_EMAIL
from .serializers import (
    RegisterStepOneSerializer,
    RegisterStepTwoEmailSerializer,
    RegisterStepThreeVerifyCodeSerializer,
    RegisterStepFourRoleSerializer, LoginSerializer, ProfileImageSerializer,
    LanguageSkillSerializer, EducationSerializer, PortfolioProjectSerializer,
    PortfolioMediaSerializer, SkillSerializer, BulkSkillSerializer,
    CertificateSerializer, WorkExperienceSerializer, SkillAnswerSerializer,
    UserPublicSerializer, UserProfileSerializer,
)
from .models import (
    CustomUser, EmailVerificationCode, LanguageSkill, Education,
    PortfolioProject, PortfolioMedia, Skill, Certificate, WorkExperience,
    SkillAnswer
)

User = get_user_model()
token_generator = PasswordResetTokenGenerator()


# ---------------- REGISTER STEPS ----------------
class RegisterStepOneView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterStepOneSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({"message": "Step 1 muvaffaqiyatli", "user_id": user.id}, status=201)
        return Response(serializer.errors, status=400)


class RegisterStepTwoEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, user_id):
        try:
            user = CustomUser.objects.only("id", "email").get(id=user_id)
        except CustomUser.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        serializer = RegisterStepTwoEmailSerializer(data=request.data, context={"user": user})
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Tasdiqlash kodi yuborildi"}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=400)


class RegisterStepThreeVerifyCodeView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, user_id):
        try:
            user = CustomUser.objects.only("id").get(id=user_id)
        except CustomUser.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        serializer = RegisterStepThreeVerifyCodeSerializer(data=request.data, context={"user": user})
        if serializer.is_valid():
            return Response({"message": "Email verified"}, status=200)
        return Response(serializer.errors, status=400)


class RegisterStepFourRoleView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, user_id):
        try:
            user = CustomUser.objects.only("id", "role").get(id=user_id)
        except CustomUser.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        serializer = RegisterStepFourRoleSerializer(data=request.data, context={"user": user})
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Registration completed"}, status=200)
        return Response(serializer.errors, status=400)


# ---------------- EMAIL VERIFICATION ----------------
class ResendVerificationCodeView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, user_id):
        try:
            user = CustomUser.objects.only("id", "email").get(id=user_id)
        except CustomUser.DoesNotExist:
            return Response({"error": "Foydalanuvchi topilmadi"}, status=404)

        if not user.email:
            return Response({"error": "Email manzili mavjud emas"}, status=400)

        code = f"{random.randint(100000, 999999)}"

        EmailVerificationCode.objects.update_or_create(
            user=user, defaults={'code': code}
        )

        # threading — email yuborishni tezlashtiradi
        threading.Thread(
            target=lambda: send_mail(
                subject="Qayta yuborilgan tasdiqlash kodingiz",
                message=f"Sizning yangi tasdiqlash kodingiz: {code}",
                from_email=DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )
        ).start()

        return Response({"message": "Kod qayta yuborildi"}, status=200)


# ---------------- LOGIN / LOGOUT ----------------
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            return Response(serializer.validated_data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"detail": "Chiqildi"}, status=status.HTTP_205_RESET_CONTENT)
        except KeyError:
            return Response({"detail": "Refresh token yo‘q"}, status=status.HTTP_400_BAD_REQUEST)
        except TokenError:
            return Response({"detail": "Noto‘g‘ri token"}, status=status.HTTP_400_BAD_REQUEST)


# ---------------- PASSWORD RESET ----------------
class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"detail": "Email kiriting."}, status=400)

        try:
            user = User.objects.only("id", "email").get(email=email)
        except User.DoesNotExist:
            return Response({"detail": "Bunday email mavjud emas."}, status=404)

        uid = urlsafe_base64_encode(force_bytes(str(user.pk)))
        token = token_generator.make_token(user)
        reset_url = f"http://localhost:5173/reset-password/{uid}/{token}/"

        threading.Thread(
            target=lambda: send_mail(
                subject="Parolni tiklash havolasi",
                message=f"Sizning parolingizni tiklash havolasi: {reset_url}",
                from_email=DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )
        ).start()

        return Response({"detail": "Parolni tiklash havolasi yuborildi."})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        uid = request.data.get("uid")
        token = request.data.get("token")
        password = request.data.get("password")

        if not (uid and token and password):
            return Response({"detail": "Barcha maydonlar talab qilinadi."}, status=400)

        try:
            user_id = urlsafe_base64_decode(uid).decode()
            user = User.objects.get(pk=user_id)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Noto‘g‘ri link."}, status=400)

        if not token_generator.check_token(user, token):
            return Response({"detail": "Token noto‘g‘ri yoki eskirgan."}, status=400)

        user.set_password(password)
        user.save()
        return Response({"detail": "Parol yangilandi."}, status=200)


# ---------------- PROFILE & UPDATES ----------------
class ProfileImageUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        user = request.user
        serializer = ProfileImageSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            full_url = request.build_absolute_uri(user.profile_image.url)
            return Response({"detail": "Profil rasmi yangilandi", "image": full_url})
        return Response(serializer.errors, status=400)


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        return Response({
            "id": u.id,
            "full_name": f"{u.first_name} {u.last_name}",
            "email": u.email,
            "username": u.username,
            "role": u.role,
            "profile_image": request.build_absolute_uri(u.profile_image.url) if u.profile_image else None,
            "latitude": u.latitude,
            "longitude": u.longitude,
            "work_hours_per_week": u.work_hours_per_week,
            "title": u.title,
            "about_me": u.about_me,
            "salary_usd": u.salary_usd,
            "last_seen": u.last_seen,
            "is_online": u.is_online,
        })


# ---------------- SIMPLE PATCH VIEWS ----------------
class UpdateLocationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        latitude = request.data.get("latitude")
        longitude = request.data.get("longitude")

        if latitude is None or longitude is None:
            return Response({"error": "Koordinatalar yuborilmadi"}, status=400)

        user = request.user
        user.latitude = latitude
        user.longitude = longitude
        user.save(update_fields=["latitude", "longitude"])
        return Response({"message": "Joylashuv saqlandi ✅"})


class UpdateWorkHoursView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        hours = request.data.get("work_hours_per_week")
        if not hours:
            return Response({"error": "Ish vaqti bo‘sh bo‘lishi mumkin emas"}, status=400)

        u = request.user
        u.work_hours_per_week = hours
        u.save(update_fields=["work_hours_per_week"])
        return Response({"message": "Ish vaqti yangilandi ✅", "work_hours_per_week": u.work_hours_per_week})


class UpdateTitleView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        title = request.data.get('title')
        if not title:
            return Response({'error': 'Title is required'}, status=400)
        u = request.user
        u.title = title.strip()
        u.save(update_fields=["title"])
        return Response({'message': 'Title updated successfully ✅', "title": u.title})


class UpdateSalaryView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        salary = request.data.get('salary_usd')
        if not salary:
            return Response({'error': 'Salary is required'}, status=400)
        u = request.user
        u.salary_usd = salary
        u.save(update_fields=["salary_usd"])
        return Response({'message': 'Salary updated ✅', "salary_usd": u.salary_usd})


class UpdateAboutMeView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        about = request.data.get("about_me")
        if about is None:
            return Response({"error": "About me is required"}, status=400)
        u = request.user
        u.about_me = about.strip()
        u.save(update_fields=["about_me"])
        return Response({"message": "About me updated ✅", "about_me": u.about_me})


# ---------------- MODEL VIEWSETS ----------------
class LanguageSkillViewSet(viewsets.ModelViewSet):
    serializer_class = LanguageSkillSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return LanguageSkill.objects.none()
        return LanguageSkill.objects.filter(user=user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class EducationViewSet(viewsets.ModelViewSet):
    serializer_class = EducationSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Education.objects.none()
        return Education.objects.filter(user=user).order_by('-start_year')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SkillViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        skills = Skill.objects.filter(user=request.user).only("id", "name")
        serializer = SkillSerializer(skills, many=True)
        return Response(serializer.data)

    def create(self, request):
        serializer = BulkSkillSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data['skills']
            existing = set(Skill.objects.filter(user=request.user).values_list('name', flat=True))
            new = [Skill(user=request.user, name=n) for n in data if n not in existing]
            with transaction.atomic():
                Skill.objects.bulk_create(new, ignore_conflicts=True)
            return Response({"detail": "Yangi skill(lar) qo‘shildi!"}, status=201)
        return Response(serializer.errors, status=400)


class SkillAnswerViewSet(viewsets.ModelViewSet):
    serializer_class = SkillAnswerSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return self.queryset.none()
        return self.queryset.filter(user=user)

    def perform_create(self, serializer):
        skill = serializer.validated_data["skill"]
        answer = serializer.validated_data["answer"]
        SkillAnswer.objects.update_or_create(
            user=self.request.user, skill=skill, defaults={"answer": answer}
        )

class CertificateViewSet(viewsets.ModelViewSet):
    serializer_class = CertificateSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]  # 🟩 FAYLLARNI QABUL QILISH UCHUN

    def get_queryset(self):
        return Certificate.objects.filter(user=self.request.user).order_by('-issue_date')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class WorkExperienceViewSet(viewsets.ModelViewSet):
    serializer_class = WorkExperienceSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return WorkExperience.objects.none()
        return WorkExperience.objects.filter(user=user).order_by('-start_date')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# ---------------- SEARCH / PROFILE DETAIL ----------------
@method_decorator(cache_page(30), name='get')
class UserSearchView(generics.ListAPIView):
    serializer_class = UserPublicSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        q = (self.request.query_params.get("q") or "").strip()
        if not q:
            return User.objects.none()

        cache_key = f"user_search:{q}:{self.request.user.id}"
        cached = cache.get(cache_key)
        if cached:
            return cached

        base = Q(username__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q)
        parts = q.split()
        if len(parts) >= 2:
            a, b = parts[0], parts[1]
            base |= (Q(first_name__icontains=a) & Q(last_name__icontains=b)) | (Q(first_name__icontains=b) & Q(last_name__icontains=a))

        queryset = User.objects.filter(base).exclude(
            Q(username="admin") | Q(id=self.request.user.id)
        ).only("id", "first_name", "last_name", "username", "profile_image", "is_online", "last_seen")

        cache.set(cache_key, queryset, timeout=60)
        return queryset


@method_decorator(cache_page(60), name='get')
class UserProfileDetailView(generics.RetrieveAPIView):
    queryset = CustomUser.objects.only("id", "first_name", "last_name", "title", "profile_image", "about_me", "is_online", "last_seen")
    serializer_class = UserProfileSerializer
    lookup_field = "id"
    permission_classes = [IsAuthenticatedOrReadOnly]


class UpdateOnlineStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        is_online = request.data.get("is_online", True)
        user = request.user
        user.is_online = bool(is_online)
        if not is_online:
            user.last_seen = timezone.now()
        user.save(update_fields=["is_online", "last_seen"])
        return Response({
            "is_online": user.is_online,
            "last_seen": user.last_seen,
        })

class ProfileView(APIView):
    """
    Foydalanuvchining profil maʼlumotlarini (view only) ko‘rsatadi.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "profile_image": request.build_absolute_uri(user.profile_image.url) if user.profile_image else None,
            "title": user.title,
            "about_me": user.about_me,
            "salary_usd": user.salary_usd,
            "work_hours_per_week": user.work_hours_per_week,
            "latitude": user.latitude,
            "longitude": user.longitude,
            "is_online": user.is_online,
            "last_seen": user.last_seen,
        })

class PortfolioProjectViewSet(viewsets.ModelViewSet):
    queryset = PortfolioProject.objects.all().order_by('-created_at')
    serializer_class = PortfolioProjectSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def get_queryset(self):
        """
        Foydalanuvchining faqat o‘z loyihalarini ko‘rsatish (agar `?mine=1` bo‘lsa)
        """
        qs = super().get_queryset()
        user = self.request.user
        if user.is_authenticated and self.request.query_params.get('mine') == '1':
            qs = qs.filter(user=user)
        return qs


class PortfolioMediaViewSet(viewsets.ModelViewSet):
    serializer_class = PortfolioMediaSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        project_id = self.request.query_params.get("project")
        qs = PortfolioMedia.objects.all().select_related("project", "project__user").order_by("-id")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs

    def perform_create(self, serializer):
        project_id = self.request.data.get("project")
        if not project_id:
            raise serializers.ValidationError({"detail": "project maydoni majburiy"})

        file_obj = self.request.FILES.get("file")
        if not file_obj:
            raise serializers.ValidationError({"detail": "Fayl yuborilmadi"})

        serializer.save(project_id=project_id, file=file_obj)

# accounts/views.py
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        current = request.data.get("current_password")
        new = request.data.get("new_password")
        confirm = request.data.get("confirm_password")

        if not all([current, new, confirm]):
            return Response({"error": "All fields required"}, status=400)
        if new != confirm:
            return Response({"error": "Passwords do not match"}, status=400)
        if not request.user.check_password(current):
            return Response({"error": "Current password incorrect"}, status=400)

        request.user.set_password(new)
        request.user.save()
        return Response({"message": "Password changed successfully ✅"})

class UpdateEmailSendView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        new_email = request.data.get("new_email")
        if not new_email:
            return Response({"error": "Email is required"}, status=400)

        code = f"{random.randint(100000, 999999)}"
        EmailVerificationCode.objects.update_or_create(
            user=request.user,
            defaults={"code": code}
        )

        send_mail(
            subject="Код для смены E-mail",
            message=f"Ваш код подтверждения: {code}",
            from_email=DEFAULT_FROM_EMAIL,
            recipient_list=[new_email],
            fail_silently=True,
        )

        cache.set(f"email_change:{request.user.id}", new_email, timeout=300)
        return Response({"message": "Код отправлен на новый E-mail"})

class UpdateEmailVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        code = request.data.get("code")
        if not code:
            return Response({"error": "Код обязателен"}, status=400)

        try:
            rec = EmailVerificationCode.objects.get(user=request.user, code=code)
        except EmailVerificationCode.DoesNotExist:
            return Response({"error": "Неверный код"}, status=400)

        new_email = cache.get(f"email_change:{request.user.id}")
        if not new_email:
            return Response({"error": "Код истёк или не найден"}, status=400)

        request.user.email = new_email
        request.user.is_email_verified = True
        request.user.save()
        rec.delete()
        cache.delete(f"email_change:{request.user.id}")

        return Response({"message": "E-mail успешно изменен ✅"})

class UpdateUsernameView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        current_username = request.data.get("current_username")
        new_username = request.data.get("new_username")

        if not all([current_username, new_username]):
            return Response({"error": "Оба поля обязательны"}, status=400)
        if request.user.username != current_username:
            return Response({"error": "Текущий логин неверен"}, status=400)
        if CustomUser.objects.filter(username=new_username).exclude(id=request.user.id).exists():
            return Response({"error": "Имя пользователя уже занято"}, status=400)

        request.user.username = new_username
        request.user.save(update_fields=["username"])
        return Response({"message": "Имя пользователя обновлено ✅"})

class UpdateNameView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        first = request.data.get("first_name")
        last = request.data.get("last_name")

        if not first and not last:
            return Response({"error": "Имя или фамилия обязательны"}, status=400)

        user = request.user
        if first:
            user.first_name = first.strip()
        if last:
            user.last_name = last.strip()
        user.save(update_fields=["first_name", "last_name"])
        return Response({"message": "Имя и фамилия успешно обновлены ✅"})

class DeleteUserByUsernameView(APIView):
    """
    Admin foydalanuvchi username orqali istalgan userni o‘chiradi.
    Body: { "username": "test_user" }
    """
    permission_classes = [permissions.IsAdminUser]

    def delete(self, request):
        username = request.data.get("username")
        if not username:
            return Response({"error": "Username kerak"}, status=400)

        try:
            user = CustomUser.objects.get(username=username)
        except CustomUser.DoesNotExist:
            return Response({"error": "Foydalanuvchi topilmadi"}, status=404)

        user.delete()
        return Response({"message": f"Foydalanuvchi '{username}' muvaffaqiyatli o‘chirildi ✅"})

import random

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
from django.db.models import Q
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from jwt.utils import force_bytes
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions, viewsets, generics
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import AllowAny


from headhunter_backend.settings import DEFAULT_FROM_EMAIL
from .serializers import (
    RegisterStepOneSerializer,
    RegisterStepTwoEmailSerializer,
    RegisterStepThreeVerifyCodeSerializer,
    RegisterStepFourRoleSerializer, LoginSerializer, ProfileImageSerializer, LanguageSkillSerializer,
    EducationSerializer, PortfolioProjectSerializer, PortfolioMediaSerializer, SkillSerializer, BulkSkillSerializer,
    CertificateSerializer, WorkExperienceSerializer, SkillAnswerSerializer, UserPublicSerializer, UserProfileSerializer,
)
from .models import CustomUser, EmailVerificationCode, LanguageSkill, Education, PortfolioProject, PortfolioMedia, \
    Skill, Certificate, WorkExperience, SkillAnswer

User = get_user_model()
token_generator = PasswordResetTokenGenerator()

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
            user = CustomUser.objects.get(id=user_id)
        except CustomUser.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        serializer = RegisterStepTwoEmailSerializer(data=request.data, context={"user": user})
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Verification code sent to email"}, status=200)
        return Response(serializer.errors, status=400)

class RegisterStepThreeVerifyCodeView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, user_id):
        try:
            user = CustomUser.objects.get(id=user_id)
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
            user = CustomUser.objects.get(id=user_id)
        except CustomUser.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        serializer = RegisterStepFourRoleSerializer(data=request.data, context={"user": user})
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Registration completed"}, status=200)
        return Response(serializer.errors, status=400)

class ResendVerificationCodeView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, user_id):
        try:
            user = CustomUser.objects.get(id=user_id)
        except CustomUser.DoesNotExist:
            return Response({"error": "Foydalanuvchi topilmadi"}, status=404)

        if not user.email:
            return Response({"error": "Email manzili mavjud emas"}, status=400)

        code = f"{random.randint(100000, 999999)}"

        EmailVerificationCode.objects.update_or_create(
            user=user,
            defaults={'code': code}
        )

        send_mail(
            subject="Qayta yuborilgan tasdiqlash kodingiz",
            message=f"Sizning yangi tasdiqlash kodingiz: {code}",
            from_email=DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )

        return Response({"message": "Kod qayta yuborildi"}, status=200)

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            return Response(serializer.validated_data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"detail": "Email kiriting."}, status=400)

        try:
            user = User.objects.get(email=email)
            uid = urlsafe_base64_encode(force_bytes(str(user.pk)))  # 🟢 SHU YERNI YANGILADIK
            token = token_generator.make_token(user)
            reset_url = f"http://localhost:5173/reset-password/{uid}/{token}/"

            send_mail(
                subject="Parolni tiklash havolasi",
                message=f"Sizning parolingizni tiklash havolasi: {reset_url}",
                from_email=DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
            )
            return Response({"detail": "Parolni tiklash havolasi yuborildi."})
        except User.DoesNotExist:
            return Response({"detail": "Bunday email mavjud emas."}, status=404)

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

class ProfileImageUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        user = request.user
        serializer = ProfileImageSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            full_url = request.build_absolute_uri(user.profile_image.url)
            return Response({
                "detail": "Profil rasmi yangilandi",
                "image": full_url
            })
        return Response(serializer.errors, status=400)


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "profile_image": user.profile_image.url if user.profile_image else None,
            "detail": "Profil rasmi yangilandi"
        })


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "id": user.id,
            "full_name": f"{user.first_name} {user.last_name}",
            "email": user.email,
            "username": user.username,
            "role": user.role,
            "profile_image": user.profile_image.url if user.profile_image else None,
            "latitude": user.latitude,
            "longitude": user.longitude,
            "work_hours_per_week": user.work_hours_per_week,
            "title": user.title,

        })


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
        user.save()

        return Response({"message": "Joylashuv saqlandi ✅"})

class UpdateWorkHoursView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        work_hours = request.data.get("work_hours_per_week")
        if not work_hours:
            return Response({"error": "Ish vaqti bo‘sh bo‘lishi mumkin emas"}, status=400)

        user = request.user
        user.work_hours_per_week = work_hours
        user.save()

        return Response({"message": "Ish vaqti yangilandi ✅", "work_hours_per_week": user.work_hours_per_week})

class LanguageSkillViewSet(viewsets.ModelViewSet):
    serializer_class = LanguageSkillSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return LanguageSkill.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class EducationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]  # ✅ SHU BORLIGINI TEKSHIR
    serializer_class = EducationSerializer

    def get_queryset(self):
        return Education.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class UpdateTitleView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        title = request.data.get('title')
        if not title:
            return Response({'error': 'Title is required'}, status=status.HTTP_400_BAD_REQUEST)

        request.user.title = title
        request.user.save()
        return Response({'message': 'Title updated successfully'}, status=status.HTTP_200_OK)

class UpdateSalaryView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        salary = request.data.get('salary_usd')
        if salary is None:
            return Response({'error': 'Salary is required'}, status=400)

        request.user.salary_usd = salary
        request.user.save()
        return Response({'message': 'Salary updated successfully'}, status=200)

class UpdateAboutMeView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        about = request.data.get("about_me")
        if about is None:
            return Response({"error": "About me is required"}, status=400)

        request.user.about_me = about
        request.user.save()
        return Response({"message": "About me updated successfully"}, status=200)

class PortfolioProjectViewSet(viewsets.ModelViewSet):
    serializer_class = PortfolioProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return PortfolioProject.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PortfolioMediaViewSet(viewsets.ModelViewSet):
    queryset = PortfolioMedia.objects.all()
    serializer_class = PortfolioMediaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        project_id = self.request.query_params.get("project")
        if project_id:
            return self.queryset.filter(project__id=project_id)
        return self.queryset.none()

class SkillViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        skills = Skill.objects.filter(user=request.user)
        serializer = SkillSerializer(skills, many=True)
        return Response(serializer.data)

    def create(self, request):
        serializer = BulkSkillSerializer(data=request.data)
        if serializer.is_valid():
            skills_data = serializer.validated_data['skills']

            existing_names = Skill.objects.filter(user=request.user).values_list('name', flat=True)

            # faqat yangi bo‘lganlarini qo‘shamiz
            new_skills = [
                Skill(user=request.user, name=name)
                for name in skills_data if name not in existing_names
            ]

            Skill.objects.bulk_create(new_skills)

            return Response({"detail": "Yangi skill(lar) qo‘shildi!"}, status=201)
        return Response(serializer.errors, status=400)

    def partial_update(self, request, pk=None):
        try:
            skill = Skill.objects.get(id=pk, user=request.user)
        except Skill.DoesNotExist:
            return Response({"detail": "Skill topilmadi."}, status=404)

        serializer = SkillSerializer(skill, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

class SkillAnswerViewSet(viewsets.ModelViewSet):
    queryset = SkillAnswer.objects.all()
    serializer_class = SkillAnswerSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SkillAnswer.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Bu yerda create emas, update_or_create ishlatyapmiz!
        skill = serializer.validated_data["skill"]
        answer = serializer.validated_data["answer"]

        obj, created = SkillAnswer.objects.update_or_create(
            user=self.request.user,
            skill=skill,
            defaults={"answer": answer}
        )

class CertificateViewSet(viewsets.ModelViewSet):
    serializer_class = CertificateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Certificate.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class WorkExperienceViewSet(viewsets.ModelViewSet):
    serializer_class = WorkExperienceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WorkExperience.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class UserSearchView(generics.ListAPIView):
    serializer_class = UserPublicSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        q = (self.request.query_params.get("q") or "").strip()
        if not q:
            return User.objects.none()

        parts = [p for p in q.split() if p]
        base = (
            Q(username__icontains=q) |
            Q(first_name__icontains=q) |
            Q(last_name__icontains=q)
        )
        if len(parts) >= 2:
            a, b = parts[0], parts[1]
            base |= (Q(first_name__icontains=a) & Q(last_name__icontains=b)) | \
                     (Q(first_name__icontains=b) & Q(last_name__icontains=a))

        return User.objects.filter(base).order_by("username")

class UserProfileDetailView(generics.RetrieveAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = UserProfileSerializer
    lookup_field = "id"  # /api/users/<id>/
    permission_classes = [IsAuthenticatedOrReadOnly]
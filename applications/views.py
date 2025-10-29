from django.core.exceptions import PermissionDenied
from django.db import transaction, IntegrityError
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from vacancies.models import JobPost
from .models import JobApplication
from .serializers import (
    JobApplicationSerializer,
    ApplicantFullSerializer,
)
from .permissions import IsJobSeeker, IsEmployerOfJob, CanDeleteApplication, IsEmployer


# ==============================
# 1️⃣ APPLY — JOB SEEKER apply qiladi
# ==============================
class ApplyView(APIView):
    permission_classes = [IsAuthenticated, IsJobSeeker]

    def post(self, request):
        print("🟢 APPLY DEBUG START ====================")
        print("🔸 RAW DATA:", request.data)

        job_id = request.data.get("job_post")
        cover_letter = request.data.get("cover_letter", "")
        print("🔸 job_id =", job_id, "| type:", type(job_id))

        # 1️⃣ job_id ni tekshiramiz
        try:
            job_id = int(job_id)
        except (TypeError, ValueError):
            print("❌ job_id conversion failed")
            return Response({"detail": "job_post noto‘g‘ri formatda."}, status=400)

        # 2️⃣ JobPost mavjudligini tekshirish
        job = JobPost.objects.filter(pk=job_id).only("id", "employer_id").first()
        if not job:
            print("❌ Job not found")
            return Response({"detail": "Vakansiya topilmadi."}, status=404)

        print("🔸 job =", job.id, "| employer_id =", job.employer_id)

        # 3️⃣ O‘zi yaratgan vakansiyaga apply qilmasin
        if job.employer_id == request.user.id:
            print("❌ Applicant is employer of this job")
            return Response({"detail": "O‘zingiz yaratgan vakansiyaga ariza berib bo‘lmaydi."}, status=400)

        if getattr(job, "is_active", True) is False:
            print("❌ Job inactive")
            return Response({"detail": "Vakansiya faol emas."}, status=400)

        # 4️⃣ get_or_create
        try:
            with transaction.atomic():
                obj, created = JobApplication.objects.get_or_create(
                    job_post=job,
                    applicant=request.user,
                    defaults={"cover_letter": cover_letter},
                )
        except IntegrityError as e:
            print("❌ DB integrity error:", e)
            return Response({"detail": "Bazaga yozishda xatolik yuz berdi."}, status=400)
        except Exception as e:
            print("❌ Unexpected DB error:", e)
            return Response({"detail": str(e)}, status=500)

        print("🔸 created =", created)
        print("🟢 APPLY DEBUG END =====================")

        if not created:
            return Response({"detail": "Siz allaqachon bu vakansiyaga ariza qoldirgansiz."}, status=400)

        serializer = JobApplicationSerializer(obj, context={"request": request})
        return Response(serializer.data, status=201)

# ==============================
# 2️⃣ EMPLOYER uchun shu JOBdagi barcha arizalar
# ==============================
@method_decorator(cache_page(15), name='get')
class JobApplicationsForEmployerView(generics.ListAPIView):
    serializer_class = JobApplicationSerializer
    permission_classes = [IsAuthenticated, IsEmployer]

    def get_queryset(self):
        job_id = self.kwargs["job_id"]
        job = get_object_or_404(JobPost.objects.only("id", "employer_id"), pk=job_id)

        checker = IsEmployerOfJob()
        if not checker.has_object_permission(self.request, self, job):
            raise PermissionDenied(checker.message)

        return (
            JobApplication.objects
            .select_related("job_post", "applicant")
            .only("id", "cover_letter", "status", "created_at", "job_post__title",
                  "applicant__id", "applicant__first_name", "applicant__last_name",
                  "applicant__profile_image", "applicant__title")
            .filter(job_post=job)
            .order_by("-created_at")
        )


# ==============================
# 3️⃣ ARIZA DETAIL + DELETE (faqat egasi yoki employer)
# ==============================
class JobApplicationDetailView(generics.RetrieveDestroyAPIView):
    queryset = (
        JobApplication.objects
        .select_related("job_post", "applicant")
        .only("id", "cover_letter", "status", "created_at",
              "job_post__id", "job_post__title",
              "applicant__id", "applicant__first_name", "applicant__last_name", "applicant__profile_image")
        .order_by("-created_at")
    )
    serializer_class = JobApplicationSerializer
    permission_classes = [IsAuthenticated, CanDeleteApplication]


# ==============================
# 4️⃣ EMPLOYER: o‘zidagi barcha arizalar
# ==============================
@method_decorator(cache_page(20), name='get')
class EmployerAllApplicationsView(generics.ListAPIView):
    serializer_class = JobApplicationSerializer
    permission_classes = [IsAuthenticated, IsEmployer]

    def get_queryset(self):
        qs = (
            JobApplication.objects
            .select_related("applicant", "job_post")
            .only("id", "cover_letter", "status", "created_at",
                  "job_post__id", "job_post__title",
                  "applicant__id", "applicant__first_name", "applicant__last_name", "applicant__profile_image")
            .filter(job_post__employer=self.request.user)
            .order_by("-created_at")
        )
        job_id = self.request.query_params.get("job")
        if job_id:
            qs = qs.filter(job_post_id=job_id)
        return qs


# ==============================
# 5️⃣ JOB SEEKER: o‘zining arizasini bekor qiladi
# ==============================
class CancelMyApplicationView(APIView):
    """
    DELETE /api/applications/jobs/<int:job_id>/mine/
    """
    permission_classes = [IsAuthenticated, IsJobSeeker]

    def delete(self, request, job_id: int):
        job = get_object_or_404(JobPost.objects.only("id"), pk=job_id)
        obj = get_object_or_404(JobApplication.objects.only("id", "applicant_id", "job_post_id"), job_post=job, applicant=request.user)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ==============================
# 6️⃣ EMPLOYER: arizadagi applicant’ning FULL profilini ko‘rish
# ==============================
@method_decorator(cache_page(30), name='get')
class ApplicationApplicantView(APIView):
    permission_classes = [IsAuthenticated, IsEmployer]

    def get(self, request, pk: int):
        qs = (
            JobApplication.objects
            .select_related("job_post", "applicant")
            .prefetch_related(
                "applicant__skills",
                "applicant__languages",
                "applicant__educations",
                "applicant__portfolio_projects__media_files",
                "applicant__certificates",
                "applicant__experiences",
            )
        )
        app = get_object_or_404(qs, pk=pk)

        checker = IsEmployerOfJob()
        if not checker.has_object_permission(request, self, app.job_post):
            raise PermissionDenied(getattr(checker, "message", "Ruxsat yo‘q"))

        data = ApplicantFullSerializer(app.applicant, context={"request": request}).data
        return Response(data, status=200)

# ==============================
# 7️⃣ JOB SEEKER: o‘zining barcha arizalari
# ==============================
class MyApplicationsView(generics.ListAPIView):
    serializer_class = JobApplicationSerializer
    permission_classes = [IsAuthenticated, IsJobSeeker]

    def get_queryset(self):
        return (
            JobApplication.objects
            .select_related("job_post", "applicant")
            .only(
                "id", "cover_letter", "status", "created_at",
                "job_post__id", "job_post__title", "job_post__company", "job_post__location"
            )
            .filter(applicant=self.request.user)
            .order_by("-created_at")
        )

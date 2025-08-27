from django.core.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from vacancies.models import JobPost
from .models import JobApplication
from .serializers import JobApplicationSerializer, ApplicantMiniSerializer, ApplicantFullSerializer
from .permissions import IsJobSeeker, IsEmployerOfJob, CanDeleteApplication, IsEmployer


class ApplyView(APIView):
    """
    POST /api/applications/apply/
    body: { "job_post": <id>, "cover_letter": "" }  # cover_letter ixtiyoriy
    """
    permission_classes = [IsAuthenticated, IsJobSeeker]

    def post(self, request):
        job_id = request.data.get("job_post")
        cover_letter = request.data.get("cover_letter", "")
        if not job_id:
            return Response({"detail": "job_post kiritilmadi."}, status=400)

        job = get_object_or_404(JobPost, pk=job_id)

        # O‘z job’iga apply qilishni bloklash
        if getattr(job, "employer_id", None) == request.user.id:
            return Response({"detail": "O‘zingiz yaratgan vakansiyaga apply qilib bo‘lmaydi."}, status=400)

        # Job aktiv tekshir (ixtiyoriy)
        if hasattr(job, "is_active") and not job.is_active:
            return Response({"detail": "Vakansiya faol emas."}, status=400)

        obj, created = JobApplication.objects.get_or_create(
            job_post=job,
            applicant=request.user,
            defaults={"cover_letter": cover_letter},
        )
        if not created:
            return Response({"detail": "Siz allaqachon bu vakansiyaga ariza qoldirgansiz."}, status=400)

        return Response(JobApplicationSerializer(obj).data, status=status.HTTP_201_CREATED)


class JobApplicationsForEmployerView(generics.ListAPIView):
    serializer_class = JobApplicationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        job_id = self.kwargs["job_id"]
        job = get_object_or_404(JobPost, pk=job_id)
        checker = IsEmployerOfJob()
        if not checker.has_object_permission(self.request, self, job):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(checker.message)

        return (
            JobApplication.objects
            .select_related("job_post", "applicant")
            .order_by("-created_at")
            .filter(job_post=job)
        )

class JobApplicationDetailView(generics.RetrieveDestroyAPIView):
    queryset = (
        JobApplication.objects
        .select_related("job_post", "applicant")
        .order_by("-created_at")
    )
    serializer_class = JobApplicationSerializer
    permission_classes = [IsAuthenticated, CanDeleteApplication]

class EmployerAllApplicationsView(generics.ListAPIView):
    serializer_class = JobApplicationSerializer
    permission_classes = [IsAuthenticated, IsEmployer]

    def get_queryset(self):
        qs = (JobApplication.objects
            .select_related("applicant", "job_post")
            .order_by("-created_at")
            .filter(job_post__employer=self.request.user)
        )
        job_id = self.request.query_params.get("job")
        if job_id:
            qs = qs.filter(job_post_id=job_id)
        return qs

    def get_queryset(self):
        qs = (JobApplication.objects
              .select_related("applicant", "job_post")
              .filter(job_post__employer=self.request.user)
              .order_by("-created_at"))
        job_id = self.request.query_params.get("job")
        if job_id:
            qs = qs.filter(job_post_id=job_id)
        return qs

class CancelMyApplicationView(APIView):
    """
    DELETE /api/applications/jobs/<int:job_id>/mine/
    Faqat JOB_SEEKER o‘zining shu job bo‘yicha arizasini o‘chiradi.
    """
    permission_classes = [IsAuthenticated, IsJobSeeker]

    def delete(self, request, job_id: int):
        job = get_object_or_404(JobPost, pk=job_id)
        obj = get_object_or_404(JobApplication, job_post=job, applicant=request.user)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class ApplicationApplicantView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        qs = (JobApplication.objects
              .select_related("job_post", "applicant")
              .prefetch_related(
                  "applicant__skills",
                  "applicant__languages",
                  "applicant__educations",
                  "applicant__portfolio_projects__media_files",
                  "applicant__certificates",
                  "applicant__experiences",
              ))
        app = get_object_or_404(qs, pk=pk)

        checker = IsEmployerOfJob()
        if not checker.has_object_permission(request, self, app.job_post):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(getattr(checker, "message", "Ruxsat yo‘q"))

        data = ApplicantFullSerializer(app.applicant, context={"request": request}).data
        return Response(data, status=200)
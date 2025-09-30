from django.urls import path
from .views import (
    ApplyView, JobApplicationsForEmployerView,
    JobApplicationDetailView, CancelMyApplicationView,
    EmployerAllApplicationsView,
    ApplicationApplicantView,   # <-- qo‘shish
)

urlpatterns = [
    path("apply/", ApplyView.as_view(), name="job-apply"),
    path("jobs/<int:job_id>/applications/", JobApplicationsForEmployerView.as_view(),
         name="job-applications-for-employer"),
    path("<int:pk>/", JobApplicationDetailView.as_view(), name="job-application-detail"),
    path("<int:pk>/applicant/", ApplicationApplicantView.as_view(), name="application-applicant"),  # NEW
    path("jobs/<int:job_id>/mine/", CancelMyApplicationView.as_view(), name="cancel-my-application"),
    path("my/applications/", EmployerAllApplicationsView.as_view(), name="employer-all-applications"),
]

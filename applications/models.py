from django.conf import settings
from django.db import models

class ApplicationStatus(models.TextChoices):
    APPLIED = "APPLIED", "Applied"
    SHORTLISTED = "SHORTLISTED", "Shortlisted"
    REJECTED = "REJECTED", "Rejected"
    HIRED = "HIRED", "Hired"

class JobApplication(models.Model):
    job_post = models.ForeignKey(
        "vacancies.JobPost",
        on_delete=models.CASCADE,
        related_name="applications",
    )
    applicant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="job_applications",
    )
    cover_letter = models.TextField(blank=True)
    status = models.CharField(
        max_length=20, choices=ApplicationStatus.choices, default=ApplicationStatus.APPLIED
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("job_post", "applicant")
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.applicant_id} -> {self.job_post_id} ({self.status})"

from django.contrib import admin
from .models import JobApplication

@admin.register(JobApplication)
class JobApplicationAdmin(admin.ModelAdmin):
    list_display = ("id", "job_post", "applicant", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("applicant__first_name", "applicant__last_name", "job_post__title")

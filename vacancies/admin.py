# vacancies/admin.py
from django.contrib import admin
from .models import JobPost, JobPostRating, SavedJob

@admin.register(JobPost)
class JobPostAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "employer", "plan", "created_at", "is_filled")
    list_filter  = ("plan", "is_filled", "is_remote",)
    search_fields = ("title", "description", "location",)

@admin.register(JobPostRating)
class JobPostRatingAdmin(admin.ModelAdmin):
    list_display = ("id", "job_post", "user", "stars")

@admin.register(SavedJob)
class SavedJobAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "job_post", "saved_at")
    search_fields = ("user__username", "job_post__title")

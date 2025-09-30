from django.contrib import admin
from .models import Resume

@admin.register(Resume)
class ResumeAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "user", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("title", "user__email", "user__username", "full_name")

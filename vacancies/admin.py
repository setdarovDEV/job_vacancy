from django.contrib import admin
from .models import JobPost

@admin.register(JobPost)
class JobPostAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'employer', 'created_at')
    search_fields = ('title', 'employer__username')

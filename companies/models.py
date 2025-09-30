from django.db import models
from django.conf import settings

class Company(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="companies")
    name = models.CharField(max_length=255)
    industry = models.CharField(max_length=255, blank=True)
    website = models.URLField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    logo = models.ImageField(upload_to='company_logos/', blank=True, null=True)

    # ⬇️ Yangi maydonlar
    banner = models.ImageField(upload_to='company_banners/', blank=True, null=True)
    description = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class CompanyReview(models.Model):
    """Отзывы: 1 user → 1 company ga 1 ta review."""
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="company_reviews")
    rating = models.PositiveSmallIntegerField()  # 1..5
    text = models.TextField(blank=True)
    country = models.CharField(max_length=120, blank=True)  # “Узбекистан”
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("company", "user")

    def __str__(self):
        return f"{self.company.name} • {self.user} • {self.rating}"


class CompanyFollow(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="follows")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="company_follows")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["company", "user"], name="uniq_company_user_follow"),
        ]
        indexes = [
            models.Index(fields=["company", "user"]),
            models.Index(fields=["user"]),
        ]



class CompanyPhoto(models.Model):
    """Фотографии (galereya)."""
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to='company_photos/')
    caption = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class InterviewExperience(models.Model):
    """Интервью tajribalari."""
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="interviews")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="interview_experiences")
    title = models.CharField(max_length=255)           # masalan: Frontend Developer
    difficulty = models.PositiveSmallIntegerField(default=3)  # 1..5
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

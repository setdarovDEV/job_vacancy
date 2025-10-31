# vacancies/models.py
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db.models import Avg
from accounts.models import CustomUser

# Agar to'g'ridan-to'g'ri import qilishni xohlasang:
# from companies.models import Company


class PlanChoices(models.TextChoices):
    BASIC = "Basic", "Basic"
    PRO = "Pro", "Pro"
    PREMIUM = "Premium", "Premium"


class JobPost(models.Model):
    # ⚠️ Migratsiya muammosiz o‘tishi uchun hozircha null=True, blank=True
    company = models.ForeignKey(
        'companies.Company',                # yoki: Company (agar yuqorida import qilsang)
        on_delete=models.CASCADE,
        related_name='job_posts',
        null=True, blank=True
    )
    employer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='job_posts'
    )

    # 1. Название вакансии
    title = models.CharField(max_length=255)

    # 2. Навыки
    skills = models.JSONField(default=list, blank=True)

    # 3. Срок работы
    duration = models.CharField(max_length=100, blank=True)  # masalan: '1-3 месяца'

    # 4. Бюджет
    budget_min = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    budget_max = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_fixed_price = models.BooleanField(default=True)  # True: fixed, False: hourly

    # 5. Локация
    location = models.CharField(max_length=255, blank=True)
    is_remote = models.BooleanField(default=False)

    # 6. Описание работы
    description = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    stars_given = models.PositiveIntegerField(default=4)  # xohlasang 0 qilib qo'yamiz
    deadline = models.DateField(null=True, blank=True)
    is_filled = models.BooleanField(default=False)

    # 🔥 Plan with choices
    plan = models.CharField(max_length=50, choices=PlanChoices.choices, blank=True, null=True)
    is_draft = models.BooleanField(default=True)
    @property
    def average_stars(self):
        avg = self.ratings.aggregate(a=Avg("stars"))["a"]
        return round(avg) if avg else 0

    def __str__(self):
        return self.title


class JobPostRating(models.Model):
    job_post = models.ForeignKey(JobPost, related_name="ratings", on_delete=models.CASCADE)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    stars = models.PositiveIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(5)]  # xohlasang Min=1 qilib qo'yamiz
    )

    class Meta:
        unique_together = ['job_post', 'user']

    @property
    def average_stars(self):
        # Bu rating obyektining o'zi emas, balki shu post bo'yicha o'rtacha
        avg = self.job_post.ratings.aggregate(a=Avg("stars"))["a"]
        return round(avg) if avg else 0

class SavedJob(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_jobs"
    )
    job_post = models.ForeignKey(
        "JobPost",
        on_delete=models.CASCADE,
        related_name="saved_by"
    )
    saved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "job_post")

    def __str__(self):
        return f"{self.user} saved {self.job_post}"
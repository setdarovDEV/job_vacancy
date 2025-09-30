from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator

class EmploymentType(models.TextChoices):
    FULL_TIME = "full_time", "Полная занятость"
    PART_TIME = "part_time", "Частичная занятость"
    CONTRACT  = "contract", "Контракт"
    INTERN    = "intern", "Стажировка"
    TEMP      = "temporary", "Временная"

class WorkFormat(models.TextChoices):
    ONSITE = "onsite", "Офис"
    REMOTE = "remote", "Удаленно"
    HYBRID = "hybrid", "Гибрид"

class ExperienceLevel(models.TextChoices):
    JUNIOR = "junior", "Junior"
    MIDDLE = "middle", "Middle"
    SENIOR = "senior", "Senior"
    LEAD   = "lead", "Lead"

class Resume(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="resumes",
    )

    # Asosiy ma'lumotlar
    title = models.CharField(max_length=255, help_text="Название резюме, напр.: Frontend Developer")
    full_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    location = models.CharField(max_length=255, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    photo = models.ImageField(upload_to="resumes/photos/", null=True, blank=True)
    cv_file = models.FileField(upload_to="resumes/files/", null=True, blank=True)

    # Job preferensiyalar
    desired_position = models.CharField(max_length=255, blank=True)
    experience_level = models.CharField(max_length=20, choices=ExperienceLevel.choices, blank=True)
    employment_type = models.CharField(max_length=20, choices=EmploymentType.choices, blank=True)
    work_format = models.CharField(max_length=10, choices=WorkFormat.choices, blank=True)
    desired_salary = models.PositiveIntegerField(null=True, blank=True)  # so'm/oy yoki $/oy — frontda ko'rsatiladi
    currency = models.CharField(max_length=10, default="UZS", blank=True)

    # Kontent bo'limlari (JSON)
    summary = models.TextField(blank=True)
    skills = models.JSONField(default=list, blank=True)           # ["React", "Django", ...]
    languages = models.JSONField(default=list, blank=True)        # [{"name":"English","level":"B2"}, ...]
    links = models.JSONField(default=list, blank=True)            # [{"type":"github","url":"..."}]
    experience = models.JSONField(default=list, blank=True)       # [{"company":"X","role":"Y","from":"2023-01","to":"2024-02","desc":"..."}]
    education = models.JSONField(default=list, blank=True)        # [{"school":"...","degree":"...","year":"2022"}]
    certifications = models.JSONField(default=list, blank=True)   # [{"name":"AWS","year":"2023"}]

    # Reyting yoki ko'rishlar (ixtiyoriy)
    rating = models.PositiveSmallIntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(5)])
    views_count = models.PositiveIntegerField(default=0)

    is_active = models.BooleanField(default=True)  # “активное резюме”
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.title} — {self.user}"

import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin

from headhunter_backend.settings import AUTH_USER_MODEL


class Role(models.TextChoices):
    JOB_SEEKER = "JOB_SEEKER", "Job Seeker"
    EMPLOYER = "EMPLOYER", "Employer"
    ADMIN = "ADMIN", "Admin"  # Optional

class CustomUserManager(BaseUserManager):
    def create_user(self, email=None, password=None, **extra_fields):  # ✅ email=None default
        user = self.model(email=self.normalize_email(email) if email else None, **extra_fields)
        user.set_password(password)
        user.save()
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Superuser uchun email shart")
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)

class CustomUser(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(default=uuid.uuid4, primary_key=True, editable=False)
    email = models.EmailField(unique=True, null=True, blank=True)
    username = models.CharField(max_length=150, unique=True)
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    role = models.CharField(max_length=20, choices=Role.choices, null=True, blank=True)
    is_email_verified = models.BooleanField(default=False)
    profile_image = models.ImageField(upload_to='profile_images/', null=True, blank=True)
    title = models.CharField(max_length=255, blank=True, null=True)  # ✅ yangi maydon
    about_me = models.TextField(null=True, blank=True)  # 🆕 qo‘shildi

    # ✅ YANGI QO‘SHILDI:
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    work_hours_per_week = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text="Masalan: 'Более 30 часов в неделю'"
    )
    salary_usd = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Ish haqi (USD)"
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']

    objects = CustomUserManager()

    def __str__(self):
        return self.username


class EmailVerificationCode(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE)
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)

class LanguageSkill(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="languages")
    language = models.CharField(max_length=50)
    level = models.CharField(max_length=50)  # Masalan: B2, родной язык, etc.
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} – {self.language}: {self.level}"

class Education(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='educations')
    academy_name = models.CharField(max_length=255)
    degree = models.CharField(max_length=255)
    start_year = models.IntegerField()
    end_year = models.IntegerField()

    def __str__(self):
        return f"{self.academy_name} ({self.start_year}–{self.end_year})"

class PortfolioProject(models.Model):
    user = models.ForeignKey(AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="portfolio_projects")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    skills = models.CharField(max_length=255, help_text="Comma-separated skills", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class PortfolioMedia(models.Model):
    FILE_TYPES = [
        ("image", "Image"),
        ("video", "Video"),
        ("text", "Text"),
        ("link", "Link"),
        ("file", "File"),
        ("audio", "Audio"),
    ]

    project = models.ForeignKey(PortfolioProject, on_delete=models.CASCADE, related_name="media_files")
    file = models.FileField(upload_to="portfolio_media/")
    file_type = models.CharField(max_length=10, choices=FILE_TYPES)

    def __str__(self):
        return f"{self.project.title} - {self.file_type}"

class Skill(models.Model):
    user = models.ForeignKey(AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='skills')
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

class SkillAnswer(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE)
    answer = models.CharField(max_length=10, choices=[('yes', 'Yes'), ('no', 'No'), ('skip', 'Skip')])

    class Meta:
        unique_together = ['user', 'skill']

class Certificate(models.Model):
    user = models.ForeignKey(AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='certificates')
    name = models.CharField(max_length=255)
    organization = models.CharField(max_length=255)
    issue_date = models.DateField()
    file = models.FileField(upload_to='certificates/')  # PDF yoki rasm bo'lishi mumkin

    def __str__(self):
        return f"{self.name} - {self.user.username}"

class WorkExperience(models.Model):
    user = models.ForeignKey(AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="experiences")
    company_name = models.CharField(max_length=255)
    position = models.CharField(max_length=255)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"{self.position} at {self.company_name}"


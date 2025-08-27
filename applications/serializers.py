from rest_framework import serializers

from accounts.models import CustomUser, Certificate, WorkExperience, PortfolioProject, PortfolioMedia, Education, \
    LanguageSkill
from .models import JobApplication

def abs_url(request, raw):
    if not raw:
        return ""
    raw = str(raw)
    if raw.startswith("http"):
        return raw
    if request is None:
        return raw
    base = request.build_absolute_uri("/")[:-1]
    return f"{base}{raw}"


class ApplicantMiniSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    bio = serializers.SerializerMethodField()           # <-- CharField emas!
    position = serializers.SerializerMethodField()
    skills = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ["id", "full_name", "avatar", "bio", "position", "skills"]

    # ------- helpers -------
    def _first(self, *vals):
        for v in vals:
            if v:
                return v
        return None

    def _pick_avatar(self, user):
        prof = getattr(user, "profile", None)
        candidates = [
            getattr(user, "avatar", None),
            getattr(user, "photo", None),
            getattr(user, "image", None),
            getattr(user, "profile_image", None),
            getattr(prof, "avatar", None) if prof else None,
            getattr(prof, "photo", None) if prof else None,
            getattr(prof, "image", None) if prof else None,
            getattr(prof, "profile_image", None) if prof else None,
        ]
        for c in candidates:
            if c:
                return getattr(c, "url", c)
        return ""

    # ------- getters -------
    def get_full_name(self, obj):
        fn = getattr(obj, "full_name", None)
        if callable(fn):
            try:
                v = fn()
                if v:
                    return v
            except Exception:
                pass
        if isinstance(fn, str) and fn:
            return fn
        return f"{getattr(obj,'first_name','')} {getattr(obj,'last_name','')}".strip() or "—"

    def get_avatar(self, obj):
        request = self.context.get("request")
        raw = self._pick_avatar(obj)
        return abs_url(request, raw) if raw else ""

    # serializers.py ichida ApplicantMiniSerializer
    def get_bio(self, obj):
        prof = getattr(obj, "profile", None)

        # 🔑 User darajasida
        u_bio = self._first(
            getattr(obj, "about_me", None),  # ✅ TO‘G‘RILANDI
            getattr(obj, "bio", None),
            getattr(obj, "about", None),
            getattr(obj, "summary", None),
        )
        if u_bio:
            return u_bio

        # 🔑 Profile darajasida
        if prof:
            p_bio = self._first(
                getattr(prof, "about_me", None),
                getattr(prof, "bio", None),
                getattr(prof, "about", None),
                getattr(prof, "description", None),
                getattr(prof, "headline", None),
                getattr(prof, "summary", None),
            )
            if p_bio:
                return p_bio

        return "—"

    def get_position(self, obj):
        prof = getattr(obj, "profile", None)
        return (
            getattr(prof, "position", None)
            or getattr(prof, "title", None)
            or getattr(obj, "title", None)
            or "—"
        )

    def get_skills(self, obj):
        prof = getattr(obj, "profile", None)
        sk = getattr(obj, "skills", None)
        if hasattr(sk, "all"):
            return list(sk.values_list("name", flat=True))
        if prof:
            psk = getattr(prof, "skills", None)
            if hasattr(psk, "all"):
                return list(psk.values_list("name", flat=True))
            psv = getattr(prof, "skills", None)
            if isinstance(psv, list):
                return psv
            if isinstance(psv, str):
                return [s for s in psv.replace(",", " ").split() if s]
        return []
class JobApplicationSerializer(serializers.ModelSerializer):
    # Nested ko‘rinish agar kerak bo‘lsa:
    applicant = ApplicantMiniSerializer(read_only=True)

    # 🔥 FRONT uchun FLAT maydonlar:
    userId   = serializers.IntegerField(source="applicant.id", read_only=True)
    name     = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    bio = serializers.SerializerMethodField()
    position = serializers.SerializerMethodField()
    skills   = serializers.SerializerMethodField()

    job = serializers.SerializerMethodField()

    class Meta:
        model = JobApplication
        fields = [
            "id",
            "job_post",
            "job",
            "applicant",
            # FLAT
            "userId", "name", "avatar", "bio", "position", "skills",
            "cover_letter", "status", "created_at",
        ]
        read_only_fields = ["id", "applicant", "status", "created_at"]

    # ----- FLAT getters -----
    def get_name(self, obj):
        user = obj.applicant
        fn = getattr(user, "full_name", None)
        if callable(fn):
            try:
                v = fn()
                if v: return v
            except Exception:
                pass
        if isinstance(fn, str) and fn:
            return fn
        return f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip() or "—"

    def get_avatar(self, obj):
        request = self.context.get("request")  # ← MUHIM: request ni oling
        user = obj.applicant
        prof = getattr(user, "profile", None)
        candidates = [
            getattr(user, "avatar", None),
            getattr(user, "photo", None),
            getattr(user, "image", None),
            getattr(user, "profile_image", None),
            getattr(prof, "avatar", None) if prof else None,
            getattr(prof, "photo", None) if prof else None,
            getattr(prof, "image", None) if prof else None,
            getattr(prof, "profile_image", None) if prof else None,
        ]
        for c in candidates:
            if not c:
                continue
            return abs_url(request, str(getattr(c, "url", c)))  # endi request bor
        return ""

    # serializers.py ichida JobApplicationSerializer
    def get_bio(self, obj):
        user = obj.applicant
        prof = getattr(user, "profile", None)
        for src in (
                getattr(user, "about_me", None),  # ✅ TO‘G‘RILANDI
                getattr(user, "bio", None),
                getattr(user, "about", None),
                getattr(user, "summary", None),
                getattr(prof, "about_me", None) if prof else None,
                getattr(prof, "bio", None) if prof else None,
                getattr(prof, "about", None) if prof else None,
                getattr(prof, "description", None) if prof else None,
                getattr(prof, "headline", None) if prof else None,
                getattr(prof, "summary", None) if prof else None,
        ):
            if src:
                return src

        return obj.cover_letter or "—"

    def get_position(self, obj):
        user = obj.applicant
        prof = getattr(user, "profile", None)
        return (
            getattr(prof, "position", None)
            or getattr(prof, "title", None)
            or getattr(user, "title", None)
            or "—"
        )

    def get_skills(self, obj):
        user = obj.applicant
        # user.skills M2M
        sk = getattr(user, "skills", None)
        if hasattr(sk, "all"):
            return list(sk.values_list("name", flat=True))
        # profile.skills
        prof = getattr(user, "profile", None)
        if prof:
            psk = getattr(prof, "skills", None)
            if hasattr(psk, "all"):
                return list(psk.values_list("name", flat=True))
            psv = getattr(prof, "skills", None)
            if isinstance(psv, list):
                return psv
            if isinstance(psv, str):
                return [s for s in psv.replace(",", " ").split() if s]
        return []

    def get_job(self, obj):
        jp = obj.job_post
        return {"id": jp.id, "title": getattr(jp, "title", None)}

class ApplicationSerializer(serializers.ModelSerializer):
    applicant = ApplicantMiniSerializer(read_only=True)

    class Meta:
        model = JobApplication
        fields = ["id", "job_post", "cover_letter", "created_at", "applicant"]



class LanguageSkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = LanguageSkill
        fields = ["language", "level", "created_at"]


class EducationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Education
        fields = ["academy_name", "degree", "start_year", "end_year"]


class PortfolioMediaSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = PortfolioMedia
        fields = ["file_type", "file_url"]

    def get_file_url(self, obj):
        request = self.context.get("request")
        raw = getattr(obj.file, "url", None) or obj.file
        return abs_url(request, raw) if raw else ""


class PortfolioProjectSerializer(serializers.ModelSerializer):
    skills_list = serializers.SerializerMethodField()
    media = serializers.SerializerMethodField()

    class Meta:
        model = PortfolioProject
        fields = ["id", "title", "description", "skills_list", "created_at", "media"]

    def get_skills_list(self, obj):
        if not obj.skills:
            return []
        return [s.strip() for s in obj.skills.replace(",", " ").split() if s.strip()]

    def get_media(self, obj):
        return PortfolioMediaSerializer(
            obj.media_files.all(),
            many=True,
            context=self.context
        ).data


class CertificateSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = ["id", "name", "organization", "issue_date", "file_url"]

    def get_file_url(self, obj):
        request = self.context.get("request")
        raw = getattr(obj.file, "url", None) or obj.file
        return abs_url(request, raw) if raw else ""


class WorkExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkExperience
        fields = [
            "id", "company_name", "position",
            "start_date", "end_date", "description",
            "city", "country"
        ]


# ==== Full profil serializer ====

class ApplicantFullSerializer(ApplicantMiniSerializer):
    work_hours_per_week = serializers.CharField(read_only=True)
    languages = LanguageSkillSerializer(many=True, read_only=True)
    educations = EducationSerializer(many=True, read_only=True)

    # ⬇️ shu qatordagi source ni olib tashlaymiz
    portfolio_projects = PortfolioProjectSerializer(many=True, read_only=True)

    certificates = CertificateSerializer(many=True, read_only=True)
    experiences = WorkExperienceSerializer(many=True, read_only=True)
    salary_usd = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, required=False)

    class Meta(ApplicantMiniSerializer.Meta):
        fields = ApplicantMiniSerializer.Meta.fields + [
            "work_hours_per_week",
            "languages",
            "educations",
            "portfolio_projects",   # nomi bilan o‘zi mos tushadi
            "certificates",
            "experiences",
            "salary_usd",
        ]
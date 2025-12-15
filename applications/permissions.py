from rest_framework.permissions import BasePermission


class IsJobSeeker(BasePermission):
    """
    Faqat JOB_SEEKER rolidagi foydalanuvchilar ruxsat oladi
    """

    def has_permission(self, request, view):
        user = request.user

        # Debug
        print("🔐 IsJobSeeker permission check:")
        print(f"  - Authenticated: {user.is_authenticated}")
        print(f"  - User: {user}")
        print(f"  - Role: {getattr(user, 'role', 'NO ROLE ATTR')}")

        if not user or not user.is_authenticated:
            print("  ❌ User not authenticated")
            return False

        user_role = getattr(user, "role", "")
        print(f"  - Final role check: '{user_role}' == 'JOB_SEEKER'?")

        is_job_seeker = user_role == "JOB_SEEKER"
        print(f"  - Result: {is_job_seeker}")

        return is_job_seeker


class IsEmployer(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and getattr(u, "role", "") == "EMPLOYER")


class IsEmployerOfJob(BasePermission):
    message = "Bu vakansiya sizga tegishli emas."

    def has_object_permission(self, request, view, obj):
        # obj = JobPost
        u = request.user
        return bool(u and u.is_authenticated and getattr(obj, "employer_id", None) == u.id)


class CanDeleteApplication(BasePermission):
    """
    O'chirishga ruxsat:
    - arizani yozgan applicant o'zi
    - yoki shu job'ning employer'i
    """
    message = "Bu arizani o'chirish huquqiga ega emassiz."

    def has_object_permission(self, request, view, obj):
        u = request.user
        if not (u and u.is_authenticated):
            return False
        is_applicant = (obj.applicant_id == u.id)
        is_owner_employer = getattr(obj.job_post, "employer_id", None) == u.id
        return is_applicant or is_owner_employer
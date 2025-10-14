from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html
from .models import CustomUser, Skill


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    model = CustomUser

    list_display = (
        'username',
        'email',
        'first_name',
        'last_name',
        'colored_role',
        'is_email_verified',
        'is_active',
        'is_staff',
    )
    list_filter = ('role', 'is_email_verified', 'is_active', 'is_staff', 'is_superuser')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    ordering = ('username',)

    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Shaxsiy maʼlumotlar', {
            'fields': (
                'first_name',
                'last_name',
                'email',
                'role',
                'is_email_verified',  # ✅ qo‘shildi
                'profile_image',
            )
        }),
        ('Ruxsatlar', {
            'fields': (
                'is_active',
                'is_staff',
                'is_superuser',
                'groups',
                'user_permissions',
            )
        }),
        ('Muhim sanalar', {'fields': ('last_login',)}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'username',
                'email',
                'first_name',
                'last_name',
                'role',
                'is_email_verified',  # ✅ yangi foydalanuvchi yaratishda ham chiqadi
                'password1',
                'password2',
            ),
        }),
    )

    def colored_role(self, obj):
        if not obj.role:
            return "—"
        color = "#1E88E5" if obj.role == "EMPLOYER" else "#43A047" if obj.role == "JOB_SEEKER" else "#F9A825"
        return format_html(f'<b style="color:{color};">{obj.role}</b>')

    colored_role.short_description = "Role"


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ('name', 'user')
    search_fields = ('name', 'user__username')

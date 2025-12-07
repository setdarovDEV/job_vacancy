from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from rest_framework.routers import DefaultRouter

from accounts.views import (
    LanguageSkillViewSet, EducationViewSet, PortfolioProjectViewSet,
    PortfolioMediaViewSet, SkillViewSet, CertificateViewSet, WorkExperienceViewSet
)

router = DefaultRouter()
router.register(r'languages', LanguageSkillViewSet, basename='language-skill')
router.register(r'education', EducationViewSet, basename='education')
router.register(r'projects', PortfolioProjectViewSet, basename='portfolio-projects')
router.register(r'portfolio-media', PortfolioMediaViewSet, basename='portfolio-media')
router.register(r'skills', SkillViewSet, basename='skills')
router.register(r'certificates', CertificateViewSet, basename='certificate')
router.register(r'experiences', WorkExperienceViewSet, basename='experience')


def health(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path('admin/', admin.site.urls),

    # 🔽 Avval DRF router
    path('api/', include(router.urls)),

    # 🔽 Keyin boshqa app'lar
    path('api/auth/', include('accounts.urls')),
    path('api/vacancies/', include('vacancies.urls')),
    path('api/', include('companies.urls')),
    path('api/', include('resume.urls')),
    path("api/", include("community.urls")),
    path("api/", include("chats.urls")),
    path("api/applications/", include("applications.urls")),

    path("healthz/", health),
    path('silk/', include('silk.urls', namespace='silk')),
]


# ✅ Lokal ishlaganda media fayllar
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]

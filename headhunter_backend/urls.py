from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter

from accounts.views import LanguageSkillViewSet, EducationViewSet, PortfolioProjectViewSet, PortfolioMediaViewSet, \
    SkillViewSet, CertificateViewSet, WorkExperienceViewSet

router = DefaultRouter()
router.register(r'languages', LanguageSkillViewSet, basename='language-skill')
router.register(r'education', EducationViewSet, basename='education')
router.register(r'projects', PortfolioProjectViewSet, basename='portfolio-projects')
router.register(r'portfolio-media', PortfolioMediaViewSet, basename='portfolio-media')
router.register(r'skills', SkillViewSet, basename='skills')
router.register(r'certificates', CertificateViewSet, basename='certificate')
router.register(r'experiences', WorkExperienceViewSet, basename='experience')

def healthz(request):
    return JsonResponse({"status": "ok"})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/vacancies/', include('vacancies.urls')),
    path('api/', include('companies.urls')),
    path('api/', include('resume.urls')),
    path("api/", include("community.urls")),
    # path("api/", include("chat.urls")),
    path("api/applications/", include("applications.urls")),
    path('language/', include(router.urls)),
    path('education/', include(router.urls)),
    path('portfolio/', include(router.urls)),
    path('skills/', include(router.urls)),
    path('certificate/', include(router.urls)),
    path('experience/', include(router.urls)),
    path("healthz/", healthz),

] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
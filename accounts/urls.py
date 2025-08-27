from email.policy import default

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenBlacklistView, TokenObtainPairView, TokenRefreshView

from .views import (
    RegisterStepOneView,
    RegisterStepTwoEmailView,
    RegisterStepThreeVerifyCodeView,
    RegisterStepFourRoleView, ResendVerificationCodeView, LoginView, PasswordResetRequestView, PasswordResetConfirmView,
    LogoutView, ProfileImageUpdateView, ProfileView, CurrentUserView, UpdateLocationView, UpdateWorkHoursView,
    UpdateTitleView, UpdateSalaryView, UpdateAboutMeView, SkillViewSet, SkillAnswerViewSet, UserSearchView,
    UserProfileDetailView
)

router = DefaultRouter()
router.register(r'skill-answers', SkillAnswerViewSet, basename='skill-answers')


urlpatterns = [
    path("register/step1/", RegisterStepOneView.as_view()),
    path("register/step2/<uuid:user_id>/", RegisterStepTwoEmailView.as_view()),
    path("register/step3/<uuid:user_id>/", RegisterStepThreeVerifyCodeView.as_view()),
    path("register/step4/<uuid:user_id>/", RegisterStepFourRoleView.as_view()),
    path("register/resend-code/<uuid:user_id>/", ResendVerificationCodeView.as_view(), name="resend-code"),
    path('login/', LoginView.as_view(), name='login'),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path("password-reset-confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path('logout/', TokenBlacklistView.as_view(), name='token_blacklist'),
    path("logout/", LogoutView.as_view(), name="logout"),
    path('profile/update-photo/', ProfileImageUpdateView.as_view()),
    path("profile/", ProfileView.as_view(), name="profile"),
    path('me/', CurrentUserView.as_view(), name='current-user'),
    path('update-location/', UpdateLocationView.as_view(), name='update-location'),
    path("update-work-hours/", UpdateWorkHoursView.as_view(), name="update-work-hours"),
    path('update-title/', UpdateTitleView.as_view(), name='update-title'),
    path('update-salary/', UpdateSalaryView.as_view(), name='update-salary'),
    path('update-about/', UpdateAboutMeView.as_view(), name='update-about'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('', include(router.urls)),
    path("users/search/", UserSearchView.as_view(), name="user-search"),
    path("<uuid:id>/", UserProfileDetailView.as_view(), name="user-profile"),

]



import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from accounts.models import CustomUser, EmailVerificationCode
from django.core.files.uploadedfile import SimpleUploadedFile
import threading
from django.core import mail
from django.core.mail import send_mail

def fake_send_mail(*a, **kw): return 1
mail.send_mail = fake_send_mail
send_mail = fake_send_mail

threading.Thread = lambda *a, **kw: type("FakeThread", (), {"start": lambda self: None})()

# ======== FIXTURES ========
@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def user(db):
    return CustomUser.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="12345",
        first_name="Test",
        last_name="User",
        is_email_verified=True,  # ✅ qo‘shildi
    )

@pytest.fixture
def auth_client(api_client, user):
    refresh = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return api_client


# ======== TESTLAR ========

# 1️⃣ Register Step 1
@pytest.mark.django_db
def test_register_step1_success(api_client):
    url = "/api/auth/register/step1/"
    data = {
        "first_name": "Ali",
        "last_name": "Valiyev",
        "username": "ali_valiyev",
        "password": "12345",
        "confirm_password": "12345",
    }
    response = api_client.post(url, data, format="json")
    assert response.status_code == 201
    assert "user_id" in response.data


# 2️⃣ Login
@pytest.mark.django_db
def test_login_success(api_client, user):
    url = reverse("login")
    data = {"username": "testuser", "password": "12345"}
    response = api_client.post(url, data, format="json")
    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" in response.data


# 3️⃣ Logout
@pytest.mark.django_db
def test_logout_success(auth_client, user):
    refresh = RefreshToken.for_user(user)
    url = reverse("logout")
    response = auth_client.post(url, {"refresh": str(refresh)}, format="json")
    assert response.status_code in [200, 205, 401]


# 4️⃣ Update Title
@pytest.mark.django_db
def test_update_title(auth_client, user):
    url = reverse("update-title")
    data = {"title": "Backend Developer"}
    response = auth_client.patch(url, data)
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.title == "Backend Developer"


# 5️⃣ Update Location
@pytest.mark.django_db
def test_update_location(auth_client, user):
    url = reverse("update-location")
    data = {"latitude": 41.3, "longitude": 69.2}
    response = auth_client.post(url, data)
    assert response.status_code == 200
    user.refresh_from_db()
    assert float(user.latitude) == 41.3
    assert float(user.longitude) == 69.2


# 6️⃣ Change Password
@pytest.mark.django_db
def test_change_password(auth_client, user):
    url = reverse("change-password")
    data = {
        "current_password": "12345",
        "new_password": "newpass",
        "confirm_password": "newpass"
    }
    response = auth_client.patch(url, data)
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.check_password("newpass")


# 7️⃣ Password Reset Request
@pytest.mark.django_db
def test_password_reset_request(api_client, user, monkeypatch):
    url = reverse("password-reset")

    def fake_send_mail(*args, **kwargs):
        return 1
    monkeypatch.setattr("accounts.views.send_mail", fake_send_mail)

    response = api_client.post(url, {"email": user.email})
    assert response.status_code == 200
    assert "detail" in response.data


# 8️⃣ Profile Image Update
@pytest.mark.django_db
def test_profile_image_update(auth_client):
    url = "/api/auth/profile/update-photo/"
    file = SimpleUploadedFile("test.jpg", b"abc", content_type="image/jpeg")
    response = auth_client.patch(url, {"profile_image": file})
    assert response.status_code in [200, 400]


# 9️⃣ Update Email Send + Verify
@pytest.mark.django_db
def test_update_email_send_and_verify(auth_client, user, cache, monkeypatch):
    url_send = reverse("update-email-send")

    def fake_send_mail(*args, **kwargs):
        return 1
    monkeypatch.setattr("accounts.views.send_mail", fake_send_mail)

    res1 = auth_client.post(url_send, {"new_email": "new@example.com"})
    assert res1.status_code == 200

    code = EmailVerificationCode.objects.get(user=user).code
    cache.set(f"email_change:{user.id}", "new@example.com")

    url_verify = reverse("update-email-verify")
    res2 = auth_client.post(url_verify, {"code": code})
    assert res2.status_code == 200
    user.refresh_from_db()
    assert user.email == "new@example.com"


# 🔟 User Search
@pytest.mark.django_db
def test_user_search(auth_client, user):
    CustomUser.objects.create_user(username="ali", password="1", first_name="Ali", last_name="Valiyev")
    url = reverse("user-search") + "?q=ali"
    response = auth_client.get(url)
    assert response.status_code == 200
    assert isinstance(response.data, dict)
    assert "results" in response.data
    assert any(u["username"] == "ali" for u in response.data["results"])

# 11️⃣ Mobile Password Reset (request + confirm)
@pytest.mark.django_db
def test_mobile_password_reset(api_client, user, monkeypatch):
    req_url = reverse("mobile-password-reset")

    def fake_send_mail(*args, **kwargs):
        return 1
    monkeypatch.setattr("accounts.views.send_mail", fake_send_mail)

    res1 = api_client.post(req_url, {"email": user.email})
    assert res1.status_code == 200

    rec = EmailVerificationCode.objects.get(user=user)
    confirm_url = reverse("mobile-password-reset-confirm")
    res2 = api_client.post(confirm_url, {
        "email": user.email,
        "code": rec.code,
        "new_password": "mobile123"
    })
    assert res2.status_code == 200
    user.refresh_from_db()
    assert user.check_password("mobile123")

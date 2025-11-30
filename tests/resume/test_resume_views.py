import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from accounts.models import CustomUser
from resume.models import Resume


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user1(db):
    return CustomUser.objects.create_user(username="ali", password="12345", first_name="Ali")


@pytest.fixture
def user2(db):
    return CustomUser.objects.create_user(username="vali", password="12345", first_name="Vali")


@pytest.fixture
def auth_client(api_client, user1):
    token = RefreshToken.for_user(user1)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return api_client


@pytest.fixture
def seeker_client(api_client, user2):
    token = RefreshToken.for_user(user2)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return api_client


# === TESTLAR ===

@pytest.mark.django_db
def test_create_resume(auth_client, user1):
    res = auth_client.post(
        "/api/resumes/",
        {"title": "Backend Developer", "summary": "Python bo‘yicha mutaxassis"},
    )
    assert res.status_code == 201
    assert Resume.objects.filter(user=user1, title="Backend Developer").exists()


@pytest.mark.django_db
def test_list_resumes(auth_client, user1):
    Resume.objects.create(user=user1, title="Data Analyst")
    Resume.objects.create(user=user1, title="Django Developer")

    res = auth_client.get("/api/resumes/")
    assert res.status_code == 200
    data = res.data["results"] if isinstance(res.data, dict) and "results" in res.data else res.data
    titles = [r["title"] for r in data]
    assert "Data Analyst" in titles and "Django Developer" in titles


@pytest.mark.django_db
def test_my_resume(auth_client, user1):
    Resume.objects.create(user=user1, title="Full Stack Dev")
    res = auth_client.patch("/api/resumes/my/", {"summary": "Updated summary"}, format="json")
    assert res.status_code in [200, 204]
    if res.status_code == 200:
        assert res.data["title"] == "Full Stack Dev"


@pytest.mark.django_db
def test_update_my_resume(auth_client, user1):
    Resume.objects.create(user=user1, title="Junior Dev", summary="Beginner level")
    res = auth_client.patch("/api/resumes/my/", {"summary": "Updated summary"}, format="json")
    assert res.status_code == 200, res.data
    resume = Resume.objects.filter(user=user1).last()
    assert resume.summary == "Updated summary"



@pytest.mark.django_db
def test_access_denied_other_user_resume(auth_client, seeker_client, user1, user2):
    resume = Resume.objects.create(user=user1, title="Secret Resume")
    res = seeker_client.get(f"/api/resumes/{resume.id}/")
    assert res.status_code in [403, 404]

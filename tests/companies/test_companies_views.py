import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.files.uploadedfile import SimpleUploadedFile
from accounts.models import CustomUser
from companies.models import Company, CompanyReview, CompanyFollow, CompanyPhoto, InterviewExperience
from vacancies.models import JobPost
import tempfile
from PIL import Image


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user1(db):
    return CustomUser.objects.create_user(username="owner", password="12345", first_name="Owner")


@pytest.fixture
def user2(db):
    return CustomUser.objects.create_user(username="seeker", password="12345", first_name="Seeker")


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


@pytest.fixture
def company(user1):
    return Company.objects.create(owner=user1, name="TestCompany", industry="IT", location="Tashkent")


# === TESTLAR ===

@pytest.mark.django_db
def test_create_and_list_company(auth_client):
    res = auth_client.post("/api/companies/", {
        "name": "MyCompany",
        "industry": "Software",
        "location": "Tashkent",
        "description": "Biz IT kompaniyamiz"
    })
    assert res.status_code == 201
    assert Company.objects.filter(name="MyCompany").exists()

    list_res = auth_client.get("/api/companies/")
    assert list_res.status_code == 200
    data = list_res.data["results"] if isinstance(list_res.data, dict) and "results" in list_res.data else list_res.data
    assert any("MyCompany" in c["name"] for c in data)


@pytest.mark.django_db
def test_company_reviews(auth_client, seeker_client, company, user2):
    res = seeker_client.post(f"/api/companies/{company.id}/reviews/", {"rating": 5, "text": "Zo‘r joy!"})
    assert res.status_code == 201
    assert CompanyReview.objects.filter(company=company, user=user2).exists()

    res_list = auth_client.get(f"/api/companies/{company.id}/reviews/")
    assert res_list.status_code == 200
    assert any("Zo‘r joy!" in r["text"] for r in res_list.data)


@pytest.mark.django_db
def test_company_photos(auth_client, company):
    # 1x1 px test rasmi yaratamiz
    tmp = tempfile.NamedTemporaryFile(suffix=".jpg")
    Image.new("RGB", (1, 1)).save(tmp, format="JPEG")
    tmp.seek(0)

    image = SimpleUploadedFile(tmp.name, tmp.read(), content_type="image/jpeg")

    res = auth_client.post(
        f"/api/companies/{company.id}/photos/",
        {"image": image, "caption": "Ofis rasmi"},
        format="multipart",
    )
    assert res.status_code in [201, 200], res.data
    assert CompanyPhoto.objects.filter(company=company).exists()


@pytest.mark.django_db
def test_company_interviews(auth_client, company, user1):
    # 🧩 difficulty ni raqam sifatida yuboramiz
    data = {"title": "Interview tajriba", "difficulty": 1, "text": "Yaxshi o‘tdi"}
    res = auth_client.post(f"/api/companies/{company.id}/interviews/", data, format="json")
    assert res.status_code in [200, 201], res.data
    assert InterviewExperience.objects.filter(company=company, user=user1).exists()


@pytest.mark.django_db
def test_company_follow_toggle(auth_client, seeker_client, company, user2):
    res = seeker_client.post(f"/api/companies/{company.id}/toggle-follow/")
    assert res.status_code == 200
    assert res.data["is_following"] is True
    assert CompanyFollow.objects.filter(company=company, user=user2).exists()

    res2 = seeker_client.post(f"/api/companies/{company.id}/toggle-follow/")
    assert res2.data["is_following"] is False


@pytest.mark.django_db
def test_company_stats(auth_client, company):
    res = auth_client.get(f"/api/companies/{company.id}/stats/")
    assert res.status_code == 200
    assert "followers_count" in res.data
    assert "reviews_count" in res.data


@pytest.mark.django_db
def test_company_top(auth_client, company):
    res = auth_client.get("/api/companies/top/")
    assert res.status_code == 200
    assert isinstance(res.data, list)
    assert any("TestCompany" in c["name"] for c in res.data)


@pytest.mark.django_db
def test_company_vacancies(auth_client, company, user1):
    JobPost.objects.create(title="Backend Dev", employer=user1, company=company)
    res = auth_client.get(f"/api/companies/{company.id}/vacancies/")
    assert res.status_code == 200
    data = res.data["results"] if "results" in res.data else res.data
    assert any("Backend" in v.get("title", "") for v in data)

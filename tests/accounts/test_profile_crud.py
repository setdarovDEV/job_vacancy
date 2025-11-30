import pytest
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.test import APIClient
from accounts.models import Skill, Education, Certificate, WorkExperience
from django.core.files.uploadedfile import SimpleUploadedFile
from datetime import date

@pytest.fixture
def user(db):
    from accounts.models import CustomUser
    return CustomUser.objects.create_user(
        username="cruduser",
        password="12345",
        email="crud@example.com",
        is_email_verified=True,
    )

@pytest.fixture
def auth_client(user):
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client

# ✅ SKILL TESTS
@pytest.mark.django_db
def test_skill_crud(auth_client):
    # Create
    res = auth_client.post("/api/skills/", {"skills": ["Python", "Django"]}, format="json")
    assert res.status_code == 201
    assert Skill.objects.filter(name="Python").exists()

    # List
    res = auth_client.get("/api/skills/")
    assert res.status_code == 200
    assert any(s["name"] == "Python" for s in res.data)

# ✅ EDUCATION TESTS
@pytest.mark.django_db
def test_education_crud(auth_client):
    data = {
        "academy_name": "PDP Academy",
        "degree": "Backend Development",
        "start_year": 2022,
        "end_year": 2024
    }
    res = auth_client.post("/api/education/", data)
    assert res.status_code == 201
    edu_id = res.data["id"]

    res = auth_client.patch(f"/api/education/{edu_id}/", {"degree": "Advanced Backend"})
    assert res.status_code == 200

    res = auth_client.get("/api/education/")
    assert res.status_code == 200

    res = auth_client.delete(f"/api/education/{edu_id}/")
    assert res.status_code in [204, 200]

# ✅ CERTIFICATE TESTS
@pytest.mark.django_db
def test_certificate_crud(auth_client):
    file = SimpleUploadedFile("cert.pdf", b"fake file", content_type="application/pdf")
    data = {
        "name": "Django Expert",
        "organization": "PDP Academy",
        "issue_date": str(date.today()),
        "file": file,
    }
    res = auth_client.post("/api/certificates/", data, format="multipart")
    assert res.status_code == 201
    cert_id = res.data["id"]

    res = auth_client.get("/api/certificates/")
    assert res.status_code == 200
    data_list = res.data["results"] if isinstance(res.data, dict) and "results" in res.data else res.data
    assert any(c["name"] == "Django Expert" for c in data_list)

    res = auth_client.delete(f"/api/certificates/{cert_id}/")
    assert res.status_code in [204, 200]

# ✅ WORK EXPERIENCE TESTS
@pytest.mark.django_db
def test_work_experience_crud(auth_client):
    data = {
        "company_name": "BMG Soft",
        "position": "Backend Engineer",
        "start_date": "2023-01-01",
        "end_date": "2024-01-01",
        "description": "Developed API systems",
        "city": "Tashkent",
        "country": "Uzbekistan"
    }
    res = auth_client.post("/api/experiences/", data)
    assert res.status_code == 201
    exp_id = res.data["id"]

    res = auth_client.get("/api/experiences/")
    assert res.status_code == 200
    data_list = res.data["results"] if isinstance(res.data, dict) and "results" in res.data else res.data
    assert any(e["company_name"] == "BMG Soft" for e in data_list)

    res = auth_client.patch(f"/api/experiences/{exp_id}/", {"position": "Senior Backend"})
    assert res.status_code == 200

    res = auth_client.delete(f"/api/experiences/{exp_id}/")
    assert res.status_code in [204, 200]

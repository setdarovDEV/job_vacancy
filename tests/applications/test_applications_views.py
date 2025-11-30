import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from accounts.models import CustomUser
from vacancies.models import JobPost
from applications.models import JobApplication


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def employer(db):
    return CustomUser.objects.create_user(
        username="emp1", password="12345", role="EMPLOYER", first_name="Emp", last_name="Loyer"
    )


@pytest.fixture
def seeker(db):
    return CustomUser.objects.create_user(
        username="seek1", password="12345", role="JOB_SEEKER", first_name="Job", last_name="Seeker"
    )


@pytest.fixture
def auth_client(api_client, seeker):
    refresh = RefreshToken.for_user(seeker)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return api_client


@pytest.fixture
def employer_client(api_client, employer):
    refresh = RefreshToken.for_user(employer)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return api_client


@pytest.fixture
def job_post(employer):
    return JobPost.objects.create(title="Backend Dev", description="API dev", employer=employer)


# 1️⃣ APPLY success
@pytest.mark.django_db
def test_apply_success(auth_client, seeker, job_post):
    res = auth_client.post("/api/applications/apply/", {"job_post": job_post.id, "cover_letter": "Hello!"})
    assert res.status_code == 201
    assert JobApplication.objects.filter(applicant=seeker, job_post=job_post).exists()


# 2️⃣ APPLY — double apply bloklansin
@pytest.mark.django_db
def test_apply_twice_fails(auth_client, job_post):
    auth_client.post("/api/applications/apply/", {"job_post": job_post.id})
    res = auth_client.post("/api/applications/apply/", {"job_post": job_post.id})
    assert res.status_code == 400


# 3️⃣ APPLY — o‘zi yaratgan vakansiyaga bo‘lmasin
@pytest.mark.django_db
def test_apply_self_job_fails(employer_client, job_post):
    res = employer_client.post("/api/applications/apply/", {"job_post": job_post.id})
    assert res.status_code == 403  # ✅ permissiondan 403 chiqadi


# 4️⃣ EMPLOYER — o‘z vakansiyasidagi arizalarni ko‘radi
@pytest.mark.django_db
def test_employer_list_applications(employer_client, seeker, job_post):
    JobApplication.objects.create(job_post=job_post, applicant=seeker)
    url = f"/api/applications/jobs/{job_post.id}/applications/"
    res = employer_client.get(url)
    assert res.status_code == 200
    data = res.data["results"] if isinstance(res.data, dict) and "results" in res.data else res.data
    assert any(a["job_post"] == job_post.id for a in data)  # ✅ ID bo‘yicha


# 5️⃣ JOB SEEKER — arizasini bekor qiladi
@pytest.mark.django_db
def test_cancel_my_application(auth_client, seeker, job_post):
    JobApplication.objects.create(job_post=job_post, applicant=seeker)
    res = auth_client.delete(f"/api/applications/jobs/{job_post.id}/mine/")
    assert res.status_code == 204
    assert not JobApplication.objects.filter(job_post=job_post, applicant=seeker).exists()


# 6️⃣ EMPLOYER — applicant to‘liq profilini ko‘radi
@pytest.mark.django_db
def test_applicant_full_profile(employer_client, seeker, job_post):
    app = JobApplication.objects.create(job_post=job_post, applicant=seeker)
    url = f"/api/applications/{app.id}/applicant/"
    res = employer_client.get(url)
    assert res.status_code == 200
    assert "full_name" in res.data  # ✅ first_name emas
    assert res.data["full_name"] == seeker.get_full_name()


# 7️⃣ JOB SEEKER — o‘z arizalarini ko‘radi
@pytest.mark.django_db
def test_my_applications_list(auth_client, seeker, job_post):
    JobApplication.objects.create(job_post=job_post, applicant=seeker)
    res = auth_client.get("/api/applications/my/")
    assert res.status_code == 200
    data = res.data["results"] if isinstance(res.data, dict) and "results" in res.data else res.data
    assert any(a["job_post"] == job_post.id for a in data)  # ✅ ID bo‘yicha

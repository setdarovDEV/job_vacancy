import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from accounts.models import CustomUser
from companies.models import Company
from vacancies.models import JobPost, SavedJob, JobPostRating, PlanChoices


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


@pytest.fixture
def company(user1):
    return Company.objects.create(owner=user1, name="AliCorp", industry="IT", location="Tashkent")


# === YORDAMCHI FUNKSIYA ===
def extract_results(data):
    """Pagination bo‘lsa ham, bo‘lmasa ham data listini olish."""
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    if isinstance(data, (list, tuple)):
        return data
    return []


# === TESTLAR ===

@pytest.mark.django_db
def test_create_and_list_vacancy(auth_client, company, user1):
    res = auth_client.post(
        "/api/vacancies/jobposts/",
        {"title": "Python Developer", "description": "Backend dev kerak", "location": "Tashkent"},
        format="json",
    )
    assert res.status_code == 201
    job = JobPost.objects.filter(title="Python Developer").first()
    assert job is not None
    assert job.is_draft is True  # ✅ yangi vakansiya draft bo‘lib saqlanadi

    # endi uni listda ko‘rinmasligini tasdiqlaymiz
    list_res = auth_client.get("/api/vacancies/jobposts/")
    assert list_res.status_code == 200
    data = extract_results(list_res.data)
    assert all("Python Developer" not in j.get("title", "") for j in data)


@pytest.mark.django_db
def test_featured_vacancies(api_client, company, user1):
    JobPost.objects.create(
        employer=user1, company=company, title="Premium Dev", plan=PlanChoices.PREMIUM, is_draft=False
    )
    res = api_client.get("/api/vacancies/jobposts/featured/")
    assert res.status_code == 200
    data = extract_results(res.data)
    assert any("Premium Dev" in j.get("title", "") for j in data)


@pytest.mark.django_db
def test_recent_vacancies(api_client, company, user1):
    JobPost.objects.create(employer=user1, company=company, title="Newest Job", is_draft=False)
    res = api_client.get("/api/vacancies/jobposts/recent/")
    assert res.status_code == 200
    data = extract_results(res.data)
    assert any("Newest Job" in j.get("title", "") for j in data)


@pytest.mark.django_db
def test_rate_vacancy(auth_client, company, user1):
    job = JobPost.objects.create(employer=user1, company=company, title="Rate me", is_draft=False)
    res = auth_client.post(f"/api/vacancies/jobposts/{job.id}/rate/", {"stars": 4}, format="json")
    assert res.status_code == 200
    assert JobPostRating.objects.filter(job_post=job, user=user1, stars=4).exists()


@pytest.mark.django_db
def test_save_and_unsave_vacancy(auth_client, company, user1):
    job = JobPost.objects.create(employer=user1, company=company, title="Save me", is_draft=False)
    res1 = auth_client.post(f"/api/vacancies/jobposts/{job.id}/save/")
    assert res1.status_code == 200
    assert SavedJob.objects.filter(job_post=job, user=user1).exists()

    res2 = auth_client.delete(f"/api/vacancies/jobposts/{job.id}/save/")
    assert res2.status_code == 200
    assert not SavedJob.objects.filter(job_post=job, user=user1).exists()


@pytest.mark.django_db
def test_saved_jobs_list(auth_client, company, user1):
    job = JobPost.objects.create(employer=user1, company=company, title="Saved Job", is_draft=False)
    SavedJob.objects.create(job_post=job, user=user1)
    res = auth_client.get("/api/vacancies/jobposts/saved-jobs/")
    assert res.status_code == 200
    data = extract_results(res.data)
    assert any("Saved Job" in j.get("title", "") for j in data)


@pytest.mark.django_db
def test_vacancies_by_company(api_client, company, user1):
    job = JobPost.objects.create(employer=user1, company=company, title="AliCorp Dev", is_draft=False)
    res = api_client.get(f"/api/vacancies/jobposts/by-company/{company.id}/")
    assert res.status_code == 200
    data = extract_results(res.data)
    assert any("AliCorp Dev" in j.get("title", "") for j in data)

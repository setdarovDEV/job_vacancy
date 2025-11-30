import warnings
import pytest
import os
import tempfile
import pytest
from django.conf import settings

@pytest.fixture(autouse=True, scope="session")
def override_media_root(tmp_path_factory):
    """Tests paytida media fayllar uchun vaqtinchalik katalog."""
    temp_media = tmp_path_factory.mktemp("media_test")
    settings.MEDIA_ROOT = temp_media
    os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
    yield

@pytest.fixture(autouse=True, scope="session")
def silence_pagination_warning():
    warnings.filterwarnings(
        "ignore",
        message="Pagination may yield inconsistent results",
        category=UserWarning,
    )

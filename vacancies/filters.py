# vacancies/filters.py
from django.db.models import Q
from django_filters import FilterSet, CharFilter, NumberFilter

from .models import JobPost


class JobPostFilter(FilterSet):
    # 🔹 Custom search — title yoki description ichida
    search = CharFilter(method='filter_search')

    # 🔹 Oddiy field filterlar
    location = CharFilter(field_name="location", lookup_expr="icontains")
    salary_min = NumberFilter(field_name="budget_min", lookup_expr="gte")
    salary_max = NumberFilter(field_name="budget_max", lookup_expr="lte")
    plan = CharFilter(field_name="plan", lookup_expr="iexact")

    class Meta:
        model = JobPost
        fields = ['search', 'location', 'salary_min', 'salary_max', 'plan']

    def filter_search(self, queryset, name, value):
        """🔍 'search' parametri bo‘yicha qidiruv (title, description, company)"""
        return queryset.filter(
            Q(title__icontains=value) |
            Q(description__icontains=value) |
            Q(company__name__icontains=value)
        )

    def filter_queryset(self, queryset):
        """Faqat GET so‘rovlar uchun ishlasin"""
        request = getattr(self, 'request', None)
        if request and request.method == 'GET':
            queryset = super().filter_queryset(queryset)
            # faqat to‘ldirilgan (bo‘sh bo‘lmagan) vakansiyalarni qaytaramiz
            return queryset.filter(budget_min__isnull=False, budget_max__isnull=False)
        return queryset

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
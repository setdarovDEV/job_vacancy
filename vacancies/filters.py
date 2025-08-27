# vacancies/filters.py
import django_filters
from .models import JobPost

class JobPostFilter(django_filters.FilterSet):
    search = django_filters.CharFilter(field_name="title", lookup_expr="icontains")
    location = django_filters.CharFilter(field_name="location", lookup_expr="iexact")
    salary_min = django_filters.NumberFilter(field_name="budget_min", lookup_expr="gte")
    salary_max = django_filters.NumberFilter(field_name="budget_max", lookup_expr="lte")
    plan = django_filters.CharFilter(field_name="plan", lookup_expr="iexact")

    class Meta:
        model = JobPost
        fields = ['search', 'location', 'salary_min', 'salary_max', 'plan']

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        return queryset.filter(budget_min__isnull=False, budget_max__isnull=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        print("Filter params:", self.data)
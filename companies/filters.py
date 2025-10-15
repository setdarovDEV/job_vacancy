# companies/filters.py
from django_filters import rest_framework as filters
from .models import Company
from django.db.models import Count, Avg, Q

class CompanyFilter(filters.FilterSet):
    # UI: qidiruv alohida bor, lekin filter ham qabul qilsin
    q = filters.CharFilter(method='filter_q')
    industry = filters.CharFilter(field_name='industry', lookup_expr='icontains')
    location = filters.CharFilter(field_name='location', lookup_expr='icontains')

    rating_min = filters.NumberFilter(method='filter_rating_min')       # >= avg_rating
    followers_min = filters.NumberFilter(method='filter_followers_min') # >= followers_count
    has_vacancies = filters.BooleanFilter(method='filter_has_vacancies')# vacancies_count > 0

    class Meta:
        model = Company
        fields = ['industry', 'location']

    def filter_q(self, qs, name, value):
        return qs.filter(Q(name__icontains=value) | Q(description__icontains=value))

    def filter_rating_min(self, qs, name, value):
        return qs.filter(avg_rating__gte=value)

    def filter_followers_min(self, qs, name, value):
        return qs.filter(followers_count__gte=value)

    def filter_has_vacancies(self, qs, name, value: bool):
        if value:
            return qs.filter(vacancies_count__gt=0)
        return qs

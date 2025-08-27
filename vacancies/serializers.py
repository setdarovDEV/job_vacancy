from rest_framework import serializers

from companies.serializers import CompanySerializer
from .models import JobPost
from django.utils.timesince import timesince
from companies.models import Company
from django.utils.functional import cached_property


class JobPostSerializer(serializers.ModelSerializer):
    average_stars = serializers.SerializerMethodField()
    user_rating = serializers.SerializerMethodField()
    timeAgo = serializers.SerializerMethodField()
    budget = serializers.SerializerMethodField()
    ratings_count = serializers.SerializerMethodField()
    company = serializers.SerializerMethodField()
    otherVacancies = serializers.SerializerMethodField()

    # deadline ni keyin qo‘shamiz

    class Meta:
        model = JobPost
        fields = '__all__'  # yoki field list bo‘lsa, 'budget' ni ham qo‘sh
        read_only_fields = ['employer', 'created_at']

    def get_average_stars(self, obj):
        return obj.average_stars

    def get_user_rating(self, obj):
        request = self.context.get("request", None)
        if request and not request.user.is_anonymous:
            rating = obj.ratings.filter(user=request.user).first()
            return rating.stars if rating else 0
        return 0

    def get_timeAgo(self, obj):
        return timesince(obj.created_at).split(',')[0] + " назад"

    def get_budget(self, obj):
        if obj.budget_min and obj.budget_max:
            return f"{obj.budget_min} - {obj.budget_max} USD"
        elif obj.budget_min:
            return f"{obj.budget_min}+ USD"
        elif obj.budget_max:
            return f"до {obj.budget_max} USD"
        return "Не указано"

    def get_ratings_count(self, obj):
        return obj.ratings.count()

    def get_company(self, obj):
        # employer = obj.employer (foydalanuvchi)
        company = Company.objects.filter(owner=obj.employer).first()
        if company:
            return CompanySerializer(company, context=self.context).data
        return None

    def get_otherVacancies(self, obj):
        other_qs = JobPost.objects.filter(
            employer=obj.employer,
            is_filled=False  # faqat ochiq (active)
        ).exclude(id=obj.id)[:5]  # bu vakansiyadan tashqari

        return [
            {
                "id": vacancy.id,
                "title": vacancy.title
            }
            for vacancy in other_qs
        ]

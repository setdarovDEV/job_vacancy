from rest_framework import serializers
from .models import Resume

class ResumeSerializer(serializers.ModelSerializer):
    # Media fayllar to‘liq URL bo‘lib kelsin
    photo = serializers.ImageField(required=False, allow_null=True)
    cv_file = serializers.FileField(required=False, allow_null=True)

    class Meta:
        model = Resume
        fields = "__all__"
        read_only_fields = ["id", "user", "created_at", "updated_at", "views_count", "rating", "is_active"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        if request:
            for f in ("photo", "cv_file"):
                if data.get(f):
                    data[f] = request.build_absolute_uri(data[f])
        return data

    # Minimal validatsiya: skills va experience tip tekshirish
    def validate_skills(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("skills must be a list")
        return value

    def validate_experience(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("experience must be a list")
        return value

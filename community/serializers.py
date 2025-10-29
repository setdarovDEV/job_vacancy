from amqp import NotFound
from rest_framework import serializers, generics, permissions

from accounts.models import CustomUser
from accounts.serializers import UserProfileSerializer
from .models import Post, Comment

class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.username", read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "author", "author_name", "content", "created_at"]
        read_only_fields = ["author", "created_at"]


class PostSerializer(serializers.ModelSerializer):
    # ✅ Front friendly author object
    author = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()

    likes_count = serializers.IntegerField(read_only=True)         # from @property
    comments_count = serializers.IntegerField(read_only=True)
    shares_count = serializers.IntegerField(read_only=True)


    class Meta:
        model = Post
        fields = [
            "id",
            "author",           # nested dict
            "content",
            "image",
            "created_at",
            "updated_at",
            "likes_count",
            "comments_count",
            "is_liked",
            "is_owner",
            "shares_count",
        ]
        read_only_fields = ["created_at", "updated_at", "likes_count", "comments_count", "is_liked", "is_owner"]

    def get_author(self, obj):
        u = obj.author
        # full name fallback: first+last or username
        try:
            full_name = (u.get_full_name() or "").strip()
        except:
            full_name = ""
        if not full_name:
            fn = getattr(u, "first_name", "") or ""
            ln = getattr(u, "last_name", "") or ""
            full_name = (f"{fn} {ln}".strip() or getattr(u, "username", ""))

        # avatar: user.avatar yoki user.profile.avatar bo‘lishi mumkin
        avatar = None
        for attr in ["avatar", "photo", "image"]:
            if hasattr(u, attr) and getattr(u, attr):
                try:
                    avatar = getattr(u, attr).url
                    break
                except Exception:
                    pass
        if not avatar and hasattr(u, "profile"):
            prof = getattr(u, "profile")
            for attr in ["avatar", "photo", "image"]:
                if hasattr(prof, attr) and getattr(prof, attr):
                    try:
                        avatar = getattr(prof, attr).url
                        break
                    except Exception:
                        pass

        return {"id": u.id, "full_name": full_name, "avatar": avatar}

    def get_is_liked(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return obj.likes.filter(id=user.id).exists()

    def get_is_owner(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and obj.author_id == user.id)

    def create(self, validated_data):
        request = self.context.get("request")
        validated_data["author"] = request.user
        return super().create(validated_data)

class JobSeekerProfileView(generics.RetrieveAPIView):
    """
    JOB_SEEKER roldagi foydalanuvchining profilini qaytaradi.
    """
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = "id"

    def get_queryset(self):
        # Faqat job seeker foydalanuvchilar
        return CustomUser.objects.filter(role="JOB_SEEKER")

    def get_object(self):
        user = super().get_object()
        if user.role != "JOB_SEEKER":
            raise NotFound("Bu foydalanuvchi ish qidiruvchi emas.")
        return user


class EmployerProfileView(generics.RetrieveAPIView):
    """
    EMPLOYER roldagi foydalanuvchining profilini qaytaradi.
    """
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = "id"

    def get_queryset(self):
        # Faqat employer foydalanuvchilar
        return CustomUser.objects.filter(role="EMPLOYER")

    def get_object(self):
        user = super().get_object()
        if user.role != "EMPLOYER":
            raise NotFound("Bu foydalanuvchi ish beruvchi emas.")
        return user

class AnyUserProfileView(generics.RetrieveAPIView):
    """
    Har qanday foydalanuvchi (EMPLOYER yoki JOB_SEEKER) profilini qaytaradi.
    """
    queryset = CustomUser.objects.all()
    serializer_class = UserProfileSerializer
    lookup_field = "id"
    permission_classes = [permissions.AllowAny]
# chats/serializers.py
from rest_framework import serializers
from .models import Chat, Message
from accounts.serializers import UserPublicSerializer

class MessageSerializer(serializers.ModelSerializer):
    sender = UserPublicSerializer(read_only=True)
    is_me = serializers.SerializerMethodField()
    file = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id", "chat", "sender", "text",
            "file", "image", "created_at",
            "is_read", "is_me"
        ]
        read_only_fields = ["id", "chat", "sender", "created_at", "is_read"]

    def get_is_me(self, obj):
        request = self.context.get("request")
        if not request:
            return False
        return obj.sender == request.user

    def get_file(self, obj):
        request = self.context.get("request")
        if obj.file:
            return request.build_absolute_uri(obj.file.url) if request else obj.file.url
        return None

    def get_image(self, obj):
        request = self.context.get("request")
        if obj.image:
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None

class ChatSerializer(serializers.ModelSerializer):
    participants = UserPublicSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    other_user = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = ["id", "participants", "other_user", "last_message"]

    def get_last_message(self, obj):
        msg = obj.messages.order_by("-created_at").first()
        return MessageSerializer(msg).data if msg else None

    def get_other_user(self, obj):
        request = self.context.get("request")
        if not request:
            return None
        user = request.user
        other = obj.participants.exclude(id=user.id).first()
        return UserPublicSerializer(other).data if other else None

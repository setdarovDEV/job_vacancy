from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import Chat, Message

User = get_user_model()

class UserShortSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "profile_image"]

class MessageSerializer(serializers.ModelSerializer):
    sender = UserShortSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ["id", "chat", "sender", "text", "created_at", "is_read"]

class ChatSerializer(serializers.ModelSerializer):
    last_message = serializers.SerializerMethodField()
    participants = UserShortSerializer(many=True, read_only=True)  # 🔹 to‘liq user info

    class Meta:
        model = Chat
        fields = ["id", "participants", "last_message"]

    def get_last_message(self, obj):
        msg = obj.messages.order_by("-created_at").first()
        return MessageSerializer(msg).data if msg else None

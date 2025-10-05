# chats/serializers.py
from rest_framework import serializers
from .models import Chat, Message
from accounts.serializers import UserPublicSerializer


class MessageSerializer(serializers.ModelSerializer):
    sender = UserPublicSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ["id", "chat", "sender", "text", "created_at", "is_read"]


class ChatSerializer(serializers.ModelSerializer):
    participants = UserPublicSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    other_user = serializers.SerializerMethodField()  # 👈 qo‘shimcha maydon

    class Meta:
        model = Chat
        fields = ["id", "other_user", "last_message"]  # 👈 faqat keraklilar

    def get_last_message(self, obj):
        msg = obj.messages.order_by("-created_at").first()
        return MessageSerializer(msg).data if msg else None

    def get_other_user(self, obj):
        """Login bo‘lgan userdan tashqari qarshi tomondagi userni qaytaradi"""
        request = self.context.get("request")
        if not request:
            return None
        user = request.user
        other = obj.participants.exclude(id=user.id).first()
        return UserPublicSerializer(other).data if other else None

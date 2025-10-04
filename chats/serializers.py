from rest_framework import serializers
from .models import Chat, Message

class MessageSerializer(serializers.ModelSerializer):
    sender = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Message
        fields = ["id", "chat", "sender", "text", "created_at", "is_read"]


class ChatSerializer(serializers.ModelSerializer):
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = ["id", "participants", "last_message"]

    def get_last_message(self, obj):
        msg = obj.messages.order_by("-created_at").first()
        return MessageSerializer(msg).data if msg else None

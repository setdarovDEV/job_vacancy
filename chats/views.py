from rest_framework import viewsets, permissions
from .models import Chat, Message
from .serializers import ChatSerializer, MessageSerializer

class ChatViewSet(viewsets.ModelViewSet):
    serializer_class = ChatSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Chat.objects.filter(participants=self.request.user)


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        chat_id = self.kwargs.get("chat_pk")
        return Message.objects.filter(chat_id=chat_id).order_by("created_at")

    def perform_create(self, serializer):
        chat_id = self.kwargs.get("chat_pk")
        serializer.save(sender=self.request.user, chat_id=chat_id)

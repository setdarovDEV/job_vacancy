from rest_framework import viewsets, permissions, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Chat, Message
from .serializers import ChatSerializer, MessageSerializer

class ChatViewSet(viewsets.ModelViewSet):
    serializer_class = ChatSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Chat.objects.filter(participants=self.request.user)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = ChatSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="get_or_create")
    def get_or_create_chat(self, request):
        other_user_id = request.data.get("user_id")
        if not other_user_id:
            return Response({"detail": "user_id majburiy"}, status=status.HTTP_400_BAD_REQUEST)

        from accounts.models import CustomUser
        try:
            other_user = CustomUser.objects.get(id=other_user_id)
        except CustomUser.DoesNotExist:
            return Response({"detail": "Bunday foydalanuvchi yo‘q"}, status=status.HTTP_404_NOT_FOUND)

        # mavjud chatni topamiz
        chat = Chat.objects.filter(participants=request.user).filter(participants=other_user).first()

        # yo‘q bo‘lsa, yangisini yaratamiz
        if not chat:
            chat = Chat.objects.create()
            chat.participants.add(request.user, other_user)
            chat.save()

        return Response(ChatSerializer(chat, context={"request": request}).data)


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        chat_id = self.kwargs.get("chat_pk")
        return Message.objects.filter(chat_id=chat_id).order_by("created_at")

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = MessageSerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)

    def perform_create(self, serializer):
        chat_id = self.kwargs.get("chat_pk")
        text = self.request.data.get("text", "").strip()

        if not text:
            raise serializers.ValidationError({"text": "Xabar matni bo‘sh bo‘lmasligi kerak"})

        serializer.save(sender=self.request.user, chat_id=chat_id, text=text)
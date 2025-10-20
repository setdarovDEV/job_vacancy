# chats/views.py
from django.db import transaction
from django.db.models import OuterRef, Subquery
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework import viewsets, permissions, status, serializers
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from .models import Chat, Message
from .serializers import ChatSerializer, MessageSerializer
from accounts.models import CustomUser


@method_decorator(cache_page(10), name="list")
class ChatViewSet(viewsets.ModelViewSet):
    """
    Chatlar ro‘yxati, yaratish, va 'get_or_create' endpointi.
    """
    serializer_class = ChatSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Chatlar ro‘yxatini optimallashtirib oladi:
        - faqat userga tegishlilar
        - ishtirokchilarni va so‘nggi xabarni bir marta yuklaydi
        """
        user = self.request.user

        # 🔹 Oxirgi xabarni annotate qilish
        last_msg_sub = Message.objects.filter(
            chat=OuterRef("pk")
        ).order_by("-created_at").values("id")[:1]

        qs = (
            Chat.objects.filter(participants=user)
            .prefetch_related("participants")
            .annotate(last_msg_id=Subquery(last_msg_sub))
            .order_by("-created_at")
        )
        return qs

    def list(self, request, *args, **kwargs):
        """
        Foydalanuvchining barcha chatlarini qaytaradi.
        """
        queryset = self.get_queryset()
        serializer = ChatSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="get_or_create")
    def get_or_create_chat(self, request):
        """
        Boshqa foydalanuvchi bilan chatni topadi yoki yaratadi.
        """
        other_user_id = request.data.get("user_id")
        if not other_user_id:
            return Response({"detail": "user_id majburiy"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            other_user = CustomUser.objects.only("id").get(id=other_user_id)
        except CustomUser.DoesNotExist:
            return Response({"detail": "Bunday foydalanuvchi yo‘q"}, status=status.HTTP_404_NOT_FOUND)

        if other_user.id == request.user.id:
            return Response({"detail": "O‘zingiz bilan chat yaratib bo‘lmaydi."}, status=400)

        with transaction.atomic():
            chat = (
                Chat.objects.filter(participants=request.user)
                .filter(participants=other_user)
                .first()
            )
            if not chat:
                chat = Chat.objects.create()
                chat.participants.add(request.user, other_user)
                chat.save()

        return Response(ChatSerializer(chat, context={"request": request}).data, status=200)


class MessageViewSet(viewsets.ModelViewSet):
    """
    Chat ichidagi xabarlar: olish va yuborish.
    """
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        chat_id = self.kwargs.get("chat_pk")

        # 🔹 Faqat shu chatga tegishli xabarlar
        qs = (
            Message.objects
            .select_related("sender", "chat")
            .only(
                "id", "chat_id", "text", "file", "image",
                "sender__id", "sender__first_name", "sender__last_name", "sender__profile_image",
                "created_at", "is_read"
            )
            .filter(chat_id=chat_id)
            .order_by("created_at")
        )

        # 🔹 Oxirgi 100 ta xabarni qaytarish (optimallashtirish)
        limit = int(self.request.query_params.get("limit", 100))
        return qs.reverse()[:limit][::-1]  # so‘nggi xabarlar

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = MessageSerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)

    def perform_create(self, serializer):
        chat_id = self.kwargs.get("chat_pk")

        text = self.request.data.get("text", "").strip()
        file = self.request.data.get("file")
        image = self.request.data.get("image")

        # ❗ kamida bittasi bo‘lishi kerak
        if not text and not file and not image:
            raise serializers.ValidationError({
                "detail": "Kamida bitta maydon (text, file yoki image) bo‘lishi kerak."
            })

        # ✅ Transaction xavfsiz yuborish
        with transaction.atomic():
            msg = serializer.save(
                sender=self.request.user,
                chat_id=chat_id,
                text=text or None,
                file=file if file else None,
                image=image if image else None,
            )

        # ✅ avtomatik “read” status (o‘z xabarlarini o‘qilgan deb belgilash)
        msg.is_read = True
        msg.save(update_fields=["is_read"])

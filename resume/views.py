from rest_framework import viewsets, permissions, decorators, response, status
from .models import Resume
from .serializers import ResumeSerializer

class IsOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.user_id == request.user.id

class ResumeViewSet(viewsets.ModelViewSet):
    serializer_class = ResumeSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        # faqat o'z rezyumelari
        return Resume.objects.filter(user=self.request.user)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    # /resumes/my/ — faol (yoki oxirgi) resume’ni olish
    @decorators.action(detail=False, methods=["get"], url_path="my")
    def my_resume(self, request):
        resume = self.get_queryset().order_by("-updated_at").first()
        if not resume:
            return response.Response({}, status=status.HTTP_204_NO_CONTENT)
        ser = self.get_serializer(resume)
        return response.Response(ser.data)

    # /resumes/my/ — PATCH bilan tezkor yangilash
    @decorators.action(detail=False, methods=["patch"], url_path="my")
    def update_my_resume(self, request):
        resume = self.get_queryset().order_by("-updated_at").first()
        if not resume:
            return response.Response({"detail": "Resume not found."}, status=404)
        ser = self.get_serializer(resume, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return response.Response(ser.data)

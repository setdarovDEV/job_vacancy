from django.db import models
from django.conf import settings
import os
from django.utils.timezone import now

User = settings.AUTH_USER_MODEL

def upload_post_media(instance, filename):
    ext = filename.split('.')[-1]
    filename = f"{now().strftime('%Y%m%d%H%M%S')}.{ext}"
    return os.path.join("community/posts", str(instance.author_id or "anon"), filename)

class Post(models.Model):
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="posts")
    content = models.TextField()
    image = models.ImageField(upload_to=upload_post_media, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    likes = models.ManyToManyField(User, related_name="liked_posts", blank=True)
    shares_count = models.PositiveIntegerField(default=0)

    # ➕ Frontga kerak bo‘ladigan denormalized field
    comments_count = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.author} - {self.content[:30]}"

    @property
    def likes_count(self):
        return self.likes.count()


class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Comment by {self.author} on {self.post}"

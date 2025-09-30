from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Comment, Post


@receiver([post_save, post_delete], sender=Comment)
def update_post_comments(sender, instance, **kwargs):
    Post.objects.filter(pk=instance.post_id).update(
        comments_count=instance.post.comments.count()
    )

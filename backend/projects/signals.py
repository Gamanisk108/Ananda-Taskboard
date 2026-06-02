from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import DEFAULT_SUBPROJECT_NAME, Project, SubProject


@receiver(post_save, sender=Project)
def create_default_subproject(sender, instance, created, **kwargs):
    """Every new Project gets a default 'General' sub-project so a Task always
    lives under a sub-project. Idempotent: never creates a second default."""
    if not created:
        return
    if not instance.subprojects.filter(is_default=True).exists():
        SubProject.objects.create(
            project=instance, name=DEFAULT_SUBPROJECT_NAME, is_default=True
        )

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0017_subtask_assignee"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="comment",
            name="mentions",
            field=models.ManyToManyField(blank=True, related_name="comment_mentions", to=settings.AUTH_USER_MODEL),
        ),
    ]

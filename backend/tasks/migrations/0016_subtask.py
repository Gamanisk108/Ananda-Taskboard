import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0015_task_priority"),
    ]

    operations = [
        migrations.CreateModel(
            name="Subtask",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=300)),
                ("status", models.CharField(default="todo", max_length=12)),
                ("order", models.PositiveIntegerField(default=0)),
                ("task", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="subtasks", to="tasks.task")),
            ],
            options={"ordering": ["order", "id"]},
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0013_task_times"),
    ]

    operations = [
        migrations.AddField(
            model_name="recurrencerule",
            name="weekdays",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
    ]

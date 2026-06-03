from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0012_calendarevent_kinds"),
    ]

    operations = [
        migrations.AddField(
            model_name="task",
            name="start_time",
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="task",
            name="end_time",
            field=models.TimeField(blank=True, null=True),
        ),
    ]

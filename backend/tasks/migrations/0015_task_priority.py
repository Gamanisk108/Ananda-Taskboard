from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0014_recurrencerule_weekdays"),
    ]

    operations = [
        migrations.AddField(
            model_name="task",
            name="priority",
            field=models.PositiveSmallIntegerField(
                choices=[(1, "Lowest"), (2, "Low"), (3, "Medium"), (4, "High"), (5, "Highest")],
                default=3,
            ),
        ),
    ]

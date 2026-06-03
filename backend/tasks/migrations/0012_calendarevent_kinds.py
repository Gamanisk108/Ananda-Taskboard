from django.db import migrations, models


def yearly_to_kind(apps, schema_editor):
    CalendarEvent = apps.get_model("tasks", "CalendarEvent")
    CalendarEvent.objects.filter(yearly=True).update(kind="yearly")


def kind_to_yearly(apps, schema_editor):
    CalendarEvent = apps.get_model("tasks", "CalendarEvent")
    CalendarEvent.objects.filter(kind="yearly").update(yearly=True)


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0011_historyday"),
    ]

    operations = [
        migrations.AddField(
            model_name="calendarevent",
            name="kind",
            field=models.CharField(
                choices=[
                    ("single", "Single date"),
                    ("yearly", "Yearly"),
                    ("range", "Date range"),
                    ("repeating", "Repeating"),
                ],
                default="single",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="calendarevent",
            name="end_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="calendarevent",
            name="weekdays",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="calendarevent",
            name="interval",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="calendarevent",
            name="count",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.RunPython(yearly_to_kind, kind_to_yearly),
        migrations.RemoveField(
            model_name="calendarevent",
            name="yearly",
        ),
    ]

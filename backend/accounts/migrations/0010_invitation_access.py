from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0009_view_access_levels")]

    operations = [
        migrations.AddField(
            model_name="invitation",
            name="access",
            field=models.JSONField(blank=True, default=list),
        ),
    ]

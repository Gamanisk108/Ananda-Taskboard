# Enrich a handful of demo tasks so Board/Weekly/Monthly exercise the design's
# avatars, varied status pills, deadlines, and subtask bars. Run:
#   manage.py shell < qa/enrich_demo.py
import datetime
from django.contrib.auth import get_user_model
from tasks.models import Task, Subtask, Status

U = get_user_model()
users = list(U.objects.all()[:6])
keys = [s.key for s in Status.objects.order_by("order", "id")] or ["todo", "in_progress", "delayed", "done"]
today = datetime.date.today()
tasks = list(Task.objects.order_by("id")[:12])

for i, t in enumerate(tasks):
    t.status = keys[i % len(keys)]
    t.deadline = today + datetime.timedelta(days=(i % 7) - 3)  # mix past/today/future
    t.save(update_fields=["status", "deadline"])
    if users:
        t.assignees.set(users[: (i % 3) + 1])

for t in tasks[:4]:
    Subtask.objects.filter(task=t).delete()
    for j, sk in enumerate(keys[:3]):
        Subtask.objects.create(task=t, title=f"Step {j + 1}", status=sk, order=j)

print("enriched", len(tasks), "tasks |", len(users), "users |", "statuses:", keys)

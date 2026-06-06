import datetime
from tasks.models import Task
today = datetime.date.today()
ts = list(Task.objects.order_by("id")[:6])
spans = [(-3, 2), (-2, 1), (0, 3), (-4, 0), (1, 4)]
for i, t in enumerate(ts[:5]):
    a, b = spans[i]
    t.timeline_start = today + datetime.timedelta(days=a)
    t.timeline_end = today + datetime.timedelta(days=b)
    t.deadline = today + datetime.timedelta(days=b)
    t.save(update_fields=["timeline_start", "timeline_end", "deadline"])
print("multi-day spans set on", len(ts[:5]), "tasks; today =", today)

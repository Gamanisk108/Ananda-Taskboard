"""Calendar events (birthdays / major dated notes). Admin write; everyone reads.
The range endpoint expands `yearly` events into the requested window."""

from datetime import date, datetime

from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from permissions.drf import IsAdminOrReadOnly

from .models import CalendarEvent, Status
from .serializers import CalendarEventSerializer, StatusSerializer


class CalendarEventViewSet(viewsets.ModelViewSet):
    """CRUD for events. Admins write; any authenticated user can read the list."""

    queryset = CalendarEvent.objects.all()
    serializer_class = CalendarEventSerializer
    permission_classes = [IsAdminOrReadOnly]


class StatusViewSet(viewsets.ModelViewSet):
    """Universal task statuses (Kanban columns). Everyone reads; admins edit."""

    queryset = Status.objects.all()
    serializer_class = StatusSerializer
    permission_classes = [IsAdminOrReadOnly]


def _parse(d, field):
    try:
        return datetime.strptime(d, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise ValidationError({field: "Expected YYYY-MM-DD."})


class EventsRangeView(APIView):
    """Events occurring within [from, to], expanding yearly ones to each year."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        start = _parse(request.query_params.get("from"), "from")
        end = _parse(request.query_params.get("to"), "to")
        out = []
        for ev in CalendarEvent.objects.all():
            if ev.yearly:
                for yr in range(start.year, end.year + 1):
                    try:
                        d = ev.date.replace(year=yr)
                    except ValueError:  # Feb 29 in a non-leap year → skip
                        continue
                    if start <= d <= end:
                        out.append({"id": ev.id, "date": d.isoformat(), "title": ev.title, "yearly": True})
            elif start <= ev.date <= end:
                out.append({"id": ev.id, "date": ev.date.isoformat(), "title": ev.title, "yearly": False})
        out.sort(key=lambda e: e["date"])
        return Response(out)

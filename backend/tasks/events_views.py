"""Calendar events (birthdays, retreats, class series). Admin write; everyone reads.
The range endpoint expands each event into concrete occurrence spans for the
requested window: single days, yearly birthdays, multi-day ranges, and weekly
multi-weekday repeats."""

from datetime import datetime

from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from permissions.drf import IsAdminOrReadOnly

from .models import CalendarEvent, Status
from .recurrence import event_weekly_dates
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


def _span(ev, start, end):
    """One occurrence-span dict {id, title, kind, yearly, start, end}."""
    return {
        "id": ev.id,
        "title": ev.title,
        "kind": ev.kind,
        "yearly": ev.kind == CalendarEvent.Kind.YEARLY,
        "start": start.isoformat(),
        "end": end.isoformat(),
    }


def expand_event(ev, window_start, window_end):
    """Expand a CalendarEvent into the occurrence spans that intersect the window.

    Spans carry their TRUE start/end (not clipped to the window) so the calendar
    can position bars correctly and clip per visible week itself.
    """
    if ev.kind == CalendarEvent.Kind.YEARLY:
        out = []
        for yr in range(window_start.year, window_end.year + 1):
            try:
                d = ev.date.replace(year=yr)
            except ValueError:  # Feb 29 in a non-leap year → skip
                continue
            if window_start <= d <= window_end:
                out.append(_span(ev, d, d))
        return out

    if ev.kind == CalendarEvent.Kind.RANGE:
        end = ev.end_date or ev.date
        if ev.date <= window_end and end >= window_start:  # overlaps the window
            return [_span(ev, ev.date, end)]
        return []

    if ev.kind == CalendarEvent.Kind.REPEATING:
        dates = event_weekly_dates(
            ev.date, ev.weekday_list(), ev.interval, ev.count, ev.end_date,
            window_start, window_end,
        )
        return [_span(ev, d, d) for d in dates]

    # single
    if window_start <= ev.date <= window_end:
        return [_span(ev, ev.date, ev.date)]
    return []


class EventsRangeView(APIView):
    """Occurrence spans for every event intersecting [from, to]."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        start = _parse(request.query_params.get("from"), "from")
        end = _parse(request.query_params.get("to"), "to")
        out = []
        for ev in CalendarEvent.objects.all():
            out.extend(expand_event(ev, start, end))
        out.sort(key=lambda e: (e["start"], e["title"]))
        return Response(out)

"""Calendar events (birthdays, retreats, class series). Admin write; everyone reads.
The range endpoint expands each event into concrete occurrence spans for the
requested window: single days, yearly birthdays, multi-day ranges, and weekly
multi-weekday repeats."""

from datetime import date, datetime

from django.db.models import Q
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from permissions.drf import IsAdminOrReadOnly
from permissions.engine import is_org_admin

from .holidays_feed import AVAILABLE_SETS, DEFAULT_SETS, holidays_in_range
from .models import CalendarEvent, PersonalHoliday, Status
from .recurrence import event_weekly_dates
from .serializers import CalendarEventSerializer, PersonalHolidaySerializer, StatusSerializer


def _org(request):
    return getattr(request, "org", None)


class CalendarEventViewSet(viewsets.ModelViewSet):
    """CRUD for events (D47 personal scope). Org-wide events (owner null) are
    admin-set and locked for members; a member may freely create/edit/delete
    their OWN personal events (owner=self), which show only on their board."""

    queryset = CalendarEvent.objects.all()
    serializer_class = CalendarEventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        org = _org(self.request)
        user = self.request.user
        base = CalendarEvent.objects.filter(organization=org) if org is not None else CalendarEvent.objects.all()
        # Members see org-wide events (owner null) + their own personal events.
        return base.filter(Q(owner__isnull=True) | Q(owner=user))

    def perform_create(self, serializer):
        org = _org(self.request)
        if bool(self.request.data.get("personal")):
            serializer.save(organization=org, owner=self.request.user)
        else:
            if not is_org_admin(self.request.user, org):
                raise PermissionDenied("Only an admin can add a team-wide event.")
            serializer.save(organization=org, owner=None)

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method in ("PUT", "PATCH", "DELETE"):
            if obj.owner_id is None:
                if not is_org_admin(request.user, _org(request)):
                    raise PermissionDenied("Only an admin can change a team-wide event.")
            elif obj.owner_id != request.user.id:
                raise PermissionDenied("You can only change your own personal events.")


class PersonalHolidayViewSet(viewsets.ModelViewSet):
    """A member's own yearly holidays (D47) — always owner-scoped, fully editable
    by the owner, invisible to everyone else."""

    serializer_class = PersonalHolidaySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PersonalHoliday.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


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
    """One occurrence-span dict {id, title, kind, yearly, personal, start, end}."""
    return {
        "id": ev.id,
        "title": ev.title,
        "kind": ev.kind,
        "yearly": ev.kind == CalendarEvent.Kind.YEARLY,
        "personal": ev.owner_id is not None,
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
        org = _org(request)
        user = request.user
        base = CalendarEvent.objects.filter(organization=org) if org is not None else CalendarEvent.objects.all()
        # Org-wide events + this member's own personal events (theirs alone).
        events = base.filter(Q(owner__isnull=True) | Q(owner=user))
        out = []
        for ev in events:
            out.extend(expand_event(ev, start, end))
        out.sort(key=lambda e: (e["start"], e["title"]))
        return Response(out)


class HolidaysRangeView(APIView):
    """Computed holiday spans for the active org, intersecting [from, to]."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        start = _parse(request.query_params.get("from"), "from")
        end = _parse(request.query_params.get("to"), "to")
        org = _org(request)
        sets = org.enabled_holiday_sets if (org and org.enabled_holiday_sets) else DEFAULT_SETS
        out = holidays_in_range(tuple(sets), start, end)
        # Member's own personal holidays (D47): expand each yearly across the window.
        for ph in PersonalHoliday.objects.filter(owner=request.user):
            for yr in range(start.year, end.year + 1):
                try:
                    d = date(yr, ph.month, ph.day)
                except ValueError:
                    continue  # Feb 29 in a non-leap year
                if start <= d <= end:
                    out.append({
                        "title": ph.name, "set": "personal", "holiday": True,
                        "personal": True, "start": d.isoformat(), "end": d.isoformat(),
                    })
        out.sort(key=lambda h: (h["start"], h["title"]))
        return Response(out)


class HolidaySettingsView(APIView):
    """GET the active org's enabled holiday sets (+ the full available list);
    PATCH to change them (admins only). Country packs use `country:XX` keys."""

    permission_classes = [IsAdminOrReadOnly]

    def get(self, request):
        org = _org(request)
        enabled = org.enabled_holiday_sets if (org and org.enabled_holiday_sets) else DEFAULT_SETS
        return Response({"enabled": enabled, "available": AVAILABLE_SETS})

    def patch(self, request):
        org = _org(request)
        if org is None:
            raise ValidationError("No active organization.")
        sets = request.data.get("enabled")
        if not isinstance(sets, list) or any(not isinstance(s, str) for s in sets):
            raise ValidationError({"enabled": "Expected a list of set keys."})
        allowed = set(AVAILABLE_SETS)
        bad = [s for s in sets if s not in allowed and not s.startswith("country:")]
        if bad:
            raise ValidationError({"enabled": f"Unknown sets: {bad}"})
        org.enabled_holiday_sets = sets
        org.save(update_fields=["enabled_holiday_sets"])
        return Response({"enabled": sets, "available": AVAILABLE_SETS})

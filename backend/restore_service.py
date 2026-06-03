"""Restore points — full-board snapshots an admin can save and restore to.

A snapshot serializes the whole board (groups, projects, sub-projects, recurrence
rules, tasks, occurrences, comments, events, access grants) in dependency order.
Restoring first auto-saves the current state (so a restore is itself undoable),
then replaces all board data with the snapshot — inside a transaction, so a
failure rolls back and changes nothing.

Retention: auto-saves (daily + before-restore) are pruned to the last
MAX_AUTO; manual saves are kept forever.
"""

import json
from itertools import chain

from django.core import serializers
from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import serializers as drf

from accounts.models import Group
from permissions.drf import IsAdmin
from permissions.models import AccessGrant
from projects.models import Project, SubProject
from tasks.models import CalendarEvent, Comment, RecurrenceRule, RestorePoint, Task, TaskOccurrence

MAX_AUTO = 10


def _all_objs():
    # dependency order for deserialize/save (FK targets first)
    return chain(
        Group.objects.all(),
        Project.all_objects.all(),
        SubProject.all_objects.all(),
        RecurrenceRule.objects.all(),
        Task.all_objects.all(),
        TaskOccurrence.objects.all(),
        Comment.objects.all(),
        CalendarEvent.objects.all(),
        AccessGrant.objects.all(),
    )


def capture_data():
    return json.loads(serializers.serialize("json", _all_objs()))


def board_stats():
    return {
        "projects": Project.objects.count(),
        "subprojects": SubProject.objects.count(),
        "tasks": Task.objects.count(),
        "events": CalendarEvent.objects.count(),
        "groups": Group.objects.count(),
        "grants": AccessGrant.objects.count(),
    }


def prune_auto(keep=MAX_AUTO):
    extra = list(
        RestorePoint.objects.filter(auto=True).order_by("-created_at").values_list("id", flat=True)[keep:]
    )
    if extra:
        RestorePoint.objects.filter(id__in=extra).delete()


def save_point(label, auto=False):
    rp = RestorePoint.objects.create(label=label, auto=auto, data=capture_data(), stats=board_stats())
    if auto:
        prune_auto()
    return rp


def _restore_data(data):
    from django.db.models.signals import post_save
    from projects.signals import create_default_subproject

    raw = json.dumps(data)
    # Disable the "auto-create default sub-project" signal during restore, so the
    # snapshot's exact sub-projects load without colliding with auto-created ones.
    post_save.disconnect(create_default_subproject, sender=Project)
    try:
        with transaction.atomic():
            # delete current board in reverse dependency order (hard delete)
            AccessGrant.objects.all().delete()
            CalendarEvent.objects.all().delete()
            Comment.objects.all().delete()
            TaskOccurrence.objects.all().delete()
            Task.all_objects.all().delete()
            RecurrenceRule.objects.all().delete()
            SubProject.all_objects.all().delete()
            Project.all_objects.all().delete()
            Group.objects.all().delete()
            for obj in serializers.deserialize("json", raw, ignorenonexistent=True):
                obj.save()
    finally:
        post_save.connect(create_default_subproject, sender=Project)


def restore_point(rp):
    """Auto-save current state, then restore the snapshot."""
    save_point(f"Before restore — {timezone.now().strftime('%Y-%m-%d %H:%M')}", auto=True)
    _restore_data(rp.data)


def daily_autosave():
    return save_point(f"Daily auto-save — {timezone.now().strftime('%Y-%m-%d')}", auto=True)


# --- API (admin) ------------------------------------------------------------

class RestorePointSerializer(drf.ModelSerializer):
    class Meta:
        model = RestorePoint
        fields = ["id", "label", "auto", "stats", "created_at"]  # omit bulky `data`


class RestorePointViewSet(viewsets.ModelViewSet):
    queryset = RestorePoint.objects.all()
    serializer_class = RestorePointSerializer
    permission_classes = [IsAdmin]
    http_method_names = ["get", "post", "delete"]

    def perform_create(self, serializer):
        # manual save (current board), ignoring any client-sent data
        save_point(serializer.validated_data.get("label") or "Manual save", auto=False)

    def create(self, request, *args, **kwargs):
        label = request.data.get("label") or "Manual save"
        rp = save_point(label, auto=False)
        return Response(RestorePointSerializer(rp).data, status=201)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        rp = self.get_object()
        restore_point(rp)
        return Response({"restored": rp.id, "stats": board_stats()})

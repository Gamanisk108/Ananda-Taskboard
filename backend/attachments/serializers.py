from django.core import signing
from rest_framework import serializers

from .models import Attachment


class AttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = ["id", "filename", "content_type", "kind", "size",
                  "uploaded_by_name", "url", "created_at"]

    def get_uploaded_by_name(self, obj):
        u = obj.uploaded_by
        return (u.name or u.email) if u else None

    def get_url(self, obj):
        # Capability URL: the list endpoint is permission-gated, so only an
        # authorized viewer ever receives this signed, short-lived link. Lets an
        # <img>/<video> tag (no auth header) load the private file via a 302 to R2.
        token = signing.dumps(obj.id, salt="att-file")
        return f"/api/attachments/{obj.id}/file?t={token}"

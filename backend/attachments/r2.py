"""Thin Cloudflare R2 (S3-compatible) helper. Presigned PUT for direct browser
uploads (bytes never touch Render), presigned GET for authenticated serving."""
from django.conf import settings


def is_configured() -> bool:
    return bool(
        settings.R2_ENDPOINT_URL and settings.R2_ACCESS_KEY_ID
        and settings.R2_SECRET_ACCESS_KEY and settings.R2_BUCKET
    )


def _client():
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def presign_put(key: str, content_type: str, expires: int = 300) -> str:
    return _client().generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.R2_BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=expires,
    )


def presign_get(key: str, filename: str = "", expires: int = 300) -> str:
    params = {"Bucket": settings.R2_BUCKET, "Key": key}
    if filename:
        params["ResponseContentDisposition"] = f'inline; filename="{filename}"'
    return _client().generate_presigned_url("get_object", Params=params, ExpiresIn=expires)


def head(key: str):
    """Return the object's HEAD metadata, or None if it isn't there."""
    try:
        return _client().head_object(Bucket=settings.R2_BUCKET, Key=key)
    except Exception:
        return None


def delete(key: str) -> None:
    try:
        _client().delete_object(Bucket=settings.R2_BUCKET, Key=key)
    except Exception:
        pass

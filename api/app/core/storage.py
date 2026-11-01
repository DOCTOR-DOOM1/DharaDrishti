"""S3/MinIO client for object storage operations."""

import boto3
from botocore.client import Config as BotoConfig
from app.core.config import get_settings


def get_s3_client():
    """Create a boto3 S3 client configured for MinIO."""
    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        config=BotoConfig(signature_version="s3v4"),
        region_name="us-east-1",
    )


def upload_file(local_path: str, s3_key: str, content_type: str = None):
    """Upload a local file to MinIO."""
    settings = get_settings()
    s3 = get_s3_client()
    extra_args = {}
    if content_type:
        extra_args["ContentType"] = content_type
    s3.upload_file(local_path, settings.minio_bucket, s3_key, ExtraArgs=extra_args)


def get_presigned_url(s3_key: str, expires_in: int = 3600) -> str:
    """Generate a presigned URL for an object."""
    settings = get_settings()
    s3 = get_s3_client()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.minio_bucket, "Key": s3_key},
        ExpiresIn=expires_in,
    )


def object_exists(s3_key: str) -> bool:
    """Check if an object exists in MinIO."""
    settings = get_settings()
    s3 = get_s3_client()
    try:
        s3.head_object(Bucket=settings.minio_bucket, Key=s3_key)
        return True
    except s3.exceptions.ClientError:
        return False

from functools import lru_cache

import boto3
from botocore.client import BaseClient

from mirror.core.config import get_settings


@lru_cache
def get_s3_client() -> BaseClient:
    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key.get_secret_value(),
        aws_secret_access_key=settings.s3_secret_key.get_secret_value(),
        region_name=settings.s3_region,
    )


def create_upload_url(object_key: str, content_type: str, expires_in: int = 900) -> str:
    settings = get_settings()
    return str(
        get_s3_client().generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.s3_bucket,
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )
    )

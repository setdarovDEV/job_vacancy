#!/bin/sh
# One-shot (minio-init service): the API's own MinIO user, limited to the two app buckets,
# so S3_ACCESS_KEY/S3_SECRET_KEY are never the root credentials. Idempotent: re-running
# updates the secret and the policy. The API creates the buckets and the public-read policy
# itself on start (storage.EnsureBuckets).
set -eu
: "${MINIO_ROOT_USER:?}" "${MINIO_ROOT_PASSWORD:?}" "${S3_ACCESS_KEY:?}" "${S3_SECRET_KEY:?}"
endpoint=${MINIO_ENDPOINT:-http://minio:9000}
export MC_CONFIG_DIR=/tmp/.mc
mc alias set jv "$endpoint" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
cat >/tmp/jv-app-policy.json <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:*"],
      "Resource": [
        "arn:aws:s3:::jv-public", "arn:aws:s3:::jv-public/*",
        "arn:aws:s3:::jv-private", "arn:aws:s3:::jv-private/*"
      ]
    }
  ]
}
JSON
mc admin policy create jv jv-app /tmp/jv-app-policy.json >/dev/null
mc admin user add jv "$S3_ACCESS_KEY" "$S3_SECRET_KEY" >/dev/null
mc admin policy attach jv jv-app --user "$S3_ACCESS_KEY" >/dev/null 2>&1 || true
mc admin user info jv "$S3_ACCESS_KEY" | grep -q 'jv-app' || { echo "minio-init: policy jv-app not attached" >&2; exit 1; }
echo "minio-init: user $S3_ACCESS_KEY limited to jv-public, jv-private"

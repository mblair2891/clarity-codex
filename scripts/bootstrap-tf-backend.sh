#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AWS_CLI="${AWS_CLI:-$ROOT_DIR/aws/dist/aws}"
AWS_REGION="${AWS_REGION:-us-east-1}"

if [[ ! -x "$AWS_CLI" ]]; then
  AWS_CLI="aws"
fi

ACCOUNT_ID="$("$AWS_CLI" sts get-caller-identity --query Account --output text)"
TF_STATE_BUCKET="${TF_STATE_BUCKET:-clarity-beta-tf-state-$ACCOUNT_ID}"
TF_LOCK_TABLE="${TF_LOCK_TABLE:-clarity-beta-tf-locks}"

if ! "$AWS_CLI" s3api head-bucket --bucket "$TF_STATE_BUCKET" 2>/dev/null; then
  if [[ "$AWS_REGION" == "us-east-1" ]]; then
    "$AWS_CLI" s3api create-bucket --bucket "$TF_STATE_BUCKET" >/dev/null
  else
    "$AWS_CLI" s3api create-bucket \
      --bucket "$TF_STATE_BUCKET" \
      --create-bucket-configuration "LocationConstraint=$AWS_REGION" >/dev/null
  fi
fi

"$AWS_CLI" s3api put-bucket-versioning \
  --bucket "$TF_STATE_BUCKET" \
  --versioning-configuration Status=Enabled >/dev/null

"$AWS_CLI" s3api put-bucket-encryption \
  --bucket "$TF_STATE_BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' >/dev/null

if ! "$AWS_CLI" dynamodb describe-table --table-name "$TF_LOCK_TABLE" --region "$AWS_REGION" >/dev/null 2>&1; then
  "$AWS_CLI" dynamodb create-table \
    --table-name "$TF_LOCK_TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$AWS_REGION" >/dev/null
fi

cat <<EOF
TF_STATE_BUCKET=$TF_STATE_BUCKET
TF_LOCK_TABLE=$TF_LOCK_TABLE
AWS_REGION=$AWS_REGION
EOF

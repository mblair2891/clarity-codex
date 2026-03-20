#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AWS_CLI="${AWS_CLI:-$ROOT_DIR/aws/dist/aws}"
AWS_REGION="${AWS_REGION:-us-east-1}"
IMAGE_TAG="${IMAGE_TAG:-$(git -C "$ROOT_DIR" rev-parse --short HEAD)}"
TF_DIR="$ROOT_DIR/infra/aws"

if [[ ! -x "$AWS_CLI" ]]; then
  AWS_CLI="aws"
fi

if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform is required but not installed." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but not installed." >&2
  exit 1
fi

eval "$("$ROOT_DIR/scripts/bootstrap-tf-backend.sh" | grep -E '^[A-Z_][A-Z0-9_]*=' | sed 's/^/export /')"

terraform -chdir="$TF_DIR" init \
  -backend-config="bucket=$TF_STATE_BUCKET" \
  -backend-config="key=beta/terraform.tfstate" \
  -backend-config="region=$AWS_REGION" \
  -backend-config="dynamodb_table=$TF_LOCK_TABLE"

terraform -chdir="$TF_DIR" apply -auto-approve \
  -target=aws_ecr_repository.web \
  -target=aws_ecr_repository.api \
  -target=aws_ecr_lifecycle_policy.web \
  -target=aws_ecr_lifecycle_policy.api

WEB_REPO="$(terraform -chdir="$TF_DIR" output -raw ecr_web_repository_url)"
API_REPO="$(terraform -chdir="$TF_DIR" output -raw ecr_api_repository_url)"

"$AWS_CLI" ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "${WEB_REPO%/*}"

docker build -f "$ROOT_DIR/apps/web/Dockerfile" -t "$WEB_REPO:$IMAGE_TAG" "$ROOT_DIR"
docker build -f "$ROOT_DIR/apps/api/Dockerfile" -t "$API_REPO:$IMAGE_TAG" "$ROOT_DIR"
docker push "$WEB_REPO:$IMAGE_TAG"
docker push "$API_REPO:$IMAGE_TAG"

terraform -chdir="$TF_DIR" apply -auto-approve \
  -var-file="$TF_DIR/beta.tfvars.example" \
  -var="image_tag=$IMAGE_TAG"

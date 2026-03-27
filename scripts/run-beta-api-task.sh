#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AWS_CLI="${AWS_CLI:-$ROOT_DIR/aws/dist/aws}"
AWS_REGION="${AWS_REGION:-us-east-1}"
TF_DIR="${TF_DIR:-$ROOT_DIR/infra/aws}"

if [[ $# -eq 0 ]]; then
  echo "usage: $0 '<shell command to run in the beta api task>'" >&2
  exit 1
fi

TASK_COMMAND="$1"

if [[ ! -x "$AWS_CLI" ]]; then
  AWS_CLI="aws"
fi

if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform is required but not installed." >&2
  exit 1
fi

CLUSTER_NAME="$(terraform -chdir="$TF_DIR" output -raw ecs_cluster_name)"
API_SERVICE_NAME="$(terraform -chdir="$TF_DIR" output -raw api_service_name)"

SERVICE_JSON="$("$AWS_CLI" ecs describe-services \
  --region "$AWS_REGION" \
  --cluster "$CLUSTER_NAME" \
  --services "$API_SERVICE_NAME" \
  --output json)"

TASK_DEFINITION_ARN="$(printf '%s' "$SERVICE_JSON" | python3 -c 'import json, sys; payload = json.load(sys.stdin); print(payload["services"][0]["taskDefinition"])')"
NETWORK_CONFIGURATION_JSON="$(printf '%s' "$SERVICE_JSON" | python3 -c 'import json, sys; payload = json.load(sys.stdin); print(json.dumps(payload["services"][0]["networkConfiguration"]))')"

OVERRIDES_JSON="$(python3 - "$TASK_COMMAND" <<'PY'
import json
import sys

command = sys.argv[1]
print(json.dumps({
    "containerOverrides": [
        {
            "name": "api",
            "command": ["sh", "-lc", command]
        }
    ]
}))
PY
)"

TASK_ARN="$("$AWS_CLI" ecs run-task \
  --region "$AWS_REGION" \
  --cluster "$CLUSTER_NAME" \
  --launch-type FARGATE \
  --task-definition "$TASK_DEFINITION_ARN" \
  --network-configuration "$NETWORK_CONFIGURATION_JSON" \
  --overrides "$OVERRIDES_JSON" \
  --query 'tasks[0].taskArn' \
  --output text)"

if [[ -z "$TASK_ARN" || "$TASK_ARN" == "None" ]]; then
  echo "Unable to start beta api task." >&2
  exit 1
fi

echo "Started beta api task: $TASK_ARN"

"$AWS_CLI" ecs wait tasks-stopped \
  --region "$AWS_REGION" \
  --cluster "$CLUSTER_NAME" \
  --tasks "$TASK_ARN"

TASK_STATUS_JSON="$("$AWS_CLI" ecs describe-tasks \
  --region "$AWS_REGION" \
  --cluster "$CLUSTER_NAME" \
  --tasks "$TASK_ARN" \
  --output json)"

TASK_EXIT_CODE="$(printf '%s' "$TASK_STATUS_JSON" | python3 -c 'import json, sys; payload = json.load(sys.stdin); containers = payload["tasks"][0].get("containers", []); print(containers[0].get("exitCode", ""))')"
TASK_STOPPED_REASON="$(printf '%s' "$TASK_STATUS_JSON" | python3 -c 'import json, sys; payload = json.load(sys.stdin); print(payload["tasks"][0].get("stoppedReason", ""))')"

if [[ "$TASK_EXIT_CODE" != "0" ]]; then
  echo "Beta api task failed with exit code ${TASK_EXIT_CODE:-unknown}." >&2
  if [[ -n "$TASK_STOPPED_REASON" ]]; then
    echo "Stopped reason: $TASK_STOPPED_REASON" >&2
  fi
  exit 1
fi

echo "Beta api task completed successfully."

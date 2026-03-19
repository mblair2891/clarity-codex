# Operations Notes

## Monitoring

- API structured logs in JSON.
- Request IDs propagated across API routes.
- Audit logs persisted for sensitive and AI-assisted actions.
- CloudWatch alarms for 5xx rate, latency, CPU, memory, and queue lag.

## On-call runbook foundations

### Incident classes

- **P1:** widespread outage, inaccessible tenant workflows, failed authentication.
- **P2:** degraded AI/RCM workflows, delayed notifications, partial reporting issues.
- **P3:** non-critical UI issues, low-severity data import problems.

### Immediate checks

1. Verify ECS service health and deployment events.
2. Verify RDS availability and storage headroom.
3. Verify Redis connectivity and queue depth.
4. Review recent audit and application logs for tenant-scoped errors.

## Compliance-adjacent posture

This scaffold supports healthcare-adjacent security and auditability needs, but a formal HIPAA program still requires:

- executed BAAs,
- administrative safeguards,
- access review processes,
- incident response documentation,
- workforce training,
- and formal risk assessments.

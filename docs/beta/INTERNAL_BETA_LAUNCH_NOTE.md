# Internal Beta Launch Note

## Seeded Accounts

| Role | Email | Password |
| --- | --- | --- |
| Platform Admin | `beta-admin@claritybridgehealth.com` | `PlatformBeta!2026` |
| Org Admin | `beta-org-admin@claritybridgehealth.com` | `PlatformBeta!2026` |
| Clinical Staff | `beta-clinical@claritybridgehealth.com` | `ClinicalBeta!2026` |
| Clinical Staff | `beta-care-coordinator@claritybridgehealth.com` | `ClinicalBeta!2026` |
| Billing / RCM | `beta-billing@claritybridgehealth.com` | `BillingBeta!2026` |
| Consumer | `beta-consumer@claritybridgehealth.com` | `ConsumerBeta!2026` |

## Recommended Tester Onboarding Order

1. Internal platform owner or product lead using `platform_admin`
2. Internal org operations tester using `org_admin`
3. Clinical workflow tester using `clinical_staff`
4. Billing workflow tester using `billing`
5. Consumer experience tester using `consumer`

This order is useful because admin coverage confirms access, scoping, and setup first, then moves into care-team and revenue workflows, and finishes with the consumer-facing experience.

## Suggested First Wave Of Testers

- 1 product/program owner
- 1 operational/admin tester
- 1 clinician or care coordinator
- 1 billing or RCM tester
- 1 consumer-experience tester

Keep the first wave small enough that feedback can be reviewed and triaged quickly.

## Recommended Testing Cadence

- Day 1:
  - send onboarding pack
  - have each tester complete their primary role checklist
- Day 2:
  - triage issues by severity and frequency
  - resolve blocking issues first
- Day 3 to Day 5:
  - re-test fixes
  - collect broader usability feedback
  - identify any training or documentation gaps

## Launch Guidance

- Start with controlled access only.
- Ask testers to stay within their assigned role unless explicitly requested to cross-check another flow.
- Treat login issues, scope leaks, missing data, and blocked primary workflows as top-priority issues.
- Ask for screenshots or short recordings whenever possible.
- Keep bug reports and general feedback separate so triage stays clean.

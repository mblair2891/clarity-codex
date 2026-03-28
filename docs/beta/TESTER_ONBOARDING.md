# Clarity Bridge Health Beta Tester Onboarding

## Purpose Of This Beta

This beta is a structured test of the live Clarity Bridge Health experience across the main user roles:

- `platform_admin`
- `org_admin`
- `clinical_staff`
- `billing`
- `consumer`

The goal is to validate that real users can complete day-to-day workflows, identify usability friction, catch regressions early, and prioritize the highest-value improvements before broader rollout.

## Beta URLs

- App: `https://beta-app.claritybridgehealth.com`
- API: `https://beta-api.claritybridgehealth.com`

Most testers should use the app URL. The API URL is mainly for internal debugging and verification.

## Login Instructions

1. Open `https://beta-app.claritybridgehealth.com`.
2. Sign in with the test account assigned to your role.
3. Confirm you land in the expected workspace:
   - Admin users -> `/admin`
   - Clinical users -> `/clinical`
   - Billing users -> `/rcm`
   - Consumer users -> `/consumer`
4. Complete the role checklist in [ROLE_TEST_CHECKLIST.md](/workspaces/clarity-codex/docs/beta/ROLE_TEST_CHECKLIST.md).
5. Report bugs with [BUG_REPORT_TEMPLATE.md](/workspaces/clarity-codex/docs/beta/BUG_REPORT_TEMPLATE.md).
6. Share broader product feedback with [FEEDBACK_TEMPLATE.md](/workspaces/clarity-codex/docs/beta/FEEDBACK_TEMPLATE.md).

## Role-Specific Test Accounts

Use only the account for the role you are testing.

| Role | Email | Password |
| --- | --- | --- |
| Platform Admin | `beta-admin@claritybridgehealth.com` | `PlatformBeta!2026` |
| Org Admin | `beta-org-admin@claritybridgehealth.com` | `PlatformBeta!2026` |
| Clinical Staff | `beta-clinical@claritybridgehealth.com` | `ClinicalBeta!2026` |
| Billing / RCM | `beta-billing@claritybridgehealth.com` | `BillingBeta!2026` |
| Consumer | `beta-consumer@claritybridgehealth.com` | `ConsumerBeta!2026` |

## What Each Tester Should Test

### Platform Admin

- Dashboard clarity and navigation
- User management
- Organization management
- Role and access management safety
- High-level operational visibility

### Org Admin

- Org-scoped admin dashboard
- In-scope user management
- Org detail updates
- Confirmation that access stays limited to the org

### Clinical Staff

- Clinical landing dashboard
- Caseload and consumer chart workflows
- Check-in review and follow-up handling
- Clinician notes

### Billing / RCM

- Billing dashboard and work queue
- Account detail view
- Work item status management
- Billing note workflows

### Consumer

- Consumer dashboard
- Goals, tasks, journals, check-ins, and recovery planning visibility
- General ease of use and trust/confidence in the experience

## How To Report Bugs Or Feedback

- File reproducible issues with [BUG_REPORT_TEMPLATE.md](/workspaces/clarity-codex/docs/beta/BUG_REPORT_TEMPLATE.md).
- Share broader impressions and product feedback with [FEEDBACK_TEMPLATE.md](/workspaces/clarity-codex/docs/beta/FEEDBACK_TEMPLATE.md).
- Include screenshots or short screen recordings whenever possible.
- If an issue blocks login, safety, data visibility, or role access, flag it immediately as high severity.

## Most Useful Feedback

The most valuable beta feedback is:

- Anything that blocks a core workflow
- Confusing navigation or unclear labels
- Missing context that makes a task hard to complete
- Slow or inconsistent screens
- Role-scope issues, especially seeing too much or too little data
- Mismatches between what you expected and what the product actually did

## Beta Expectations And Limitations

- This is a controlled beta, not a production release.
- Data is seeded and intended for testing workflows, not real patient care or billing operations.
- Some areas are intentionally lighter than a full production system.
- Small usability issues, rough edges, or incomplete convenience features may still exist.
- Please do not share test credentials outside the approved tester group.
- If you are unsure whether something is a bug, report it anyway.

# Clarity Bridge Health Role Test Checklist

Use this checklist during structured beta testing. Mark items as pass, fail, or needs follow-up.

## Platform Admin

### Core checks

- Log in successfully and land on `/admin`
- Confirm logout is visible and works
- Confirm the dashboard loads key metrics and recent activity
- Confirm the user list is present and searchable
- Create a new user
- Edit an existing user
- Activate or deactivate a user
- Change a user's role within allowed admin scope
- Set a temporary password for a user
- Review organization summaries and edit an org detail

### Watch for

- Confusing user status or role labels
- Missing success or error feedback after admin actions
- Scope problems across organizations
- Dead ends after saving, cancelling, or switching views

## Org Admin

### Core checks

- Log in successfully and land on `/admin`
- Confirm logout is visible and works
- Confirm dashboard data is org-scoped
- Confirm user list loads and excludes out-of-scope privileged users
- Search or filter users within the org
- Edit an in-scope user
- Change allowed roles only
- Edit organization details

### Watch for

- Seeing users outside the org
- Ability to escalate to `platform_admin`
- Missing guardrails around out-of-scope actions
- Unclear errors when an action is denied

## Clinical Staff

### Core checks

- Log in successfully and land on `/clinical`
- Confirm logout is visible and works
- Review the dashboard summary, attention queue, and quick actions
- Open the consumer roster and search/filter the caseload
- Open a consumer detail workspace
- Review recovery plan, goals, routines, and shared journals
- Review a recent check-in
- Mark a check-in reviewed or update follow-up state
- Add a clinician note

### Watch for

- Missing consumer context needed to make care decisions
- Private journal content appearing where it should not
- Review actions that appear saved but do not persist
- Navigation friction between dashboard, roster, and consumer detail

## Billing / RCM

### Core checks

- Log in successfully and land on `/rcm`
- Confirm logout is visible and works
- Review dashboard metrics and attention items
- Open the billing queue and filter by status
- Open a consumer billing/account detail view
- Review coverage, encounters, claims, and notes
- Create a billing work item
- Update the work item status
- Add a work-item note

### Watch for

- Missing context on what action to take next
- Status changes not reflecting in queue or detail views
- Confusing billing terminology or labels
- Accounts appearing outside the expected org scope

## Consumer

### Core checks

- Log in successfully and land on `/consumer`
- Confirm logout is visible and works
- Review dashboard summary and today’s tasks
- Review goals and recovery plan details
- Complete or review recent check-ins
- Review journal entries and staff-sharing behavior
- Review appointments, medications, and recent activity

### Watch for

- Unclear next steps after login
- Data that feels stale or mismatched
- Confusing language around journals, check-ins, or follow-up
- Anything that reduces trust, clarity, or ease of use

## Common Cross-Role Checks

- Loading states feel intentional and not broken
- Empty states explain what to do next
- Error states are understandable
- Navigation makes it clear where you are
- Returning to the main landing page is easy
- Logout is always easy to find

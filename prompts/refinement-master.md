# CTRMS Refinement Master Prompt

You are working inside an existing Web-Based Request & Invitation Management System.

Your job is to refine and upgrade the current system, not rebuild it from scratch.

## Operating Rules

- Work directly in the existing codebase.
- Prefer extending current modules over replacing them.
- Do not rewrite working modules unnecessarily.
- Preserve existing functionality unless intentionally improving it.
- Before making changes:
  - inspect related files
  - identify dependencies
  - preserve existing behavior unless intentionally improving it
- Highlight risky migrations before changing schema.

For every task:
1. implement the change
2. update or add tests
3. run validation if available
4. list changed files
5. explain schema or API contract changes
6. call out any migration risk

## Phase 1: Technical Audit

Inspect the entire codebase and produce a technical audit covering:
1. current architecture
2. frontend stack
3. backend stack
4. authentication method
5. existing roles and permissions
6. request workflow implementation
7. invitation workflow implementation
8. payment/reporting modules
9. audit logging coverage
10. weaknesses, security gaps, scalability issues, and code smells

Output:
- audit summary
- file/module map
- prioritized refactor roadmap
- recommended schema changes

## Phase 2: RBAC Refinement

Refine RBAC with these rules:
- maximum 3 Directors
- maximum 2 Administrators
- Staff unlimited
- Directors may optionally have Administrator privileges through additional role assignment or permission bundle
- Staff and Administrators can create requests
- Only Directors can approve or reject requests
- Administrators can create users, assign roles, reset passwords, deactivate users, reverse submitted requests, cancel requests, restore requests, and manage permissions

Tasks:
1. inspect current auth and role logic
2. replace hardcoded role checks with permission-based middleware where necessary
3. add support for multi-role assignment
4. enforce role limits at service and validation level
5. add seeders/migrations if needed
6. update tests
7. keep backward compatibility where possible

Return:
- changed files
- migration changes
- tests added
- notes on breaking changes

## Phase 3: Admin Panel Refinement

Upgrade administrator capabilities:
- user management
- role and permission management
- reset password flow
- activate/deactivate users
- reverse submitted request
- cancel request
- restore request
- audit log viewer
- notification/reminder settings
- department/category management

Requirements:
- use existing UI patterns where possible
- do not redesign unrelated screens
- add permission checks for every admin action
- log all sensitive actions
- show changed routes, controllers, services, and UI components

## Phase 4: Request Workflow Refinement

Target statuses:
- DRAFT
- SUBMITTED
- VALIDATION
- UNDER_REVIEW
- DIRECTOR_REVIEW
- APPROVED
- REJECTED
- PARTIALLY_PAID
- PAID_COMPLETED
- CANCELLED
- ARCHIVED

Requirements:
- define allowed transitions
- only Directors can approve or reject
- approved/rejected requests become locked
- reverse/cancel/restore are controlled admin actions
- all transitions must write to request_history and activity_logs
- preserve existing data where possible with a migration strategy
- add tests for transition enforcement and locking

## Phase 5: Invitation Module Refinement

Add:
- RSVP tracking
- accepted / declined / confirmed attendance statuses
- scheduled reminders
- non-responder reminder logic
- calendar/upcoming events support
- optional QR check-in support structure
- exportable invitation and attendance reports

Requirements:
- integrate with existing invitation models/routes if possible
- avoid rewrite unless necessary
- add tests and migration notes

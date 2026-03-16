# CTRMS System - Complete Data Flow & Request/Approval Workflow Documentation

**Generated**: March 6, 2026  
**Version**: 3.0 with Enhanced Authentication & User Management

---

## Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [Request Submission Flow](#request-submission-flow)
3. [Approval Workflow](#approval-workflow)
4. [Notification System](#notification-system)
5. [User Authentication Flow](#user-authentication-flow)
6. [API Request Lifecycle](#api-request-lifecycle)
7. [Database Schema & Relationships](#database-schema--relationships)
8. [Security & Audit Trail](#security--audit-trail)

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   CTRMS Enterprise Platform                 │
└─────────────────────────────────────────────────────────────┘

┌────────────────────────────┐
│   Web/Mobile Clients       │
├────────────────────────────┤
│  • Browser (HTML/CSS/JS)   │
│  • Mobile App (API Only)   │
│  • Third-party Integrations│
└────────────┬───────────────┘
             │
             │ HTTP/HTTPS
             ▼
┌────────────────────────────────────────────────────────────┐
│          Django REST Framework Application                  │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │   Web Views      │  │   API Endpoints  │               │
│  ├──────────────────┤  ├──────────────────┤               │
│  │  • HomeView      │  │  /api/token/     │               │
│  │  • Dashboard     │  │  /api/users/     │               │
│  │  • RequestCreate │  │  /api/requests/  │               │
│  │  • RequestDetail │  │  /api/invitations
/  │               │
│  │  • Approval      │  │  /api/export/    │               │
│  │  • Tracking      │  │  /api/analytics/ │               │
│  └──────────────────┘  └──────────────────┘               │
│           │                      │                        │
│           └──────────┬───────────┘                        │
│                      ▼                                    │
│           ┌──────────────────┐                           │
│           │   Permissions    │                           │
│           │   & Auth         │                           │
│           ├──────────────────┤                           │
│           │  • Session Auth  │                           │
│           │  • JWT Token     │                           │
│           │  • RBAC (Admin/  │                           │
│           │    Director)     │                           │
│           └──────────────────┘                           │
│                                                            │
└────────────────────────────────────────────────────────────┘
             │
             │ ORM Queries
             ▼
┌────────────────────────────────────────────────────────────┐
│              Django ORM Models & Signals                    │
├────────────────────────────────────────────────────────────┤
│  • Request Model         • User Model                     │
│  • RequestDocument Model • UserPreferences                │
│  • Invitation Model      • PasswordResetToken             │
│  • AuditLog Model        • OrganizationSettings           │
│  • WorkflowAction Model  • NotificationTemplate           │
│  • EmailLog Model        • Signal Handlers                │
└────────────────────────────────────────────────────────────┘
             │
             │ Serialization/ORM
             ▼
┌────────────────────────────────────────────────────────────┐
│              Database (SQLite / PostgreSQL)                 │
├────────────────────────────────────────────────────────────┤
│  • request table         • user table                      │
│  • request_document      • user_preferences               │
│  • invitation table      • password_reset_token           │
│  • audit_log table       • organization_settings          │
│  • notification_template • workflow_action / execution    │
└────────────────────────────────────────────────────────────┘
             │
             │ Background Signals
             ▼
┌────────────────────────────────────────────────────────────┐
│          Asynchronous Actions (via Django Signals)         │
├────────────────────────────────────────────────────────────┤
│  • WorkflowExecution (auto-approval, reminders)            │
│  • Email Notifications (async send)                       │
│  • AuditLog Creation (all actions)                        │
│  • File Processing (document scanning)                    │
└────────────────────────────────────────────────────────────┘
```

---

## Request Submission Flow

```
USER SUBMITS REQUEST
        │
        ▼
[1] REQUEST CREATE VIEW
    ├─ URL: /request/new/
    ├─ Method: GET/POST
    ├─ Auth: LoginRequired (Applicant)
    └─ Form: RequestCreationForm
        │
        ├─ Step 1: Request Type Selection
        │   └─ Category: TUITION, MEDICAL, CONSTRUCTION, OTHER
        │
        ├─ Step 2: Applicant Information
        │   ├─ Name, Email, Phone
        │   ├─ ID Number, Address
        │   └─ Organization/Company
        │
        ├─ Step 3: Request Details
        │   ├─ Title, Description
        │   ├─ Beneficiaries
        │   └─ Amount Requested
        │
        ├─ Step 4: Document Upload
        │   ├─ Supporting documents (PDF/JPG/PNG)
        │   ├─ File validation
        │   └─ Virus scanning (optional)
        │
        └─ Step 5: Review & Confirmation
            └─ Summary of request
        │
        ▼
[2] REQUEST MODEL CREATION
    ├─ Save RequestModel instance
    ├─ Auto-generate request_id (REQ-YYYYMMDD-XXXXXX)
    ├─ Set status = PENDING
    ├─ Create associated RequestDocument records
    └─ Capture created_at timestamp
        │
        ▼
[3] DJANGO SIGNALS TRIGGER
    ├─ post_save signal sent
    ├─ Receivers:
    │   ├─ AuditLog creation (ActionType.CREATE)
    │   ├─ WorkflowEngine check (WorkflowTrigger.REQUEST_CREATED)
    │   └─ NotificationService (send to applicant)
    │
    └─ Auto-Approval Workflow (if applicable)
        ├─ Check: amount_requested <= $50,000
        ├─ Check: category IN [TUITION, MEDICAL]
        ├─ If YES:
        │   ├─ Create WorkflowExecution
        │   ├─ Set status = APPROVED
        │   ├─ Set approved_amount = amount_requested
        │   ├─ Send APPROVAL email
        │   └─ Log workflow action
        └─ If NO:
            └─ Set status = UNDER_REVIEW
                └─ Alert admin of pending review
        │
        ▼
[4] NOTIFICATION DISPATCH
    ├─ Email: REQUEST_SUBMITTED
    │   ├─ Recipient: Applicant
    │   ├─ Content: Confirmation, Request ID, Next Steps
    │   └─ Status: Queued → Sending → Delivered/Failed
    │
    ├─ (If auto-approved)
    │   Email: REQUEST_APPROVED
    │   ├─ Recipient: Applicant
    │   ├─ Content: Approved amount, Disbursement info
    │   └─ Status: Queued → Sending → Delivered/Failed
    │
    └─ Dashboard Alert (for admin)
        ├─ Alert type: request_submitted
        └─ Status: unread → read
        │
        ▼
[5] AUDIT TRAIL CREATION
    ├─ AuditLog Entry:
    │   ├─ user_id: Request creator
    │   ├─ action_type: CREATE
    │   ├─ content_type: Request
    │   ├─ object_id: request.id
    │   ├─ description: "Request created - REQ-YYYYMMDD-XXXXXX"
    │   ├─ ip_address: Client IP
    │   └─ created_at: UTC timestamp
    │
    └─ Additional log (if auto-approved):
        ├─ action_type: APPROVE
        ├─ description: "Auto-approved by WorkflowEngine"
        └─ user_id: System User (admin)
        │
        ▼
[6] RETURN RESPONSE
    ├─ Success Page / Modal
    ├─ Request ID: REQ-YYYYMMDD-XXXXXX
    ├─ Status: PENDING or APPROVED
    └─ Next Steps: "Await review" or "Check payment details"

```

**Data Captured at Request Creation**:
- Request ID (auto-generated, unique)
- Applicant information (name, email, phone, address, ID)
- Request details (category, title, description, amount)
- Document attachments (file paths, MIME types)
- Timestamp (created_at)
- Status (PENDING → APPROVED/UNDER_REVIEW)
- Creator/Applicant user (foreign key)

---

## Approval Workflow

```
DIRECTOR REVIEWS REQUEST
        │
        ▼
[1] REQUEST LIST & FILTER VIEW
    ├─ URL: /requests/
    ├─ Auth: LoginRequired + Director
    ├─ Filters:
    │   ├─ Status (PENDING, UNDER_REVIEW)
    │   ├─ Category (TUITION, MEDICAL, etc.)
    │   ├─ Date Range
    │   └─ Amount Range
    │
    └─ Display:
        ├─ Request ID, Applicant Name
        ├─ Category, Amount, Status Badge
        ├─ Created Date, Review Button
        └─ Pagination (25 per page)
        │
        ▼
[2] REQUEST DETAIL VIEW
    ├─ URL: /requests/<request_id>/
    ├─ Auth: LoginRequired + Director
    ├─ Display:
    │   ├─ Full applicant information
    │   ├─ Request details & description
    │   ├─ Amount breakdown
    │   │   ├─ Requested: $X
    │   │   ├─ Approved: $Y (if approved)
    │   │   └─ Remaining: $Y - $Paid
    │   │
    │   ├─ Document previews
    │   │   ├─ Inline PDF/image viewer
    │   │   └─ Download links
    │   │
    │   ├─ Workflow history
    │   │   ├─ Status timeline
    │   │   ├─ Previous approvals
    │   │   └─ Review notes
    │   │
    │   └─ Director Actions (if status=PENDING/UNDER_REVIEW)
    │       ├─ [Approve] Button
    │       ├─ [Reject] Button
    │       └─ [Request More Info] Button
    │
    └─ Related Requests (same applicant)
        └─ History view
        │
        ▼
[3] APPROVAL DECISION
    
    SCENARIO A: APPROVE REQUEST
    ─────────────────────────────
    Director clicks [Approve]
        │
        ▼
    Modal Dialog Opens:
    ├─ Approval Form:
    │   ├─ Amount to Approve (default: requested amount)
    │   ├─ Review Notes (optional)
    │   └─ [Confirm] Button
    │
    └─ Director enters:
        ├─ Approved Amount (can be less than requested)
        └─ Optional notes (reason, conditions, etc.)
        │
        ▼
    [4] APPROVAL PROCESSING (POST /api/approve-request/)
        ├─ Validation:
        │   ├─ Check user is director (permission check)
        │   ├─ Check request status = PENDING/UNDER_REVIEW
        │   ├─ Check approved_amount <= amount_requested
        │   └─ Check not already approved
        │
        ├─ Update Request Model:
        │   ├─ status = APPROVED
        │   ├─ approved_amount = <director_input>
        │   ├─ remaining_balance = approved_amount
        │   ├─ reviewed_by = <director_user>
        │   ├─ review_notes = <director_notes>
        │   ├─ reviewed_at = NOW()
        │   └─ updated_at = NOW()
        │
        ├─ Trigger Signals:
        │   ├─ post_save signal
        │   ├─ WorkflowEngine (WorkflowTrigger.REQUEST_APPROVED)
        │   └─ NotificationService
        │
        ├─ Create AuditLog:
        │   ├─ action_type = APPROVE
        │   ├─ user = director
        │   ├─ description = "Approved for $X by <director_name>"
        │   └─ ip_address = director's IP
        │
        └─ Send Notifications:
            ├─ Email to Applicant:
            │   ├─ Template: REQUEST_APPROVED
            │   ├─ Content: Approved amount, next steps
            │   └─ Status: Queued
            │
            └─ Dashboard notification (admin + applicant)
                └─ Alert: "Request approved"
        
    SCENARIO B: REJECT REQUEST
    ──────────────────────────
    Director clicks [Reject]
        │
        ▼
    Modal Dialog Opens:
    ├─ Rejection Form:
    │   ├─ Reason (dropdown):
    │   │   ├─ Insufficient documentation
    │   │   ├─ Ineligible category
    │   │   ├─ Amount exceeds budget
    │   │   └─ Other (specify)
    │   │
    │   ├─ Rejection Notes (required)
    │   └─ [Confirm Rejection] Button
    │
    └─ Director enters:
        ├─ Rejection reason
        └─ Detailed explanation
        │
        ▼
    [4b] REJECTION PROCESSING (POST /api/reject-request/)
        ├─ Validation:
        │   ├─ Check user is director
        │   ├─ Check request status = PENDING/UNDER_REVIEW
        │   └─ Check not already rejected
        │
        ├─ Update Request Model:
        │   ├─ status = REJECTED
        │   ├─ reviewed_by = <director_user>
        │   ├─ review_notes = <rejection_reason + notes>
        │   ├─ reviewed_at = NOW()
        │   └─ updated_at = NOW()
        │
        ├─ Trigger Signals:
        │   ├─ post_save signal
        │   ├─ WorkflowEngine (WorkflowTrigger.REQUEST_REJECTED)
        │   └─ NotificationService
        │
        ├─ Create AuditLog:
        │   ├─ action_type = REJECT
        │   ├─ user = director
        │   ├─ description = "Rejected: <reason>"
        │   └─ ip_address = director's IP
        │
        └─ Send Notifications:
            ├─ Email to Applicant:
            │   ├─ Template: REQUEST_REJECTED
            │   ├─ Content: Reason, appeal process
            │   └─ Status: Queued
            │
            └─ Dashboard notification
                └─ Alert: "Request rejected"
        │
        ▼
[5] PAYMENT PROCESSING (After Approval)
    
    When approved request needs disbursement:
    ├─ Admin clicks [Mark as Paid]
    ├─ Payment Details Form:
    │   ├─ Payment method (Bank Transfer, Check, Cash)
    │   ├─ Reference number (transaction ID, check #)
    │   └─ Payment date (default: today)
    │
    └─ Processing:
        ├─ Update Request Model:
        │   ├─ status = PAID
        │   ├─ payment_date = <date>
        │   ├─ payment_method = <method>
        │   ├─ payment_reference = <reference>
        │   ├─ disbursed_amount = approved_amount
        │   ├─ remaining_balance = 0
        │   └─ updated_at = NOW()
        │
        ├─ Create AuditLog:
        │   ├─ action_type = UPDATE
        │   ├─ description = "Marked as paid - $X via <method>"
        │   └─ user = admin
        │
        └─ Send Notification:
            ├─ Email to Applicant:
            │   ├─ Template: PAYMENT_PROCESSED
            │   ├─ Content: Confirmation, amount, receipt
            │   └─ Status: Queued
            │
            └─ Dashboard notification
                └─ Alert: "Payment processed"

```

**Key Approval Workflow Data Points**:
- Status transitions: PENDING → APPROVED/REJECTED/UNDER_REVIEW → PAID
- Financial tracking: approved_amount, disbursed_amount, remaining_balance
- Review metadata: reviewed_by (director), reviewed_at (timestamp), review_notes
- Audit trail: Every state change logged with user, timestamp, IP address
- Notifications: Applicant, admin, and director notified at each step

---

## Notification System

```
TRIGGER EVENT
        │
        ▼
NOTIFICATION ENGINE
├─ Event: REQUEST_CREATED
│   ├─ Recipient: Applicant (request creator)
│   ├─ Template: REQUEST_SUBMITTED
│   ├─ Content:
│   │   ├─ "Dear <name>,"
│   │   ├─ "Your request REQ-XXX has been submitted"
│   │   ├─ "Status: PENDING"
│   │   ├─ "You will be notified when reviewed"
│   │   └─ "Track status: [link]"
│   │
│   └─ Delivery:
│       ├─ Queue to EmailLog (status: PENDING)
│       ├─ Send via SMTP (async if Celery enabled)
│       ├─ Update EmailLog (status: SENT/FAILED)
│       └─ Retry if failed (up to 3 attempts)
│
├─ Event: REQUEST_APPROVED
│   ├─ Recipient: Applicant
│   ├─ Template: REQUEST_APPROVED
│   ├─ Content:
│   │   ├─ "Dear <name>,"
│   │   ├─ "Your request has been APPROVED"
│   │   ├─ "Approved Amount: $X"
│   │   ├─ "Disbursement Info: [details]"
│   │   └─ "Track status: [link]"
│   │
│   └─ Delivery: (same as above)
│
├─ Event: REQUEST_REJECTED
│   ├─ Recipient: Applicant
│   ├─ Template: REQUEST_REJECTED
│   ├─ Content:
│   │   ├─ "Dear <name>,"
│   │   ├─ "Your request REQ-XXX has been REJECTED"
│   │   ├─ "Reason: <reason>"
│   │   ├─ "Explanation: <review_notes>"
│   │   ├─ "Appeal Process: [instructions]"
│   │   └─ "Contact: [support_email]"
│   │
│   └─ Delivery: (same as above)
│
├─ Event: PAYMENT_PROCESSED
│   ├─ Recipient: Applicant
│   ├─ Template: PAYMENT_PROCESSED
│   ├─ Content:
│   │   ├─ "Dear <name>,"
│   │   ├─ "Payment of $X has been processed"
│   │   ├─ "Method: <payment_method>"
│   │   ├─ "Reference: <reference_number>"
│   │   ├─ "Date: <date>"
│   │   └─ "Receipt: [attachment/link]"
│   │
│   └─ Delivery: (same as above)
│
└─ Event: APPROVAL_REQUIRED
    ├─ Recipient: Director (staff)
    ├─ Template: APPROVAL_REQUIRED
    ├─ Content:
    │   ├─ "New request awaiting approval:"
    │   ├─ "ID: REQ-XXX"
    │   ├─ "Applicant: <name>"
    │   ├─ "Amount: $X"
    │   └─ "Action: [review_link]"
    │
    └─ Delivery: Email + Dashboard notification
        │
        ▼
NOTIFICATION DELIVERY FLOW
├─ Store in EmailLog:
│   ├─ template_type
│   ├─ recipient_email
│   ├─ status (PENDING)
│   ├─ attempt_count (0)
│   ├─ last_attempt_at (NULL)
│   └─ next_attempt_at (scheduled)
│
├─ Send via SMTP (configured in settings):
│   ├─ From: DEFAULT_FROM_EMAIL
│   ├─ To: recipient.email
│   ├─ Subject: Template-defined
│   ├─ Body: Rendered with context
│   └─ Content-Type: text/html + text/plain
│
├─ Handle Result:
│   ├─ If SUCCESS:
│   │   ├─ Update EmailLog (status: SENT, sent_at: NOW())
│   │   └─ Log action (AuditLog, action: EMAIL_SENT)
│   │
│   ├─ If FAILURE:
│   │   ├─ Log error
│   │   ├─ Increment attempt_count
│   │   ├─ Schedule retry (exponential backoff)
│   │   └─ Update next_attempt_at
│   │
│   └─ If BOUNCED:
│       ├─ Mark email as invalid
│       ├─ Disable future emails to address
│       └─ Log incident (AuditLog)
│
└─ Quiet Hours Check:
    ├─ If recipient.preferences.quiet_hours_enabled
    │   ├─ Check if current_time in [quiet_hours_start, quiet_hours_end]
    │   └─ If YES: Defer delivery until quiet hours end
    │
    └─ Notification Frequency:
        ├─ instant: Send immediately
        ├─ daily: Batch and send daily digest
        ├─ weekly: Batch and send weekly digest
        └─ never: Don't send email (dashboard only)

```

---

## User Authentication Flow

```
NEW USER REGISTRATION
        │
        ▼
[1] REGISTRATION PAGE
    ├─ URL: /register/
    ├─ Form: UserRegistrationForm
    ├─ Fields:
    │   ├─ Username (unique)
    │   ├─ Email (unique)
    │   ├─ First Name
    │   ├─ Last Name
    │   ├─ Password (8+ chars, uppercase, number)
    │   └─ Confirm Password
    │
    └─ Validation:
        ├─ Username not taken
        ├─ Email not registered
        ├─ Passwords match
        ├─ Password strength check
        └─ Email format valid
        │
        ▼
[2] USER CREATION
    ├─ Create User object:
    │   ├─ username (lowercased, unique)
    │   ├─ email
    │   ├─ first_name, last_name
    │   ├─ password (hashed with PBKDF2)
    │   ├─ is_active = True
    │   ├─ is_staff = False (requires admin approval)
    │   └─ role = 'admin' (default)
    │
    ├─ Create UserPreferences:
    │   ├─ theme = 'light'
    │   ├─ email_notifications_enabled = True
    │   ├─ quiet_hours_enabled = False
    │   └─ language = 'en'
    │
    └─ Send Welcome Email
        ├─ Template: WELCOME
        ├─ Content: Account created, next steps
        └─ Status: Queued
        │
        ▼
[3] LOGIN FLOW
    ├─ URL: /login/
    ├─ POST Form:
    │   ├─ Username or Email
    │   └─ Password
    │
    └─ Authentication:
        ├─ Look up user by username/email
        ├─ Check password (using check_password)
        ├─ Check user.is_active = True
        ├─ If SUCCESS:
        │   ├─ Create session
        │   ├─ Set session cookie
        │   ├─ Log login action (AuditLog)
        │   └─ Redirect to dashboard
        │
        └─ If FAILURE:
            ├─ Increment failed_login_count
            ├─ If failed_login_count > 5:
            │   └─ Temporarily lock account (15 min)
            │
            └─ Return error message (generic for security)
        │
        ▼
[4] PASSWORD RESET REQUEST
    ├─ URL: /password-reset/
    ├─ Form: PasswordResetRequestForm
    │   └─ Email address
    │
    └─ Processing:
        ├─ Find user by email
        ├─ Create PasswordResetToken:
        │   ├─ user = <user>
        │   ├─ token = <secure_token_32_chars>
        │   ├─ email = <user.email>
        │   ├─ is_used = False
        │   ├─ expires_at = NOW() + 24 hours
        │   └─ created_at = NOW()
        │
        ├─ Build reset link:
        │   └─ /password-reset/confirm/<token>/
        │
        ├─ Send email:
        │   ├─ Template: PASSWORD_RESET
        │   ├─ Content: Reset link, expires in 24h
        │   └─ Status: Queued
        │
        └─ Security: Don't reveal if email exists
            └─ Always show "Check your email" message
        │
        ▼
[5] PASSWORD RESET CONFIRMATION
    ├─ User clicks link: /password-reset/confirm/<token>/
    ├─ Validation:
    │   ├─ Look up token
    │   ├─ Check token.is_valid (not used, not expired)
    │   └─ If invalid:  Redirect to /password-reset/
    │
    ├─ Form: PasswordResetForm
    │   ├─ New Password
    │   └─ Confirm Password
    │
    └─ Processing:
        ├─ Validate new password (strength check)
        ├─ Hash new password
        ├─ Update user.password = <hashed>
        ├─ Mark token.is_used = True
        ├─ token.used_at = NOW()
        ├─ Log action (AuditLog)
        ├─ Send confirmation email
        └─ Redirect to login
        │
        ▼
[6] CHANGE PASSWORD (Logged In)
    ├─ URL: /change-password/
    ├─ Auth: LoginRequired
    ├─ Form: PasswordResetForm
    │   ├─ Old Password (verification)
    │   ├─ New Password
    │   └─ Confirm Password
    │
    └─ Processing:
        ├─ Verify old password (check_password)
        ├─ Validate new password
        ├─ Update user.password = <hashed>
        ├─ Log action (AuditLog)
        ├─ Invalidate all other sessions (force re-login elsewhere)
        ├─ Keep current session active
        └─ Send security alert email
        │
        ▼
[7] JWT TOKEN AUTHENTICATION (for API)
    ├─ Endpoint: POST /api/token/
    ├─ Credentials: Username + Password
    ├─ Response:
    │   ├─ access_token (15 min expiry)
    │   └─ refresh_token (7 day expiry)
    │
    ├─ Token Claims:
    │   ├─ user_id, username, email
    │   ├─ full_name
    │   ├─ is_director, is_admin
    │   ├─ iat (issued at)
    │   └─ exp (expiration)
    │
    ├─ Usage:
    │   └─ Authorization: Bearer <access_token>
    │
    ├─ Refresh: POST /api/token/refresh/
    │   ├─ Input: refresh_token
    │   └─ Output: new access_token
    │
    └─ Logout: POST /api/logout/
        ├─ Blacklist refresh token
        └─ Clear session
        │
        ▼
[8] USER PROFILE & PREFERENCES
    ├─ URL: /profile/
    ├─ View Profile:
    │   ├─ Display: Name, Email, Phone, Address
    │   ├─ Edit Profile button (UserProfileUpdateView)
    │   └─ Preferences link
    │
    ├─ Edit Profile: POST /profile/edit/
    │   ├─ Form: UserProfileForm
    │   ├─ Fields: first_name, last_name, email, phone, address, department
    │   └─ Validation: Email uniqueness (if changing)
    │
    └─ Edit Preferences: POST /preferences/
        ├─ Form: PreferencesForm
        ├─ Sections:
        │   ├─ Email Notifications:
        │   │   ├─ Enable/disable
        │   │   ├─ Frequency (instant/daily/weekly/never)
        │   │   └─ Notification types (approval, rejection, etc.)
        │   │
        │   ├─ Quiet Hours:
        │   │   ├─ Enable/disable
        │   │   ├─ Start time (e.g., 22:00)
        │   │   └─ End time (e.g., 08:00)
        │   │
        │   ├─ Display:
        │   │   ├─ Theme (light/dark/auto)
        │   │   ├─ Language (en/fr/es/pt)
        │   │   ├─ Timezone
        │   │   └─ Items per page
        │   │
        │   └─ Privacy:
        │       ├─ Profile visibility (public/private)
        │       ├─ Allow contact
        │       └─ Data export
        │
        └─ Storage:
            └─ Save to UserPreferences model

```

---

## API Request Lifecycle

```
API REQUEST (e.g., POST /api/submit-request/)
        │
        ▼
[1] DJANGO MIDDLEWARE CHAIN
    ├─ SecurityMiddleware
    ├─ SessionMiddleware
    ├─ AuthenticationMiddleware
    ├─ MessageMiddleware
    ├─ AuditLoggingMiddleware
    │   ├─ Capture: Method, Path, IP, User-Agent
    │   ├─ Extract: User ID (from session/JWT)
    │   └─ Queue: Audit log creation (post-response)
    │
    └─ CORSMiddleware (if configured)
        │
        ▼
[2] URL ROUTING
    ├─ Match URL pattern
    └─ Route to appropriate view/viewset
        │
        ▼
[3] AUTHENTICATION & PERMISSION CHECKS
    ├─ Session Auth:
    │   ├─ Extract session cookie
    │   ├─ Look up session in database
    │   ├─ Get associated user
    │   └─ Attach user to request.user
    │
    ├─ OR JWT Auth (for API):
    │   ├─ Extract Authorization header
    │   ├─ Parse "Bearer <token>"
    │   ├─ Verify token signature
    │   ├─ Check expiration
    │   ├─ Decode claims
    │   └─ Attach user to request.user
    │
    ├─ Permission Checks:
    │   ├─ IsAuthenticated (user logged in)
    │   ├─ IsAdminOrDirector (staff member)
    │   ├─ IsDirector (director only)
    │   └─ Custom RBAC checks
    │
    └─ If FAIL:
        └─ Return 401 Unauthorized / 403 Forbidden
        │
        ▼
[4] REQUEST DESERIALIZATION
    ├─ Parse request body (JSON)
    ├─ Validate against serializer schema
    ├─ Check required fields
    ├─ Type validation
    ├─ Custom validation rules
    │
    └─ If FAIL:
        └─ Return 400 Bad Request + error details
        │
        ▼
[5] BUSINESS LOGIC EXECUTION
    ├─ Example: Request Submission (/api/submit-request/)
    │   ├─ Validate data
    │   ├─ Create Request object
    │   ├─ Create RequestDocument objects
    │   ├─ Trigger Django signals
    │   ├─ Workflow engine check (auto-approve?)
    │   ├─ Create notification queue entry
    │   └─ Create audit log entry
    │
    └─ Example: Request Approval (/api/approve-request/)
        ├─ Validate director permission
        ├─ Validate request status
        ├─ Update request.status = APPROVED
        ├─ Update approved_amount, reviewed_by, reviewed_at
        ├─ Trigger Django signals
        ├─ Queue approval notification
        └─ Create audit log entry
        │
        ▼
[6] RESPONSE SERIALIZATION
    ├─ Serialize response object (to JSON)
    ├─ Include:
    │   ├─ Request ID
    │   ├─ Current status
    │   ├─ Timestamp
    │   ├─ Success flag
    │   └─ Message
    │
    └─ HTTP Status Code:
        ├─ 200 OK (GET/PATCH)
        ├─ 201 Created (POST)
        ├─ 204 No Content (DELETE)
        └─ Error codes (4xx/5xx)
        │
        ▼
[7] ASYNC SIGNAL PROCESSING
    ├─ After transaction commit:
    │   ├─ WorkflowEngine execution (if needed)
    │   ├─ Email notification queuing
    │   ├─ AuditLog creation
    │   └─ Any post_save handlers
    │
    └─ If Celery configured:
        ├─ Queue background tasks:
        │   ├─ send_email_notifications()
        │   ├─ execute_workflows()
        │   └─ generate_audit_logs()
        │
        └─ Execute async without blocking response
        │
        ▼
[8] RESPONSE RETURN
    ├─ Return JSON response
    ├─ HTTP Headers:
    │   ├─ Content-Type: application/json
    │   ├─ Cache-Control (if applicable)
    │   └─ CORS headers (if applicable)
    │
    └─ Example Response:
        {
          "success": true,
          "message": "Request created successfully",
          "data": {
            "request_id": "REQ-20260306-000001",
            "status": "PENDING",
            "created_at": "2026-03-06T14:30:00Z",
            "amount_requested": 5000.00
          }
        }

```

---

## Database Schema & Relationships

```
DATABASE RELATIONSHIPS
======================

User (auth.User)
├─ PK: id (UUIDField)
├─ username (unique, CharField)
├─ email (EmailField)
├─ password (hashed)
├─ first_name, last_name
├─ phone, address, department
├─ role (admin/director)
├─ is_staff, is_active
├─ created_at, updated_at
│
├─ FK→ requests.Request (reviewed_requests)
├─ FK→ invitations.Invitation (reviewed_invitations)
├─ FK→ core.AuditLog (audit_logs)
├─ 1-to-1→ core.UserPreferences
├─ FK→ core.PasswordResetToken (password_reset_tokens)
└─ FK→ core.WorkflowExecution (executed_by)

Request
├─ PK: id (UUIDField)
├─ request_id (CharField, unique, business key)
├─ category (tuition/medical/construction/other)
├─ status (pending/under_review/approved/rejected/paid)
├─ applicant_name, applicant_email, applicant_phone
├─ applicant_id, address
├─ description, title
├─ amount_requested (DecimalField)
├─ approved_amount, disbursed_amount, remaining_balance
├─ payment_date, payment_method, payment_reference
├─ created_at, updated_at
├─ reviewed_at
│
├─ FK→ User (reviewed_by)
├─ 1-to-many→ RequestDocument
├─ 1-to-many→ AuditLog (object_id filter)
└─ 1-to-many→ WorkflowExecution (RequestAction)

RequestDocument
├─ PK: id (UUIDField)
├─ file (FileField)
├─ original_filename
├─ file_size, mime_type
├─ uploaded_at
│
└─ FK→ Request

Invitation
├─ PK: id (UUIDField)
├─ inviting_organization
├─ event_title, description, location
├─ event_date (DateTimeField)
├─ event_duration_hours
├─ status (pending_review/accepted/declined/confirmed/completed)
├─ contact_person, contact_email, contact_phone
├─ rsvp_required, expected_attendees
├─ reminder_3_days_sent, reminder_1_day_sent
├─ created_at, updated_at, reviewed_at
│
├─ FK→ User (reviewed_by)
├─ 1-to-many→ AuditLog
└─ 1-to-many→ WorkflowExecution (InvitationAction)

AuditLog
├─ PK: id (UUIDField)
├─ action_type (create/update/delete/approve/reject/download/view/login/logout)
├─ content_type (Request/Invitation/User/etc)
├─ object_id (FK to object being audited)
├─ description (human-readable)
├─ ip_address (GenericIPAddressField)
├─ user_agent
├─ created_at (indexed, ordered)
│
└─ FK→ User

UserPreferences
├─ PK: id (UUIDField)
├─ email_notifications_enabled (BooleanField)
├─ request_notifications (instant/daily/weekly/never)
├─ approval_notifications, rejection_notifications, etc.
├─ quiet_hours_enabled, quiet_hours_start, quiet_hours_end
├─ theme (light/dark/auto)
├─ language, timezone
├─ items_per_page
├─ profile_visibility, allow_contact
├─ created_at, updated_at
│
└─ 1-to-1→ User

PasswordResetToken
├─ PK: id (UUIDField)
├─ token (CharField, unique, 32-char secure token)
├─ email
├─ is_used (BooleanField)
├─ created_at, expires_at, used_at
│
└─ FK→ User

OrganizationSettings (new)
├─ PK: id (UUIDField)
├─ organization_name
├─ logo (ImageField)
├─ favicon, banner_image
├─ primary_color, secondary_color, accent_color (hex)
├─ website_url, facebook_url, twitter_url, instagram_url
├─ about_us, mission_statement, footer_text
├─ show_social_links (BooleanField)
├─ is_active, created_at, updated_at
│
└─ (Singleton or multi-org support)

WorkflowAction
├─ PK: id (UUIDField)
├─ name, description
├─ trigger_type (REQUEST_CREATED/REQUEST_APPROVED/etc)
├─ condition_rule (JSON field)
├─ action_type (auto_approve/send_email/notify_admin)
├─ action_config (JSON field)
├─ is_active, created_at, updated_at
│
└─ 1-to-many→ WorkflowExecution

WorkflowExecution
├─ PK: id (UUIDField)
├─ workflow_action (FK)
├─ content_type (Request/Invitation)
├─ object_id (FK to object)
├─ status (pending/running/completed/failed)
├─ result (JSON, output data)
├─ error_message (if failed)
├─ executed_by (FK to User)
├─ created_at, executed_at, updated_at
│
└─ 1-to-many→ WorkflowLog

NotificationTemplate
├─ PK: id (UUIDField)
├─ template_type (REQUEST_SUBMITTED/REQUEST_APPROVED/etc)
├─ name, subject
├─ html_content, text_content
├─ variables (JSON, list of template vars)
├─ is_active, created_at, updated_at
│
└─ 1-to-many→ EmailLog

EmailLog
├─ PK: id (UUIDField)
├─ notification_template (FK)
├─ recipient_email
├─ status (PENDING/SENT/FAILED/BOUNCED)
├─ attempt_count, last_attempt_at
├─ next_attempt_at (scheduled retry)
├─ sent_at, error_message
├─ created_at, updated_at
│
└─ Related to Request/Invitation/User (polymorphic)

```

---

## Security & Audit Trail

```
AUDIT TRAIL IMPLEMENTATION
===========================

Every user action is logged via AuditLog model:

Action Type Classification:
├─ CREATE
│   ├─ New request submitted
│   ├─ New user registered
│   ├─ New invitation created
│   └─ New document uploaded
│
├─ UPDATE
│   ├─ Profile information changed
│   ├─ Request status changed
│   ├─ Document metadata updated
│   └─ Preferences modified
│
├─ APPROVE
│   ├─ Request approved by director
│   └─ Invitation approved
│
├─ REJECT
│   ├─ Request rejected
│   └─ Invitation declined
│
├─ DELETE
│   ├─ Request deleted (soft delete)
│   └─ Document deleted
│
├─ DOWNLOAD
│   ├─ Report export (CSV/Excel/PDF)
│   ├─ Document download
│   └─ Audit log export
│
├─ VIEW
│   ├─ Dashboard viewed
│   ├─ Request detail viewed
│   └─ Protected page accessed
│
├─ LOGIN
│   ├─ Successful login
│   └─ Failed login attempt (3+ times = lock)
│
└─ LOGOUT
    └─ User logged out

AUDIT LOG ENTRY:
────────────────
{
  "id": "uuid",
  "user_id": "uuid",                    # WHO did it
  "action_type": "APPROVE",             # WHAT action
  "content_type": "Request",            # ON WHAT
  "object_id": "REQ-20260306-000001",   # WHICH object
  "description": "Approved for $5000",  # DETAILS
  "ip_address": "192.168.1.100",        # FROM WHERE
  "user_agent": "Mozilla/5.0...",       # WHAT CLIENT
  "created_at": "2026-03-06T14:30:00Z"  # WHEN
}

QUERY EXAMPLES:
───────────────
# All actions by a user in last 7 days
AuditLog.objects.filter(
  user_id=user.id,
  created_at__gte=timezone.now() - timedelta(days=7)
).order_by('-created_at')

# All approvals by directors
AuditLog.objects.filter(
  action_type='APPROVE',
  user__role='director'
)

# All actions on a specific request
AuditLog.objects.filter(
  content_type='Request',
  object_id='REQ-20260306-000001'
).order_by('-created_at')

# Failed login attempts
AuditLog.objects.filter(
  action_type='LOGIN',
  description__icontains='FAILED'
)

SECURITY CONSIDERATIONS:
─────────────────────────
✅ Password Hashing: PBKDF2 with salt
✅ SQL Injection Prevention: ORM parameterized queries
✅ CSRF Protection: Django CSRF tokens in forms
✅ XSS Prevention: Template auto-escaping
✅ SQL Injection: No raw SQL (use ORM)
✅ Rate Limiting: Implement for auth endpoints
✅ Session Security: HttpOnly, Secure flags
✅ API Security: JWT with short expiry (15 min)
✅ CORS: Configured for allowed origins
✅ Encryption: Supports encrypted fields
✅ Audit Trail: All actions logged with IP/user/timestamp
✅ Access Control: RBAC (admin/director roles)
✅ Account Lockout: After 5 failed logins (15 min)
✅ Password Reset: 24-hour token expiry, one-time use
✅ Session Timeout: Configure in settings

```

---

## Module Functionality Checklist

| Module | Feature | Status | Test |
|--------|---------|--------|------|
| **Authentication** | User Registration | ✅ Implemented | [POST /register/] |
| | Login/Logout | ✅ Implemented | [POST /login/] |
| | Password Reset | ✅ Implemented | [POST /password-reset/] |
| | JWT Tokens | ✅ Implemented | [POST /api/token/] |
| | Change Password | ✅ Implemented | [POST /change-password/] |
| **User Profile** | View Profile | ✅ Implemented | [GET /profile/] |
| | Edit Profile | ✅ Implemented | [POST /profile/edit/] |
| | Preferences | ✅ Implemented | [POST /preferences/] |
| | Notification Settings | ✅ Implemented | [UserPreferences Model] |
| **Requests** | Submit Request | ✅ Implemented | [POST /request/new/] |
| | View List | ✅ Implemented | [GET /requests/] |
| | View Detail | ✅ Implemented | [GET /requests/<id>/] |
| | Approve | ✅ Implemented | [POST /api/approve-request/] |
| | Reject | ✅ Implemented | [POST /api/reject-request/] |
| | Mark Paid | ✅ Implemented | [POST /api/mark-paid/] |
| | Track Status | ✅ Implemented | [GET /request/track/] |
| **Notifications** | Email Templates | ✅ Implemented | [8 templates] |
| | Send Email | ✅ Implemented | [EmailLog Model] |
| | Quiet Hours | ✅ Implemented | [UserPreferences] |
| | Retry Logic | ✅ Implemented | [EmailLog.attempt_count] |
| **Branding** | Logo Management | ✅ Implemented | [OrganizationSettings] |
| | Custom Colors | ✅ Implemented | [Organization Colors] |
| | Footer/Social Links | ✅ Implemented | [Organization Settings] |
| **Reports** | Export CSV | ✅ Implemented | [/export/requests-csv/] |
| | Export Excel | ✅ Implemented | [/export/requests-excel/] |
| | Export PDF | ✅ Implemented | [/export/requests-pdf/] |
| **Analytics** | Dashboard Stats | ✅ Implemented | [Chart.js] |
| | Trends | ✅ Implemented | [Monthly data] |
| | Category Breakdown | ✅ Implemented | [Pie charts] |
| **Admin** | User Management | ✅ Implemented | [Django Admin] |
| | Permission Control | ✅ Implemented | [Role-based] |
| | Audit Logs | ✅ Implemented | [AuditLog Admin] |
| | System Settings | ✅ Implemented | [SystemSettings] |

---

## API Endpoints Summary

```
AUTHENTICATION ENDPOINTS
========================
POST   /register/                      Register new user
POST   /login/                         User login
POST   /logout/                        User logout
POST   /password-reset/                Request password reset
GET    /password-reset/confirm/<token>/ Confirm reset link
POST   /api/token/                     Obtain JWT tokens
POST   /api/token/refresh/             Refresh access token
POST   /api/users/me/                  Get current user
POST   /api/users/me/change-password/  Change password

REQUEST MANAGEMENT ENDPOINTS
=============================
POST   /request/new/                   Create request (web form)
GET    /requests/                      List all requests (staff)
GET    /requests/<id>/                 View request detail
POST   /api/submit-request/            Submit request (API)
POST   /api/approve-request/           Approve request
POST   /api/reject-request/            Reject request
POST   /api/mark-paid/                 Mark as paid
GET    /request/track/                 Track request (public)
POST   /api/requests-data/             Get filtered list (API)

PROFILE ENDPOINTS
=================
GET    /profile/                       View user profile
POST   /profile/edit/                  Edit profile
GET    /preferences/                   View preferences
POST   /preferences/                   Update preferences

REPORTING & EXPORT ENDPOINTS
=============================
GET    /api/dashboard-stats/           Get dashboard KPIs
GET    /export/requests-csv/           Export CSV
GET    /export/requests-excel/         Export Excel
GET    /export/requests-pdf/           Export PDF
GET    /export/financial-report-csv/   Financial report
GET    /export/analytics-report-csv/   Analytics report

ADMIN ENDPOINTS
===============
GET    /admin/                         Django admin panel
GET    /admin/auth/user/               User management
GET    /admin/core/auditlog/           Audit logs
GET    /admin/common/systemsettings/   System settings
GET    /admin/common/organizationsettings/ Organization settings

```

---

## Testing Request/Approval Workflow

```
MANUAL TESTING STEPS
====================

1. CREATE REQUEST
──────────────────
curl -X POST http://localhost:8000/api/submit-request/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "applicant_name": "John Doe",
    "applicant_email": "john@example.com",
    "applicant_phone": "1234567890",
    "category": "tuition",
    "amount_requested": 5000,
    "description": "College tuition assistance"
  }'

Expected Response:
{
  "success": true,
  "request_id": "REQ-20260306-000001",
  "status": "PENDING",
  "created_at": "2026-03-06T14:30:00Z"
}

Check:
✓ Request created in database
✓ AuditLog entry created (ActionType.CREATE)
✓ Email sent to applicant
✓ Dashboard notification queued
✓ Workflow checked (auto-approval if applicable)


2. VIEW REQUEST
────────────────
curl -X GET http://localhost:8000/api/requests/REQ-20260306-000001/ \
  -H "Authorization: Bearer <access_token>"

Expected Response:
{
  "request_id": "REQ-20260306-000001",
  "status": "PENDING",
  "applicant_name": "John Doe",
  "amount_requested": 5000,
  ...
}


3. APPROVE REQUEST
────────────────────
curl -X POST http://localhost:8000/api/approve-request/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <director_token>" \
  -d '{
    "request_id": "REQ-20260306-000001",
    "approved_amount": 4500,
    "review_notes": "Approved. Supporting docs verified."
  }'

Expected Response:
{
  "success": true,
  "message": "Request approved successfully",
  "request_id": "REQ-20260306-000001",
  "status": "APPROVED",
  "approved_amount": 4500
}

Check:
✓ Request.status updated to APPROVED
✓ approved_amount set to 4500
✓ reviewed_by = director user
✓ reviewed_at = current timestamp
✓ AuditLog entry created (ActionType.APPROVE)
✓ Email sent to applicant (REQUEST_APPROVED)
✓ Dashboard notification queued
✓ APPROVAL_REQUIRED email sent to admin


4. MARK AS PAID
──────────────────
curl -X POST http://localhost:8000/api/mark-paid/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "request_id": "REQ-20260306-000001",
    "payment_method": "bank_transfer",
    "payment_reference": "TXN-123456",
    "payment_date": "2026-03-06"
  }'

Expected Response:
{
  "success": true,
  "message": "Payment recorded successfully",
  "request_id": "REQ-20260306-000001",
  "status": "PAID",
  "disbursed_amount": 4500
}

Check:
✓ Request.status updated to PAID
✓ disbursed_amount set to 4500
✓ remaining_balance set to 0
✓ payment_method, payment_reference stored
✓ AuditLog entry created
✓ Email sent to applicant (PAYMENT_PROCESSED)


5. CHECK AUDIT TRAIL
──────────────────────
curl -X GET "http://localhost:8000/admin/core/auditlog/?object_id=REQ-20260306-000001" \
  -H "Authorization: Bearer <admin_token>"

Expected Entries (in reverse chronological order):
1. ActionType.UPDATE, "Marked as paid via bank transfer"
2. ActionType.APPROVE, "Approved for $4500"
3. ActionType.CREATE, "Request created"

Each entry should have:
✓ user_id (who did it)
✓ action_type (what action)
✓ description (details)
✓ ip_address (from where)
✓ created_at (when)


6. CHECK NOTIFICATIONS
───────────────────────
Review EmailLog entries:
- REQUEST_SUBMITTED (to applicant) - Status: SENT
- REQUEST_APPROVED (to applicant) - Status: SENT
- APPROVAL_REQUIRED (to admin) - Status: SENT
- PAYMENT_PROCESSED (to applicant) - Status: SENT

Each should have:
✓ recipient_email
✓ status (SENT/FAILED)
✓ attempt_count (1)
✓ sent_at timestamp

```

---

## Conclusion

The CTRMS system now has a complete, documented request lifecycle from submission through approval and payment, with comprehensive user authentication, notification system, and complete audit trail. All critical gaps have been addressed with:

✅ Modern user authentication (registration, password reset, JWT)  
✅ Real email sending configuration  
✅ User preferences and notification settings  
✅ Logo/branding management  
✅ Complete audit logging  
✅ Request approval workflow  
✅ Comprehensive data flow documentation

The system is now ready for production deployment with proper SMTP configuration and database migration to PostgreSQL.


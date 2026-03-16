# Chakou Trust - Application Flows & User Journeys

## 1. User Journey Flows

### A. Public User Journey: Submit & Track Request

```
START
  │
  ├─→ Visit chakou.org/
  │   ├─→ View landing page with statistics
  │   ├─→ Read about programs
  │   └─→ See "Submit Request" button
  │
  ├─→ Click "Submit Request"
  │   └─→ Navigate to /request/new/
  │
  ├─→ STEP 1: Select Request Type
  │   ├─→ View 4 options:
  │   │   ├─ Education (🎓)
  │   │   ├─ Medical Welfare (🏥)
  │   │   ├─ School Support (🏫)
  │   │   └─ Other Initiative
  │   │
  │   ├─→ Validation: User must select one
  │   └─→ Click "Next" → Proceed to Step 2
  │
  ├─→ STEP 2: Enter Applicant Information
  │   ├─→ Required fields:
  │   │   ├─ Full Name
  │   │   ├─ Email Address
  │   │   ├─ Phone Number
  │   │   ├─ ID Number
  │   │   └─ Region
  │   │
  │   ├─→ Optional fields:
  │   │   ├─ Organization
  │   │   └─ Role
  │   │
  │   ├─→ Validation: All required fields must be filled
  │   ├─→ Click "Back" → Return to Step 1
  │   └─→ Click "Next" → Proceed to Step 3
  │
  ├─→ STEP 3: Enter Request Details
  │   ├─→ Request Information:
  │   │   ├─ Title (short summary)
  │   │   ├─ Description (detailed explanation)
  │   │   ├─ Number of Beneficiaries
  │   │   ├─ Amount Needed ($)
  │   │   └─ Location
  │   │
  │   ├─→ Validation: All fields required
  │   ├─→ Character limits enforced
  │   ├─→ Amount must be positive number
  │   ├─→ Click "Back" → Return to Step 2
  │   └─→ Click "Next" → Proceed to Step 4
  │
  ├─→ STEP 4: Upload Supporting Documents
  │   ├─→ Drag & drop area OR click to browse
  │   ├─→ Accepted formats: PDF, JPG, PNG
  │   ├─→ File size limits enforced
  │   ├─→ Upload multiple files
  │   ├─→ View uploaded files with delete option
  │   ├─→ Optional: Documents can be skipped
  │   ├─→ Click "Back" → Return to Step 3
  │   └─→ Click "Next" → Proceed to Step 5
  │
  ├─→ STEP 5: Review & Submit
  │   ├─→ See summary of all entered information:
  │   │   ├─ Request type
  │   │   ├─ Applicant details
  │   │   ├─ Request description
  │   │   ├─ Amount requested
  │   │   └─ Attached documents
  │   │
  │   ├─→ Read terms & conditions
  │   ├─→ Check confirmation checkbox: "I confirm this information is accurate"
  │   ├─→ Validation: Checkbox must be checked
  │   ├─→ Click "Back" → Return to Step 4
  │   └─→ Click "Submit Request"
  │       │
  │       ├─→ Form validation passes
  │       │   ├─→ System creates Request object
  │       │   ├─→ Auto-generates request_id (e.g., REQ-2026-001234)
  │       │   ├─→ Sets status = 'PENDING'
  │       │   ├─→ Stores all documents
  │       │   ├─→ Sets created_at = now()
  │       │   ├─→ Clears session data
  │       │   ├─→ Displays success message
  │       │   └─→ Shows request_id
  │       │
  │       └─→ Form validation fails
  │           ├─→ Displays error message
  │           └─→ User corrects and resubmits
  │
  ├─→ After Successful Submission
  │   ├─→ User receives confirmation page
  │   ├─→ Shows generated request_id
  │   ├─→ Instructs how to track request
  │   └─→ Provides tracking link
  │
  ├─→ User Clicks "Track My Request"
  │   └─→ Navigate to /request/track/
  │
  ├─→ TRACKING PAGE
  │   ├─→ Enter search criteria:
  │   │   ├─ Request ID (REQ-2026-001234)
  │   │   └─ Phone Number (to verify)
  │   │
  │   ├─→ Click "Search"
  │   │   │
  │   │   ├─→ Match found:
  │   │   │   ├─→ Display request details
  │   │   │   ├─→ Show current status (PENDING)
  │   │   │   ├─→ Display timeline:
  │   │   │   │   ├─ ✓ Submitted (completed)
  │   │   │   │   ├─ ⏳ Initial Review (5-7 days, in progress)
  │   │   │   │   ├─ ⏳ Finance Committee (10-14 days, pending)
  │   │   │   │   └─ ⏳ Payment Processing (if approved)
  │   │   │   │
  │   │   │   ├─→ Show approval notes (once approved)
  │   │   │   └─→ Show payment info (once paid)
  │   │   │
  │   │   └─→ No match found:
  │   │       └─→ Display "Request not found" message
  │   │           └─→ Suggest contacting support
  │   │
  │   └─→ User periodically checks for updates
  │       ├─→ Status updates as admin reviews
  │       ├─→ Receives notification when approved
  │       └─→ Receives notification when paid
  │
  └─→ END

```

---

### B. Administrator/Director Journey: Review & Approve Requests

```
START
  │
  ├─→ Director opens browser
  │   └─→ Navigate to chakou.org/
  │
  ├─→ Click "Login" (or redirected to /login/)
  │   ├─→ Enter username: admin
  │   ├─→ Enter password: ••••••••
  │   ├─→ Click "Login"
  │   │
  │   ├─→ Validation successful:
  │   │   └─→ Set session cookie
  │   │       └─→ Redirect to /dashboard/
  │   │
  │   └─→ Validation fails:
  │       ├─→ Display "Invalid credentials"
  │       └─→ Show login form again
  │
  ├─→ ADMIN DASHBOARD (/dashboard/)
  │   ├─→ View statistics:
  │   │   ├─ Total Requests: 147
  │   │   ├─ Pending Review: 12
  │   │   ├─ Approved: 98
  │   │   ├─ Rejected: 15
  │   │   ├─ Paid: 22
  │   │   ├─ Total Requested: $487,500
  │   │   ├─ Total Approved: $356,200
  │   │   └─ Total Disbursed: $298,450
  │   │
  │   ├─→ View "Pending Approvals" table
  │   │   ├─ Shows requests with status = 'UNDER_REVIEW'
  │   │   ├─ Columns: Request ID, Applicant, Amount, Category, Date
  │   │   │
  │   │   └─ Example:
  │   │       ├─ REQ-2026-001234 | John Smith | $5,000 | Education | Mar 1
  │   │       ├─ REQ-2026-001235 | Mary Jane | $8,500 | Medical | Mar 2
  │   │       ├─ REQ-2026-001236 | Clinic ABC | $15,000 | Construction | Mar 3
  │   │       └─ [3 more...]
  │   │
  │   ├─→ Director clicks "Review" on first request
  │   │   └─→ Navigate to /request/REQ-2026-001234/
  │   │
  │   └─→ Alternative: Go to /requests/ (All Requests page)
  │       ├─→ See all requests with filters
  │       ├─→ Filter by Status (dropdown)
  │       ├─→ Filter by Category (dropdown)
  │       ├─→ Search by Request ID, Name, Email
  │       └─→ Click request to view detail
  │
  ├─→ REQUEST DETAIL PAGE (/request/<uuid>/)
  │   ├─→ View complete request information:
  │   │   ├─ Applicant Information:
  │   │   │  ├─ Name: John Smith
  │   │   │  ├─ Email: john@example.com
  │   │   │  ├─ Phone: +255 123 456 789
  │   │   │  ├─ ID: AB12345
  │   │   │  ├─ Organization: Community Center
  │   │   │  └─ Region: Dar es Salaam
  │   │   │
  │   │   ├─ Request Details:
  │   │   │  ├─ Type: Educational Support
  │   │   │  ├─ Title: "Student Tuition Assistance"
  │   │   │  ├─ Description: "5 students from low-income families..."
  │   │   │  ├─ Beneficiaries: 5
  │   │   │  ├─ Amount Requested: $5,000
  │   │   │  └─ Location: Dar es Salaam
  │   │   │
  │   │   ├─ Financial Summary:
  │   │   │  ├─ Requested: $5,000
  │   │   │  ├─ Approved: $0 (not yet)
  │   │   │  ├─ Disbursed: $0
  │   │   │  └─ Balance: $0
  │   │   │
  │   │   ├─ Supporting Documents:
  │   │   │  ├─ student_list.pdf (download link)
  │   │   │  ├─ school_letter.pdf (download link)
  │   │   │  └─ invoices.zip (download link)
  │   │   │
  │   │   └─ Status: UNDER_REVIEW
  │   │
  │   ├─→ Director reviews all information
  │   │   ├─→ Reads description thoroughly
  │   │   ├─→ Downloads and reviews documents
  │   │   ├─→ Evaluates need and legitimacy
  │   │   └─→ Makes decision
  │   │
  │   ├─→ DECISION: Approve Request
  │   │   │
  │   │   ├─→ Director clicks "Approve" button
  │   │   │   └─→ Modal dialog appears
  │   │   │
  │   │   ├─→ APPROVAL MODAL:
  │   │   │   ├─ Request ID: REQ-2026-001234
  │   │   │   ├─ Amount Requested: $5,000
  │   │   │   │
  │   │   │   ├─ Input: Approved Amount (required)
  │   │   │   │   └─→ Director enters: $4,500
  │   │   │   │       (May approve less than requested)
  │   │   │   │
  │   │   │   ├─ Input: Review Notes (optional)
  │   │   │   │   └─→ Director enters:
  │   │   │   │       "Approved for 4 students instead of 5.
  │   │   │   │        One student will seek alternative funding."
  │   │   │   │
  │   │   │   ├─ Button: "Cancel" → Close modal
  │   │   │   └─ Button: "Approve" → Submit form
  │   │   │
  │   │   ├─→ Form validation:
  │   │   │   ├─ Approved amount required
  │   │   │   ├─ Amount must be positive
  │   │   │   ├─ Amount ≤ requested amount
  │   │   │   └─→ Validation passes → Process approval
  │   │   │
  │   │   ├─→ System processes approval:
  │   │   │   ├─ Update request.status = 'APPROVED'
  │   │   │   ├─ Set request.approved_amount = 4500
  │   │   │   ├─ Set request.review_notes = "Approved for 4..."
  │   │   │   ├─ Set request.reviewed_by = current_user
  │   │   │   ├─ Set request.review_date = now()
  │   │   │   ├─ Save to database
  │   │   │   ├─ Create audit log entry
  │   │   │   └─ Send success message
  │   │   │
  │   │   ├─→ Page updates:
  │   │   │   ├─ Status badge changes to "APPROVED"
  │   │   │   ├─ Approved amount now shows $4,500
  │   │   │   ├─ Review notes appear in timeline
  │   │   │   ├─ Remaining balance shows $4,500
  │   │   │   ├─ "Mark as Paid" button appears
  │   │   │   └─ Success alert displays
  │   │   │
  │   │   └─→ Director can now:
  │   │       ├─ View request in "Approved" status
  │   │       ├─ Later mark as paid
  │   │       └─ Move on to next pending request
  │   │
  │   ├─→ DECISION: Reject Request
  │   │   │
  │   │   ├─→ Director clicks "Reject" button
  │   │   │   └─→ Modal dialog appears
  │   │   │
  │   │   ├─→ REJECTION MODAL:
  │   │   │   ├─ Request ID: REQ-2026-001234
  │   │   │   │
  │   │   │   ├─ Input: Reason for Rejection (required)
  │   │   │   │   └─→ Director enters:
  │   │   │   │       "Missing documentation. School letter required.
  │   │   │   │        Applicant should resubmit with complete docs."
  │   │   │   │
  │   │   │   ├─ Button: "Cancel" → Close modal
  │   │   │   └─ Button: "Reject" → Submit form
  │   │   │
  │   │   ├─→ Form validation:
  │   │   │   ├─ Reason required
  │   │   │   ├─ Reason must be meaningful (min chars)
  │   │   │   └─→ Validation passes → Process rejection
  │   │   │
  │   │   ├─→ System processes rejection:
  │   │   │   ├─ Update request.status = 'REJECTED'
  │   │   │   ├─ Set request.review_notes = rejection reason
  │   │   │   ├─ Set request.reviewed_by = current_user
  │   │   │   ├─ Set request.review_date = now()
  │   │   │   ├─ Save to database
  │   │   │   ├─ Create audit log entry
  │   │   │   └─ Send success message
  │   │   │
  │   │   ├─→ Page updates:
  │   │   │   ├─ Status badge changes to "REJECTED"
  │   │   │   ├─ Rejection reason appears in timeline
  │   │   │   ├─ Approved/Disbursed amounts stay at $0
  │   │   │   ├─ "Approve" button disappears
  │   │   │   └─ Success alert displays
  │   │   │
  │   │   └─→ Applicant can see:
  │   │       ├─ Request status changed to "REJECTED"
  │   │       ├─ Rejection reason on tracking page
  │   │       └─ Option to resubmit with corrections
  │   │
  │   └─→ DECISION: Request Needs More Information
  │       └─→ Can change status to UNDER_REVIEW
  │           └─→ Request remains pending review
  │
  ├─→ AFTER APPROVAL: Mark as Paid
  │   │
  │   ├─→ Time passes...
  │   ├─→ Finance department processes payment
  │   ├─→ Payment ready to be recorded
  │   │
  │   ├─→ Director goes back to request detail
  │   │   └─→ Status now shows "APPROVED"
  │   │
  │   ├─→ Director clicks "Mark as Paid" button
  │   │   └─→ Modal dialog appears
  │   │
  │   ├─→ PAYMENT MODAL:
  │   │   ├─ Request ID: REQ-2026-001234
  │   │   ├─ Approved Amount: $4,500
  │   │   │
  │   │   ├─ Input: Payment Date (required)
  │   │   │   └─→ Director enters: 03/05/2026
  │   │   │
  │   │   ├─ Input: Payment Method (dropdown)
  │   │   │   ├─ Bank Transfer (selected)
  │   │   │   ├─ Check
  │   │   │   ├─ Cash
  │   │   │   └─ Mobile Money
  │   │   │
  │   │   ├─ Input: Reference Number (optional)
  │   │   │   └─→ Director enters: TRF-2026-54321
  │   │   │       (Bank transfer reference)
  │   │   │
  │   │   ├─ Button: "Cancel" → Close modal
  │   │   └─ Button: "Confirm Payment" → Submit form
  │   │
  │   ├─→ Form validation:
  │   │   ├─ Payment date required
  │   │   ├─ Date must be valid
  │   │   └─→ Validation passes → Process payment
  │   │
  │   ├─→ System processes payment:
  │   │   ├─ Update request.status = 'PAID'
  │   │   ├─ Set request.payment_date = 03/05/2026
  │   │   ├─ Set request.payment_method = 'Bank Transfer'
  │   │   ├─ Set request.payment_reference = 'TRF-2026-54321'
  │   │   ├─ Set request.disbursed_amount = 4500
  │   │   ├─ Calculate remaining_balance = 0
  │   │   ├─ Save to database
  │   │   ├─ Create audit log entry
  │   │   └─ Send success message
  │   │
  │   ├─→ Page updates:
  │   │   ├─ Status badge changes to "PAID"
  │   │   ├─ Disbursed amount shows $4,500
  │   │   ├─ Remaining balance shows $0
  │   │   ├─ Payment info appears in timeline
  │   │   └─ Success alert displays
  │   │
  │   └─→ Applicant sees:
  │       ├─ Request status: PAID
  │       ├─ Payment confirmation on tracking page
  │       └─ Payment method and date
  │
  ├─→ VIEW DASHBOARD STATISTICS
  │   └─→ Statistics update automatically:
  │       ├─ Paid requests: 23 (was 22)
  │       ├─ Total disbursed: $302,950 (was $298,450)
  │       └─ Approval rate: 67.3% (recalculated)
  │
  ├─→ CONTINUE TO NEXT REQUEST
  │   ├─→ Director can:
  │   │   ├─ View dashboard again
  │   │   ├─ Click next pending approval
  │   │   ├─ Filter by status
  │   │   └─ Search for specific request
  │   │
  │   └─→ Workflow repeats for each request
  │
  └─→ END

```

---

## 2. Data Flow Diagrams

### A. Request Submission Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    REQUEST SUBMISSION FLOW                       │
└─────────────────────────────────────────────────────────────────┘

    USER BROWSER                    DJANGO SERVER              DATABASE
    ════════════                    ══════════════              ════════

    │                                   │                          │
    │─ GET /request/new/ ──────────────→│                          │
    │                                   │                          │
    │ (STEP 1: Select Type)             │                          │
    │                                   │                          │
    │─ POST (category, next) ──────────→│                          │
    │                                   ├─ Validate category       │
    │                                   ├─ Store in session        │
    │                                   │  wizard_data['category'] │
    │                                   │                          │
    │←─────────────────────────────────│                          │
    │ (STEP 2 Form)                    │                          │
    │                                   │                          │
    │─ POST (name, email, phone...) ───→│                          │
    │                                   ├─ Validate all fields     │
    │                                   ├─ Store in session        │
    │                                   │  wizard_data[field]      │
    │                                   │                          │
    │←─────────────────────────────────│                          │
    │ (STEP 3 Form)                    │                          │
    │                                   │                          │
    │─ POST (title, description...) ───→│                          │
    │                                   ├─ Validate all fields     │
    │                                   ├─ Store in session        │
    │                                   │                          │
    │←─────────────────────────────────│                          │
    │ (STEP 4 Form - Upload)           │                          │
    │                                   │                          │
    │─ POST (files[...]) ───────────────→│                          │
    │                                   ├─ Validate file types     │
    │                                   ├─ Validate file sizes     │
    │                                   ├─ Store files in /media   │──┐
    │                                   ├─ Store filenames in      │  │
    │                                   │  session wizard_data      │  │ Files
    │                                   │                          │  │ saved
    │←─────────────────────────────────│                          │←─┘
    │ (STEP 5 Form - Review)           │                          │
    │                                   │                          │
    │─ POST (submit, checkbox=1) ──────→│                          │
    │                                   ├─ Validate form data      │
    │                                   ├─ Validate all sessions   │
    │                                   │                          │
    │                                   ├─ Create Request object:  │
    │                                   │  ├─ id = UUID()          │
    │                                   │  ├─ request_id = seq#    │
    │                                   │  ├─ category             │
    │                                   │  ├─ applicant_name       │
    │                                   │  ├─ applicant_email      │
    │                                   │  ├─ amount_requested     │
    │                                   │  ├─ status = 'PENDING'   │
    │                                   │  ├─ created_at = now()   │
    │                                   │  │                          │
    │                                   │──────────────────────────→│
    │                                   │  INSERT INTO requests... │
    │                                   │←────────────────────────│
    │                                   │  (saved)                │
    │                                   │                          │
    │                                   ├─ For each uploaded file: │
    │                                   │  CREATE RequestDocument  │
    │                                   │  ├─ request_id (FK)      │
    │                                   │  ├─ file (path)          │
    │                                   │  ├─ uploaded_at = now()  │
    │                                   │  │                          │
    │                                   │──────────────────────────→│
    │                                   │  INSERT INTO             │
    │                                   │  request_documents...    │
    │                                   │←────────────────────────│
    │                                   │  (saved)                │
    │                                   │                          │
    │                                   ├─ Create AuditLog entry  │
    │                                   │  ├─ user = None (public) │
    │                                   │  ├─ action_type = 'create' │
    │                                   │  ├─ resource = 'Request' │
    │                                   │  ├─ timestamp = now()    │
    │                                   │  │                          │
    │                                   │──────────────────────────→│
    │                                   │  INSERT INTO audit_logs  │
    │                                   │←────────────────────────│
    │                                   │  (logged)               │
    │                                   │                          │
    │                                   ├─ Clear session data     │
    │                                   │  delete wizard_data     │
    │                                   │                          │
    │                                   ├─ Create success message │
    │                                   │                          │
    │←───── Redirect /request/track/ ──│                          │
    │ (with request_id in URL)         │                          │
    │                                   │                          │
    │ (TRACKING PAGE)                   │                          │
    │                                   │                          │
    │─ GET (request_id, phone) ────────→│                          │
    │                                   ├─ Query Request WHERE:    │
    │                                   │  request_id = 'REQ...'   │
    │                                   │  AND phone = '255...'    │
    │                                   │                          │
    │                                   │──────────────────────────→│
    │                                   │  SELECT * FROM requests  │
    │                                   │  WHERE request_id = ...  │
    │                                   │←────────────────────────│
    │                                   │  (request object)       │
    │                                   │                          │
    │                                   ├─ Render request info    │
    │                                   ├─ Render timeline        │
    │                                   ├─ Render contact info    │
    │                                   │                          │
    │←────────── HTML Response ────────│                          │
    │ (displays request info)          │                          │
    │                                   │                          │
    └─────────────────────────────────────────────────────────────┘
```

### B. Request Approval Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    REQUEST APPROVAL FLOW                         │
└─────────────────────────────────────────────────────────────────┘

    ADMIN BROWSER                   DJANGO SERVER              DATABASE
    ═════════════                   ══════════════              ════════

    │                                   │                          │
    │─ GET /request/<uuid>/ ──────────→│                          │
    │                                   ├─ Check auth (session)    │
    │                                   ├─ Check staff (is_staff)  │
    │                                   │                          │
    │                                   ├─ Query Request:          │
    │                                   │  WHERE id = '<uuid>'     │
    │                                   │                          │
    │                                   │──────────────────────────→│
    │                                   │  SELECT * FROM requests  │
    │                                   │  WHERE id = ...          │
    │                                   │←────────────────────────│
    │                                   │  (request object)       │
    │                                   │                          │
    │                                   ├─ Query documents:       │
    │                                   │  WHERE request_id = FK   │
    │                                   │                          │
    │                                   │──────────────────────────→│
    │                                   │  SELECT * FROM           │
    │                                   │  request_documents       │
    │                                   │←────────────────────────│
    │                                   │  (documents list)       │
    │                                   │                          │
    │                                   ├─ Render detail view     │
    │                                   ├─ Show approval buttons  │
    │                                   │                          │
    │←────────── HTML Response ────────│                          │
    │ (request detail page)            │                          │
    │                                   │                          │
    │ (Admin reviews request)           │                          │
    │ Admin reads description           │                          │
    │ Admin downloads documents         │                          │
    │ Admin decides: APPROVE            │                          │
    │                                   │                          │
    │─ POST /request/<uuid>/           │                          │
    │    (action=approve,              │                          │
    │     approved_amount=4500,        │                          │
    │     review_notes="...") ────────→│                          │
    │                                   ├─ Check auth + staff    │
    │                                   ├─ Validate action       │
    │                                   ├─ Validate amount       │
    │                                   │                          │
    │                                   ├─ Query Request:        │
    │                                   │  WHERE id = '<uuid>'    │
    │                                   │                          │
    │                                   │──────────────────────────→│
    │                                   │  SELECT * FROM requests │
    │                                   │  WHERE id = ...         │
    │                                   │←────────────────────────│
    │                                   │  (request object)       │
    │                                   │                          │
    │                                   ├─ Update fields:        │
    │                                   │  status = 'APPROVED'    │
    │                                   │  approved_amount = 4500 │
    │                                   │  review_notes = "..."   │
    │                                   │  reviewed_by = admin_id │
    │                                   │  review_date = now()    │
    │                                   │  updated_at = now()     │
    │                                   │                          │
    │                                   │──────────────────────────→│
    │                                   │  UPDATE requests SET     │
    │                                   │  status = 'APPROVED',    │
    │                                   │  approved_amount = 4500, │
    │                                   │  ...                     │
    │                                   │  WHERE id = ...          │
    │                                   │←────────────────────────│
    │                                   │  (row updated)          │
    │                                   │                          │
    │                                   ├─ Create AuditLog:      │
    │                                   │  user_id = admin_id     │
    │                                   │  ip_address = '10.0...' │
    │                                   │  action_type = 'approve'│
    │                                   │  resource = 'Request'   │
    │                                   │  timestamp = now()      │
    │                                   │                          │
    │                                   │──────────────────────────→│
    │                                   │  INSERT INTO audit_logs  │
    │                                   │  (user_id, ip_address,   │
    │                                   │   action_type, ...)      │
    │                                   │←────────────────────────│
    │                                   │  (logged)               │
    │                                   │                          │
    │                                   ├─ Create success message│
    │                                   │  "Request approved"    │
    │                                   │                          │
    │←─────── Redirect to detail ──────│                          │
    │ (with success message)           │                          │
    │                                   │                          │
    │─ GET /request/<uuid>/ (reload) ─→│                          │
    │                                   ├─ Query updated request │
    │                                   │                          │
    │                                   │──────────────────────────→│
    │                                   │  SELECT * FROM requests │
    │                                   │  WHERE id = ... (status │
    │                                   │  now = 'APPROVED')      │
    │                                   │←────────────────────────│
    │                                   │  (updated object)       │
    │                                   │                          │
    │                                   ├─ Render detail view    │
    │                                   ├─ Status shows APPROVED │
    │                                   ├─ Show approved amount  │
    │                                   ├─ Show "Mark as Paid"   │
    │                                   │  button                │
    │                                   │                          │
    │←────────── HTML Response ────────│                          │
    │ (request now shows APPROVED)     │                          │
    │                                   │                          │
    │ Success message displays         │                          │
    │ "Request approved successfully" │                          │
    │                                   │                          │
    └─────────────────────────────────────────────────────────────┘
```

---

## 3. System Status Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              REQUEST STATUS STATE MACHINE                         │
└─────────────────────────────────────────────────────────────────┘

    START (New Request Submitted)
        │
        ├─→ PENDING
        │   ├─ Request submitted by public user
        │   ├─ Awaiting initial review
        │   ├─ Can transition to: UNDER_REVIEW
        │   │
        │   └─→ [Admin reviews]
        │       │
        │       ├─→ UNDER_REVIEW
        │       │   ├─ Request assigned to reviewer
        │       │   ├─ Director/Admin reviewing
        │       │   ├─ Evaluating documents
        │       │   ├─ Can transition to: APPROVED or REJECTED
        │       │   │
        │       │   ├─→ [Director approves]
        │       │   │   │
        │       │   │   └─→ APPROVED
        │       │   │       ├─ Approved amount recorded
        │       │   │       ├─ Review notes added
        │       │   │       ├─ Ready for payment
        │       │   │       ├─ Can transition to: PAID
        │       │   │       │
        │       │   │       └─→ [Finance processes payment]
        │       │   │           │
        │       │   │           └─→ PAID ✓
        │       │   │               ├─ Payment date recorded
        │       │   │               ├─ Payment method recorded
        │       │   │               ├─ Disbursed amount = approved
        │       │   │               ├─ Request COMPLETE
        │       │   │               └─ END
        │       │   │
        │       │   └─→ [Director rejects]
        │       │       │
        │       │       └─→ REJECTED ✗
        │       │           ├─ Rejection reason recorded
        │       │           ├─ Request cannot be approved
        │       │           ├─ Applicant can resubmit new request
        │       │           └─ END
        │       │
        │       └─→ [No decision yet]
        │           ├─ Stays in UNDER_REVIEW
        │           ├─ Can be reviewed again
        │           └─ Moves to APPROVED or REJECTED
        │
        └─→ [Applicant doesn't follow up]
            └─ PENDING (indefinitely)

    
    STATE TRANSITIONS:
    ══════════════════
    
    PENDING        → UNDER_REVIEW  (Admin action)
    UNDER_REVIEW   → APPROVED      (Director approves)
    UNDER_REVIEW   → REJECTED      (Director rejects)
    UNDER_REVIEW   → PENDING       (Return for resubmission)
    APPROVED       → PAID          (Finance records payment)
    APPROVED       → REJECTED      (Rare: changes mind)
    
    TERMINAL STATES:
    ════════════════
    • PAID         (Request complete, paid)
    • REJECTED     (Request denied, not pursuing)


    DISPLAYED TIMELINE:
    ═══════════════════
    
    ✓ Request Submitted [Date/Time]
      └─ Status: PENDING
         Applicant ID: REQ-2026-001234
    
    ⏳ Initial Admin Review [Expected: 5-7 days]
      └─ Status: UNDER_REVIEW
         Reviewer: [Director name]
    
    ⏳ Finance Committee Decision [Expected: 10-14 days]
      └─ Status: APPROVED/REJECTED
         Decision: [Approved $X | Rejected]
         Notes: [Director notes]
    
    ⏳ Payment Processing [If Approved]
      └─ Status: PAID
         Payment Date: [Date]
         Method: [Bank Transfer]
         Reference: [TRF#]
    
    Amount Allocated: $X
    Amount Disbursed: $X
    Remaining Balance: $0
```

---

## 4. Event Invitation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│           EVENT INVITATION & RSVP FLOW                           │
└─────────────────────────────────────────────────────────────────┘

    DIRECTOR SIDE                       SYSTEM                   USER SIDE
    ═════════════                       ══════                   ═════════

    │                                   │                          │
    ├─ Create Invitation               │                          │
    │  (via /admin/)                   │                          │
    │  ├─ Event title                  │                          │
    │  ├─ Date/Time                    │                          │
    │  ├─ Location                     │                          │
    │  ├─ Description                  │                          │
    │  ├─ Expected attendees           │                          │
    │  └─ Submit                        │                          │
    │     │                             │                          │
    │     └─ Save to database          │                          │
    │        status = 'pending_review'  │                          │
    │        created_at = now()         │                          │
    │        reminder_3_days_sent = F  │                          │
    │        reminder_1_day_sent = F   │                          │
    │                                   │                          │
    │                                   ├─ System email/SMS       │
    │                                   │  (if configured)        │
    │                                   │  "You have an event     │
    │                                   │   invitation..."        │
    │                                   │                          │
    │                                   │                    ←─ User receives invite
    │                                   │                          │
    │                                   │                    User opens email
    │                                   │                    Clicks "View Event"
    │                                   │                    │
    │                                   │←─ User logs in / views
    │                                   │   /invitation/<id>/
    │                                   │                          │
    │                                   │                    Sees event details
    │                                   │                    • Title, date, time
    │                                   │                    • Location
    │                                   │                    • Description
    │                                   │                          │
    │                                   │                    Sees buttons:
    │                                   │                    [Accept] [Decline]
    │                                   │                          │
    │                                   │                    Clicks "Accept"
    │                                   │                    │
    │                                   │←─ POST action=accept
    │                                   │   Updates invitation
    │                                   │   status = 'accepted'
    │                                   │   │
    │                                   │   └─ Success message
    │                                   │      "Invitation accepted"
    │                                   │                          │
    │                                   │                    Page reloads
    │                                   │                    Now shows:
    │                                   │                    [Confirm Attendance]
    │                                   │                    button
    │                                   │                          │
    │                                   │                    [Days pass...]
    │                                   │                          │
    │                                   │←─ System check:
    │                                   │   Is date - 3 days?
    │                                   │   YES → Send 3-day reminder
    │                                   │   Set reminder_3_days_sent = T
    │                                   │                          │
    │                                   │                    ←─ User gets reminder
    │                                   │                       "Event in 3 days"
    │                                   │                          │
    │                                   │                    [1 more day...]
    │                                   │                          │
    │                                   │←─ System check:
    │                                   │   Is date - 1 day?
    │                                   │   YES → Send 1-day reminder
    │                                   │   Set reminder_1_day_sent = T
    │                                   │                          │
    │                                   │                    ←─ User gets reminder
    │                                   │                       "Event tomorrow!"
    │                                   │                          │
    │                                   │                    User can confirm
    │                                   │                    Clicks "Confirm
    │                                   │                    Attendance"
    │                                   │                          │
    │                                   │←─ POST action=confirm
    │                                   │   Updates invitation
    │                                   │   status = 'confirmed_attendance'
    │                                   │   │
    │                                   │   └─ Success message
    │                                   │      "Attendance confirmed"
    │                                   │                          │
    │                                   │                    ←─ Confirmation
    │                                   │                       "See you there!"
    │                                   │                          │
    │                                   │                    [Event day arrives]
    │                                   │                          │
    │ Director marks event complete   │                          │
    │ (via /admin/)                   │                          │
    │ status = 'completed'            │                          │
    │                                   │                          │
    │                                   │←─ System sends thank you │
    │                                   │   (optional)             │
    │                                   │                    ←─ User gets email
    │                                   │                       "Thank you for
    │                                   │                        attending!"
    │                                   │                          │
    └─────────────────────────────────────────────────────────────┘


    ALTERNATIVE: USER DECLINES INVITATION
    ═════════════════════════════════════

    User receives invitation email
          │
          └─ Opens invitation
             └─ Sees [Decline] button
                └─ Clicks "Decline"
                   │
                   └─ POST action=decline
                      │
                      └─ Updates invitation
                         status = 'declined'
                         │
                         └─ Page shows "You have declined"
                            Director sees attendance = declined


    INVITATION STATUS MACHINE:
    ═════════════════════════
    
    pending_review  → New invitation (awaiting user response)
         ↓
         ├─→ accepted           (User accepts, awaiting confirmation)
         │   ├─→ confirmed_attendance  (User confirms, definitely attending)
         │   └─→ completed      (Event finished)
         │
         ├─→ declined           (User declines)
         │   └─→ completed      (Event finished)
         │
         └─→ (no response)
             └─→ (expires/auto-decline)
                 └─→ completed  (Event finished)
```

---

## 5. Dashboard Data Update Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              DASHBOARD STATISTICS UPDATE FLOW                     │
└─────────────────────────────────────────────────────────────────┘

    REAL-TIME UPDATES (On Page Load)
    ════════════════════════════════

    Admin loads dashboard (/dashboard/)
            │
            ├─ Query: COUNT(*) FROM requests
            │  └─ total_requests = 147
            │
            ├─ Query: COUNT(*) FROM requests WHERE status='PENDING'
            │  └─ pending_requests = 12
            │
            ├─ Query: COUNT(*) FROM requests WHERE status='UNDER_REVIEW'
            │  └─ under_review = 8
            │
            ├─ Query: COUNT(*) FROM requests WHERE status='APPROVED'
            │  └─ approved_requests = 98
            │
            ├─ Query: COUNT(*) FROM requests WHERE status='REJECTED'
            │  └─ rejected_requests = 15
            │
            ├─ Query: COUNT(*) FROM requests WHERE status='PAID'
            │  └─ paid_requests = 14
            │
            ├─ Query: SUM(amount_requested) FROM requests
            │  └─ total_requested = $487,500
            │
            ├─ Query: SUM(approved_amount) FROM requests
            │  └─ total_approved = $356,200
            │
            ├─ Query: SUM(disbursed_amount) FROM requests
            │  └─ total_disbursed = $298,450
            │
            ├─ Calculation: approval_rate
            │  └─ (approved_requests / total_requests) * 100 = 66.7%
            │
            ├─ Query: SELECT * FROM requests
            │         WHERE status='UNDER_REVIEW'
            │         ORDER BY created_at ASC
            │         LIMIT 5
            │  └─ pending_approvals = [5 requests]
            │
            ├─ Query: SELECT * FROM requests
            │         ORDER BY created_at DESC
            │         LIMIT 5
            │  └─ recent_requests = [5 latest]
            │
            ├─ Query: COUNT(*) FROM invitations
            │         WHERE status='pending_review'
            │  └─ pending_invitations = 3
            │
            ├─ Query: COUNT(*) FROM invitations
            │         WHERE status='confirmed_attendance'
            │         AND event_date > NOW()
            │  └─ upcoming_events = 7
            │
            └─ Render dashboard with all data
               │
               ├─ Display stat cards:
               │  ├─ 147 Total Requests
               │  ├─ 12 Pending Review
               │  ├─ 98 Approved
               │  ├─ 15 Rejected
               │  ├─ 14 Paid
               │  │
               │  ├─ $487,500 Total Requested
               │  ├─ $356,200 Total Approved
               │  ├─ $298,450 Total Disbursed
               │  └─ 66.7% Approval Rate
               │
               ├─ Display "Pending Approvals" table
               │  └─ 5 requests awaiting approval
               │
               ├─ Display "Recent Requests" list
               │  └─ 5 latest requests
               │
               ├─ Display quick action buttons
               │
               └─ Auto-refresh every 30 seconds (optional)
                  └─ Reload all statistics
                     └─ Update dashboard in real-time


    UPDATES AFTER APPROVAL
    ═════════════════════

    Director approves request:
            │
            ├─ status = 'APPROVED'
            ├─ approved_amount = 4500
            ├─ approved_requests + 1
            ├─ total_approved + 4500
            │
            └─ Next dashboard load:
               ├─ pending_requests = 11 (was 12)
               ├─ approved_requests = 99 (was 98)
               ├─ approval_rate = 67.3% (was 66.7%)
               └─ All stats update automatically


    UPDATES AFTER PAYMENT
    ═════════════════════

    Director marks request as paid:
            │
            ├─ status = 'PAID'
            ├─ disbursed_amount = 4500
            ├─ paid_requests + 1
            ├─ total_disbursed + 4500
            │
            └─ Next dashboard load:
               ├─ paid_requests = 15 (was 14)
               ├─ total_disbursed = $302,950 (was $298,450)
               └─ All metrics update in real-time
```

---

## 6. Complete User Journey Summary

```
╔═════════════════════════════════════════════════════════════════╗
║                    USER JOURNEY SUMMARY                          ║
╚═════════════════════════════════════════════════════════════════╝

PUBLIC USER (Unregistered):
════════════════════════════

HOME PAGE
   ├─ Browse landing page
   ├─ View statistics
   ├─ Learn about programs
   └─ See CTA: "Submit Request"
        │
        ├─ Click "Submit Request"
        │
        FORM WIZARD (5 Steps)
        ├─ Step 1: Select request type
        ├─ Step 2: Enter applicant info
        ├─ Step 3: Enter request details
        ├─ Step 4: Upload documents
        ├─ Step 5: Review & submit
        │
        ├─ Submit successfully
        │  └─ Get request_id: REQ-2026-001234
        │
        REQUEST TRACKING
        ├─ Enter request_id + phone
        ├─ View request status
        ├─ View timeline
        ├─ Track progress
        ├─ Periodic check-ins
        │
        └─ Status progresses:
           ├─ PENDING (submitted)
           ├─ UNDER_REVIEW (admin reviewing)
           ├─ APPROVED (approved!)
           ├─ PAID (payment sent!)
           └─ COMPLETE


ADMIN/DIRECTOR (Registered):
═════════════════════════════

LOGIN
   ├─ Enter credentials
   │
   DASHBOARD
   ├─ View statistics
   ├─ See pending approvals
   ├─ See recent activity
   ├─ See upcoming events
   │
   REQUEST MANAGEMENT
   ├─ View all requests list
   ├─ Filter by status/category
   ├─ Search by ID/name/email
   │
   REQUEST APPROVAL
   ├─ View request detail
   ├─ Review applicant info
   ├─ Review documents
   ├─ Make decision:
   │  ├─ Approve (specify amount)
   │  └─ Reject (specify reason)
   │
   PAYMENT PROCESSING
   ├─ View approved requests
   ├─ Record payment:
   │  ├─ Payment date
   │  ├─ Payment method
   │  └─ Reference number
   │
   EVENT MANAGEMENT
   ├─ Create invitations
   ├─ View RSVP responses
   ├─ Send reminders
   └─ Mark events complete
```

---

## 7. Key Decision Points

```
┌─────────────────────────────────────────────────────────────────┐
│          KEY DECISION POINTS IN USER FLOWS                       │
└─────────────────────────────────────────────────────────────────┘

REQUEST SUBMISSION:
═══════════════════

Question: Is request legitimate?
├─ YES: Complete form & submit
│       ├─ Get request_id
│       ├─ Can track progress
│       └─ Await admin review
│
└─ NO: Don't submit
      └─ Seek alternative assistance


FORM WIZARD NAVIGATION:
══════════════════════

Question: Is current step valid?
├─ YES: Click Next
│       └─ Proceed to next step
│
└─ NO: Click Back
      └─ Return to previous step
          └─ Correct and try again


REQUEST REVIEW (ADMIN):
══════════════════════

Question: Is request eligible?
│
├─ YES:  "Is requested amount appropriate?"
│         │
│         ├─ YES: Approve (full/partial amount)
│         │       └─ Request becomes APPROVED
│         │
│         └─ NO:  Reject (specify reason)
│                 └─ Request becomes REJECTED
│
└─ NO:   Reject (specify reason)
         └─ Request becomes REJECTED


PAYMENT PROCESSING:
═══════════════════

Question: Is funds available?
├─ YES:  Process payment
│        ├─ Record payment date
│        ├─ Record payment method
│        └─ Request becomes PAID
│
└─ NO:   Wait for funds
         └─ Remain in APPROVED status


EVENT INVITATION:
═════════════════

Question: Can you attend event?
├─ YES:  Accept invitation
│        └─ Status = accepted
│            └─ "Can you confirm attendance?"
│                ├─ YES: Confirm
│                │       └─ Status = confirmed_attendance
│                │
│                └─ NO:  (wait for event)
│
└─ NO:   Decline invitation
         └─ Status = declined
```

---

## Summary

This comprehensive flow documentation covers:

1. **User Journey Flows** - Detailed step-by-step paths for public users (submit request) and admins (approve requests)

2. **Data Flow Diagrams** - How data moves between browser, server, and database during key operations (submission, approval, tracking)

3. **System Status Flow** - How request status transitions through the system (PENDING → UNDER_REVIEW → APPROVED/REJECTED → PAID)

4. **Event Invitation Flow** - Complete workflow for creating events, sending invitations, getting RSVPs, and sending reminders

5. **Dashboard Update Flow** - How statistics are calculated and updated in real-time

6. **User Journey Summary** - High-level overview of typical workflows

7. **Decision Points** - Key decision trees at critical junctures in the system

All flows are designed to be **transparent, efficient, and user-friendly** - giving users clear visibility into their requests while giving administrators clear workflows for approving and processing them.

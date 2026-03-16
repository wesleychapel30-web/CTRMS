# Chakou Trust - Comprehensive Application Description

## Executive Summary

**Chakou Trust** is a modern, Django-based web application designed for community organizations and NGOs to manage assistance requests and event invitations with transparency, efficiency, and accountability. The system provides a professional interface for request submission, approval workflows, financial tracking, and event management—all with role-based access control and complete audit trails.

---

## 1. Application Overview

### What is Chakou Trust?

Chakou Trust is a **Request & Invitation Management System** that:
- Allows community members to submit assistance requests for education, medical care, construction, and other needs
- Provides administrators and directors with tools to review, approve, and track requests
- Manages event invitations with RSVP functionality
- Tracks financial allocations and disbursements
- Maintains complete audit logs of all actions
- Displays organization impact metrics and transparency reports

### Core Purpose

Enable NGOs and community organizations to:
1. **Streamline request processing** - From submission to approval to payment
2. **Maintain transparency** - Public tracking and impact dashboards
3. **Ensure accountability** - Complete audit trails and financial tracking
4. **Manage events** - Event invitations with attendance tracking
5. **Build trust** - Professional interface demonstrates organizational integrity

---

## 2. Key Features

### A. Request Management System (Part A)

#### Request Submission (Public)
- **Multi-step Wizard Form** (5 steps)
  - Step 1: Select request category (Education, Medical, Construction, Other)
  - Step 2: Provide applicant information (name, email, phone, ID, organization, role, region)
  - Step 3: Describe request details (title, description, beneficiaries, amount needed, location)
  - Step 4: Upload supporting documents (PDFs, images)
  - Step 5: Review and confirm submission
- **Real-time validation** at each step
- **Session persistence** across steps
- **Document attachment support**

#### Request Tracking (Public)
- Search requests by ID and phone number
- View real-time status with timeline
- Track approval progress
- See payment information
- No authentication required

#### Request Management (Admin)
- **List View**
  - All requests with filtering
  - Filter by status (Pending, Under Review, Approved, Rejected, Paid)
  - Filter by category (Tuition, Medical, Construction, Other)
  - Search by request ID, applicant name, or email
  - Pagination (15 requests per page)
  - Summary statistics at top

- **Detail View**
  - Complete applicant information
  - Full request description
  - Financial summary (requested, approved, disbursed, remaining)
  - Supporting documents with download links
  - Timeline of approvals and payments
  - Director action buttons

#### Request Approval Workflow
- **Pending Review** → Director views request details
- **Approve Action** → Director specifies approved amount and adds notes
- Status changes to **APPROVED**
- Financial fields updated (approved_amount, reviewed_by, review_date)

#### Request Rejection
- Director specifies rejection reason
- Status changes to **REJECTED**
- Rejection reason stored in review_notes
- Applicant can track status

#### Payment Processing
- Director marks approved request as paid
- Enter payment date, method, and reference number
- Payment method options:
  - Bank Transfer
  - Check
  - Cash
  - Mobile Money
- Disbursed amount tracked
- Status changes to **PAID**

### B. Invitation Management System (Part B)

#### Event Invitations
- **Create Invitations** (Directors only)
  - Event title and organization
  - Date, time, and duration
  - Location and expected attendees
  - Description and special requirements
  
#### Invitation Responses (Web)
- View upcoming events
- Accept/Decline/Confirm attendance
- Status tracking: Pending, Accepted, Declined, Confirmed, Completed
- RSVP modal dialogs

#### Event List View
- Filter by status (Pending Review, Accepted, Declined, etc.)
- Filter by type (All, Upcoming, Past)
- Card-based layout with event details
- Quick RSVP buttons
- Event count summary

#### Event Detail View
- Full event information
- Date, time, duration, location
- Expected attendees count
- Special requirements
- Reminder status (3-day, 1-day)
- RSVP action buttons
- Organizer contact information

#### Automatic Reminders
- System sends reminders 3 days before event
- System sends reminders 1 day before event
- Tracks reminder sent status
- Optional SMS/Email notifications (infrastructure ready)

### C. Public Pages

#### Landing Page (/home)
- Hero section with value proposition
- Live statistics:
  - Total requests submitted
  - Approved requests
  - Communities served
  - People helped
- Programs overview (Education, Welfare, School)
- How-it-works guide (4-step process)
- Call-to-action buttons

#### Transparency Dashboard (/transparency)
- Organization impact metrics
- Request statistics:
  - Total submitted
  - Total approved
  - Total amount allocated
  - Communities reached
- Category breakdown:
  - Requests by type
  - Approval rates per category
  - Amount allocated per category
- Geographic distribution (regions served)
- Key performance indicators:
  - Average processing time
  - Approval rate percentage
  - Average award amount
- Community testimonials
- Final call-to-action

### D. Administrative Dashboard (/dashboard)

#### Statistics Overview
- **Request Metrics**
  - Total requests
  - Pending review
  - Under review
  - Approved requests
  - Rejected requests
  - Paid requests

- **Financial Summary**
  - Total amount requested
  - Total amount approved
  - Total amount disbursed
  - Approval rate percentage

- **Event Metrics**
  - Pending invitations
  - Upcoming events

#### Quick Actions
- View all requests
- View all events
- View impact statistics
- Access admin panel

#### Pending Approvals
- Table of requests needing review
- Request ID, applicant name, amount
- Category and submission date
- Direct "Review" button to detail page

#### Recent Activity
- Latest requests submitted
- Latest system actions
- Status indicators
- Quick links

---

## 3. Technical Architecture

### Technology Stack

#### Backend
- **Django 4.2.13** - Web framework
- **Django REST Framework 3.14.0** - API development
- **PostgreSQL/SQLite** - Database (SQLite dev, PostgreSQL production)
- **Gunicorn** - WSGI server
- **White Noise** - Static file serving

#### Frontend
- **Bootstrap 5.3.0** - CSS framework (CDN)
- **Bootstrap Icons 1.11.0** - Icon library
- **Django Templates** - Server-side rendering
- **Custom CSS** - 400+ lines of proprietary styling

#### Additional
- **Django-Filter** - Queryset filtering
- **Django-CORS-Headers** - Cross-origin requests
- **Python-Decouple** - Environment configuration
- **Celery** - Background tasks (optional, configured)
- **Redis** - Message broker (optional, configured)

### Database Models

#### User Model
- Custom Django User model
- Fields: username, email, password, first_name, last_name, is_staff, is_active
- Roles: Admin (is_staff=True), Director (is_staff=True), User (is_staff=False)

#### Request Model
- `id`: UUID primary key
- `request_id`: Human-readable auto-generated ID
- **Applicant Info**: name, email, phone, ID number, organization, role, region
- **Request Details**: category, title, description, beneficiaries count, location
- **Financial**: amount_requested, approved_amount, disbursed_amount
- **Status**: PENDING → UNDER_REVIEW → APPROVED/REJECTED/PAID
- **Review**: reviewed_by (FK User), review_date, review_notes
- **Timestamps**: created_at, updated_at
- **Audit**: Documents attached via RequestDocument model

#### RequestDocument Model
- `id`: UUID primary key
- `request_id`: FK to Request
- `file`: FileField for uploads
- `uploaded_at`: Timestamp
- Supports: PDF, JPG, PNG

#### Invitation Model
- `id`: UUID primary key
- **Event Info**: event_title, inviting_organization, description
- **Timing**: event_date, event_duration_hours
- **Location**: location, expected_attendees
- **Status**: PENDING_REVIEW → ACCEPTED/DECLINED → CONFIRMED_ATTENDANCE → COMPLETED
- **Review**: reviewed_by, reviewed_date, review_notes
- **Reminders**: reminder_3_days_sent, reminder_1_day_sent (Boolean flags)
- **Timestamps**: created_at, updated_at

#### AuditLog Model
- Tracks every user action
- Fields: user, ip_address, action_type, resource_type, timestamp
- Excluded from logging: static files, media files, health checks

---

## 4. User Roles & Permissions

### Public Users (Unauthenticated)
**Can Access:**
- Home page
- Submit requests (form)
- Track requests (by ID + phone)
- View transparency/impact dashboard
- View login page

**Cannot Access:**
- Admin dashboard
- Request list
- Event management
- Admin panel

### Administrator Users (is_staff=True)
**Can Access:**
- Dashboard with full statistics
- All requests (list & detail)
- Submit, view, and manage requests
- Request tracking
- Event list and details
- View impact statistics
- Admin panel (/admin/)

**Special Permissions:**
- Approve requests (set approved_amount, add review notes)
- Reject requests (provide rejection reason)
- Mark requests as paid (enter payment details)
- View audit logs

### Director Users (is_staff=True)
**Same permissions as Administrator** (currently same role, can be differentiated)

---

## 5. Workflows & Processes

### Request Submission Workflow

```
1. User submits form (home.html → request/new/)
2. Step 1: Select request type
3. Step 2: Enter applicant info
4. Step 3: Enter request details
5. Step 4: Upload documents
6. Step 5: Review and submit
7. Request created with status=PENDING
8. System generates request_id
9. Confirmation message displayed
10. User redirected to tracking page
```

### Request Approval Workflow

```
1. Director logs in → Goes to Dashboard
2. Views "Pending Approvals" table
3. Clicks "Review" on specific request
4. Views RequestDetailView with full details
5. Director clicks "Approve" button
6. Modal appears requesting:
   - Approved amount
   - Review notes
7. Director submits form with action='approve'
8. RequestDetailView.post() processes:
   - Updates status to 'APPROVED'
   - Sets approved_amount
   - Sets reviewed_by (current user)
   - Sets review_date (now)
   - Saves review_notes
9. Success message displayed
10. Request list refreshes
11. Request now shows "APPROVED" status
12. Applicant can track status online
```

### Payment Workflow

```
1. Request has status='APPROVED'
2. Director views request detail
3. Clicks "Mark as Paid" button
4. Modal appears requesting:
   - Payment date
   - Payment method (dropdown)
   - Reference number (optional)
5. Director submits with action='mark_paid'
6. RequestDetailView.post() processes:
   - Updates status to 'PAID'
   - Sets payment_date
   - Sets payment_method
   - Sets payment_reference
   - Sets disbursed_amount = approved_amount
   - Saves payment info
7. Timeline updates to show payment
8. Applicant can see payment confirmation
```

### Event Invitation Workflow

```
1. Director creates invitation (admin interface)
2. Sets event date, location, details
3. Status = 'pending_review'
4. Admin/user receives invitation notification
5. User clicks "View Details" on invitation
6. User sees event information
7. User clicks "Accept" or "Decline" button
8. If accepted: status = 'accepted'
9. User can later click "Confirm Attendance"
10. Status = 'confirmed_attendance'
11. System tracks responses
12. 3 days before event: reminder sent
13. 1 day before event: reminder sent
14. Event completed: status = 'completed'
```

---

## 6. Routes & URLs

### Public Routes (No Login Required)

```
GET  /                          → Home page (statistics)
GET  /transparency/             → Impact dashboard
GET  /login/                    → Login form

GET  /request/new/              → Request submission wizard
POST /request/new/              → Submit form data (step navigation)
GET  /request/track/            → Public tracking search
POST /request/track/            → Search results
```

### Admin Routes (Login Required)

```
GET  /dashboard/                → Admin dashboard
GET  /requests/                 → Request list (filtered, paginated)
GET  /request/<uuid>/           → Request detail
POST /request/<uuid>/           → Request actions (approve, reject, pay)

GET  /invitations/              → Event list
GET  /invitation/<uuid>/        → Event detail
POST /invitation/<uuid>/        → RSVP actions
```

### API Routes (RESTful)

```
GET    /api/requests/                    → List all requests
POST   /api/requests/                    → Create request
GET    /api/requests/<id>/               → Get request detail
PATCH  /api/requests/<id>/               → Update request
POST   /api/requests/<id>/approve_request/  → Approve (director)
POST   /api/requests/<id>/reject_request/   → Reject (director)
POST   /api/requests/<id>/mark_as_paid/    → Mark paid (director)
POST   /api/requests/<id>/upload_document/ → Upload file

GET    /api/invitations/                 → List invitations
POST   /api/invitations/                 → Create invitation
GET    /api/invitations/<id>/            → Get invitation
PATCH  /api/invitations/<id>/            → Update invitation
POST   /api/invitations/<id>/accept_invitation/     → Accept
POST   /api/invitations/<id>/decline_invitation/    → Decline
POST   /api/invitations/<id>/confirm_attendance/    → Confirm
POST   /api/invitations/<id>/mark_completed/        → Complete

GET    /api/documents/                   → List documents
GET    /api/documents/<id>/download/     → Download file
```

### Auth Routes

```
POST /api/token/                 → Obtain JWT token
POST /api/token/refresh/         → Refresh JWT token
GET  /logout/                    → Logout (session)
```

---

## 7. Key Features Deep Dive

### Multi-Step Form Wizard

**Implementation:**
- Session-based state persistence (request.session['wizard_data'])
- Step validation before allowing next
- Previous button allows backtracking
- Data preserved across steps
- Final submission creates Request object
- Session cleared on completion

**Features:**
- Progress indicator (shows current step)
- Help sidebar with contextual guidance
- Error messages guide user
- Confirmation on final step
- Document upload with drag-drop

### Advanced Filtering & Search

**Request List:**
- Filter by status (dropdown)
- Filter by category (dropdown)
- Full-text search (request ID, name, email)
- Pagination (15 per page)
- Preserves filters across pages
- Summary stats update with filters

**Event List:**
- Filter by status (pending, accepted, declined, etc.)
- View type filter (all, upcoming, past)
- Card-based layout
- Quick RSVP buttons

### Financial Tracking

**Amounts Tracked:**
- `amount_requested` - What applicant asked for
- `approved_amount` - What director approved
- `disbursed_amount` - What was actually paid
- `remaining_balance` - approved - disbursed

**Display:**
- Request detail shows all 4 amounts
- Dashboard shows summary totals
- Transparency page shows aggregate statistics
- Financial information updated with each action

### Document Management

**Features:**
- Upload multiple files per request
- Supported formats: PDF, JPG, PNG
- Download links for each document
- File size tracking
- Upload timestamp
- Secure file storage

### Audit Trail

**Captured Information:**
- User performing action
- IP address of request
- Timestamp
- Action type (create, approve, reject, payment)
- Resource affected (request ID, etc.)

**Exclusions:**
- Static files
- Media files
- Health checks

---

## 8. Design & User Experience

### Color Scheme
- **Primary Navy**: #1a3a52 (headings, nav, primary text)
- **Accent Green**: #2ecc71 (buttons, success, CTAs)
- **Gold Accent**: #d4af37 (highlights, premium feel)
- **Neutral White**: #ffffff (backgrounds)
- **Light Gray**: #f8f9fa (secondary backgrounds)

### Typography
- **Headings**: Georgia serif font (elegant, professional)
- **Body**: Sans-serif (readable, modern)
- **Sizes**: 
  - H1: 2.5rem
  - H2: 2rem
  - H3: 1.5rem
  - Body: 1rem

### Components
- **Cards**: Soft shadows, rounded corners, hover effects
- **Buttons**: Green background, hover animations, multiple sizes
- **Forms**: Clear labels, validation feedback, focus states
- **Badges**: Color-coded status (warning, success, danger, etc.)
- **Progress**: Step indicators, progress bars
- **Modals**: Confirmation dialogs for important actions
- **Tables**: Hover rows, status indicators, action buttons

### Responsive Design
- Mobile-first approach
- Breakpoints: sm(576px), md(768px), lg(992px), xl(1200px)
- Navigation collapses on mobile
- Cards stack vertically
- Tables become responsive

---

## 9. Security Features

### Authentication
- Session-based for web UI
- JWT optional for API
- Password hashing (Django default)
- CSRF protection on forms
- Secure headers configured

### Authorization
- LoginRequired mixin on protected views
- Staff/is_staff checks for director actions
- Database-level role checks
- URL-based access control

### Data Protection
- File upload validation
- Input sanitization
- SQL injection prevention (Django ORM)
- XSS protection (template escaping)
- CORS headers configured

### Audit & Compliance
- Complete action logging
- IP address tracking
- Timestamp on all operations
- Immutable audit records
- GDPR-ready structure

---

## 10. Deployment & Operations

### Development
- SQLite database
- Local file storage
- Debug mode enabled
- Auto-reload on code changes

### Production
- PostgreSQL database
- S3/cloud file storage
- Debug disabled
- Gunicorn WSGI server
- Nginx reverse proxy
- SSL/HTTPS enabled

### Maintenance
- Database backups configured
- Log rotation in place
- Static file collection
- Media file cleanup
- Dependency updates

---

## 11. Integration Points

### Email Notifications (Ready)
- Request approved notification
- Request rejected notification
- Payment confirmation
- Invitation reminders
- Status updates

### SMS Integration (Ready)
- Twilio integration ready
- SMS reminders
- Status notifications

### Payment Gateways (Ready)
- Stripe integration point
- PayPal integration point
- Mobile money integration ready

### External Systems
- Calendar integrations (iCal, Google Calendar)
- Report exports (PDF, Excel)
- Analytics integrations

---

## 12. Statistics & Reporting

### Available Metrics
- Total requests submitted
- Approval rate (%)
- Average processing time
- Amount requested vs. approved
- Requests by category
- Requests by region
- Communities served
- People helped
- Event attendance rate

### Reports
- Request summary (all requests with status)
- Financial report (amounts by status)
- Category breakdown (requests, approvals, amount)
- Geographic distribution (regions served)
- Transparency report (public metrics)

### Dashboard Data
- Real-time statistics
- Pending items count
- Recent activity feed
- KPI indicators

---

## 13. System Status & Readiness

### ✅ Completed
- Core request management (CRUD)
- Multi-step form wizard
- Approval workflow
- Payment processing
- Event management
- Web UI (11+ templates)
- User authentication
- Role-based access
- Audit logging
- Dashboard & reporting
- Public pages
- Responsive design

### 🔄 Optional/Future
- Email notifications
- SMS alerts
- Payment gateway integration
- Advanced analytics charts
- Bulk actions
- Request amendments
- Budget tracking per category
- Comments/notes system
- Mobile app
- API documentation (Swagger)

### ⚙️ Infrastructure
- Database migrations ready
- Static file collection configured
- Media upload handling ready
- Caching configured (optional)
- Task queue ready (Celery)

---

## 14. Getting Started

### Installation
```bash
# 1. Clone repository
git clone <repo-url>
cd CTRMS

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate  # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Setup environment
cp .env.example .env
# Edit .env with your settings

# 5. Database setup
python manage.py migrate

# 6. Create superuser
python manage.py createsuperuser

# 7. Run development server
python manage.py runserver 0.0.0.0:8000
```

### Access
- **Public Home**: http://localhost:8000/
- **Submit Request**: http://localhost:8000/request/new/
- **Track Request**: http://localhost:8000/request/track/
- **Admin Dashboard**: http://localhost:8000/dashboard/
- **Django Admin**: http://localhost:8000/admin/

### Default Credentials
- Username: `admin`
- Password: `admin123456` (change immediately in production!)

---

## 15. File Structure

```
CTRMS/
├── core/                    # User models, authentication
│   ├── models.py           # User, AuditLog models
│   ├── web_views.py        # Web UI views
│   ├── views.py            # API viewsets
│   ├── urls.py             # URL routing
│   └── context_processors.py # Template context
│
├── requests/               # Request management
│   ├── models.py           # Request, RequestDocument
│   ├── web_views.py        # Web views (wizard, list, detail)
│   ├── views.py            # API endpoints
│   ├── serializers.py      # DRF serializers
│   └── urls.py             # Request URLs
│
├── invitations/            # Event management
│   ├── models.py           # Invitation model
│   ├── views.py            # API views
│   └── serializers.py      # Serializers
│
├── templates/              # HTML templates
│   ├── base.html           # Master layout
│   ├── home.html           # Landing page
│   ├── transparency.html    # Impact dashboard
│   ├── dashboard.html       # Admin dashboard
│   ├── login.html           # Auth form
│   ├── messages.html        # Alert component
│   ├── requests/
│   │   ├── form.html       # Submission wizard
│   │   ├── list.html       # Request list
│   │   ├── detail.html     # Request detail
│   │   └── track.html      # Public tracking
│   └── invitations/
│       ├── list.html       # Event list
│       └── detail.html     # Event detail
│
├── static/                 # CSS, JS, images
├── media/                  # User uploads
├── ctrms_config/           # Project settings
│   ├── settings.py         # Django configuration
│   ├── urls.py             # Main URL routing
│   ├── middleware.py       # Audit logging
│   └── wsgi.py             # WSGI config
│
├── manage.py               # Django CLI
└── requirements.txt        # Python dependencies
```

---

## Summary

**Chakou Trust** is a production-ready web application that brings transparency, efficiency, and accountability to community assistance programs. It combines a public-facing interface for request submission and tracking with a comprehensive admin dashboard for reviewing, approving, and managing requests. The system is secure, scalable, and designed to build trust through transparency.

**Key Strengths:**
- ✅ User-friendly interface
- ✅ Complete request lifecycle management
- ✅ Transparent tracking and reporting
- ✅ Role-based security
- ✅ Financial accountability
- ✅ Event management
- ✅ Audit trails
- ✅ Responsive design
- ✅ Production-ready code
- ✅ Professional presentation

---

**Version**: 2.0.0 (Web UI Release)  
**Status**: Production Ready  
**Last Updated**: March 5, 2026

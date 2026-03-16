# CTRMS - Complete Request & Training Management System

**Version**: 3.0 (Production Ready)  
**Last Updated**: March 6, 2026  
**Status**: ✅ Fully Operational

---

## Table of Contents

- [Quick Start](#quick-start)
- [System Overview](#system-overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Installation & Setup](#installation--setup)
- [Running the System](#running-the-system)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Quick Start

```bash
# 1. Navigate to project
cd c:\Users\CARL\Desktop\PROJECTS\CTRMS

# 2. Activate virtual environment
venv\Scripts\activate

# 3. Run migrations
python manage.py migrate

# 4. Create admin user
python manage.py createsuperuser

# 5. Start server
python manage.py runserver

# 6. Visit http://localhost:8000/
```

---

## System Overview

CTRMS is a comprehensive Django-based platform for managing:

### 1. **Request Management** (Part A)
- Submit financial requests (tuition, medical, construction)
- Track request status through approval workflow
- Upload supporting documents
- Monitor disbursements and payments

### 2. **Invitation Management** (Part B)
- Create and manage event invitations
- Track RSVP responses
- Set automated reminders
- View calendar of upcoming events

### 3. **User Management** (NEW - Phase 3)
- User registration with email confirmation
- Secure password reset with token validation
- Comprehensive user preferences
- Role-based access control (Admin/Director)

### 4. **Organization Management** (NEW - Phase 3)
- Logo and branding customization
- Color scheme configuration
- Social media links
- Organization information and footer

---

## Key Features

### Authentication & Security
✅ User registration with validation  
✅ Secure login with session management  
✅ Password reset with email tokens  
✅ JWT API authentication  
✅ Failed login attempt tracking  
✅ Account lockout protection  
✅ PBKDF2 password hashing  
✅ CSRF and XSS protection  

### User Management
✅ User profiles with detailed information  
✅ Comprehensive preference settings  
✅ Email notification controls  
✅ Quiet hours scheduling  
✅ Theme and language selection  
✅ Timezone configuration  
✅ Privacy controls  

### Request Workflow
✅ Multi-stage approval process  
✅ Auto-approval based on rules  
✅ Director review and approval  
✅ Payment tracking and disbursement  
✅ Document upload and management  
✅ Status transitions with audit trail  
✅ Financial reconciliation  

### Notifications
✅ Email notifications for all events  
✅ Customizable notification frequency  
✅ Quiet hours respect  
✅ Multi-part email (HTML + text)  
✅ Delivery tracking  
✅ Retry logic for failed sends  

### API & Integration
✅ RESTful API with DRF  
✅ JWT token authentication  
✅ 15+ endpoints  
✅ Role-based permissions  
✅ Request/response serialization  
✅ Error handling and validation  
✅ CORS support  

### Organization Branding
✅ Logo upload and display  
✅ Favicon configuration  
✅ Banner images  
✅ Custom color scheme  
✅ Social media links  
✅ Organization information  

### Reporting & Analytics
✅ Dashboard statistics  
✅ Request tracking  
✅ Financial reports  
✅ CSV/Excel/PDF exports  
✅ Approval metrics  
✅ User activity logs  

---

## Architecture

### Technology Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| Django | 6.0.3 | Web framework |
| Django REST Framework | 3.16.1 | API framework |
| JWT (djangorestframework-simplejwt) | 5.5.1 | Token authentication |
| SQLite/PostgreSQL | Latest | Database |
| Bootstrap 5 | Latest | Frontend framework |
| Chart.js | Latest | Analytics charts |

### Directory Structure

```
CTRMS/
├── ctrms_config/          # Django configuration
│   ├── settings.py        # Settings and configuration
│   ├── urls.py            # URL routing
│   ├── wsgi.py            # WSGI application
│   └── middleware.py      # Middleware (audit logging)
│
├── core/                  # User & authentication management
│   ├── models.py          # User, PasswordResetToken, UserPreferences
│   ├── views.py           # Web views
│   ├── auth_views.py      # Authentication views (NEW)
│   ├── auth_urls.py       # Authentication URLs (NEW)
│   ├── forms.py           # Authentication forms (NEW)
│   ├── jwt_auth.py        # JWT & API endpoints (NEW)
│   ├── serializers.py     # DRF serializers
│   ├── permissions.py     # Custom permissions
│   └── migrations/        # Database migrations
│
├── requests/              # Request management
│   ├── models.py          # Request, RequestDocument
│   ├── views.py           # Request views
│   ├── serializers.py     # Request serializers
│   ├── urls.py            # Request URLs
│   └── migrations/        # Migrations
│
├── invitations/           # Invitation management
│   ├── models.py          # Invitation model
│   ├── views.py           # Invitation views
│   ├── serializers.py     # Invitation serializers
│   └── migrations/        # Migrations
│
├── common/                # Shared utilities
│   ├── models.py          # OrganizationSettings (NEW)
│   ├── utilities.py       # Helper functions
│   └── migrations/        # Migrations
│
├── static/                # Static files (CSS, JS, images)
├── media/                 # User uploads (documents, logos)
├── templates/             # HTML templates
│
├── COMPLETE_DATA_FLOW.md  # System architecture & data flow
├── TESTING_MANUAL.md      # Comprehensive testing guide
├── IMPLEMENTATION_SUMMARY.md # Feature summary
└── manage.py              # Django management command
```

### Data Models

**Core Models**:
- `User` - Django's built-in user model
- `UserPreferences` - User settings and preferences
- `PasswordResetToken` - Password reset tokens
- `Request` - Financial requests with workflow
- `RequestDocument` - Attached files to requests
- `Invitation` - Event invitations and RSVPs
- `AuditLog` - Complete action audit trail
- `OrganizationSettings` - Organization branding
- `NotificationTemplate` - Email templates
- `EmailLog` - Email delivery tracking

---

## Installation & Setup

### Prerequisites

- Python 3.14+
- pip (Python package manager)
- Virtual environment (venv)
- Git (for version control)

### Step 1: Clone/Navigate to Project

```bash
cd c:\Users\CARL\Desktop\PROJECTS\CTRMS
```

### Step 2: Create Virtual Environment

```bash
python -m venv venv
venv\Scripts\activate
```

### Step 3: Install Dependencies

```bash
pip install -r requirements.txt
```

**Key packages**:
- Django 6.0.3
- djangorestframework 3.16.1
- djangorestframework-simplejwt 5.5.1
- Pillow (for image handling)
- python-decouple (for environment variables)

### Step 4: Configure Environment

Create `.env` file in project root:

```bash
# Django settings
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=sqlite:///db.sqlite3
# Or for PostgreSQL: postgresql://user:password@localhost/ctrms_db

# Email (development - console backend)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend

# Email (production - Gmail example)
# EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
# EMAIL_HOST=smtp.gmail.com
# EMAIL_PORT=587
# EMAIL_USE_TLS=True
# EMAIL_HOST_USER=your-email@gmail.com
# EMAIL_HOST_PASSWORD=your-app-password
# DEFAULT_FROM_EMAIL=noreply@example.com

# JWT settings
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7
```

### Step 5: Run Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

**Expected output**:
```
Applying admin.0001_initial... OK
...
Applying core.0003_userpreferences_passwordresettoken... OK
Applying common.0002_organizationsettings... OK
```

### Step 6: Create Superuser

```bash
python manage.py createsuperuser
```

Follow prompts to create admin account.

### Step 7: Collect Static Files (Production)

```bash
python manage.py collectstatic --noinput
```

---

## Running the System

### Development Server

```bash
python manage.py runserver
```

**Output**:
```
Starting development server at http://127.0.0.1:8000/
Quit the server with CTRL-BREAK.
```

### Access Points

| URL | Purpose | Auth |
|-----|---------|------|
| http://localhost:8000/ | Home page | None |
| http://localhost:8000/register/ | User registration | None |
| http://localhost:8000/login/ | User login | None |
| http://localhost:8000/dashboard/ | User dashboard | Required |
| http://localhost:8000/admin/ | Django admin | Admin only |
| http://localhost:8000/api/ | API root | Token |

### System Checks

Before running, verify system is healthy:

```bash
python manage.py check
```

**Expected output**:
```
System check identified no issues (0 silenced).
```

---

## API Documentation

### Authentication

#### Register New User
```bash
POST /api/users/register/
Content-Type: application/json

{
  "username": "johnsmith",
  "email": "john@example.com",
  "first_name": "John",
  "last_name": "Smith",
  "password": "SecurePass123",
  "password_confirm": "SecurePass123"
}

Response 201 Created:
{
  "id": "uuid",
  "username": "johnsmith",
  "email": "john@example.com",
  "first_name": "John",
  "last_name": "Smith",
  "message": "User registered successfully"
}
```

#### Obtain JWT Token
```bash
POST /api/token/
Content-Type: application/json

{
  "username": "johnsmith",
  "password": "SecurePass123"
}

Response 200 OK:
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": "uuid",
    "username": "johnsmith",
    "email": "john@example.com",
    "full_name": "John Smith",
    "is_admin": false,
    "is_director": false
  }
}
```

#### Refresh Access Token
```bash
POST /api/token/refresh/
Content-Type: application/json

{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}

Response 200 OK:
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

#### Get Current User
```bash
GET /api/users/me/
Authorization: Bearer <ACCESS_TOKEN>

Response 200 OK:
{
  "id": "uuid",
  "username": "johnsmith",
  "email": "john@example.com",
  "full_name": "John Smith",
  "phone": "",
  "address": "",
  "department": "",
  "role": "admin",
  "is_admin": false,
  "is_director": false,
  "preferences": {
    "theme": "light",
    "language": "en",
    "email_notifications_enabled": true,
    "quiet_hours_enabled": false
  }
}
```

### Request Management

#### Submit Request
```bash
POST /api/submit-request/
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "category": "tuition",
  "amount_requested": 5000.00,
  "title": "College Tuition Assistance",
  "description": "Request for fall semester tuition",
  "beneficiaries": "John Smith"
}

Response 201 Created:
{
  "request_id": "REQ-20260306-000001",
  "status": "PENDING",
  "category": "TUITION",
  "amount_requested": 5000.00,
  "created_at": "2026-03-06T14:30:00Z"
}
```

#### Approve Request
```bash
POST /api/approve-request/
Authorization: Bearer <DIRECTOR_TOKEN>
Content-Type: application/json

{
  "request_id": "REQ-20260306-000001",
  "approved_amount": 4500.00,
  "review_notes": "Approved. Documentation verified."
}

Response 200 OK:
{
  "request_id": "REQ-20260306-000001",
  "status": "APPROVED",
  "approved_amount": 4500.00,
  "message": "Request approved successfully"
}
```

#### Reject Request
```bash
POST /api/reject-request/
Authorization: Bearer <DIRECTOR_TOKEN>
Content-Type: application/json

{
  "request_id": "REQ-20260306-000001",
  "rejection_reason": "Insufficient documentation",
  "review_notes": "Please provide additional proof of eligibility"
}

Response 200 OK:
{
  "request_id": "REQ-20260306-000001",
  "status": "REJECTED",
  "message": "Request rejected"
}
```

#### Mark as Paid
```bash
POST /api/mark-paid/
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "request_id": "REQ-20260306-000001",
  "payment_method": "bank_transfer",
  "payment_reference": "TXN-20260306-12345",
  "payment_date": "2026-03-06"
}

Response 200 OK:
{
  "request_id": "REQ-20260306-000001",
  "status": "PAID",
  "disbursed_amount": 4500.00,
  "message": "Payment recorded successfully"
}
```

---

## Testing

### Run Test Suite

```bash
# Run all tests
python manage.py test

# Run specific app tests
python manage.py test core
python manage.py test requests
python manage.py test invitations

# Run with verbose output
python manage.py test -v 2

# Run with coverage
coverage run --source='.' manage.py test
coverage report
coverage html  # Generate HTML report
```

### Manual Testing

See [TESTING_MANUAL.md](TESTING_MANUAL.md) for comprehensive manual testing guide including:

- 50+ test cases
- Step-by-step instructions
- Expected results
- Verification steps
- Edge case testing

**Quick Manual Tests**:

1. **User Registration**
   - Navigate to http://localhost:8000/register/
   - Fill in all fields
   - Submit
   - Check for welcome email

2. **User Login**
   - Navigate to http://localhost:8000/login/
   - Enter credentials
   - Verify redirect to dashboard

3. **Password Reset**
   - Click "Forgot Password"
   - Enter email
   - Check for reset link email
   - Click link and reset password

4. **Request Submission**
   - Login as user
   - Navigate to dashboard
   - Click "New Request"
   - Fill in all fields
   - Upload document
   - Submit

5. **Request Approval**
   - Login as director
   - View pending requests
   - Click "Approve"
   - Enter amount and notes
   - Confirm

---

## Troubleshooting

### Server Won't Start

**Error**: `ModuleNotFoundError: No module named 'django'`

**Solution**:
```bash
# Ensure virtual environment is activated
venv\Scripts\activate

# Reinstall dependencies
pip install -r requirements.txt
```

### Database Migration Error

**Error**: `No such table: core_user`

**Solution**:
```bash
# Run migrations
python manage.py migrate
```

### Port Already in Use

**Error**: `Error: Address already in use (':8000')`

**Solution**:
```bash
# Use different port
python manage.py runserver 8001

# OR kill process on port 8000 (Windows)
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Static Files Not Loading

**Error**: 404 errors for CSS/JS files

**Solution**:
```bash
# Collect static files
python manage.py collectstatic --noinput

# For development, ensure STATIC_URL in settings is correct
# settings.py should have:
# STATIC_URL = '/static/'
```

### Email Not Sending

**Error**: Emails not appearing in console or mailbox

**Solution**:
1. Check `EMAIL_BACKEND` in `.env`:
   - Development: `django.core.mail.backends.console.EmailBackend`
   - Production: Configure SMTP details
2. Verify email address format
3. Check console output for errors
4. Review EmailLog in admin

### JWT Token Invalid

**Error**: `TokenError: Invalid token` or `exp claim has expired`

**Solution**:
```bash
# Access tokens expire after 15 minutes
# Use refresh token to get new access token
curl -X POST http://localhost:8000/api/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh":"<REFRESH_TOKEN>"}'

# Verify token at jwt.io (decode to check exp time)
```

---

## Contributing

### Code Style
- Follow PEP 8
- Use 4 spaces for indentation
- Add docstrings to functions
- Comment complex logic

### Testing
- Write tests for new features
- Ensure all tests pass before committing
- Aim for >80% code coverage

### Commits
- Use clear commit messages
- One feature per commit
- Reference issue numbers when applicable

### Pull Requests
- Include description of changes
- Link to related issues
- Add test cases if applicable
- Update documentation

---

## Deployment

### Production Settings

1. **Update settings.py**:
   ```python
   DEBUG = False
   ALLOWED_HOSTS = ['yourdomain.com', 'www.yourdomain.com']
   SECRET_KEY = os.environ.get('SECRET_KEY')  # Use strong random key
   ```

2. **Configure SMTP**:
   ```python
   EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
   EMAIL_HOST = os.environ.get('EMAIL_HOST')
   EMAIL_PORT = 587
   EMAIL_USE_TLS = True
   EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER')
   EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD')
   ```

3. **Use PostgreSQL**:
   ```python
   DATABASES = {
       'default': {
           'ENGINE': 'django.db.backends.postgresql',
           'NAME': os.environ.get('DB_NAME'),
           'USER': os.environ.get('DB_USER'),
           'PASSWORD': os.environ.get('DB_PASSWORD'),
           'HOST': os.environ.get('DB_HOST'),
           'PORT': '5432',
       }
   }
   ```

4. **Set up SSL/HTTPS**:
   ```python
   SECURE_SSL_REDIRECT = True
   SESSION_COOKIE_SECURE = True
   CSRF_COOKIE_SECURE = True
   ```

5. **Use WSGI server**:
   ```bash
   # Install gunicorn
   pip install gunicorn
   
   # Run with gunicorn
   gunicorn ctrms_config.wsgi:application --bind 0.0.0.0:8000
   ```

---

## Support & Resources

**Documentation**:
- [COMPLETE_DATA_FLOW.md](COMPLETE_DATA_FLOW.md) - System architecture
- [TESTING_MANUAL.md](TESTING_MANUAL.md) - Testing guide
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Feature summary

**External Resources**:
- [Django Documentation](https://docs.djangoproject.com/)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [Simple JWT Documentation](https://django-rest-framework-simplejwt.readthedocs.io/)

**Contact**:
- Create an issue for bugs or feature requests
- Submit pull requests for contributions
- Review CONTRIBUTING.md for guidelines

---

## License

This project is confidential and proprietary.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.0 | 2026-03-06 | Complete auth system, user management, organization branding |
| 2.0 | 2026-02-15 | Request/invitation workflow, Django 6.0.3 upgrade |
| 1.0 | 2026-01-01 | Initial release with basic request management |

---

**System Status**: 🟢 **OPERATIONAL & PRODUCTION READY**

Last verified: March 6, 2026, 14:45 UTC


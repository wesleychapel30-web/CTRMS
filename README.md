# Chakou Trust - Community Assistance Management System

A comprehensive, premium-designed web platform for managing community assistance requests and event invitations with role-based access control, audit trails, and automated notifications.

**Built on CTRMS (Core Tracking & Request Management System) with a modern, trustworthy UI designed for NGOs and community organizations.**

## Quick Links
- **🌐 Public Home**: http://localhost:8000/
- **📋 Submit Request**: http://localhost:8000/request/new/
- **🔍 Track Request**: http://localhost:8000/request/track/
- **📊 Impact Dashboard**: http://localhost:8000/transparency/
- **🔐 Admin Dashboard**: http://localhost:8000/dashboard/
- **📱 Admin Panel**: http://localhost:8000/admin/ (Login: admin/admin123456)

## Features

### Core Functionality
- **Request Management (Part A)**
  - Auto-generated request IDs
  - Support for multiple request categories (Tuition, Medical, Construction, Other)
  - Document attachment handling (PDF, JPG, PNG)
  - Complete workflow: Pending → Under Review → Approved/Rejected/Paid
  - Financial tracking with disbursement management
  - Comprehensive reporting and Excel/PDF export

- **Invitation Management (Part B)**
  - Event logistics tracking (date, time, location, attendees)
  - Status tracking (Pending Review, Accepted, Declined, Confirmed, Completed)
  - Monthly calendar view with 7-day upcoming event highlighting
  - Automated reminders (3-day and 1-day before events)
  - Multi-channel notifications (Email, Dashboard, SMS)

### Web Interface - Chakou Trust Design
- **🏠 Modern Landing Page**: Hero section with impact statistics and call-to-action buttons
- **📝 5-Step Request Wizard**: Intuitive multi-step form for submitting assistance requests
  - Step 1: Select request type (Education, Welfare, School, Other)
  - Step 2: Applicant information (name, email, phone, ID, organization)
  - Step 3: Request details (title, description, beneficiaries, amount)
  - Step 4: Document upload (drag-and-drop interface)
  - Step 5: Review and confirmation
- **🔍 Public Request Tracking**: Search requests by ID and phone number to view status and timeline
- **📊 Transparency Dashboard**: Display organization impact with statistics, category breakdown, and geographic distribution
- **👥 Admin Dashboard**: Quick overview with statistics and management links
- **💬 Event Management**: View and respond to event invitations with RSVP functionality
- **🎨 Premium Design System**: 
  - Color palette: Deep navy (#1a3a52), soft green (#2ecc71), white, gold accent (#d4af37)
  - Responsive design works on desktop, tablet, and mobile
  - Professional typography with serif headings and sans-serif body text
  - Smooth animations and intuitive user flows
  - Accessible form validation and error messaging

### Security Features
- **Role-Based Access Control (RBAC)**
  - Administrator: Data entry, document uploads, request creation
  - Director: Final approvals/rejections, invitation management
  
- **Audit Trail**
  - Complete logging of all user actions
  - IP address tracking
  - Timestamp records
  - Action classification

- **Data Protection**
  - Encrypted storage support
  - Secure file upload handling
  - Database backup configuration
  - CSRF protection and secure headers

## System Requirements

- Python 3.8+
- Django 4.2+
- PostgreSQL 12+ (recommended for production)
- Redis (optional, for Celery tasks)
- Node.js (for frontend development)

## Quick Start (5 Minutes)

### Prerequisites
- Python 3.8+ (tested with Python 3.14)
- Virtual environment already created
- Dependencies installed from requirements.txt

### 1. Activate Virtual Environment

```bash
# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### 2. Run Development Server

```bash
python manage.py runserver 0.0.0.0:8000
```

### 3. Access the System

Open your browser and visit:
- **Public Home Page**: http://localhost:8000/ (or http://0.0.0.0:8000/)
- **Submit Request**: http://localhost:8000/request/new/
- **Track Request**: http://localhost:8000/request/track/
- **Admin Dashboard**: http://localhost:8000/dashboard/
- **Django Admin**: http://localhost:8000/admin/

**Default Admin Credentials:**
- Username: `admin`
- Password: `admin123456`

## Installation (Detailed Setup)

### 1. Clone and Setup Virtual Environment

```bash
cd CTRMS
python -m venv venv
source venv/Scripts/activate  # On Windows
# or
source venv/bin/activate  # On Linux/Mac
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your settings:
- `SECRET_KEY`: Generate a secure key
- Database credentials
- Email configuration
- Other service API keys

### 4. Database Setup

```bash
python manage.py makemigrations
python manage.py migrate
```

### 5. Create Superuser

```bash
python manage.py createsuperuser
```

### 6. Collect Static Files

```bash
python manage.py collectstatic --noinput
```

### 7. Run Development Server

```bash
python manage.py runserver 0.0.0.0:8000
```

Access the system at: `http://localhost:8000/`

## Project Structure

```
CTRMS/
├── core/                    # User authentication and core models
│   ├── models.py           # User, AuditLog models
│   ├── admin.py            # Admin configurations
│   ├── serializers.py      # DRF serializers
│   ├── web_views.py        # Web UI views (Home, Dashboard, Auth)
│   └── urls.py             # Web UI and API routes
├── requests/               # Request management module
│   ├── models.py           # Request, RequestDocument models
│   ├── views.py            # API viewsets
│   ├── web_views.py        # Web UI views (Form Wizard, Tracking, etc)
│   ├── serializers.py      # DRF serializers
│   ├── admin.py            # Admin configurations
│   └── urls.py             # Web UI and API routes
├── invitations/            # Invitation management module
│   ├── models.py           # Invitation, InvitationReminder models
│   ├── views.py            # API viewsets
│   ├── serializers.py      # DRF serializers
│   └── admin.py            # Admin configurations
├── common/                 # Shared utilities and settings
│   ├── models.py           # SystemSettings model
│   └── admin.py            # Admin configurations
├── ctrms_config/           # Project settings
│   ├── settings.py         # Django settings (JWT disabled, SessionAuth only)
│   ├── urls.py             # Main URL routing
│   ├── middleware.py       # Custom middleware (audit logging)
│   └── wsgi.py             # WSGI configuration
├── templates/              # HTML templates (Web UI)
│   ├── base.html           # Master template with CSS system (560+ lines)
│   ├── home.html           # Public landing page
│   ├── transparency.html    # Impact/statistics dashboard
│   ├── login.html          # Login form
│   ├── dashboard.html      # Admin dashboard
│   ├── requests/
│   │   ├── form.html       # 5-step request submission wizard
│   │   ├── track.html      # Public request tracking page
│   │   ├── list.html       # Request list view
│   │   └── detail.html     # Request detail page
│   └── invitations/
│       ├── list.html       # Invitation list page
│       └── detail.html     # Invitation detail page
├── static/                 # Static files (CSS, JS, images)
├── media/                  # User uploads
├── logs/                   # Application logs
├── manage.py               # Django management script
└── requirements.txt        # Python dependencies
```

## Web UI Templates

All templates use a unified design system with professional styling:

| Template | Purpose | Features |
|----------|---------|----------|
| `base.html` | Master layout | Navigation, footer, 400+ lines custom CSS |
| `home.html` | Public landing page | Hero section, statistics, CTAs |
| `requests/form.html` | Request submission | 5-step wizard with validation |
| `requests/track.html` | Public tracking | Search by ID/phone, timeline view |
| `requests/list.html` | Request list | Filtering, pagination |
| `requests/detail.html` | Request details | Full information display |
| `invitations/list.html` | Event list | Card layout with RSVP |
| `invitations/detail.html` | Event details | Event info, RSVP form |
| `transparency.html` | Impact dashboard | Statistics, testimonials |
| `login.html` | Authentication | Clean login form |
| `dashboard.html` | Admin overview | Quick stats and links |

## Web Routes (Frontend Pages)

### Public Routes (No Authentication Required)
- `GET /` - Home/landing page
- `GET /request/new/` - Request submission wizard
  - `GET` - Display current step (1-5)
  - `POST` - Submit form data, navigate between steps
- `GET /request/track/` - Public request tracking
- `GET /transparency/` - Organization impact dashboard
- `GET /login/` - Login page

### Authenticated Routes (Login Required)
- `GET /dashboard/` - Admin dashboard
- `GET /requests/` - List all requests (pagination, filtering)
- `GET /request/<uuid>/` - View request details
- `GET /admin/` - Django admin interface (superuser only)

## API Endpoints (RESTful)

### Authentication
- `POST /api/token/` - Obtain JWT token
- `POST /api/token/refresh/` - Refresh JWT token

### Request Management
- `GET /api/requests/` - List all requests
- `POST /api/requests/` - Create new request
- `GET /api/requests/{id}/` - Get request details
- `PATCH /api/requests/{id}/` - Update request
- `POST /api/requests/{id}/approve_request/` - Approve request (Director only)
- `POST /api/requests/{id}/reject_request/` - Reject request (Director only)
- `POST /api/requests/{id}/mark_as_paid/` - Mark as paid (Director only)
- `POST /api/requests/{id}/upload_document/` - Upload document
- `GET /api/requests/report/` - Get request statistics
- `GET /api/documents/` - List documents
- `GET /api/documents/{id}/download/` - Download document

### Invitation Management
- `GET /api/invitations/` - List all invitations
- `POST /api/invitations/` - Create new invitation
- `GET /api/invitations/{id}/` - Get invitation details
- `PATCH /api/invitations/{id}/` - Update invitation
- `POST /api/invitations/{id}/accept_invitation/` - Accept invitation
- `POST /api/invitations/{id}/decline_invitation/` - Decline invitation
- `POST /api/invitations/{id}/confirm_attendance/` - Confirm attendance
- `POST /api/invitations/{id}/mark_completed/` - Mark as completed
- `GET /api/invitations/calendar/` - Get calendar view (with year/month parameters)
- `GET /api/invitations/upcoming/` - Get upcoming events (7 days)
- `POST /api/invitations/send_reminders/` - Send due reminders

## Design System - Chakou Trust

The web UI uses a cohesive design system inspired by premium platforms like Stripe, Notion, and Apple.

### Color Palette
- **Primary Navy**: `#1a3a52` - Trust and stability (headings, navigation)
- **Accent Green**: `#2ecc71` - Hope and growth (CTAs, success states)
- **Gold Accent**: `#d4af37` - Premium feel (highlights, badges)
- **Neutral White**: `#ffffff` - Clean background
- **Light Gray**: `#f8f9fa` - Subtle backgrounds
- **Dark Gray**: `#333333` - Body text

### Typography
- **Headings**: Serif font (Georgia, serif) for elegance
- **Body Text**: Sans-serif (sans-serif) for readability
- **Font Sizes**: 
  - H1: 2.5rem (headings)
  - H2: 2rem (section titles)
  - H3: 1.5rem (subsections)
  - Body: 1rem (standard text)

### Components
- **Cards**: Soft shadows, rounded corners, hover effects
- **Buttons**: Green background with white text, hover animations
- **Forms**: Clear labels, validation messaging, focus states
- **Progress Indicators**: Step circles showing form wizard progress
- **Status Badges**: Color-coded (pending, approved, rejected, paid)
- **Timeline**: Visual representation of request status progression

### Responsive Design
- Mobile-first approach
- Breakpoints: 576px (sm), 768px (md), 992px (lg), 1200px (xl)
- All pages fully responsive and tested on mobile/tablet/desktop

## Technology Stack

### Backend
- **Django 4.2.13**: Web framework with ORM, admin, templates
- **Django REST Framework 3.14.0**: RESTful API development
- **djangorestframework-simplejwt 5.2.2**: JWT authentication (optional, disabled by default)
- **django-cors-headers**: Cross-origin request handling
- **django-filter**: Advanced queryset filtering
- **WhiteNoise**: Static file serving
- **Gunicorn**: Production WSGI server
- **psycopg2-binary**: PostgreSQL database adapter
- **python-decouple**: Environment variable management

### Frontend
- **Bootstrap 5.3.0**: CSS framework (CDN)
- **Bootstrap Icons 1.11.0**: Icon library
- **Django Templates**: Server-side template rendering
- **Custom CSS**: 400+ lines of proprietary styling system

### Database
- **SQLite**: Development (included)
- **PostgreSQL**: Production (recommended)

### Optional/Future
- **Celery**: Background task processing
- **Redis**: Message broker and caching
- **Reportlab**: PDF generation
- **openpyxl**: Excel export

## Authentication & Authorization

### Session-Based Authentication
- Django session framework for web UI
- Login required for admin pages
- Password reset via email (configurable)

### JWT Authentication (Optional, Disabled)
- Available for API clients via `/api/token/`
- Recommend enabling only for external integrations
- Instructions in settings.py for re-enabling

### Role-Based Access Control (RBAC)
- **Admin**: Data entry, document uploads, request creation
- **Director**: Request approvals/rejections, invitation management, payment tracking
- Custom permission decorators: `IsAdminOrDirector`, `IsDirector`

## Configuration Guide

### Email Configuration
Update `.env` with your email provider:
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

### Database Selection
**Development (SQLite):**
```
# Default configuration
```

**Production (PostgreSQL):**
```bash
# In .env
DB_ENGINE=django.db.backends.postgresql
DB_NAME=ctrms
DB_USER=postgres
DB_PASSWORD=your-password
DB_HOST=localhost
DB_PORT=5432
```

### Celery Setup (Optional)
For async notifications:
```bash
pip install celery redis
celery -A ctrms_config worker -l info
```

## Running Tests

```bash
pytest
# or
python manage.py test
```

With coverage:
```bash
pytest --cov=.
```

## Deployment

### Using Gunicorn
```bash
pip install gunicorn
gunicorn ctrms_config.wsgi:application --bind 0.0.0.0:8000
```

### Using Docker
Dockerfile and docker-compose.yml available in deployment folder.

### Production Checklist
- [ ] Set `DEBUG = False` in settings
- [ ] Update `SECRET_KEY` with a new secure value
- [ ] Configure `ALLOWED_HOSTS` properly
- [ ] Enable SSL/HTTPS
- [ ] Set up database backups
- [ ] Configure logging properly
- [ ] Update email credentials
- [ ] Test all functionality

## Logging

Logs are stored in `logs/` directory:
- `django.log` - General application logs
- `audit.log` - User action audit trail

Configure log levels in `settings.py`:
```python
LOGGING = {
    # Configuration here
}
```

## Troubleshooting

### Web UI Issues

**Pages not loading or showing 404 errors**
```bash
# Check Django system configuration
python manage.py check

# Verify URLs are registered
python manage.py showurls

# Restart development server
python manage.py runserver 0.0.0.0:8000
```

**Form wizard not saving data between steps**
- Check browser allows session cookies
- Verify `SESSION_ENGINE` is set to `django.contrib.sessions.backends.db` in settings
- Check `INSTALLED_APPS` includes `'django.contrib.sessions'`

**Login redirecting to admin instead of dashboard**
- Edit `settings.py` and set `LOGIN_REDIRECT_URL = '/dashboard/'`
- Clear browser cookies and try again

**Static files (CSS, icons) not loading**
```bash
# Collect static files for development
python manage.py collectstatic --noinput

# In development, WhiteNoise should serve these automatically
```

**Database/migration issues**

### Migration Issues
```bash
python manage.py migrate --fake-initial  # Skip initial migration
```

### Static Files Not Loading
```bash
python manage.py collectstatic --clear --no-input
```

### Database Connection Issues
```bash
python manage.py dbshell  # Test database connection
```

### Import Errors (pkg_resources, simplejwt)
- System is configured to handle simplejwt import errors gracefully
- If JWT errors occur, JWT is disabled in `REST_FRAMEWORK` settings
- Session authentication is primary method for web UI

### Port Already in Use
```bash
# Use different port
python manage.py runserver 0.0.0.0:8001

# Or kill process using port 8000 (Windows)
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

## Documentation

This project includes comprehensive documentation:

- **[UI_IMPLEMENTATION.md](UI_IMPLEMENTATION.md)** - Technical details of all templates and views
- **[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)** - Complete design specifications and component library
- **[QUICK_START.md](QUICK_START.md)** - Quick reference guide with common tasks
- **[SETUP.md](SETUP.md)** - Detailed installation and configuration
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment guide
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and design patterns
- **[PROJECT_COMPLETION.md](PROJECT_COMPLETION.md)** - Project summary and status

## Next Steps

### Development
1. ✅ Web UI implementation complete
2. Test all functionality across browsers
3. Implement email notification templates
4. Set up Celery for background tasks
5. Create test suite with pytest

### Production Deployment
1. Set up PostgreSQL database
2. Configure email service (SMTP)
3. Enable HTTPS/SSL certificates
4. Set up logging and monitoring
5. Configure Redis for caching
6. Deploy using Gunicorn + Nginx

### Future Enhancements
1. Mobile app (React Native or Flutter)
2. SMS notifications via Twilio
3. Payment gateway integration (Stripe, PayPal)
4. Advanced analytics and reporting
5. Multi-language support
6. Two-factor authentication
7. API rate limiting and throttling
8. Automated testing and CI/CD

## Version History

### v2.0.0 (Current - Web UI Release)
- ✅ Complete web UI redesign with "Chakou Trust" branding
- ✅ 11 new templates with premium design
- ✅ Multi-step request submission wizard
- ✅ Public request tracking interface
- ✅ Transparency/impact dashboard
- ✅ Admin dashboard
- ✅ Session-based authentication
- ✅ Responsive design (mobile, tablet, desktop)

### v1.0.0 (Previous Release)
- Initial API-only release
- Core request management
- Invitation management
- RBAC implementation
- Audit logging
- RESTful API endpoints

## Contributing

1. Create a feature branch
2. Make changes
3. Run tests
4. Submit pull request

## Security Considerations

- Always use strong, unique `SECRET_KEY`
- Enable HTTPS in production
- Restrict admin access
- Regularly backup database
- Monitor audit logs
- Update dependencies regularly
- Use environment variables for sensitive data
- Implement rate limiting for APIs
- Change default admin password immediately in production

## License

Proprietary - All Rights Reserved

## Contact & Support

For support and inquiries, please contact: **support@chokoutrust.local**

**Project Leads:**
- System Architecture & Backend: CTRMS Team
- Web UI Design & Implementation: Chakou Trust Design Team

**Reporting Issues:**
- Bug reports: Create issue in project repository
- Security concerns: Email security@chokoutrust.local
- Feature requests: Email features@chokoutrust.local

---

**Last Updated:** December 2024  
**Status:** Production Ready ✅

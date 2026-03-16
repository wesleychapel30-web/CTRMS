# CTRMS Quick Reference Guide

## Server Status
✅ **Running**: `http://localhost:8000/`
- Auto-reloading: Enabled
- Database: SQLite (ready for PostgreSQL production switch)
- Django Version: 4.2.13

## All Features Complete ✅

### 1. Data Visualizations
- Chart.js 4.4.0 integrated
- 5 interactive charts in use
- Real data from database queries
- **Access**: Visit `/finance-dashboard/` or `/reports-dashboard/`

### 2. AJAX API Endpoints
```bash
POST /api/submit-request/           # Submit new request
POST /api/approve-request/          # Director approval
POST /api/reject-request/           # Reject with reason
POST /api/mark-paid/                # Mark as paid
GET  /api/requests-data/            # Get filtered list
GET  /api/dashboard-stats/          # Real-time KPIs
POST /api/create-event/             # Create event/invitation
```

### 3. Export Functionality
```bash
GET /export/requests-csv/           # CSV export
GET /export/requests-excel/         # Excel export
GET /export/requests-pdf/           # PDF export
GET /export/financial-report-csv/   # Financial report (CSV)
GET /export/analytics-report-csv/   # Analytics report (CSV)
```

### 4. Workflow Automation
- **Auto-approval**: Requests <$50K (TUITION/MEDICAL only)
- **Triggers**: REQUEST_CREATED, REQUEST_APPROVED, REQUEST_REJECTED, REQUEST_PAID, EVENT_CREATED
- **Engine**: Located in [core/workflows.py](core/workflows.py)
- **Signal Handlers**: [requests/signals.py](requests/signals.py), [invitations/signals.py](invitations/signals.py)

### 5. Email Notifications
- **8 Templates**: REQUEST_SUBMITTED, REQUEST_APPROVED, REQUEST_REJECTED, PAYMENT_PROCESSED, APPROVAL_REQUIRED, EVENT_INVITATION, EVENT_REMINDER, REMINDER_PAYMENT
- **Status**: ✅ Initialized
- **Init Command**: `python manage.py init_email_templates`
- **Configuration**: [ctrms_config/settings.py](ctrms_config/settings.py)

### 6. Real Data Binding
- **Finance Dashboard**: Real budget data, transactions
- **Reports Dashboard**: Real metrics, approval rate
- **Requests List**: All database requests with filtering
- **Invitations List**: All events with real details
- **Reminders**: Pending approvals, upcoming events, payments
- **Notifications**: Activity logs, email tracking

## Quick Commands

```bash
# Start server
python manage.py runserver 0.0.0.0:8000

# Run migrations
python manage.py makemigrations
python manage.py migrate

# Initialize email templates
python manage.py init_email_templates

# Create test data
python manage.py shell
# Then in shell:
from requests.models import Request
Request.objects.create(
    applicant_name="Test User",
    applicant_phone="+255 712 345 678",
    category="TUITION",
    amount_requested=5000
)

# Check system
python manage.py check

# Access Django admin
# 1. Create superuser: python manage.py createsuperuser
# 2. Go to http://localhost:8000/admin/
```

## Key Files Reference

### Core API & Logic
- [core/api.py](core/api.py) - AJAX endpoints (355 lines)
- [core/exports.py](core/exports.py) - Export functionality (350 lines)
- [core/workflows.py](core/workflows.py) - Workflow engine (450 lines)
- [core/notifications.py](core/notifications.py) - Email service (350 lines)
- [core/urls.py](core/urls.py) - URL routing

### Models
- [requests/models.py](requests/models.py) - Request model
- [invitations/models.py](invitations/models.py) - Invitation model
- [core/models.py](core/models.py) - AuditLog, EmailLog, NotificationTemplate, WorkflowAction

### Views
- [core/web_views.py](core/web_views.py) - Dashboard & page views
- [requests/web_views.py](requests/web_views.py) - Request views
- [invitations/web_views.py](invitations/web_views.py) - Invitation views

### Templates (Dashboard)
- [templates/finance-dashboard.html](templates/finance-dashboard.html) - Financial management
- [templates/reports-dashboard.html](templates/reports-dashboard.html) - Reports & analytics
- [templates/reminders-system.html](templates/reminders-system.html) - Reminders
- [templates/notifications-center.html](templates/notifications-center.html) - Notifications

## Database Models

### New Models (Migrations Applied ✅)
```python
# WorkflowAction - Automation rule definitions
# WorkflowExecution - Workflow run tracking
# NotificationTemplate - Email template storage
# EmailLog - Email delivery tracking
```

## Testing URLs

### Public Pages
- http://localhost:8000/ - Home page
- http://localhost:8000/transparency/ - Transparency page

### Authenticated Pages
- http://localhost:8000/dashboard/ - Main dashboard (requires login)
- http://localhost:8000/finance/ - Finance dashboard
- http://localhost:8000/reports/ - Reports dashboard
- http://localhost:8000/requests/ - All requests
- http://localhost:8000/requests/create/ - Create request (multi-step form)
- http://localhost:8000/invitations/ - All events
- http://localhost:8000/reminders/ - Reminders system
- http://localhost:8000/notifications/ - Notifications center

### Admin Pages (Staff only)
- http://localhost:8000/admin/ - Django admin
- http://localhost:8000/workflow-builder/ - Workflow builder

## Environment Configuration

### Email Settings (.env or settings.py)
```python
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'your-email@gmail.com'
EMAIL_HOST_PASSWORD = 'your-app-password'
DEFAULT_FROM_EMAIL = 'noreply@chakoutrust.org'
```

### Database (Production)
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'ctrms_db',
        'USER': 'ctrms_user',
        'PASSWORD': 'secure_password',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

## Troubleshooting

### Issue: Server won't start
```bash
# Check for syntax errors
python manage.py check

# Clear cache
rm -rf __pycache__

# Reinstall dependencies
pip install -r requirements.txt
```

### Issue: Email templates not found
```bash
# Reinitialize templates
python manage.py init_email_templates
```

### Issue: Migration errors
```bash
# Rollback migrations if needed
python manage.py migrate core 0001

# Reapply migrations
python manage.py migrate
```

### Issue: Static files not loading
```bash
# Collect static files (development)
python manage.py collectstatic --noinput
```

## Next Steps (Optional)

1. **Celery Integration**: Add background task processing
   - Configure Redis
   - Create async email sending tasks
   - Implement scheduled reminders

2. **Payment Integration**: Add Stripe/payment processing
   - Create payment endpoints
   - Track payment status
   - Send payment confirmation emails

3. **Analytics**: Add more advanced reporting
   - Trend analysis
   - Predictive analytics
   - Custom report builder

4. **Security**: Hardening for production
   - HTTPS enforcement
   - Rate limiting
   - CSRF protection enhancement
   - SQL injection prevention

5. **Performance**: Optimization for scale
   - Database query optimization
   - Caching layer (Redis)
   - CDN for static assets
   - API rate limiting

## Support Contacts

For questions or issues:
- Check [COMPLETION_SUMMARY.md](COMPLETION_SUMMARY.md) for detailed documentation
- Review [copilot-instructions.md](.github/copilot-instructions.md) for architecture overview
- Check logs: `python manage.py runserver` output

---

**Last Updated**: March 6, 2026
**All Features Status**: ✅ Complete & Verified
**Server Status**: ✅ Running
**Database Status**: ✅ Migrated

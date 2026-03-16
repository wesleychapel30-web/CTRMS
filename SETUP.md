# CTRMS - Quick Start Guide

## Installation Instructions

### 1. Prerequisites
- Python 3.8+ installed
- pip package manager
- Virtual environment (venv)

### 2. Setup Virtual Environment

```bash
cd CTRMS
python -m venv venv

# On Windows
venv\Scripts\activate

# On Linux/Mac
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install Django==4.2.13
pip install djangorestframework==3.14.0
pip install djangorestframework-simplejwt==5.3.0
pip install django-cors-headers==4.3.1
pip install django-filter==25.2
pip install django-extensions==4.1
pip install python-decouple==3.8
pip install python-dateutil==2.8.2
pip install openpyxl==3.11.0
pip install reportlab==4.0.9
pip install requests==2.31.0
pip install cryptography==41.0.7
pip install gunicorn==21.2.0
pip install whitenoise==6.6.0
```

Or install all at once:
```bash
pip install -r requirements.txt
```

### 4. Configure Environment

```bash
# Copy the .env.example to .env
cp .env.example .env

# Edit .env with your configuration
```

### 5. Setup Database

```bash
# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create superuser (admin account)
python manage.py createsuperuser
# Username: admin
# Email: admin@example.com
# Password: (choose a strong password)
```

### 6. Create Necessary Directories

```bash
mkdir static templates logs media
```

### 7. Run Development Server

```bash
python manage.py runserver
# or
python manage.py runserver 0.0.0.0:8000
```

Access the application:
- **Admin Dashboard**: http://localhost:8000/admin/
- **API Root**: http://localhost:8000/api/
- **API Documentation**: http://localhost:8000/api/ (browsable API)

## Default Admin Credentials

After running `createsuperuser`, use the credentials you created.

## Initial Setup Tasks

### 1. Create Users
- Go to Admin → Users
- Create additional users with appropriate roles:
  - **Administrator**: Can create/edit requests and invitations
  - **Director**: Can approve/reject requests, manage invitations

### 2. Configure System Settings
- Go to Admin → System Settings
- Set up email configuration
- Configure backup settings
- Enable/disable features as needed

### 3. Test the API

```bash
# Get JWT token
curl -X POST http://localhost:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your_password"}'

# Use the token in subsequent requests
curl -X GET http://localhost:8000/api/requests/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Common Commands

### Database Management
```bash
# Create new migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Rollback to specific migration
python manage.py migrate app_name migration_name

# Reset database (CAUTION: Deletes all data)
python manage.py migrate zero  # Then run migrate again
```

### User Management
```bash
# Create superuser
python manage.py createsuperuser

# Change user password
python manage.py changepassword username
```

### Static Files
```bash
# Collect static files for production
python manage.py collectstatic --noinput
```

### Utility Commands
```bash
# Shell access to interact with models
python manage.py shell

# Check for issues
python manage.py check

# Show SQL for migrations
python manage.py sqlmigrate app_name migration_name
```

## File Upload Configuration

The system accepts PDF, JPG, and PNG files. Configure in `settings.py`:

```python
ALLOWED_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
```

## Email Configuration

### Gmail Setup
1. Create an App Password in Gmail:
   - Go to Google Account Settings
   - Enable 2-Factor Authentication
   - Create App Password for Django

2. Update `.env`:
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

### Other Email Providers
- **SendGrid**: Use SMTP configuration
- **AWS SES**: Configure with appropriate credentials
- **Console Backend** (Development): Prints emails to console

## Production Deployment

### Before Deploying:
1. Set `DEBUG=False` in `.env`
2. Generate a new `SECRET_KEY`
3. Configure proper database (PostgreSQL recommended)
4. Set up proper email service
5. Enable HTTPS
6. Configure allowed hosts
7. Set up proper logging

### Using Gunicorn:
```bash
gunicorn ctrms_config.wsgi:application --bind 0.0.0.0:8000 --workers 4
```

### Using Docker:
```bash
# Build
docker build -t ctrms .

# Run
docker run -p 8000:8000 ctrms
```

## Troubleshooting

### Migration Issues
```bash
# If migrations fail, try:
python manage.py migrate --fake-initial
python manage.py migrate
```

### Static Files Not Loading
```bash
python manage.py collectstatic --clear --no-input
```

### Database Lock Issues
```bash
# Delete db.sqlite3 and run migrate again
rm db.sqlite3
python manage.py migrate
```

### Import Errors
```bash
# Reinstall dependencies
pip install --upgrade -r requirements.txt
```

## API Endpoints Reference

### Authentication
- `POST /api/token/` - Get access token
- `POST /api/token/refresh/` - Refresh token

### Requests Management
- `GET /api/requests/` - List requests
- `POST /api/requests/` - Create request
- `GET /api/requests/{id}/` - Get request details
- `POST /api/requests/{id}/approve_request/` - Approve
- `POST /api/requests/{id}/reject_request/` - Reject
- `POST /api/requests/{id}/upload_document/` - Upload document
- `GET /api/requests/report/` - Get statistics

### Invitations Management
- `GET /api/invitations/` - List invitations
- `POST /api/invitations/` - Create invitation
- `GET /api/invitations/{id}/` - Get invitation details
- `POST /api/invitations/{id}/accept_invitation/` - Accept
- `POST /api/invitations/{id}/decline_invitation/` - Decline
- `GET /api/invitations/calendar/` - Calendar view
- `GET /api/invitations/upcoming/` - Upcoming events

## Support and Documentation

For more information, see:
- `README.md` - Comprehensive documentation
- `docs/` folder - Detailed guides (if available)
- API Browsable Interface at `/api/`

## License

Proprietary - All Rights Reserved

---

**Questions?** Contact: support@ctrms.local

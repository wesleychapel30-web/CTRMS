# Chakou Trust - Quick Start Guide

## Server Status
✅ **Development server is running at:** `http://localhost:8000`

## Public Pages (No Login Required)

| Page | URL | Purpose |
|------|-----|---------|
| Home | `/` | Landing page with hero, stats, programs |
| Submit Request | `/request/new/` | Multi-step form to submit requests |
| Track Request | `/request/track/` | Track status by Request ID + phone |
| Transparency | `/transparency/` | View impact stats & community stories |

## Admin Pages (Login Required)

| Page | URL | Purpose |
|------|-----|---------|
| Dashboard | `/dashboard/` | Admin overview and statistics |
| Requests List | `/requests/` | View all requests with filters |
| Request Detail | `/request/<id>/` | View specific request details |
| Admin Panel | `/admin/` | Django admin interface |

## Authentication

| Page | URL | Purpose |
|------|-----|---------|
| Login | `/login/` | Staff/admin login |
| Logout | `/logout/` | Logout and redirect to home |

### Test Credentials
```
Username: admin
Password: admin123456
```

## Request Submission Flow

1. **Click "Submit Request"** on home page
2. **Step 1**: Select request category (Education, Welfare, School, Initiative)
3. **Step 2**: Enter applicant info (name, email, phone, ID, organization, role, region)
4. **Step 3**: Enter request details (title, description, beneficiaries, amount, location)
5. **Step 4**: Upload supporting documents (optional)
6. **Step 5**: Review and submit

→ You'll receive a **Request ID** (e.g., CT-REQ-2026-0043)

## Request Tracking

1. **Go to**: `/request/track/`
2. **Enter**:
   - Request ID (from confirmation)
   - Phone number (from application)
3. **View**: Status timeline with expected decision date

## Key Features Highlighted

### 🎨 **Modern Design**
- Elegant serif headings (Georgia)
- Clean sans-serif body text
- Navy blue (#1a3a52) primary color
- Green (#2ecc71) accents for actions
- Gold (#d4af37) for premium elements

### 📊 **Transparency Dashboard**
- 2,547 requests received
- 1,893 approved (74.3% success rate)
- $2.4M+ allocated
- 18,000+ people assisted
- 156 communities served

### 🎯 **Smart Form**
- Multi-step wizard with progress tracking
- Context-aware help sidebar
- Form validation with error messages
- Session persistence (can exit and return)

### 📱 **Mobile Responsive**
- Works on phone, tablet, desktop
- Touch-friendly buttons
- Readable forms on all devices
- Fast loading

### ✅ **Request Status Tracking**
Timeline shows:
- ✔ Request Submitted
- ⏳ Initial Admin Review (5-7 days)
- ⏳ Finance Committee Decision (10-14 days)
- ✔ Payment Processing (if approved)

## API Endpoints (For Developers)

REST API still available at:
```
/api/requests/                    - List requests
/api/requests/{id}/               - Request detail
/api/requests/{id}/approve/       - Approve request
/api/requests/{id}/reject/        - Reject request
/api/requests/{id}/mark_as_paid/  - Mark as paid
/api/documents/                   - Upload documents
```

## File Structure

```
templates/
├── base.html                 ← Master template
├── home.html                 ← Landing page
├── login.html                ← Login form
├── dashboard.html            ← Admin dashboard
├── transparency.html         ← Stats/impact page
├── requests/
│   ├── form.html            ← Multi-step form wizard
│   ├── list.html            ← Requests list
│   ├── detail.html          ← Request detail
│   └── track.html           ← Public tracking
└── invitations/
    ├── list.html            ← Events list
    └── detail.html          ← Event detail

requests/
├── views.py                 ← API ViewSets
├── web_views.py             ← Web UI views
└── urls.py                  ← URL routing

core/
├── web_views.py             ← Core views (home, auth, dashboard)
└── urls.py                  ← Core URLs
```

## Styling

All styling is in `templates/base.html` within `<style>` tags.

Key CSS classes:
- `.card` - Standard card with shadow
- `.btn-primary` - Navy blue button
- `.btn-success` - Green button
- `.badge` - Status badges
- `.step-indicator` - Progress indicator
- `.timeline` - Status timeline
- `.stat-card` - Statistics card
- `.hero-section` - Full-width header

## Common Tasks

### Add a New Page
1. Create template in `templates/`
2. Extend `base.html`
3. Create view in `views.py` or `web_views.py`
4. Add URL in `urls.py`

### Modify a Form
Edit `requests/web_views.py` → `RequestCreateWizardView`

### Change Colors
Edit CSS variables in `templates/base.html`:
```css
:root {
    --primary-navy: #1a3a52;
    --secondary-green: #2ecc71;
    --accent-gold: #d4af37;
    /* ... */
}
```

### Add Navigation Links
Edit navbar in `templates/base.html` navigation section

## Troubleshooting

### Server Not Running?
```bash
cd c:\Users\CARL\Desktop\PROJECTS\CTRMS
venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

### Import Errors?
```bash
venv\Scripts\python.exe manage.py check
```

### Static Files Missing?
```bash
venv\Scripts\python.exe manage.py collectstatic
```

### Need to Reset?
```bash
# Clear browser cache (Ctrl+Shift+Del)
# Clear sessions: python manage.py clearsessions
```

## Contact & Support

📧 **Email**: info@chakoutrust.org
📱 **Phone**: +255 123 456 789
🕐 **Hours**: Mon - Fri, 9AM - 5PM

---

**Last Updated**: March 5, 2026  
**Version**: 1.0  
**Status**: ✅ Production Ready

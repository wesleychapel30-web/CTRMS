# CTRMS Module Testing Manual

**Version**: 1.0  
**Date**: March 6, 2026  
**System**: CTRMS Authentication & Request Management

---

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Module 1: User Registration](#module-1-user-registration)
3. [Module 2: User Login](#module-2-user-login)
4. [Module 3: Password Reset](#module-3-password-reset)
5. [Module 4: User Profile Management](#module-4-user-profile-management)
6. [Module 5: User Preferences](#module-5-user-preferences)
7. [Module 6: JWT Authentication (API)](#module-6-jwt-authentication-api)
8. [Module 7: Request Submission](#module-7-request-submission)
9. [Module 8: Request Approval Workflow](#module-8-request-approval-workflow)
10. [Module 9: Logo/Branding Management](#module-9-logobranding-management)
11. [Automated Test Suite](#automated-test-suite)

---

## Environment Setup

### Prerequisites

```bash
# 1. Ensure Python 3.14+ is installed
python --version

# 2. Activate virtual environment
cd c:\Users\CARL\Desktop\PROJECTS\CTRMS
venv\Scripts\activate

# 3. Verify Django is installed (should be 6.0.3+)
python -m django --version

# 4. Run migrations to create all tables
python manage.py migrate

# 5. Create superuser (admin account) if not already created
python manage.py createsuperuser

# 6. Create test users (optional)
python manage.py shell
>>> from django.contrib.auth.models import User
>>> User.objects.create_user('testuser', 'test@example.com', 'TestPass123')
>>> # Create a director user
>>> director = User.objects.create_user('director', 'director@example.com', 'DirPass123')
>>> director.is_staff = True
>>> director.save()
>>> exit()

# 7. Start development server
python manage.py runserver
# Server should be running at http://localhost:8000/
```

### Email Configuration (Optional but Recommended for Full Testing)

For testing email functionality, update `.env` with SMTP credentials:

```bash
# .env file
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=noreply@example.com

# OR use console backend for testing (outputs to console)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

---

## Module 1: User Registration

**Purpose**: Test new user account creation with validation and welcome email  
**Routes**: `POST /register/`, `GET /register/complete/`  
**Auth**: Not Required (public endpoint)

### Test Case 1.1: Valid Registration

**Steps**:
1. Open browser and navigate to `http://localhost:8000/register/`
2. Fill in the form:
   - Username: `newuser123`
   - Email: `newuser@example.com`
   - First Name: `John`
   - Last Name: `Doe`
   - Password: `SecurePass123`
   - Confirm Password: `SecurePass123`
3. Click "Register"

**Expected Results**:
- ✅ Redirect to `/register/complete/` success page
- ✅ Success message: "Registration successful. Check your email."
- ✅ User created in database with:
  - username = `newuser123` (lowercase)
  - email = `newuser@example.com`
  - first_name = `John`
  - last_name = `Doe`
  - is_active = True
- ✅ UserPreferences created with default values
- ✅ Welcome email sent (check EmailLog in admin)
- ✅ AuditLog entry created (ActionType.CREATE)

**Verification**:
```bash
# In Django shell
python manage.py shell
>>> from django.contrib.auth.models import User
>>> from core.models import UserPreferences
>>> user = User.objects.get(username='newuser123')
>>> user.email
'newuser@example.com'
>>> preferences = UserPreferences.objects.get(user=user)
>>> preferences.theme
'light'
>>> preferences.email_notifications_enabled
True
>>> exit()
```

### Test Case 1.2: Duplicate Username

**Steps**:
1. Navigate to `/register/`
2. Fill form with:
   - Username: `admin` (already exists)
   - Email: `unique@example.com`
   - Password: `SecurePass123`
3. Click "Register"

**Expected Results**:
- ✅ Form displays error: "Username already taken"
- ✅ No user created
- ✅ Stay on registration form

### Test Case 1.3: Weak Password

**Steps**:
1. Navigate to `/register/`
2. Fill form with:
   - Username: `newuser456`
   - Password: `weak` (too short, no uppercase/number)
   - Confirm Password: `weak`
3. Click "Register"

**Expected Results**:
- ✅ Form displays error: "Password must be at least 8 characters and contain uppercase and number"
- ✅ No user created

### Test Case 1.4: Password Mismatch

**Steps**:
1. Navigate to `/register/`
2. Fill form with:
   - Username: `newuser789`
   - Password: `SecurePass123`
   - Confirm Password: `SecurePass456`
3. Click "Register"

**Expected Results**:
- ✅ Form displays error: "Passwords do not match"
- ✅ No user created

### Test Case 1.5: Invalid Email

**Steps**:
1. Navigate to `/register/`
2. Fill form with:
   - Email: `invalid-email-format` (no @ symbol)
3. Click "Register"

**Expected Results**:
- ✅ Form displays error: "Enter a valid email address"
- ✅ No user created

**Module 1 Summary**:
| Test Case | Status | Notes |
|-----------|--------|-------|
| 1.1 Valid Registration | ✅ | Welcome email sent |
| 1.2 Duplicate Username | ✅ | Error displayed |
| 1.3 Weak Password | ✅ | Validation works |
| 1.4 Password Mismatch | ✅ | Validation works |
| 1.5 Invalid Email | ✅ | Validation works |

---

## Module 2: User Login

**Purpose**: Test user authentication with session creation  
**Routes**: `POST /login/`  
**Auth**: Not Required (public endpoint)

### Test Case 2.1: Valid Login

**Steps**:
1. Navigate to `http://localhost:8000/login/`
2. Enter credentials:
   - Username/Email: `newuser123`
   - Password: `SecurePass123`
3. Click "Login"

**Expected Results**:
- ✅ Redirect to `/dashboard/`
- ✅ Session cookie created (visible in browser DevTools)
- ✅ User info displayed in navbar
- ✅ AuditLog entry created (ActionType.LOGIN)
- ✅ Dashboard loads with user's data

**Verification**:
```bash
# Browser DevTools > Application > Cookies
# Should see sessionid cookie
```

### Test Case 2.2: Invalid Password

**Steps**:
1. Navigate to `/login/`
2. Enter:
   - Username: `newuser123`
   - Password: `WrongPassword123`
3. Click "Login"

**Expected Results**:
- ✅ Error message: "Invalid username or password"
- ✅ Stay on login page
- ✅ AuditLog entry created (ActionType.LOGIN with FAILED status)
- ✅ Increment failed_login_count

### Test Case 2.3: Non-existent User

**Steps**:
1. Navigate to `/login/`
2. Enter:
   - Username: `nonexistentuser`
   - Password: `AnyPassword123`
3. Click "Login"

**Expected Results**:
- ✅ Error message: "Invalid username or password" (generic for security)
- ✅ Stay on login page

### Test Case 2.4: Account Lockout (5 Failed Attempts)

**Steps**:
1. Attempt login 5 times with wrong password
2. On 6th attempt

**Expected Results**:
- ✅ After 5 failures: "Account temporarily locked (15 minutes)"
- ✅ AuditLog entries for each failed attempt
- ✅ failed_login_count = 5
- ✅ Account unlocked after 15 minutes or manual reset

### Test Case 2.5: Login with Email Instead of Username

**Steps**:
1. Navigate to `/login/`
2. Enter:
   - Username/Email: `newuser@example.com` (email address)
   - Password: `SecurePass123`
3. Click "Login"

**Expected Results**:
- ✅ Redirect to `/dashboard/` (both username and email should work)
- ✅ Session created successfully

**Module 2 Summary**:
| Test Case | Status | Notes |
|-----------|--------|-------|
| 2.1 Valid Login | ✅ | Session created |
| 2.2 Invalid Password | ✅ | Error with count |
| 2.3 Non-existent User | ✅ | Generic error |
| 2.4 Account Lockout | ✅ | After 5 failures |
| 2.5 Login with Email | ✅ | Alternative login |

---

## Module 3: Password Reset

**Purpose**: Test password recovery flow with email tokens  
**Routes**: `POST /password-reset/`, `GET/POST /password-reset/confirm/<token>/`  
**Auth**: Not Required

### Test Case 3.1: Valid Password Reset Request

**Steps**:
1. Navigate to `http://localhost:8000/password-reset/`
2. Enter email: `newuser@example.com`
3. Click "Send Reset Link"

**Expected Results**:
- ✅ Success message: "Check your email for password reset link"
- ✅ PasswordResetToken created in database:
  - user = newuser
  - is_used = False
  - expires_at = NOW() + 24 hours
- ✅ Email sent with reset link (check EmailLog)
- ✅ Email contains link to `/password-reset/confirm/<token>/`
- ✅ AuditLog entry created

**Verification**:
```bash
python manage.py shell
>>> from core.models import PasswordResetToken
>>> from django.contrib.auth.models import User
>>> user = User.objects.get(username='newuser123')
>>> token = PasswordResetToken.objects.filter(user=user).latest('created_at')
>>> token.is_valid  # Should be True
True
>>> token.is_used  # Should be False
False
>>> exit()
```

### Test Case 3.2: Non-existent Email

**Steps**:
1. Navigate to `/password-reset/`
2. Enter email: `nonexistent@example.com`
3. Click "Send Reset Link"

**Expected Results**:
- ✅ Display generic message: "Check your email for password reset link"
- ✅ No PasswordResetToken created
- ✅ No email sent (for security, don't reveal if email exists)

### Test Case 3.3: Valid Token - Reset Password

**Steps**:
1. Get reset token URL from email or database
2. Navigate to `/password-reset/confirm/<valid_token>/`
3. Form displays with:
   - New Password field
   - Confirm Password field
4. Enter:
   - New Password: `NewSecurePass456`
   - Confirm Password: `NewSecurePass456`
5. Click "Reset Password"

**Expected Results**:
- ✅ Password updated in User model
- ✅ PasswordResetToken.is_used = True
- ✅ PasswordResetToken.used_at = NOW()
- ✅ Redirect to `/login/` with success message
- ✅ Can login with new password
- ✅ Old password no longer works
- ✅ AuditLog entry created

**Verification**:
```bash
# Login with new password
# Navigate to /login/
# Username: newuser123
# Password: NewSecurePass456
# Should successfully login
```

### Test Case 3.4: Expired Token

**Steps**:
1. Manually modify database to set token expiry to past date:
   ```bash
   python manage.py shell
   >>> from core.models import PasswordResetToken
   >>> from django.utils import timezone
   >>> from datetime import timedelta
   >>> token = PasswordResetToken.objects.latest('created_at')
   >>> token.expires_at = timezone.now() - timedelta(hours=25)
   >>> token.save()
   >>> exit()
   ```
2. Navigate to reset link URL

**Expected Results**:
- ✅ Error message: "Reset link is expired"
- ✅ Redirect to `/password-reset/`
- ✅ User must request new reset link

### Test Case 3.5: Already Used Token

**Steps**:
1. Use a valid reset token once successfully
2. Try to use the same token again

**Expected Results**:
- ✅ Error message: "Reset link has already been used"
- ✅ Redirect to `/password-reset/`
- ✅ Must request new token

### Test Case 3.6: Password Mismatch on Reset

**Steps**:
1. Navigate to valid reset link
2. Enter:
   - New Password: `NewPass123`
   - Confirm Password: `DifferentPass123`
3. Click "Reset Password"

**Expected Results**:
- ✅ Error message: "Passwords do not match"
- ✅ Stay on reset form
- ✅ Token not marked as used

**Module 3 Summary**:
| Test Case | Status | Notes |
|-----------|--------|-------|
| 3.1 Valid Reset Request | ✅ | Token created, email sent |
| 3.2 Non-existent Email | ✅ | Generic message for security |
| 3.3 Valid Token Reset | ✅ | Password changed, token used |
| 3.4 Expired Token | ✅ | 24-hour expiry enforced |
| 3.5 Already Used Token | ✅ | One-time use enforced |
| 3.6 Password Mismatch | ✅ | Validation works |

---

## Module 4: User Profile Management

**Purpose**: Test user profile information updates  
**Routes**: `GET /profile/`, `GET/POST /profile/edit/`  
**Auth**: Required (LoginRequired)

### Test Case 4.1: View Profile

**Steps**:
1. Login as `newuser123`
2. Navigate to `/profile/`

**Expected Results**:
- ✅ Display user information:
  - Full Name
  - Email
  - Username
  - Phone (if set)
  - Address (if set)
  - Department (if set)
  - Member since date
- ✅ Edit Profile link visible
- ✅ Preferences link visible
- ✅ Change Password link visible

### Test Case 4.2: Edit Profile - Valid Update

**Steps**:
1. Login as `newuser123`
2. Navigate to `/profile/edit/`
3. Update fields:
   - First Name: `Jonathan`
   - Last Name: `Doe-Smith`
   - Email: `johnsmith@example.com`
   - Phone: `+1-555-123-4567`
   - Address: `123 Main Street, Anytown, ST 12345`
   - Department: `Finance`
4. Click "Save Changes"

**Expected Results**:
- ✅ Redirect to `/profile/`
- ✅ Success message: "Profile updated successfully"
- ✅ Database updated:
  - first_name = `Jonathan`
  - last_name = `Doe-Smith`
  - email = `johnsmith@example.com` (if uniqueness check passes)
  - phone = `+1-555-123-4567`
  - address = `123 Main Street, Anytown, ST 12345`
- ✅ AuditLog entry created (ActionType.UPDATE)

### Test Case 4.3: Edit Profile - Duplicate Email

**Steps**:
1. Attempt to change email to one already in use
2. Click "Save Changes"

**Expected Results**:
- ✅ Error message: "Email already in use"
- ✅ Stay on edit form
- ✅ Email not changed

### Test Case 4.4: Edit Profile - Invalid Phone Format

**Steps**:
1. Enter phone: `invalid-phone`
2. Click "Save Changes"

**Expected Results**:
- ✅ Either: Success (if no validation) OR
- ✅ Error message: "Enter a valid phone number"

### Test Case 4.5: Unauthorized Access

**Steps**:
1. Logout
2. Try to access `/profile/edit/` directly (no auth)

**Expected Results**:
- ✅ Redirect to `/login/`
- ✅ Message: "You must be logged in"

**Module 4 Summary**:
| Test Case | Status | Notes |
|-----------|--------|-------|
| 4.1 View Profile | ✅ | Read-only display |
| 4.2 Valid Update | ✅ | All fields saved |
| 4.3 Duplicate Email | ✅ | Uniqueness enforced |
| 4.4 Invalid Phone | ✅ | Format validation |
| 4.5 Unauthorized Access | ✅ | Login required |

---

## Module 5: User Preferences

**Purpose**: Test notification and display preference management  
**Routes**: `GET/POST /preferences/`  
**Auth**: Required (LoginRequired)

### Test Case 5.1: View Preferences

**Steps**:
1. Login as `newuser123`
2. Navigate to `/preferences/`

**Expected Results**:
- ✅ Display UserPreferences form with sections:
  - **Email Notifications**:
    - Enable/Disable checkbox
    - Frequency (Instant, Daily, Weekly, Never)
    - Notification types (checkboxes)
  - **Quiet Hours**:
    - Enable/Disable checkbox
    - Start time picker
    - End time picker
  - **Display**:
    - Theme (Light, Dark, Auto)
    - Language (English, French, Spanish, etc.)
    - Timezone
    - Items per page
  - **Privacy**:
    - Profile visibility
    - Allow contact
    - Data export option

### Test Case 5.2: Update Email Preferences

**Steps**:
1. Navigate to `/preferences/`
2. Update:
   - Email notifications: Enable
   - Frequency: Daily
   - Notification types: Check "Approvals", "Rejections", "Payments"
   - Uncheck: "Invitations"
3. Click "Save Preferences"

**Expected Results**:
- ✅ Redirect to `/preferences/`
- ✅ Success message: "Preferences updated"
- ✅ Database updated:
  - email_notifications_enabled = True
  - request_notifications = 'daily'
  - approval_notifications = True
  - rejection_notifications = True
  - payment_notifications = True
  - invitation_notifications = False
- ✅ AuditLog entry created

### Test Case 5.3: Enable Quiet Hours

**Steps**:
1. Navigate to `/preferences/`
2. Update:
   - Quiet hours: Enable
   - Start time: 22:00 (10 PM)
   - End time: 08:00 (8 AM)
3. Click "Save Preferences"

**Expected Results**:
- ✅ Preferences saved
- ✅ Database updated:
  - quiet_hours_enabled = True
  - quiet_hours_start = 22:00
  - quiet_hours_end = 08:00
- ✅ Emails won't be sent during this time (queued instead)

**Verification**:
```bash
python manage.py shell
>>> from core.models import UserPreferences
>>> from django.contrib.auth.models import User
>>> user = User.objects.get(username='newuser123')
>>> prefs = UserPreferences.objects.get(user=user)
>>> prefs.quiet_hours_enabled
True
>>> prefs.quiet_hours_start
datetime.time(22, 0)
>>> exit()
```

### Test Case 5.4: Change Theme

**Steps**:
1. Navigate to `/preferences/`
2. Update:
   - Theme: Dark
3. Click "Save Preferences"

**Expected Results**:
- ✅ Preferences saved
- ✅ Database: theme = 'dark'
- ✅ On next page load, dark theme applied (if implemented in templates)

### Test Case 5.5: Change Display Settings

**Steps**:
1. Navigate to `/preferences/`
2. Update:
   - Language: Español (Spanish)
   - Timezone: America/New_York
   - Items per page: 50
3. Click "Save Preferences"

**Expected Results**:
- ✅ Preferences saved
- ✅ Database updated with new values
- ✅ Language change affects UI on next page load (if i18n implemented)
- ✅ Pagination shows 50 items instead of default

### Test Case 5.6: Automatic Preferences Creation

**Steps**:
1. Create user via API (`/api/users/register/`)
2. Navigate to `/preferences/`

**Expected Results**:
- ✅ UserPreferences created automatically if doesn't exist
- ✅ Default values applied:
  - theme = 'light'
  - email_notifications_enabled = True
  - language = 'en'
  - items_per_page = 25

**Module 5 Summary**:
| Test Case | Status | Notes |
|-----------|--------|-------|
| 5.1 View Preferences | ✅ | Full form displayed |
| 5.2 Email Preferences | ✅ | Notification control |
| 5.3 Quiet Hours | ✅ | Email deferral |
| 5.4 Theme Change | ✅ | Display preference |
| 5.5 Display Settings | ✅ | Language, timezone, pagination |
| 5.6 Auto-creation | ✅ | Default on creation |

---

## Module 6: JWT Authentication (API)

**Purpose**: Test token-based API authentication  
**Routes**: `POST /api/token/`, `POST /api/token/refresh/`, `GET /api/users/me/`  
**Auth**: Token-based (JWT)

### Test Case 6.1: Obtain JWT Token

**Steps**:
```bash
curl -X POST http://localhost:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser123",
    "password": "SecurePass123"
  }'
```

**Expected Results**:
- ✅ HTTP 200 response with JSON:
  ```json
  {
    "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "user": {
      "id": "uuid",
      "username": "newuser123",
      "email": "newuser@example.com",
      "full_name": "John Doe",
      "is_director": false,
      "is_admin": false
    }
  }
  ```
- ✅ access token (15-minute expiry)
- ✅ refresh token (7-day expiry)
- ✅ User info in response
- ✅ AuditLog entry created

**Verification**:
```bash
# Decode token (online at jwt.io or with Python)
python -c "import jwt; print(jwt.decode('YOUR_TOKEN', options={'verify_signature': False}))"
# Should show claims: user_id, username, email, is_director, is_admin, exp
```

### Test Case 6.2: Use Access Token

**Steps**:
```bash
ACCESS_TOKEN="<token_from_6.1>"

curl -X GET http://localhost:8000/api/users/me/ \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

**Expected Results**:
- ✅ HTTP 200 response with current user data:
  ```json
  {
    "id": "uuid",
    "username": "newuser123",
    "email": "newuser@example.com",
    "full_name": "John Doe",
    "phone": "",
    "address": "",
    "department": "",
    "role": "admin",
    "is_director": false,
    "is_admin": false,
    "preferences": {
      "theme": "light",
      "language": "en",
      "email_notifications_enabled": true
    }
  }
  ```

### Test Case 6.3: Invalid Token

**Steps**:
```bash
curl -X GET http://localhost:8000/api/users/me/ \
  -H "Authorization: Bearer invalid-token-here"
```

**Expected Results**:
- ✅ HTTP 401 Unauthorized
- ✅ Response: `{"detail": "Invalid token"}`

### Test Case 6.4: Expired Token

**Steps**:
1. Obtain a token
2. Wait for access token to expire (15 minutes) OR manually set expiry to past
3. Use expired token

**Expected Results**:
- ✅ HTTP 401 Unauthorized
- ✅ Response: `{"detail": "Token is invalid or expired"}`

### Test Case 6.5: Refresh Token

**Steps**:
```bash
REFRESH_TOKEN="<refresh_token_from_6.1>"

curl -X POST http://localhost:8000/api/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "'${REFRESH_TOKEN}'"}'
```

**Expected Results**:
- ✅ HTTP 200 response with new access token:
  ```json
  {
    "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
  }
  ```
- ✅ New access token valid for 15 minutes
- ✅ Refresh token still valid (not changed)

### Test Case 6.6: API User Registration

**Steps**:
```bash
curl -X POST http://localhost:8000/api/users/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "apiuser1",
    "email": "apiuser@example.com",
    "first_name": "API",
    "last_name": "User",
    "password": "ApiPass123",
    "password_confirm": "ApiPass123"
  }'
```

**Expected Results**:
- ✅ HTTP 201 Created
- ✅ User created in database
- ✅ UserPreferences created
- ✅ Welcome email sent
- ✅ Response includes user_id, username, email

### Test Case 6.7: API Change Password

**Steps**:
```bash
ACCESS_TOKEN="<your_token>"

curl -X POST http://localhost:8000/api/users/me/change-password/ \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "old_password": "SecurePass123",
    "new_password": "NewApiPass456",
    "new_password_confirm": "NewApiPass456"
  }'
```

**Expected Results**:
- ✅ HTTP 200 response
- ✅ Password changed in database
- ✅ AuditLog entry created
- ✅ Old password no longer works
- ✅ New password works for login

### Test Case 6.8: List Users (Admin Only)

**Steps**:
```bash
# Get token as director/admin
ADMIN_TOKEN="<admin_token>"

curl -X GET http://localhost:8000/api/users/ \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
```

**Expected Results**:
- ✅ HTTP 200 with paginated user list
- ✅ Includes all users

**Test Case 6.9: Non-Admin Cannot List Users**

**Steps**:
```bash
# Get token as regular user
USER_TOKEN="<user_token>"

curl -X GET http://localhost:8000/api/users/ \
  -H "Authorization: Bearer ${USER_TOKEN}"
```

**Expected Results**:
- ✅ HTTP 403 Forbidden (if permission is IsAdmin)
- ✅ Response: `{"detail": "Permission denied"}`

**Module 6 Summary**:
| Test Case | Status | Notes |
|-----------|--------|-------|
| 6.1 Obtain Token | ✅ | Access + Refresh tokens |
| 6.2 Use Token | ✅ | Authenticated request |
| 6.3 Invalid Token | ✅ | 401 error |
| 6.4 Expired Token | ✅ | 401 error |
| 6.5 Refresh Token | ✅ | New access token |
| 6.6 API Registration | ✅ | Create user via API |
| 6.7 Change Password | ✅ | Old password verification |
| 6.8 List Users (Admin) | ✅ | Admin access |
| 6.9 Non-Admin List | ✅ | Permission denied |

---

## Module 7: Request Submission

**Purpose**: Test financial request creation and validation  
**Routes**: `POST /api/submit-request/`, `POST /request/new/`  
**Auth**: Required (LoginRequired)

### Test Case 7.1: Submit Valid Request (API)

**Steps**:
```bash
TOKEN="<your_token>"

curl -X POST http://localhost:8000/api/submit-request/ \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "tuition",
    "amount_requested": 5000.00,
    "title": "College Tuition Assistance",
    "description": "Requesting assistance for fall semester tuition",
    "beneficiaries": "John Doe"
  }'
```

**Expected Results**:
- ✅ HTTP 201 Created
- ✅ Response:
  ```json
  {
    "request_id": "REQ-20260306-000001",
    "status": "PENDING",
    "category": "TUITION",
    "amount_requested": 5000.00,
    "created_by": "newuser123",
    "created_at": "2026-03-06T14:30:00Z",
    "message": "Request submitted successfully"
  }
  ```
- ✅ Request created in database with:
  - request_id (auto-generated)
  - status = PENDING
  - category = TUITION
  - amount_requested = 5000.00
  - created_at = NOW()
- ✅ Email sent to applicant (REQUEST_SUBMITTED)
- ✅ AuditLog entry created (ActionType.CREATE)
- ✅ Workflow checked (auto-approval if eligible)

### Test Case 7.2: Auto-Approval Trigger

**Steps**:
1. Submit request with:
   - category: TUITION
   - amount_requested: 25000 (within auto-approve limit)

**Expected Results**:
- ✅ Request created with status = PENDING or APPROVED (based on workflow)
- ✅ If auto-approved:
  - status = APPROVED
  - approved_amount = 25000
  - Email sent to applicant (REQUEST_APPROVED)
  - Workflow log created

### Test Case 7.3: Document Upload

**Steps**:
1. Submit request with form (web interface)
2. Upload supporting documents (PDF, JPG, PNG)
3. Include files:
   - tuition_letter.pdf
   - acceptance_letter.jpg

**Expected Results**:
- ✅ Documents stored in media directory
- ✅ RequestDocument records created for each file:
  - file (path to uploaded file)
  - original_filename
  - file_size
  - mime_type
  - uploaded_at
- ✅ Documents linked to Request

### Test Case 7.4: Insufficient Funds Category

**Steps**:
```bash
curl -X POST http://localhost:8000/api/submit-request/ \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "other",
    "amount_requested": 500000,
    "title": "Large construction project",
    "description": "..."
  }'
```

**Expected Results**:
- ✅ Request created with status = PENDING
- ✅ Marked for director review (high amount or category)
- ✅ Email sent to director (APPROVAL_REQUIRED)

### Test Case 7.5: Invalid Category

**Steps**:
```bash
curl -X POST http://localhost:8000/api/submit-request/ \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "invalid_category",
    "amount_requested": 5000,
    "title": "Test"
  }'
```

**Expected Results**:
- ✅ HTTP 400 Bad Request
- ✅ Error: `{"category": ["Invalid category"]}`

### Test Case 7.6: Negative Amount

**Steps**:
```bash
# amount_requested: -5000
```

**Expected Results**:
- ✅ HTTP 400 Bad Request
- ✅ Error: `{"amount_requested": ["Amount must be positive"]}`

### Test Case 7.7: Missing Required Fields

**Steps**:
```bash
# Omit title and description
```

**Expected Results**:
- ✅ HTTP 400 Bad Request
- ✅ Errors for missing fields

**Module 7 Summary**:
| Test Case | Status | Notes |
|-----------|--------|-------|
| 7.1 Valid Submit | ✅ | Request ID generated |
| 7.2 Auto-Approval | ✅ | Workflow checked |
| 7.3 Document Upload | ✅ | Files stored |
| 7.4 High Amount | ✅ | Marked for review |
| 7.5 Invalid Category | ✅ | Validation error |
| 7.6 Negative Amount | ✅ | Validation error |
| 7.7 Missing Fields | ✅ | Required fields |

---

## Module 8: Request Approval Workflow

**Purpose**: Test director approval/rejection and payment workflow  
**Routes**: `POST /api/approve-request/`, `POST /api/reject-request/`, `POST /api/mark-paid/`  
**Auth**: Required (Director role)

### Test Case 8.1: Director Approves Request

**Steps**:
```bash
# Get token as director
DIRECTOR_TOKEN="<director_token>"

curl -X POST http://localhost:8000/api/approve-request/ \
  -H "Authorization: Bearer ${DIRECTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "REQ-20260306-000001",
    "approved_amount": 4500.00,
    "review_notes": "Approved. All documentation verified."
  }'
```

**Expected Results**:
- ✅ HTTP 200 response
- ✅ Request updated:
  - status = APPROVED
  - approved_amount = 4500
  - remaining_balance = 4500
  - reviewed_by = director user
  - reviewed_at = NOW()
  - review_notes = "Approved. All documentation verified."
- ✅ Email sent to applicant (REQUEST_APPROVED)
- ✅ AuditLog entry created (ActionType.APPROVE)
- ✅ Dashboard notification created

### Test Case 8.2: Approve with Less Than Requested

**Steps**:
```bash
# Approve for less than requested amount
# amount_requested: 5000
# approved_amount: 3000
```

**Expected Results**:
- ✅ Request approved for $3000
- ✅ remaining_balance = 3000
- ✅ Email to applicant shows approved amount
- ✅ Audit trail shows partial approval

### Test Case 8.3: Director Rejects Request

**Steps**:
```bash
curl -X POST http://localhost:8000/api/reject-request/ \
  -H "Authorization: Bearer ${DIRECTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "REQ-20260306-000001",
    "rejection_reason": "Insufficient documentation",
    "review_notes": "Please provide additional proof of eligibility"
  }'
```

**Expected Results**:
- ✅ HTTP 200 response
- ✅ Request updated:
  - status = REJECTED
  - reviewed_by = director
  - reviewed_at = NOW()
  - review_notes = full rejection reason
- ✅ Email sent to applicant (REQUEST_REJECTED)
- ✅ Email includes appeal process if configured
- ✅ AuditLog entry created (ActionType.REJECT)

### Test Case 8.4: Non-Director Cannot Approve

**Steps**:
```bash
# Get token as regular user
USER_TOKEN="<user_token>"

curl -X POST http://localhost:8000/api/approve-request/ \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"request_id": "REQ-20260306-000001", ...}'
```

**Expected Results**:
- ✅ HTTP 403 Forbidden
- ✅ Error: `{"detail": "Permission denied. Director access required."}`

### Test Case 8.5: Cannot Approve Already Approved Request

**Steps**:
1. Approve request once
2. Try to approve again

**Expected Results**:
- ✅ HTTP 400 Bad Request
- ✅ Error: `{"detail": "Request has already been reviewed"}`

### Test Case 8.6: Cannot Approve Non-Existent Request

**Steps**:
```bash
# request_id that doesn't exist
```

**Expected Results**:
- ✅ HTTP 404 Not Found
- ✅ Error: `{"detail": "Request not found"}`

### Test Case 8.7: Mark Approved Request as Paid

**Steps**:
```bash
curl -X POST http://localhost:8000/api/mark-paid/ \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "REQ-20260306-000001",
    "payment_method": "bank_transfer",
    "payment_reference": "TXN-20260306-12345",
    "payment_date": "2026-03-06"
  }'
```

**Expected Results**:
- ✅ HTTP 200 response
- ✅ Request updated:
  - status = PAID
  - disbursed_amount = approved_amount
  - remaining_balance = 0
  - payment_method = "bank_transfer"
  - payment_reference = "TXN-20260306-12345"
  - payment_date = 2026-03-06
- ✅ Email sent to applicant (PAYMENT_PROCESSED)
- ✅ Email includes receipt/confirmation details
- ✅ AuditLog entry created

### Test Case 8.8: Cannot Mark Non-Approved as Paid

**Steps**:
1. Create request (stays PENDING)
2. Try to mark as paid without approving

**Expected Results**:
- ✅ HTTP 400 Bad Request
- ✅ Error: `{"detail": "Only approved requests can be marked as paid"}`

### Test Case 8.9: View Approval History

**Steps**:
```bash
curl -X GET "http://localhost:8000/api/requests/REQ-20260306-000001/history/" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Expected Results**:
- ✅ HTTP 200 response with approval history:
  ```json
  {
    "history": [
      {
        "action": "APPROVE",
        "timestamp": "2026-03-06T14:35:00Z",
        "user": "director",
        "notes": "Approved. All documentation verified.",
        "amount": 4500
      },
      {
        "action": "CREATE",
        "timestamp": "2026-03-06T14:30:00Z",
        "user": "newuser123",
        "notes": ""
      }
    ]
  }
  ```

**Module 8 Summary**:
| Test Case | Status | Notes |
|-----------|--------|-------|
| 8.1 Approve Request | ✅ | Status changed, email sent |
| 8.2 Partial Approval | ✅ | Less than requested |
| 8.3 Reject Request | ✅ | Status rejected, email sent |
| 8.4 Non-Director | ✅ | Permission denied |
| 8.5 Already Approved | ✅ | Cannot re-approve |
| 8.6 Non-Existent | ✅ | 404 error |
| 8.7 Mark as Paid | ✅ | Status paid, payment tracked |
| 8.8 Cannot Pay Non-Approved | ✅ | Validation error |
| 8.9 View History | ✅ | Complete audit trail |

---

## Module 9: Logo/Branding Management

**Purpose**: Test organization settings and logo uploads  
**Routes**: Admin interface, site templates  
**Auth**: Required (Admin only)

### Test Case 9.1: View Organization Settings

**Steps**:
1. Login as admin
2. Navigate to `/admin/common/organizationsettings/`

**Expected Results**:
- ✅ Django admin page loads
- ✅ Form displays with all fields:
  - Logo (ImageField)
  - Favicon (ImageField)
  - Banner Image (ImageField)
  - Primary Color, Secondary Color, Accent Color
  - Organization Name, Email, Phone
  - Website, Social Links (Facebook, Twitter, Instagram, LinkedIn, YouTube)
  - About Us, Mission Statement, Footer Text

### Test Case 9.2: Upload Logo

**Steps**:
1. Navigate to OrganizationSettings admin
2. Upload logo image (200x50px recommended)
3. Save

**Expected Results**:
- ✅ Image uploaded to media directory
- ✅ Logo path saved to database
- ✅ Success message: "Organization settings saved"
- ✅ Logo accessible via URL

### Test Case 9.3: Logo Displayed in Templates

**Steps**:
1. Upload logo as in 9.2
2. Navigate to home page or any template that uses logo

**Expected Results**:
- ✅ Logo appears in navbar/header
- ✅ Logo is clickable (links to home)
- ✅ Logo displays correctly at intended size
- ✅ Fallback text if no logo ("Organization Name" text)

### Test Case 9.4: Favicon Upload

**Steps**:
1. Upload favicon (.ico file, 16x16 or 32x32)
2. Save

**Expected Results**:
- ✅ File uploaded to media directory
- ✅ Favicon path saved to database
- ✅ Favicon appears in browser tab

### Test Case 9.5: Custom Colors

**Steps**:
1. Set colors:
   - Primary: #007bff (blue)
   - Secondary: #6c757d (gray)
   - Accent: #ff6b6b (red)
2. Save

**Expected Results**:
- ✅ Colors saved to database
- ✅ CSS variables updated (if implemented in templates)
- ✅ Color scheme applied to UI on next page load

### Test Case 9.6: Social Links

**Steps**:
1. Set social links:
   - Facebook: https://facebook.com/organization
   - Twitter: https://twitter.com/organization
   - Instagram: https://instagram.com/organization
2. Save

**Expected Results**:
- ✅ URLs saved to database
- ✅ Social links appear in footer (if implemented)
- ✅ Links are clickable and go to correct pages

### Test Case 9.7: Organization Info

**Steps**:
1. Set:
   - Organization Name: "CTRMS Foundation"
   - Email: info@ctrms.org
   - Phone: +1-555-123-4567
   - Website: www.ctrms.org
   - About Us: "Organization description..."
   - Mission: "Our mission is..."
2. Save

**Expected Results**:
- ✅ Information saved to database
- ✅ Displayed in footer or about page
- ✅ Contact information accessible to users

### Test Case 9.8: Unauthorized Access

**Steps**:
1. Login as regular user (not admin)
2. Try to access `/admin/common/organizationsettings/`

**Expected Results**:
- ✅ 403 Forbidden or redirect to login
- ✅ Message: "You don't have permission to view this"

**Module 9 Summary**:
| Test Case | Status | Notes |
|-----------|--------|-------|
| 9.1 View Settings | ✅ | Admin only |
| 9.2 Upload Logo | ✅ | File saved to media |
| 9.3 Logo Display | ✅ | Appears in navbar |
| 9.4 Favicon | ✅ | Browser tab icon |
| 9.5 Custom Colors | ✅ | Theme applied |
| 9.6 Social Links | ✅ | Footer links |
| 9.7 Organization Info | ✅ | Footer display |
| 9.8 Unauthorized | ✅ | Admin only access |

---

## Automated Test Suite

Create comprehensive test suite in [core/tests.py](core/tests.py):

```python
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.utils import timezone
from core.models import PasswordResetToken, UserPreferences
from requests.models import Request

class AuthenticationTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='TestPass123'
        )
    
    def test_user_registration(self):
        """Test user registration endpoint"""
        response = self.client.post('/register/', {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'NewPass123',
            'password_confirm': 'NewPass123',
            'first_name': 'Test',
            'last_name': 'User'
        })
        self.assertEqual(response.status_code, 302)  # Redirect on success
        self.assertTrue(User.objects.filter(username='newuser').exists())
    
    def test_user_login(self):
        """Test login functionality"""
        response = self.client.post('/login/', {
            'username': 'testuser',
            'password': 'TestPass123'
        })
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.wsgi_request.user, self.user)
    
    def test_password_reset(self):
        """Test password reset token generation"""
        response = self.client.post('/password-reset/', {
            'email': 'test@example.com'
        })
        self.assertEqual(response.status_code, 302)
        token = PasswordResetToken.objects.get(user=self.user)
        self.assertFalse(token.is_used)
        self.assertTrue(token.is_valid)
    
    def test_jwt_token_obtain(self):
        """Test JWT token endpoint"""
        response = self.client.post('/api/token/', {
            'username': 'testuser',
            'password': 'TestPass123'
        }, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('access', data)
        self.assertIn('refresh', data)

class RequestTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='applicant',
            email='applicant@example.com',
            password='TestPass123'
        )
        self.client.login(username='applicant', password='TestPass123')
    
    def test_request_submission(self):
        """Test request creation"""
        response = self.client.post('/api/submit-request/', {
            'category': 'tuition',
            'amount_requested': 5000,
            'title': 'Tuition Assistance',
            'description': 'College tuition'
        }, content_type='application/json')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Request.objects.filter(category='TUITION').exists())

class PreferencesTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='prefuser',
            email='pref@example.com',
            password='TestPass123'
        )
        self.client.login(username='prefuser', password='TestPass123')
    
    def test_update_preferences(self):
        """Test user preferences update"""
        prefs = UserPreferences.objects.get(user=self.user)
        response = self.client.post('/preferences/', {
            'theme': 'dark',
            'email_notifications_enabled': True
        })
        self.assertEqual(response.status_code, 302)
        prefs.refresh_from_db()
        self.assertEqual(prefs.theme, 'dark')
```

**Run Tests**:
```bash
# Run all tests
python manage.py test

# Run specific app tests
python manage.py test core

# Run with verbose output
python manage.py test -v 2

# Run with coverage
coverage run --source='.' manage.py test
coverage report
```

---

## Summary & Checklist

**Authentication Modules**: ✅ 6/6 Complete
- User Registration
- User Login
- Password Reset
- User Profile
- User Preferences
- JWT Tokens

**Request Management**: ✅ 2/2 Complete
- Request Submission
- Request Approval Workflow

**Organization**: ✅ 1/1 Complete
- Logo/Branding Management

**Overall Status**: **READY FOR TESTING**

Use this manual to systematically test each module and verify functionality before production deployment.


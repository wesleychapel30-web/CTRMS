# CTRMS Copilot Instructions

## Project Overview
CTRMS is a Django-based request and invitation management system with role-based access control (RBAC). It has two primary domains:
- **Request Management (Part A)**: Financial requests (tuition, medical, construction) with multi-stage approval workflows and document handling
- **Invitation Management (Part B)**: Event logistics tracking with automated reminders and calendar views

## Architecture & Key Components

### App Structure
- **`core/`**: User models (Admin/Director roles), AuditLog model, and authentication
- **`requests/`**: Request model with 4 categories, 5 status states, document attachments, and financial tracking
- **`invitations/`**: Invitation model with event scheduling, RSVP tracking, and reminder logic
- **`common/`**: Shared utilities
- **`ctrms_config/`**: Django settings, URL routing, and middleware (includes AuditLoggingMiddleware)

### Data Models Key Patterns
- All models use `UUIDField` as primary key with additional business key (e.g., `request_id`)
- Status fields use `TextChoices` with `db_index=True` for fast filtering
- ForeignKey references use `PROTECT` or `SET_NULL` per business rules
- Models include `created_at`/`updated_at` timestamps with `auto_now_add`/`auto_now`
- [Request.models](requests/models.py): 5 status states (PENDING→UNDER_REVIEW→APPROVED/REJECTED/PAID); financial fields: `amount_requested`, `approved_amount`, `disbursed_amount`, `remaining_balance`
- [Invitation.models](invitations/models.py): `is_upcoming` property (7-day window), `is_overdue_for_*_reminder` for scheduling notifications

### Request Workflow
1. Applicant submits request → Status: PENDING
2. Admin can transition to UNDER_REVIEW
3. Director approves/rejects (with `approved_amount` and `review_notes`)
4. Approved requests can be marked as PAID (tracks `payment_date`, `payment_method`, `payment_reference`)
5. All transitions logged via AuditLog with user, IP, action type

### Invitation Workflow
Event created (PENDING_REVIEW) → Director reviews → ACCEPTED/DECLINED/CONFIRMED_ATTENDANCE → COMPLETED
- Auto-send reminders at 3 days and 1 day before event (tracked via `reminder_3_days_sent`, `reminder_1_day_sent`)

## Custom Permissions & Middleware
- **[IsAdminOrDirector](requests/views.py#L14-L17)**: Checks user role
- **[IsDirector](requests/views.py#L20-L23)**: Approval-only action guard
- **[AuditLoggingMiddleware](ctrms_config/middleware.py)**: Captures all non-excluded requests with user, IP, action type; logs to `AuditLog` model

## API Patterns

### ViewSet Actions
- Standard CRUD via `ModelViewSet`
- Custom actions decorated with `@action(detail=True, methods=['post'])`
  - `approve_request`: Directors only, checks status before allowing approval
  - `reject_request`: Directors only, sets status='rejected' and stores notes
  - `mark_as_paid`: Updates financial tracking
  - See [RequestViewSet](requests/views.py#L31-L100) for implementation details

### Serializers
- Separate serializer classes for different operations: `RequestSerializer`, `RequestCreateUpdateSerializer`, `RequestApprovalSerializer`, `RequestReportSerializer`
- This pattern (e.g., `get_serializer_class()` override) allows different field validation/output for different actions

### Filtering & Search
- Uses `DjangoFilterBackend` + `SearchFilter` + `OrderingFilter`
- Filterset on status/category; search on request_id/applicant fields

## Development Workflow

### Setup
```bash
# Activate virtual environment (Windows)
venv\Scripts\activate

# Run migrations
python manage.py makemigrations
python manage.py migrate

# Create superuser (admin)
python manage.py createsuperuser
```

### Database
- SQLite by default (`db.sqlite3`); production should use PostgreSQL (see requirements.txt: `psycopg2-binary`)
- Migrations stored in `*/migrations/` directories; always check `migrations/` when altering models

### Testing
- Use `pytest` + `pytest-django` (in requirements.txt)
- Place tests in `*/tests.py`

### Static Files & Media
- Static files: `static/` directory; collect via `python manage.py collectstatic`
- Media uploads: `media/` directory; served in DEBUG mode via settings

## Dependencies & Tools
- **Django 4.2.13**: Core framework
- **DRF (djangorestframework 3.14.0)**: REST API with JWT auth (djangorestframework-simplejwt)
- **django-cors-headers**: Cross-origin requests
- **django-filter**: QuerySet filtering
- **cryptography**: Encrypted storage support
- **openpyxl + reportlab**: Excel/PDF export for reports
- **celery + redis**: Background task support (optional, not yet integrated in views shown)
- **pytest-django**: Testing

## Important Conventions
1. **File Organization**: Model logic in `models.py`, API logic in `views.py` + `serializers.py`, URLs in `urls.py`
2. **Naming**: Request IDs auto-generated (`request_id` field), not relying on UUID for user-facing references
3. **Approval Pattern**: Status checks before allowing state transitions; only directors can approve/reject
4. **Audit Trail**: All user actions logged automatically via middleware (IP, action type, timestamps)
5. **Environment Config**: Use `.env` with `python-decouple` for SECRET_KEY, DEBUG, ALLOWED_HOSTS

## Common Tasks
- **Add a Request status**: Update `Status.choices` in [Request model](requests/models.py#L20-L26), create migration
- **Add a custom action**: Create `@action` method in ViewSet, implement permission check, update serializer mapping
- **Add audit logging for new action**: Extend `ActionType` in [AuditLog model](core/models.py#L48-L57)
- **Modify approval logic**: Edit `approve_request` action in [RequestViewSet](requests/views.py#L68-L80), ensure status validation

## Files to Review First
1. [ctrms_config/settings.py](ctrms_config/settings.py): App registration, middleware, database
2. [requests/models.py](requests/models.py): Request workflow and status states
3. [invitations/models.py](invitations/models.py): Invitation structure and reminder logic
4. [core/models.py](core/models.py): User roles, AuditLog schema
5. [requests/views.py](requests/views.py): Approval/rejection/payment patterns

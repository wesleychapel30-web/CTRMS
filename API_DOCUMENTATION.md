# CTRMS API Documentation

## Base URL
`http://localhost:8000/api/` (all endpoints start with this)

## Authentication
All endpoints require Django session authentication (login required) or can be extended to use JWT tokens via `djangorestframework-simplejwt`.

---

## Endpoints

### 1. Submit Request
**Endpoint**: `POST /api/submit-request/`

**Description**: Create a new assistance request (financial/medical/tuition/etc.)

**Authentication**: Required (LoginRequired)

**Request Headers**:
```
Content-Type: application/json
X-CSRFToken: [csrf-token]
```

**Request Body**:
```json
{
  "applicant_name": "John Doe",
  "applicant_email": "john@example.com",
  "applicant_phone": "+255 712 345 678",
  "category": "TUITION",
  "title": "School Tuition Payment",
  "description": "Need help paying for school fees",
  "amount_requested": 5000,
  "beneficiaries": "My family (4 people)"
}
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "message": "Request submitted successfully",
  "request_id": "REQ-2026-001234",
  "request_uuid": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (Error - 400)**:
```json
{
  "success": false,
  "error": "applicant_name is required"
}
```

**Status Code Responses**:
- `200 OK` - Request created successfully
- `400 Bad Request` - Missing required fields
- `401 Unauthorized` - User not authenticated
- `500 Internal Server Error` - Server error

---

### 2. Approve Request
**Endpoint**: `POST /api/approve-request/`

**Description**: Director/admin approval of a request with optional amount modification

**Authentication**: Required + Staff/Director role

**Request Headers**:
```
Content-Type: application/json
X-CSRFToken: [csrf-token]
```

**Request Body**:
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "approved_amount": 4500,
  "notes": "Approved with 10% reduction due to budget constraints"
}
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "message": "Request approved successfully",
  "request_id": "REQ-2026-001234"
}
```

**Response (Error - 403)**:
```json
{
  "success": false,
  "error": "Unauthorized - Admin access required"
}
```

**Response (Error - 404)**:
```json
{
  "success": false,
  "error": "Request not found"
}
```

**Status Code Responses**:
- `200 OK` - Request approved
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not staff/director
- `404 Not Found` - Request doesn't exist
- `500 Internal Server Error` - Server error

---

### 3. Reject Request
**Endpoint**: `POST /api/reject-request/`

**Description**: Director/admin rejection of a request with reason

**Authentication**: Required + Staff/Director role

**Request Headers**:
```
Content-Type: application/json
X-CSRFToken: [csrf-token]
```

**Request Body**:
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "Insufficient documentation provided",
  "notes": "Please resubmit with complete documentation"
}
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "message": "Request rejected successfully",
  "request_id": "REQ-2026-001234"
}
```

**Status Code Responses**:
- `200 OK` - Request rejected
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not staff/director
- `404 Not Found` - Request doesn't exist
- `500 Internal Server Error` - Server error

---

### 4. Mark as Paid
**Endpoint**: `POST /api/mark-paid/`

**Description**: Mark an approved request as paid with payment details

**Authentication**: Required + Staff/Director role

**Request Headers**:
```
Content-Type: application/json
X-CSRFToken: [csrf-token]
```

**Request Body**:
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "payment_method": "bank_transfer",
  "payment_reference": "TXN-2026-001234-BANK",
  "payment_date": "2026-03-06",
  "notes": "Payment processed via bank transfer"
}
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "message": "Request marked as paid successfully",
  "request_id": "REQ-2026-001234"
}
```

**Status Code Responses**:
- `200 OK` - Marked as paid
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not staff/director
- `404 Not Found` - Request doesn't exist
- `500 Internal Server Error` - Server error

---

### 5. Get Requests Data
**Endpoint**: `GET /api/requests-data/`

**Description**: Retrieve paginated list of requests with optional filtering and search

**Authentication**: Required

**Query Parameters**:
```
?status=APPROVED              # Filter by status (PENDING, UNDER_REVIEW, APPROVED, REJECTED, PAID)
&category=TUITION             # Filter by category (TUITION, MEDICAL, CONSTRUCTION, OTHER)
&search=REQ-2026              # Search in request_id, applicant_name, applicant_email
&page=1                       # Pagination (default: 1, 15 per page)
&sort_by=created_at           # Sort by field (created_at, amount_requested, status)
&sort_order=asc               # Sort order (asc, desc)
```

**Example Request**:
```
GET /api/requests-data/?status=APPROVED&category=TUITION&page=1
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "count": 42,
  "page": 1,
  "total_pages": 3,
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "request_id": "REQ-2026-001234",
      "applicant_name": "John Doe",
      "applicant_email": "john@example.com",
      "applicant_phone": "+255 712 345 678",
      "category": "TUITION",
      "status": "APPROVED",
      "amount_requested": 5000,
      "approved_amount": 4500,
      "disbursed_amount": 0,
      "created_at": "2026-03-01T10:30:00Z",
      "updated_at": "2026-03-05T14:20:00Z"
    },
    ...
  ]
}
```

**Response (Error - 400)**:
```json
{
  "success": false,
  "error": "Invalid filter parameter: invalid_status"
}
```

**Status Code Responses**:
- `200 OK` - Data retrieved successfully
- `400 Bad Request` - Invalid query parameters
- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - Server error

---

### 6. Get Dashboard Stats
**Endpoint**: `GET /api/dashboard-stats/`

**Description**: Retrieve real-time dashboard statistics and KPIs

**Authentication**: Required

**Query Parameters** (optional):
```
?date_from=2026-01-01        # Filter from date
&date_to=2026-03-06          # Filter to date
&category=TUITION             # Filter by category
```

**Example Request**:
```
GET /api/dashboard-stats/?date_from=2026-01-01
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "statistics": {
    "total_requests": 45,
    "pending_requests": 8,
    "under_review_requests": 5,
    "approved_requests": 24,
    "rejected_requests": 3,
    "paid_requests": 5,
    "total_requested": 250000,
    "total_approved": 200000,
    "total_disbursed": 75000,
    "approval_rate": 53.3,
    "average_approval_time_days": 2.5,
    "by_category": {
      "TUITION": {
        "count": 20,
        "approved": 15,
        "amount": 100000
      },
      "MEDICAL": {
        "count": 15,
        "approved": 5,
        "amount": 50000
      },
      "CONSTRUCTION": {
        "count": 7,
        "approved": 3,
        "amount": 30000
      },
      "OTHER": {
        "count": 3,
        "approved": 1,
        "amount": 20000
      }
    },
    "monthly_trend": {
      "January 2026": 8,
      "February 2026": 18,
      "March 2026": 19
    }
  }
}
```

**Status Code Responses**:
- `200 OK` - Statistics retrieved successfully
- `400 Bad Request` - Invalid date format
- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - Server error

---

### 7. Create Event/Invitation
**Endpoint**: `POST /api/create-event/`

**Description**: Create a new event/invitation

**Authentication**: Required

**Request Headers**:
```
Content-Type: application/json
X-CSRFToken: [csrf-token]
```

**Request Body**:
```json
{
  "event_title": "Community Health Awareness Program",
  "inviting_organization": "Chakou Trust",
  "event_date": "2026-03-15T14:00:00Z",
  "location": "Community Center, Dar es Salaam",
  "event_duration_hours": 3,
  "description": "Join us for a health awareness program",
  "expected_attendees": 100,
  "contact_person": "Jane Smith",
  "contact_phone": "+255 712 345 678",
  "contact_email": "jane@example.com"
}
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "message": "Event created successfully",
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "event_title": "Community Health Awareness Program"
}
```

**Response (Error - 400)**:
```json
{
  "success": false,
  "error": "event_title is required"
}
```

**Status Code Responses**:
- `200 OK` - Event created successfully
- `400 Bad Request` - Missing required fields
- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - Server error

---

## Export Endpoints

### 1. Export Requests (CSV)
**Endpoint**: `GET /export/requests-csv/`

**Description**: Download all requests as CSV file

**Query Parameters**:
```
?status=APPROVED              # Filter by status
&category=TUITION             # Filter by category
&date_from=2026-01-01         # Filter from date
&date_to=2026-03-06           # Filter to date
```

**Response**:
- Content-Type: `text/csv`
- Attachment: `requests-export-2026-03-06.csv`

**CSV Columns**:
```
Request ID, Applicant Name, Email, Phone, Category, Amount Requested, 
Approved Amount, Disbursed Amount, Status, Created At, Updated At
```

---

### 2. Export Requests (Excel)
**Endpoint**: `GET /export/requests-excel/`

**Description**: Download all requests as Excel spreadsheet

**Query Parameters**: Same as CSV export

**Response**:
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Attachment: `requests-export-2026-03-06.xlsx`

**Features**:
- Formatted headers
- Auto-adjusted column widths
- Color-coded status
- Multiple sheets (Requests, Summary, Charts)

---

### 3. Export Requests (PDF)
**Endpoint**: `GET /export/requests-pdf/`

**Description**: Download requests as professional PDF report

**Query Parameters**: Same as CSV export

**Response**:
- Content-Type: `application/pdf`
- Attachment: `requests-export-2026-03-06.pdf`

**Report Contents**:
- Title and date
- Summary statistics
- Filtered request table
- Category breakdown
- Generated timestamp

---

### 4. Export Financial Report (CSV)
**Endpoint**: `GET /export/financial-report-csv/`

**Description**: Download financial summary by category

**Response**: CSV with columns:
```
Category, Total Requested, Total Approved, Total Disbursed, 
Remaining Balance, Number of Requests, Approval Rate
```

---

### 5. Export Analytics Report (CSV)
**Endpoint**: `GET /export/analytics-report-csv/`

**Description**: Download analytics and KPI metrics

**Response**: CSV with metrics:
```
Metric, Value, Percentage, Trend
Total Requests, 45, 100%, [trend]
Approved Requests, 24, 53.3%, [trend]
Rejected Requests, 3, 6.7%, [trend]
Pending Requests, 18, 40%, [trend]
...
```

---

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "error_code": "ERROR_CODE",
  "details": {
    "field_name": ["Field-specific error message"]
  }
}
```

### Common Error Codes
- `INVALID_INPUT` - Invalid request data
- `NOT_FOUND` - Resource not found
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Permission denied
- `CONFLICT` - Resource conflict (e.g., duplicate)
- `INTERNAL_ERROR` - Server error

---

## Rate Limiting

- No rate limiting currently implemented
- Recommended for production: 100 requests/minute per user

---

## CORS Support

CORS is enabled via `django-cors-headers`. Allowed origins configured in [ctrms_config/settings.py](ctrms_config/settings.py).

---

## Testing with cURL

### Create Request
```bash
curl -X POST http://localhost:8000/api/submit-request/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: [token]" \
  -d '{
    "applicant_name": "John Doe",
    "applicant_phone": "+255 712 345 678",
    "category": "TUITION",
    "amount_requested": 5000
  }' \
  --cookie "sessionid=[session]"
```

### Get Dashboard Stats
```bash
curl -X GET "http://localhost:8000/api/dashboard-stats/" \
  --cookie "sessionid=[session]"
```

### Export as CSV
```bash
curl -X GET "http://localhost:8000/export/requests-csv/?status=APPROVED" \
  --cookie "sessionid=[session]" \
  -o requests.csv
```

---

## Webhooks (Future Enhancement)

Planned webhook support for:
- `request.created` - New request submitted
- `request.approved` - Request approved
- `request.rejected` - Request rejected
- `request.paid` - Payment processed
- `invitation.created` - New event created
- `invitation.confirmed` - Attendance confirmed

---

## API Versioning

Current version: **v1.0** (implied)

Future versions will be prefixed: `/api/v2/`, `/api/v3/`, etc.

---

**Last Updated**: March 6, 2026
**API Status**: ✅ Production Ready
**Documentation Version**: 1.0

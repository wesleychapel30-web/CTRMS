"""
Email template initialization
Create default email notification templates
"""
from django.core.management.base import BaseCommand
from core.notifications import NotificationTemplate


class Command(BaseCommand):
    help = 'Initialize email notification templates'

    def handle(self, *args, **options):
        templates = [
            {
                'name': 'Request Submitted',
                'template_type': 'REQUEST_SUBMITTED',
                'subject': 'Request Submitted - {request_id}',
                'html_content': '''
                <html>
                    <body style="font-family: Arial, sans-serif;">
                        <h2>Request Submission Confirmation</h2>
                        <p>Dear {applicant_name},</p>
                        <p>Your request has been successfully submitted to Chakou Trust.</p>
                        <p><strong>Request Details:</strong></p>
                        <ul>
                            <li>Request ID: {request_id}</li>
                            <li>Amount: {amount}</li>
                            <li>Category: {category}</li>
                        </ul>
                        <p>You will receive updates as your request is processed. The approval process typically takes 3-5 business days.</p>
                        <p>Best regards,<br/>Chakou Trust Team</p>
                    </body>
                </html>
                ''',
                'plain_text_content': '''Request Submission Confirmation

Dear {applicant_name},

Your request has been successfully submitted to Chakou Trust.

Request Details:
- Request ID: {request_id}
- Amount: {amount}
- Category: {category}

You will receive updates as your request is processed. The approval process typically takes 3-5 business days.

Best regards,
Chakou Trust Team'''
            },
            {
                'name': 'Request Approved',
                'template_type': 'REQUEST_APPROVED',
                'subject': 'Your Request Has Been Approved - {request_id}',
                'html_content': '''
                <html>
                    <body style="font-family: Arial, sans-serif;">
                        <h2>Request Approval Notification</h2>
                        <p>Dear {applicant_name},</p>
                        <p>Great news! Your request has been approved.</p>
                        <p><strong>Approval Details:</strong></p>
                        <ul>
                            <li>Request ID: {request_id}</li>
                            <li>Approved Amount: {approved_amount}</li>
                            <li>Notes: {approval_notes}</li>
                        </ul>
                        <p>Payment processing will begin shortly. You will receive a separate confirmation once the funds are disbursed.</p>
                        <p>Best regards,<br/>Chakou Trust Team</p>
                    </body>
                </html>
                ''',
                'plain_text_content': '''Request Approval Notification

Dear {applicant_name},

Great news! Your request has been approved.

Approval Details:
- Request ID: {request_id}
- Approved Amount: {approved_amount}
- Notes: {approval_notes}

Payment processing will begin shortly. You will receive a separate confirmation once the funds are disbursed.

Best regards,
Chakou Trust Team'''
            },
            {
                'name': 'Request Rejected',
                'template_type': 'REQUEST_REJECTED',
                'subject': 'Update on Your Request - {request_id}',
                'html_content': '''
                <html>
                    <body style="font-family: Arial, sans-serif;">
                        <h2>Request Status Update</h2>
                        <p>Dear {applicant_name},</p>
                        <p>We regret to inform you that your request has been reviewed and cannot be approved at this time.</p>
                        <p><strong>Request Details:</strong></p>
                        <ul>
                            <li>Request ID: {request_id}</li>
                            <li>Reason: {reason}</li>
                        </ul>
                        <p>If you believe this is an error or would like to appeal this decision, please contact our support team.</p>
                        <p>Best regards,<br/>Chakou Trust Team</p>
                    </body>
                </html>
                ''',
                'plain_text_content': '''Request Status Update

Dear {applicant_name},

We regret to inform you that your request has been reviewed and cannot be approved at this time.

Request Details:
- Request ID: {request_id}
- Reason: {reason}

If you believe this is an error or would like to appeal this decision, please contact our support team.

Best regards,
Chakou Trust Team'''
            },
            {
                'name': 'Payment Processed',
                'template_type': 'PAYMENT_PROCESSED',
                'subject': 'Payment Confirmation - {request_id}',
                'html_content': '''
                <html>
                    <body style="font-family: Arial, sans-serif;">
                        <h2>Payment Confirmation</h2>
                        <p>Dear {applicant_name},</p>
                        <p>Your payment has been successfully processed.</p>
                        <p><strong>Payment Details:</strong></p>
                        <ul>
                            <li>Request ID: {request_id}</li>
                            <li>Amount: {amount}</li>
                            <li>Payment Date: {payment_date}</li>
                            <li>Reference: {reference}</li>
                        </ul>
                        <p>The funds should appear in your account within 1-3 business days.</p>
                        <p>Best regards,<br/>Chakou Trust Team</p>
                    </body>
                </html>
                ''',
                'plain_text_content': '''Payment Confirmation

Dear {applicant_name},

Your payment has been successfully processed.

Payment Details:
- Request ID: {request_id}
- Amount: {amount}
- Payment Date: {payment_date}
- Reference: {reference}

The funds should appear in your account within 1-3 business days.

Best regards,
Chakou Trust Team'''
            },
            {
                'name': 'Approval Required',
                'template_type': 'APPROVAL_REQUIRED',
                'subject': 'New Request Awaiting Review - {request_id}',
                'html_content': '''
                <html>
                    <body style="font-family: Arial, sans-serif;">
                        <h2>Request Review Required</h2>
                        <p>A new request requires your approval.</p>
                        <p><strong>Request Details:</strong></p>
                        <ul>
                            <li>Request ID: {request_id}</li>
                            <li>Applicant: {applicant_name}</li>
                            <li>Amount: {amount}</li>
                            <li>Category: {category}</li>
                            <li>Submitted: {submitted_date}</li>
                        </ul>
                        <p>Please log in to the system to review and approve/reject this request.</p>
                        <p>Best regards,<br/>CTRMS System</p>
                    </body>
                </html>
                ''',
                'plain_text_content': '''Request Review Required

A new request requires your approval.

Request Details:
- Request ID: {request_id}
- Applicant: {applicant_name}
- Amount: {amount}
- Category: {category}
- Submitted: {submitted_date}

Please log in to the system to review and approve/reject this request.

Best regards,
CTRMS System'''
            },
            {
                'name': 'Event Invitation',
                'template_type': 'EVENT_INVITATION',
                'subject': 'You are invited: {event_name}',
                'html_content': '''
                <html>
                    <body style="font-family: Arial, sans-serif;">
                        <h2>Event Invitation</h2>
                        <p>You are cordially invited to attend:</p>
                        <p><strong>{event_name}</strong></p>
                        <p><strong>Event Details:</strong></p>
                        <ul>
                            <li>Date & Time: {event_date}</li>
                            <li>Location: {location}</li>
                            <li>Description: {description}</li>
                        </ul>
                        <p>Please RSVP through the system to confirm your attendance.</p>
                        <p>Best regards,<br/>Chakou Trust Team</p>
                    </body>
                </html>
                ''',
                'plain_text_content': '''Event Invitation

You are cordially invited to attend:

{event_name}

Event Details:
- Date & Time: {event_date}
- Location: {location}
- Description: {description}

Please RSVP through the system to confirm your attendance.

Best regards,
Chakou Trust Team'''
            },
            {
                'name': 'Event Reminder',
                'template_type': 'EVENT_REMINDER',
                'subject': 'Reminder: {event_name} is coming up',
                'html_content': '''
                <html>
                    <body style="font-family: Arial, sans-serif;">
                        <h2>Event Reminder</h2>
                        <p>This is a friendly reminder about the upcoming event:</p>
                        <p><strong>{event_name}</strong></p>
                        <p><strong>Event Details:</strong></p>
                        <ul>
                            <li>Date & Time: {event_date}</li>
                            <li>Location: {location}</li>
                        </ul>
                        <p>We hope to see you there!</p>
                        <p>Best regards,<br/>Chakou Trust Team</p>
                    </body>
                </html>
                ''',
                'plain_text_content': '''Event Reminder

This is a friendly reminder about the upcoming event:

{event_name}

Event Details:
- Date & Time: {event_date}
- Location: {location}

We hope to see you there!

Best regards,
Chakou Trust Team'''
            },
            {
                'name': 'Payment Reminder',
                'template_type': 'REMINDER_PAYMENT',
                'subject': 'Payment Reminder - {request_id}',
                'html_content': '''
                <html>
                    <body style="font-family: Arial, sans-serif;">
                        <h2>Payment Reminder</h2>
                        <p>Dear {applicant_name},</p>
                        <p>This is a reminder that your approved request is awaiting payment.</p>
                        <p><strong>Details:</strong></p>
                        <ul>
                            <li>Request ID: {request_id}</li>
                            <li>Amount: {amount}</li>
                            <li>Days Since Approval: {days_since_approval}</li>
                        </ul>
                        <p>Payment is being processed. Thank you for your patience.</p>
                        <p>Best regards,<br/>Chakou Trust Team</p>
                    </body>
                </html>
                ''',
                'plain_text_content': '''Payment Reminder

Dear {applicant_name},

This is a reminder that your approved request is awaiting payment.

Details:
- Request ID: {request_id}
- Amount: {amount}
- Days Since Approval: {days_since_approval}

Payment is being processed. Thank you for your patience.

Best regards,
Chakou Trust Team'''
            }
        ]
        
        for template_data in templates:
            obj, created = NotificationTemplate.objects.get_or_create(
                template_type=template_data['template_type'],
                defaults={
                    'name': template_data['name'],
                    'subject': template_data['subject'],
                    'html_content': template_data['html_content'],
                    'plain_text_content': template_data['plain_text_content'],
                }
            )
            
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'Created template: {template_data["name"]}')
                )
            else:
                self.stdout.write(f'Template already exists: {template_data["name"]}')
        
        self.stdout.write(self.style.SUCCESS('Email templates initialized successfully!'))

"""
Workflow Automation Engine
Handles automated workflows, transitions, and business logic
"""
from django.db import models
from django.db.models import Q
from django.utils.timezone import now
from requests.models import Request
from invitations.models import Invitation
from core.models import AuditLog, User
from django.core.mail import send_mail
from django.conf import settings
import json
from enum import Enum


class WorkflowAction(models.Model):
    """Model for workflow action definitions"""
    
    TRIGGER_CHOICES = [
        ('REQUEST_CREATED', 'Request Created'),
        ('REQUEST_APPROVED', 'Request Approved'),
        ('REQUEST_REJECTED', 'Request Rejected'),
        ('REQUEST_PAID', 'Request Paid'),
        ('EVENT_CREATED', 'Event Created'),
        ('DAILY_SCHEDULE', 'Daily Schedule'),
        ('WEEKLY_SCHEDULE', 'Weekly Schedule'),
        ('THRESHOLD_REACHED', 'Budget Threshold Reached'),
        ('OVERDUE_PAYMENT', 'Overdue Payment'),
    ]
    
    ACTION_CHOICES = [
        ('SEND_EMAIL', 'Send Email'),
        ('SEND_SMS', 'Send SMS'),
        ('UPDATE_STATUS', 'Update Status'),
        ('ASSIGN_REVIEWER', 'Assign Reviewer'),
        ('CREATE_REMINDER', 'Create Reminder'),
        ('GENERATE_REPORT', 'Generate Report'),
        ('ESCALATE', 'Escalate'),
        ('ARCHIVE', 'Archive'),
    ]
    
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    trigger = models.CharField(max_length=50, choices=TRIGGER_CHOICES)
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    condition = models.JSONField(default=dict, blank=True)  # JSON condition
    target_users = models.JSONField(default=list, blank=True)  # List of user roles/IDs
    email_template = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.name} - {self.trigger}"
    
    class Meta:
        db_table = 'workflow_action'
        ordering = ['trigger', 'name']


class WorkflowExecution(models.Model):
    """Track workflow executions"""
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('RUNNING', 'Running'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
    ]
    
    workflow_action = models.ForeignKey(WorkflowAction, on_delete=models.CASCADE)
    trigger_object_type = models.CharField(max_length=50)  # Request, Invitation, etc
    trigger_object_id = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    result = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    executed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.workflow_action.name} - {self.status}"
    
    class Meta:
        db_table = 'workflow_execution'
        ordering = ['-created_at']


class WorkflowEngine:
    """Main workflow automation engine"""
    
    def __init__(self):
        self.executions = []
    
    def trigger_workflow(self, trigger_type, obj_type, obj_id, context=None):
        """
        Trigger workflows based on event type
        
        Args:
            trigger_type: The trigger event (e.g., REQUEST_CREATED)
            obj_type: Type of object (Request, Invitation, etc)
            obj_id: ID of the object
            context: Additional context data
        """
        try:
            # Get all active workflows for this trigger
            workflows = WorkflowAction.objects.filter(
                trigger=trigger_type,
                is_active=True
            )
            
            for workflow in workflows:
                # Check conditions
                if self._check_condition(workflow, obj_type, obj_id, context):
                    # Execute workflow
                    self._execute_workflow(workflow, obj_type, obj_id, context)
        
        except Exception as e:
            print(f"Error triggering workflow: {e}")
    
    def _check_condition(self, workflow, obj_type, obj_id, context):
        """Check if workflow conditions are met"""
        if not workflow.condition:
            return True
        
        try:
            # Get the object
            if obj_type == 'Request':
                obj = Request.objects.get(id=obj_id)
            elif obj_type == 'Invitation':
                obj = Invitation.objects.get(id=obj_id)
            else:
                return True
            
            # Check conditions
            for key, value in workflow.condition.items():
                if key == 'status' and hasattr(obj, 'status'):
                    if obj.status != value:
                        return False
                elif key == 'category' and hasattr(obj, 'category'):
                    if obj.category != value:
                        return False
                elif key == 'amount_threshold' and hasattr(obj, 'amount_requested'):
                    if obj.amount_requested < float(value):
                        return False
            
            return True
        
        except Exception as e:
            print(f"Error checking condition: {e}")
            return False
    
    def _execute_workflow(self, workflow, obj_type, obj_id, context):
        """Execute the workflow action"""
        execution = WorkflowExecution.objects.create(
            workflow_action=workflow,
            trigger_object_type=obj_type,
            trigger_object_id=obj_id,
            status='RUNNING'
        )
        
        try:
            if workflow.action == 'SEND_EMAIL':
                self._send_email_action(workflow, obj_type, obj_id, context)
            elif workflow.action == 'UPDATE_STATUS':
                self._update_status_action(workflow, obj_type, obj_id, context)
            elif workflow.action == 'ASSIGN_REVIEWER':
                self._assign_reviewer_action(workflow, obj_type, obj_id)
            elif workflow.action == 'CREATE_REMINDER':
                self._create_reminder_action(workflow, obj_type, obj_id)
            elif workflow.action == 'ESCALATE':
                self._escalate_action(workflow, obj_type, obj_id)
            
            execution.status = 'SUCCESS'
            execution.executed_at = now()
            execution.save()
        
        except Exception as e:
            execution.status = 'FAILED'
            execution.error_message = str(e)
            execution.executed_at = now()
            execution.save()
            print(f"Workflow execution failed: {e}")
    
    def _send_email_action(self, workflow, obj_type, obj_id, context):
        """Send email action"""
        try:
            if obj_type == 'Request':
                obj = Request.objects.get(id=obj_id)
                recipient = obj.applicant_email
            elif obj_type == 'Invitation':
                obj = Invitation.objects.get(id=obj_id)
                recipient = context.get('recipient_email', '')
            else:
                return
            
            # Simple email - in production, use templates
            if workflow.trigger == 'REQUEST_CREATED':
                subject = "Request Submitted Successfully"
                message = f"Your request has been submitted. Request ID: {obj.request_id if hasattr(obj, 'request_id') else obj_id}"
            elif workflow.trigger == 'REQUEST_APPROVED':
                subject = "Request Approved"
                message = f"Your request has been approved!"
            elif workflow.trigger == 'REQUEST_REJECTED':
                subject = "Request Status Update"
                message = f"Your request status has been updated."
            else:
                return
            
            # Log email action (in production, actually send email)
            print(f"Email would be sent to {recipient}: {subject}")
        
        except Exception as e:
            raise Exception(f"Email action failed: {e}")
    
    def _update_status_action(self, workflow, obj_type, obj_id, context):
        """Update object status action"""
        try:
            new_status = context.get('new_status') if context else None
            if not new_status:
                return
            
            if obj_type == 'Request':
                obj = Request.objects.get(id=obj_id)
                obj.status = new_status
                obj.save()
        
        except Exception as e:
            raise Exception(f"Status update failed: {e}")
    
    def _assign_reviewer_action(self, workflow, obj_type, obj_id):
        """Assign reviewer action"""
        try:
            if obj_type == 'Request':
                obj = Request.objects.get(id=obj_id)
                
                reviewer = (
                    User.objects.filter(is_active=True)
                    .filter(Q(role=User.Role.DIRECTOR) | Q(role_assignments__role__key=User.Role.DIRECTOR))
                    .distinct()
                    .first()
                )
                
                if reviewer:
                    obj.reviewed_by = reviewer
                    obj.status = Request.Status.UNDER_REVIEW
                    obj.save()
        
        except Exception as e:
            raise Exception(f"Assign reviewer failed: {e}")
    
    def _create_reminder_action(self, workflow, obj_type, obj_id):
        """Create reminder action"""
        try:
            # This would typically create a Reminder model
            print(f"Reminder created for {obj_type} {obj_id}")
        
        except Exception as e:
            raise Exception(f"Create reminder failed: {e}")
    
    def _escalate_action(self, workflow, obj_type, obj_id):
        """Escalate action"""
        try:
            if obj_type == 'Request':
                obj = Request.objects.get(id=obj_id)
                escalation_note = "\n[Escalated by workflow engine]"
                if escalation_note not in obj.review_notes:
                    obj.review_notes = f"{obj.review_notes}{escalation_note}".strip()
                obj.save()
        
        except Exception as e:
            raise Exception(f"Escalate failed: {e}")


class AutoApprovalWorkflow:
    """Automatic approval workflow for low-value requests"""
    
    MIN_AUTO_APPROVE = 5000  # Minimum for auto-approval
    MAX_AUTO_APPROVE = 50000  # Maximum for auto-approval
    
    @staticmethod
    def check_auto_approval(request_obj):
        """Check if request meets auto-approval criteria"""
        try:
            # Criteria for auto-approval
            if request_obj.amount_requested < AutoApprovalWorkflow.MIN_AUTO_APPROVE:
                return False
            
            if request_obj.amount_requested > AutoApprovalWorkflow.MAX_AUTO_APPROVE:
                return False
            
            if request_obj.category not in [Request.Category.TUITION, Request.Category.MEDICAL]:
                return False
            
            return True
        
        except Exception as e:
            print(f"Error checking auto-approval: {e}")
            return False
    
    @staticmethod
    def auto_approve(request_obj, approver):
        """Automatically approve a request"""
        try:
            if not approver:
                return False
            is_director = (
                approver.role == User.Role.DIRECTOR
                or approver.role_assignments.filter(role__key=User.Role.DIRECTOR).exists()
            )
            if not is_director:
                return False
            request_obj.status = Request.Status.APPROVED
            request_obj.approved_amount = request_obj.amount_requested
            request_obj.reviewed_by = approver
            request_obj.reviewed_at = now()
            request_obj.review_notes = "Auto-approved by system workflow"
            request_obj.save()
            
            # Log action
            AuditLog.objects.create(
                user=approver,
                action_type=AuditLog.ActionType.APPROVE,
                content_type='Request',
                object_id=str(request_obj.id),
                ip_address='127.0.0.1',
                description=f"Auto-approved {request_obj.request_id} via workflow"
            )
            
            return True
        
        except Exception as e:
            print(f"Auto-approval failed: {e}")
            return False


class PaymentReminderWorkflow:
    """Automated payment reminder workflow"""
    
    REMINDER_DAYS = [1, 3, 7, 14]  # Reminder days after payment date
    
    @staticmethod
    def send_payment_reminders():
        """Send reminders for unpaid approved requests"""
        try:
            approved_unpaid = Request.objects.filter(
                status=Request.Status.APPROVED,
                reviewed_at__isnull=False
            )
            
            for req in approved_unpaid:
                days_since_approval = (now().date() - req.reviewed_at.date()).days
                
                if days_since_approval in PaymentReminderWorkflow.REMINDER_DAYS:
                    # Send reminder
                    print(f"Payment reminder sent for {req.request_id}")
        
        except Exception as e:
            print(f"Error sending payment reminders: {e}")


# Global workflow engine instance
workflow_engine = WorkflowEngine()

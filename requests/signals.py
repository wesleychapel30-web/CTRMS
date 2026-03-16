"""
Django signals for Request and Invitation models
Triggers workflows and notifications on status changes
"""
from django.db.models.signals import post_save, pre_save
from django.db.models import Q
from django.dispatch import receiver
from requests.models import Request
from invitations.models import Invitation
from core.workflows import workflow_engine
from core.notifications import EmailNotificationService
from core.models import User


@receiver(post_save, sender=Request)
def request_post_save(sender, instance, created, **kwargs):
    """
    Signal handler for Request model save
    Triggers workflows and notifications
    """
    try:
        if created:
            # Request created - trigger workflow
            workflow_engine.trigger_workflow(
                'REQUEST_CREATED',
                'Request',
                str(instance.id),
                {'request_obj': instance}
            )
            
            # Send confirmation email
            EmailNotificationService.send_request_submitted(instance)

            # Director-only approval policy: never auto-approve and never set reviewed_by automatically.
            # Notify all active directors (fallback to first active user with an email).
            directors = list(
                User.objects.filter(is_active=True)
                .filter(Q(role=User.Role.DIRECTOR) | Q(role_assignments__role__key=User.Role.DIRECTOR))
                .exclude(email="")
                .values_list("email", flat=True)
                .distinct()
            )
            if directors:
                for email in directors:
                    EmailNotificationService.send_approval_required_alert(instance, email)
            else:
                fallback = User.objects.filter(is_active=True).exclude(email="").first()
                if fallback and fallback.email:
                    EmailNotificationService.send_approval_required_alert(instance, fallback.email)
        
        else:
            previous_status = getattr(instance, '_previous_status', None)
            if previous_status and previous_status != instance.status:
                if instance.status == Request.Status.APPROVED:
                    workflow_engine.trigger_workflow(
                        'REQUEST_APPROVED',
                        'Request',
                        str(instance.id),
                        {'request_obj': instance}
                    )
                    EmailNotificationService.send_request_approved(instance)

                elif instance.status == Request.Status.REJECTED:
                    workflow_engine.trigger_workflow(
                        'REQUEST_REJECTED',
                        'Request',
                        str(instance.id),
                        {'request_obj': instance}
                    )
                    EmailNotificationService.send_request_rejected(instance)

                elif instance.status in {Request.Status.PARTIALLY_PAID, Request.Status.PAID}:
                    workflow_engine.trigger_workflow(
                        'REQUEST_PAID',
                        'Request',
                        str(instance.id),
                        {'request_obj': instance}
                    )
                    EmailNotificationService.send_payment_processed(instance)
    
    except Exception as e:
        print(f"Error in request_post_save signal: {e}")


@receiver(post_save, sender=Invitation)
def invitation_post_save(sender, instance, created, **kwargs):
    """
    Signal handler for Invitation model save
    Triggers workflows and notifications
    """
    try:
        if created:
            # Event created - trigger workflow
            workflow_engine.trigger_workflow(
                'EVENT_CREATED',
                'Invitation',
                str(instance.id),
                {'event_obj': instance}
            )
            
            # Send event invitation emails
            # In production, would send to actual attendees
            print(f"Event created: {instance.event_title}")
    
    except Exception as e:
        print(f"Error in invitation_post_save signal: {e}")


@receiver(pre_save, sender=Request)
def request_pre_save(sender, instance, **kwargs):
    if instance.pk:
        try:
            instance._previous_status = Request.objects.get(pk=instance.pk).status
        except Request.DoesNotExist:
            instance._previous_status = None


# Register signals (do this in apps.py ready() method)

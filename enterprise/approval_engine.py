from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .models import (
    ApprovalDecision,
    ApprovalHistoryEntry,
    ApprovalInstance,
    ApprovalWorkflowTemplate,
)


class ApprovalEngineError(ValueError):
    """Raised when a shared enterprise approval action is invalid."""


ENTRY_TONE_BY_EVENT = {
    ApprovalHistoryEntry.EventType.REGISTERED: "info",
    ApprovalHistoryEntry.EventType.SUBMITTED: "info",
    ApprovalHistoryEntry.EventType.COMMENT: "warning",
    ApprovalHistoryEntry.EventType.APPROVED: "success",
    ApprovalHistoryEntry.EventType.REJECTED: "danger",
    ApprovalHistoryEntry.EventType.REVERTED: "warning",
    ApprovalHistoryEntry.EventType.STEP_ADVANCED: "warning",
    ApprovalHistoryEntry.EventType.COMPLETED: "success",
}


def _actor_name(actor) -> str:
    if not actor:
        return "System"
    return actor.get_full_name() or actor.username or "System"


def get_latest_approval_instance(*, target_type: str, target_id, statuses: list[str] | None = None):
    queryset = ApprovalInstance.objects.filter(target_type=target_type, target_id=target_id)
    if statuses:
        queryset = queryset.filter(status__in=statuses)
    return queryset.order_by("-submitted_at", "-created_at").first()


def _active_workflow(*, organization, module_key: str, required: bool = True):
    workflow = (
        ApprovalWorkflowTemplate.objects.filter(
            organization=organization,
            module_key=module_key,
            is_active=True,
        )
        .prefetch_related("steps__role")
        .order_by("created_at")
        .first()
    )
    if workflow is None and required:
        raise ApprovalEngineError(f"No active approval workflow is configured for {module_key}.")
    return workflow


def has_active_workflow(*, organization, module_key: str) -> bool:
    return _active_workflow(organization=organization, module_key=module_key, required=False) is not None


def _eligible_steps(*, organization, module_key: str, amount: Decimal):
    workflow = _active_workflow(organization=organization, module_key=module_key, required=True)
    eligible_steps = []
    for step in workflow.steps.all().order_by("sequence"):
        if step.minimum_amount is not None and amount < step.minimum_amount:
            continue
        if step.maximum_amount is not None and amount > step.maximum_amount:
            continue
        eligible_steps.append(step)
    if not eligible_steps:
        raise ApprovalEngineError("The configured approval workflow has no steps for this amount.")
    return workflow, eligible_steps


def create_approval_history_entry(
    *,
    instance: ApprovalInstance,
    event_type: str,
    title: str,
    actor=None,
    body: str = "",
    step=None,
    old_status: str = "",
    new_status: str = "",
):
    return ApprovalHistoryEntry.objects.create(
        instance=instance,
        event_type=event_type,
        title=title,
        actor=actor,
        body=body or "",
        step=step,
        old_status=old_status or "",
        new_status=new_status or "",
    )


def serialize_approval_history(instance: ApprovalInstance | None) -> list[dict[str, str | None]]:
    if instance is None:
        return []
    entries = instance.history_entries.select_related("actor", "step").order_by("-created_at")
    serialized = []
    for entry in entries:
        status_text = ""
        if entry.old_status or entry.new_status:
            if entry.old_status and entry.new_status:
                status_text = f"{entry.old_status} -> {entry.new_status}"
            else:
                status_text = entry.new_status or entry.old_status
        serialized.append(
            {
                "id": str(entry.id),
                "label": entry.get_event_type_display(),
                "title": entry.title,
                "actor_name": _actor_name(entry.actor),
                "created_at": entry.created_at.isoformat(),
                "body": entry.body or "",
                "status_text": status_text or None,
                "tone": ENTRY_TONE_BY_EVENT.get(entry.event_type, "neutral"),
            }
        )
    return serialized


def get_pending_decision(instance: ApprovalInstance | None):
    if instance is None:
        return None
    return (
        instance.decisions.select_related("step", "step__role")
        .filter(status=ApprovalDecision.DecisionStatus.PENDING)
        .order_by("step__sequence")
        .first()
    )


@transaction.atomic
def register_record_for_approval(
    *,
    organization,
    module_key: str,
    target_type: str,
    target_id,
    actor,
    amount: Decimal,
    submission_note: str = "",
):
    workflow, eligible_steps = _eligible_steps(
        organization=organization,
        module_key=module_key,
        amount=Decimal(str(amount or "0.00")),
    )
    instance = ApprovalInstance.objects.create(
        organization=organization,
        workflow=workflow,
        target_type=target_type,
        target_id=target_id,
        current_step=eligible_steps[0].sequence,
        submitted_by=actor,
    )
    ApprovalDecision.objects.bulk_create(
        [
            ApprovalDecision(
                instance=instance,
                step=step,
                status=ApprovalDecision.DecisionStatus.PENDING,
            )
            for step in eligible_steps
        ]
    )
    create_approval_history_entry(
        instance=instance,
        event_type=ApprovalHistoryEntry.EventType.REGISTERED,
        title="Approval workflow registered",
        actor=actor,
        body=submission_note,
        new_status=ApprovalInstance.Status.PENDING,
    )
    create_approval_history_entry(
        instance=instance,
        event_type=ApprovalHistoryEntry.EventType.SUBMITTED,
        title="Submitted for approval",
        actor=actor,
        body=submission_note,
        new_status=ApprovalInstance.Status.PENDING,
    )
    return instance


@transaction.atomic
def approve_record_step(instance: ApprovalInstance, *, actor, comments: str = ""):
    if instance.status != ApprovalInstance.Status.PENDING:
        raise ApprovalEngineError("Only pending approval records can be approved.")

    pending_decision = get_pending_decision(instance)
    if pending_decision is None:
        raise ApprovalEngineError("This approval record has no pending step.")

    pending_decision.status = ApprovalDecision.DecisionStatus.APPROVED
    pending_decision.actor = actor
    pending_decision.comments = comments
    pending_decision.decided_at = timezone.now()
    pending_decision.save(update_fields=["status", "actor", "comments", "decided_at", "updated_at"])

    create_approval_history_entry(
        instance=instance,
        step=pending_decision.step,
        event_type=ApprovalHistoryEntry.EventType.APPROVED,
        title=f"Approved at {pending_decision.step.name}",
        actor=actor,
        body=comments,
        old_status=ApprovalInstance.Status.PENDING,
        new_status=ApprovalInstance.Status.PENDING,
    )

    next_decision = get_pending_decision(instance)
    if next_decision:
        instance.current_step = next_decision.step.sequence
        instance.save(update_fields=["current_step", "updated_at"])
        create_approval_history_entry(
            instance=instance,
            step=next_decision.step,
            event_type=ApprovalHistoryEntry.EventType.STEP_ADVANCED,
            title=f"Moved to {next_decision.step.name}",
            actor=actor,
            body=f"Awaiting {next_decision.step.role.name if next_decision.step.role else 'configured approver'} action.",
            old_status=ApprovalInstance.Status.PENDING,
            new_status=ApprovalInstance.Status.PENDING,
        )
    else:
        old_status = instance.status
        instance.status = ApprovalInstance.Status.APPROVED
        instance.completed_at = timezone.now()
        instance.save(update_fields=["status", "completed_at", "updated_at"])
        create_approval_history_entry(
            instance=instance,
            event_type=ApprovalHistoryEntry.EventType.COMPLETED,
            title="Approval workflow completed",
            actor=actor,
            old_status=old_status,
            new_status=ApprovalInstance.Status.APPROVED,
        )
    return pending_decision, next_decision


@transaction.atomic
def reject_record_step(instance: ApprovalInstance, *, actor, comments: str = ""):
    if instance.status != ApprovalInstance.Status.PENDING:
        raise ApprovalEngineError("Only pending approval records can be rejected.")

    pending_decision = get_pending_decision(instance)
    if pending_decision is None:
        raise ApprovalEngineError("This approval record has no pending step.")

    pending_decision.status = ApprovalDecision.DecisionStatus.REJECTED
    pending_decision.actor = actor
    pending_decision.comments = comments
    pending_decision.decided_at = timezone.now()
    pending_decision.save(update_fields=["status", "actor", "comments", "decided_at", "updated_at"])

    old_status = instance.status
    instance.status = ApprovalInstance.Status.REJECTED
    instance.completed_at = timezone.now()
    instance.save(update_fields=["status", "completed_at", "updated_at"])
    create_approval_history_entry(
        instance=instance,
        step=pending_decision.step,
        event_type=ApprovalHistoryEntry.EventType.REJECTED,
        title=f"Rejected at {pending_decision.step.name}",
        actor=actor,
        body=comments,
        old_status=old_status,
        new_status=ApprovalInstance.Status.REJECTED,
    )
    return pending_decision


@transaction.atomic
def revert_record_step(instance: ApprovalInstance, *, actor, comments: str = ""):
    latest_decision = (
        instance.decisions.select_related("step")
        .exclude(status=ApprovalDecision.DecisionStatus.PENDING)
        .order_by("-step__sequence", "-decided_at")
        .first()
    )
    if latest_decision is None:
        raise ApprovalEngineError("This approval record has no decision to revert.")

    old_status = instance.status
    latest_decision.status = ApprovalDecision.DecisionStatus.PENDING
    latest_decision.actor = None
    latest_decision.comments = ""
    latest_decision.decided_at = None
    latest_decision.save(update_fields=["status", "actor", "comments", "decided_at", "updated_at"])

    instance.status = ApprovalInstance.Status.PENDING
    instance.current_step = latest_decision.step.sequence
    instance.completed_at = None
    instance.save(update_fields=["status", "current_step", "completed_at", "updated_at"])

    create_approval_history_entry(
        instance=instance,
        step=latest_decision.step,
        event_type=ApprovalHistoryEntry.EventType.REVERTED,
        title=f"Reverted to {latest_decision.step.name}",
        actor=actor,
        body=comments,
        old_status=old_status,
        new_status=ApprovalInstance.Status.PENDING,
    )
    return latest_decision


def add_approval_comment(instance: ApprovalInstance, *, actor, body: str):
    text = (body or "").strip()
    if not text:
        raise ApprovalEngineError("Approval comment body is required.")
    return create_approval_history_entry(
        instance=instance,
        event_type=ApprovalHistoryEntry.EventType.COMMENT,
        title="Approval comment added",
        actor=actor,
        body=text,
        old_status=instance.status,
        new_status=instance.status,
    )

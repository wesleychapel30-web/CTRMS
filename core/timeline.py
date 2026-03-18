from __future__ import annotations

from typing import Iterable

from core.models import RecordTimelineEntry, User
from core.rbac import user_has_permission, user_has_role


TIMELINE_INTERNAL_ROLES = {User.Role.ADMIN, User.Role.DIRECTOR}


ENTRY_LABELS = {
    RecordTimelineEntry.EntryType.STATUS_CHANGE: "Status Change",
    RecordTimelineEntry.EntryType.INTERNAL_NOTE: "Internal Note",
    RecordTimelineEntry.EntryType.DIRECTOR_COMMENT: "Director Comment",
    RecordTimelineEntry.EntryType.ADMIN_NOTE: "Admin Note",
    RecordTimelineEntry.EntryType.APPROVAL_ACTION: "Approval Action",
    RecordTimelineEntry.EntryType.REVERT_ACTION: "Revert Action",
    RecordTimelineEntry.EntryType.PAYMENT_ACTION: "Payment Action",
    RecordTimelineEntry.EntryType.SYSTEM_EVENT: "System Event",
}


def can_view_internal_timeline(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return (
        user_has_permission(user, "audit:view")
        or user_has_role(user, User.Role.ADMIN)
        or user_has_role(user, User.Role.DIRECTOR)
    )


def can_compose_timeline_entry(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return user_has_role(user, User.Role.ADMIN) or user_has_role(user, User.Role.DIRECTOR)


def _actor_name(actor) -> str:
    if not actor:
        return "System"
    return actor.get_full_name() or actor.username or "System"


def _label_for_entry(entry: RecordTimelineEntry) -> str:
    if entry.request_id:
        if entry.entry_type == RecordTimelineEntry.EntryType.PAYMENT_ACTION:
            return "Payment Action"
        if entry.entry_type in {
            RecordTimelineEntry.EntryType.DIRECTOR_COMMENT,
            RecordTimelineEntry.EntryType.ADMIN_NOTE,
            RecordTimelineEntry.EntryType.INTERNAL_NOTE,
        }:
            return "Request Note"
        return "Request Status"
    if entry.invitation_id:
        if entry.entry_type in {
            RecordTimelineEntry.EntryType.DIRECTOR_COMMENT,
            RecordTimelineEntry.EntryType.ADMIN_NOTE,
            RecordTimelineEntry.EntryType.INTERNAL_NOTE,
        }:
            return "Invitation Note"
        return "Invitation Status"
    return ENTRY_LABELS.get(entry.entry_type, "Record Update")


def serialize_timeline_entry(entry: RecordTimelineEntry) -> dict[str, object]:
    return {
        "id": str(entry.id),
        "entry_type": entry.entry_type,
        "label": _label_for_entry(entry),
        "actor_name": _actor_name(entry.actor),
        "title": entry.title,
        "body": entry.body,
        "old_status": entry.old_status,
        "new_status": entry.new_status,
        "is_internal": entry.is_internal,
        "created_at": entry.created_at,
    }


def serialize_timeline_entries(entries: Iterable[RecordTimelineEntry]) -> list[dict[str, object]]:
    return [serialize_timeline_entry(entry) for entry in entries]


def get_request_timeline_entries(request_obj, viewer):
    queryset = request_obj.timeline_entries.select_related("actor").order_by("-created_at")
    if not can_view_internal_timeline(viewer):
        queryset = queryset.filter(is_internal=False)
    return queryset


def get_invitation_timeline_entries(invitation_obj, viewer):
    queryset = invitation_obj.timeline_entries.select_related("actor").order_by("-created_at")
    if not can_view_internal_timeline(viewer):
        queryset = queryset.filter(is_internal=False)
    return queryset


def create_request_timeline_entry(
    *,
    request_obj,
    entry_type: str,
    actor=None,
    title: str,
    body: str = "",
    old_status: str = "",
    new_status: str = "",
    is_internal: bool = False,
):
    try:
        return RecordTimelineEntry.objects.create(
            request=request_obj,
            actor=actor,
            entry_type=entry_type,
            title=title,
            body=body or "",
            old_status=old_status or "",
            new_status=new_status or "",
            is_internal=is_internal,
        )
    except Exception:
        return None


def create_invitation_timeline_entry(
    *,
    invitation_obj,
    entry_type: str,
    actor=None,
    title: str,
    body: str = "",
    old_status: str = "",
    new_status: str = "",
    is_internal: bool = False,
):
    try:
        return RecordTimelineEntry.objects.create(
            invitation=invitation_obj,
            actor=actor,
            entry_type=entry_type,
            title=title,
            body=body or "",
            old_status=old_status or "",
            new_status=new_status or "",
            is_internal=is_internal,
        )
    except Exception:
        return None


def create_record_comment(*, request_obj=None, invitation_obj=None, actor, body: str, internal: bool = False):
    text = (body or "").strip()
    if not text:
        return None

    if internal:
        entry_type = RecordTimelineEntry.EntryType.INTERNAL_NOTE
        title = "Internal note logged"
    elif user_has_role(actor, User.Role.DIRECTOR):
        entry_type = RecordTimelineEntry.EntryType.DIRECTOR_COMMENT
        title = "Director comment added"
    else:
        entry_type = RecordTimelineEntry.EntryType.ADMIN_NOTE
        title = "Admin comment added"

    payload = {
        "entry_type": entry_type,
        "actor": actor,
        "title": title,
        "body": text,
        "is_internal": internal,
    }
    if request_obj is not None:
        return create_request_timeline_entry(request_obj=request_obj, **payload)
    if invitation_obj is not None:
        return create_invitation_timeline_entry(invitation_obj=invitation_obj, **payload)
    return None

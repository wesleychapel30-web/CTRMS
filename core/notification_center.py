from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Sequence

from django.db.models import Q
from django.db import transaction
from django.utils import timezone

from core.models import Notification, NotificationReceipt, User


@dataclass(frozen=True)
class NotificationPayload:
    kind: str
    title: str
    message: str
    href: str | None = None


def get_recipients_for_roles(roles: Sequence[str]) -> Iterable[User]:
    role_keys = [role for role in roles if role]
    if not role_keys:
        return User.objects.none()
    try:
        return (
            User.objects.filter(is_active=True)
            .filter(Q(role__in=role_keys) | Q(role_assignments__role__key__in=role_keys))
            .distinct()
        )
    except Exception:
        # Backward compatibility before user_role migration.
        return User.objects.filter(role__in=role_keys, is_active=True).distinct()


@transaction.atomic
def notify_users(
    *,
    recipients: Iterable[User],
    payload: NotificationPayload,
    created_by: User | None = None,
) -> Notification:
    notification = Notification.objects.create(
        kind=payload.kind,
        title=payload.title,
        message=payload.message,
        href=payload.href or "",
        created_by=created_by,
    )

    receipts = []
    for user in recipients:
        receipts.append(NotificationReceipt(user=user, notification=notification))
    if receipts:
        NotificationReceipt.objects.bulk_create(receipts, ignore_conflicts=True)

    return notification


def mark_receipt_read(*, receipt: NotificationReceipt) -> NotificationReceipt:
    if receipt.is_read:
        return receipt
    receipt.is_read = True
    receipt.read_at = timezone.now()
    receipt.save(update_fields=["is_read", "read_at"])
    return receipt

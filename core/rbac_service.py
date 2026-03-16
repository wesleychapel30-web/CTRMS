from __future__ import annotations

from collections.abc import Iterable

from django.core.exceptions import ValidationError
from django.db import transaction

from core.models import ROLE_LIMITS, RoleDefinition, User, UserRole, active_user_count_for_role
from core.rbac_defaults import seed_rbac_defaults


STAFF_CAPABLE_ROLES = {User.Role.ADMIN, User.Role.DIRECTOR, User.Role.IT_ADMIN}


def normalize_role_keys(role_keys: Iterable[str]) -> set[str]:
    return {str(role).strip() for role in role_keys if str(role).strip()}


def ensure_defined_roles(role_keys: Iterable[str]) -> set[str]:
    seed_rbac_defaults()
    normalized = normalize_role_keys(role_keys)
    if not normalized:
        return set()
    defined = set(RoleDefinition.objects.filter(key__in=normalized).values_list("key", flat=True))
    missing = sorted(normalized - defined)
    if missing:
        raise ValidationError(f"Unknown role key(s): {', '.join(missing)}")
    return defined


def ensure_role_capacity(role_keys: Iterable[str], *, exclude_user_id=None) -> None:
    for role_key in normalize_role_keys(role_keys):
        limit = ROLE_LIMITS.get(role_key)
        if limit is None:
            continue
        current = active_user_count_for_role(role_key, exclude_user_id=exclude_user_id)
        if current >= limit:
            raise ValidationError(f"Maximum {limit} active users are allowed for role {role_key}.")


def get_user_additional_role_keys(user: User) -> set[str]:
    if not user.pk:
        return set()
    return set(
        user.role_assignments.select_related("role").values_list("role__key", flat=True)
    )


def get_user_role_keys(user: User) -> set[str]:
    role_keys = {(user.role or "").strip()} if getattr(user, "role", "") else set()
    role_keys.update(get_user_additional_role_keys(user))
    return {key for key in role_keys if key}


def user_has_any_staff_role(role_keys: Iterable[str]) -> bool:
    normalized = normalize_role_keys(role_keys)
    return any(key in STAFF_CAPABLE_ROLES for key in normalized)


@transaction.atomic
def sync_user_roles(
    *,
    user: User,
    primary_role: str,
    additional_roles: Iterable[str] | None = None,
    is_active: bool | None = None,
    actor: User | None = None,
) -> User:
    desired_primary = str(primary_role or "").strip()
    if not desired_primary:
        raise ValidationError("Primary role is required.")

    valid_primary_roles = {choice[0] for choice in User.Role.choices}
    if desired_primary not in valid_primary_roles:
        raise ValidationError(f"Role must be one of: {', '.join(sorted(valid_primary_roles))}")

    additional = normalize_role_keys(additional_roles or [])
    additional.discard(desired_primary)

    ensure_defined_roles({desired_primary, *additional})

    desired_roles = {desired_primary, *additional}
    active_state = user.is_active if is_active is None else bool(is_active)
    if active_state:
        ensure_role_capacity(desired_roles, exclude_user_id=user.pk)

    user.role = desired_primary
    if is_active is not None:
        user.is_active = bool(is_active)
    user.is_staff = user_has_any_staff_role(desired_roles)
    user.save()

    existing_assignments = {
        assignment.role.key: assignment
        for assignment in user.role_assignments.select_related("role").all()
    }
    desired_assignments = additional

    to_remove = [assignment.id for key, assignment in existing_assignments.items() if key not in desired_assignments]
    if to_remove:
        UserRole.objects.filter(id__in=to_remove).delete()

    to_add = sorted(desired_assignments - set(existing_assignments.keys()))
    if to_add:
        role_map = {role.key: role for role in RoleDefinition.objects.filter(key__in=to_add)}
        for key in to_add:
            UserRole.objects.create(user=user, role=role_map[key], created_by=actor)

    return user

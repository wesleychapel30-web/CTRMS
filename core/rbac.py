from __future__ import annotations

from collections.abc import Callable, Iterable
from functools import wraps

from django.http import JsonResponse
from rest_framework import permissions

from core.models import Permission, RoleDefinition, RolePermission, User, UserRole

_seed_attempted = False
STAFF_RESTRICTED_PERMISSION_KEYS = {
    "document:view_own",
    "request:create",
    "request:update_own",
    "request:upload_own",
    "request:view_own",
    "profile:change_password",
}


def _ensure_rbac_seeded() -> None:
    global _seed_attempted
    if _seed_attempted:
        return
    try:
        # Seed lazily and idempotently so default roles, permissions, and policy-bound
        # mappings exist without overwriting customized role-permission assignments.
        from core.rbac_defaults import seed_rbac_defaults

        seed_rbac_defaults()
        _seed_attempted = True
    except Exception:
        # Migrations might not have run yet, or DB may be unavailable.
        # Do not mark as attempted so we can retry later.
        _seed_attempted = False
        return None


def get_user_permission_keys(user: User) -> set[str]:
    """
    Return permission keys for a user based on primary + additional role assignments.

    Notes:
    - Primary role is stored in User.role for backward compatibility.
    - Additional roles are stored in UserRole.
    - Role definitions + permission mappings are stored in DB.
    """
    _ensure_rbac_seeded()
    if not user or not user.is_authenticated:
        return set()
    if getattr(user, "is_superuser", False):
        return set(Permission.objects.values_list("key", flat=True))

    role_keys = get_user_role_keys(user)
    if not role_keys:
        return set()

    permission_keys = set(
        RolePermission.objects.filter(role__key__in=role_keys)
        .select_related("permission")
        .values_list("permission__key", flat=True)
    )

    # Strict staff policy: staff-only accounts are request-status/details viewers.
    # Additional roles still grant broader permissions as mapped.
    if role_keys == {User.Role.STAFF}:
        return permission_keys.intersection(STAFF_RESTRICTED_PERMISSION_KEYS)

    return permission_keys


def get_user_role_keys(user: User) -> set[str]:
    """Return all role keys for a user (primary role + additional assignments)."""
    _ensure_rbac_seeded()
    if not user or not user.is_authenticated:
        return set()

    keys = {(getattr(user, "role", "") or "").strip()}
    if getattr(user, "pk", None):
        try:
            prefetched = getattr(user, "_prefetched_objects_cache", {}).get("role_assignments")
            if prefetched is not None:
                keys.update(
                    (getattr(getattr(assignment, "role", None), "key", "") or "").strip()
                    for assignment in prefetched
                )
            else:
                keys.update(
                    UserRole.objects.filter(user=user)
                    .select_related("role")
                    .values_list("role__key", flat=True)
                )
        except Exception:
            # UserRole table may not exist yet before migrations.
            pass

    normalized = {key for key in keys if key}
    if not normalized:
        return set()

    # Keep only role keys that exist in RoleDefinition.
    try:
        defined = set(RoleDefinition.objects.filter(key__in=normalized).values_list("key", flat=True))
    except Exception:
        return normalized
    return defined


def user_has_role(user: User, role_key: str) -> bool:
    if not role_key:
        return False
    return role_key in get_user_role_keys(user)


def user_has_permission(user: User, permission_key: str) -> bool:
    if not permission_key:
        return False
    return permission_key in get_user_permission_keys(user)


def user_has_any_permission(user: User, permission_keys: Iterable[str]) -> bool:
    keys = set(permission_keys or [])
    if not keys:
        return False
    user_keys = get_user_permission_keys(user)
    return any(key in user_keys for key in keys)


def require_permission(permission_key: str) -> Callable:
    """Decorator for Django function-based views that return JSON."""

    def decorator(view_func: Callable) -> Callable:
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            if not request.user or not request.user.is_authenticated:
                return JsonResponse({"success": False, "error": "Unauthorized"}, status=401)
            if not user_has_permission(request.user, permission_key):
                return JsonResponse({"success": False, "error": "Forbidden"}, status=403)
            return view_func(request, *args, **kwargs)

        return wrapped

    return decorator


def require_any_permission(permission_keys: Iterable[str]) -> Callable:
    """Decorator for Django function-based views requiring any of the given keys."""

    keys = list(permission_keys or [])

    def decorator(view_func: Callable) -> Callable:
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            if not request.user or not request.user.is_authenticated:
                return JsonResponse({"success": False, "error": "Unauthorized"}, status=401)
            if not user_has_any_permission(request.user, keys):
                return JsonResponse({"success": False, "error": "Forbidden"}, status=403)
            return view_func(request, *args, **kwargs)

        return wrapped

    return decorator


def drf_permission_required(permission_key: str):
    """Factory: create a DRF permission class for a single permission key."""

    class HasPermissionKey(permissions.BasePermission):
        message = "Forbidden"

        def has_permission(self, request, view):
            return bool(request.user and request.user.is_authenticated and user_has_permission(request.user, permission_key))

    return HasPermissionKey


def drf_any_permission_required(permission_keys: Iterable[str]):
    """Factory: create a DRF permission class requiring any of the given keys."""

    keys = list(permission_keys or [])

    class HasAnyPermissionKey(permissions.BasePermission):
        message = "Forbidden"

        def has_permission(self, request, view):
            if not request.user or not request.user.is_authenticated:
                return False
            return user_has_any_permission(request.user, keys)

    return HasAnyPermissionKey

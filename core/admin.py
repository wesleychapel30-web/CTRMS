from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from .models import AuditLog, Permission, RoleDefinition, RolePermission, User, UserRole


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin interface for custom User model"""
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Personal info'), {'fields': ('first_name', 'last_name', 'phone', 'address')}),
        (_('Role & Department'), {'fields': ('role', 'department', 'is_active_staff')}),
        (_('Account Lifecycle'), {'fields': ('is_active', 'is_archived', 'force_password_change')}),
        (_('Permissions'), {'fields': ('is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        (_('Important dates'), {'fields': ('last_login', 'date_joined', 'created_at', 'updated_at')}),
    )
    
    list_display = ('username', 'email', 'get_full_name', 'role', 'is_active', 'is_archived', 'force_password_change')
    list_filter = ('role', 'is_staff', 'is_superuser', 'is_active', 'is_archived', 'force_password_change', 'is_active_staff', 'date_joined')
    search_fields = ('username', 'first_name', 'last_name', 'email', 'phone')
    ordering = ('-date_joined',)
    
    readonly_fields = ('created_at', 'updated_at', 'last_login', 'date_joined')
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'password1', 'password2', 'role'),
        }),
    )


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Admin interface for AuditLog model"""
    
    list_display = ('id', 'user', 'action_type', 'content_type', 'created_at', 'ip_address')
    list_filter = ('action_type', 'content_type', 'created_at', 'user')
    search_fields = ('user__username', 'object_id', 'description', 'ip_address')
    readonly_fields = ('id', 'user', 'action_type', 'content_type', 'object_id', 'description', 
                       'ip_address', 'user_agent', 'created_at')
    
    ordering = ('-created_at',)
    
    def has_add_permission(self, request):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(RoleDefinition)
class RoleDefinitionAdmin(admin.ModelAdmin):
    list_display = ("key", "name", "created_at")
    search_fields = ("key", "name")
    ordering = ("key",)


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("key", "name", "module", "created_at")
    list_filter = ("module",)
    search_fields = ("key", "name", "description")
    ordering = ("module", "key")


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ("role", "permission", "created_at")
    list_filter = ("role", "permission__module")
    search_fields = ("role__key", "permission__key", "permission__name")
    ordering = ("role__key", "permission__key")


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "created_by", "created_at")
    list_filter = ("role",)
    search_fields = ("user__username", "user__email", "role__key")
    ordering = ("-created_at",)

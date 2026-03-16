from rest_framework import serializers
from core.models import User, AuditLog


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'role', 
                 'phone', 'department', 'is_active_staff', 'is_active', 'is_archived', 'force_password_change', 'created_at')
        read_only_fields = ('id', 'created_at')


class UserDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for User model"""
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'role', 
                 'phone', 'address', 'department', 'is_active_staff', 
                 'is_active', 'is_archived', 'force_password_change',
                 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for AuditLog model"""
    
    user_username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = ('id', 'user', 'user_username', 'action_type', 'content_type', 
                 'object_id', 'description', 'ip_address', 'created_at')
        read_only_fields = ('id', 'created_at')

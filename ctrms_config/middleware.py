import logging
from django.utils.deprecation import MiddlewareMixin
from core.models import AuditLog, User

logger = logging.getLogger('audit')


class AuditLoggingMiddleware(MiddlewareMixin):
    """Middleware to log user actions for audit trail"""
    
    EXCLUDED_PATHS = ['/admin/', '/static/', '/media/', '/api/token/', '/health/']
    
    def process_request(self, request):
        """Log request details"""
        request._audit_start = True
        return None
    
    def process_response(self, request, response):
        """Log user actions to audit trail"""
        if not getattr(request, '_audit_start', False):
            return response
        
        # Skip excluded paths
        if any(request.path.startswith(path) for path in self.EXCLUDED_PATHS):
            return response
        
        # Only log for authenticated users
        if not request.user or not request.user.is_authenticated:
            return response
        
        try:
            # Only log state-changing operations. Logging every GET floods the audit trail and
            # makes it hard for non-technical users to read.
            method = request.method
            status_code = response.status_code

            if not (200 <= status_code < 300):
                return response

            if method == 'POST':
                action_type = AuditLog.ActionType.CREATE
            elif method in {'PUT', 'PATCH'}:
                action_type = AuditLog.ActionType.UPDATE
            elif method == 'DELETE':
                action_type = AuditLog.ActionType.DELETE
            else:
                return response
            
            # Get user IP address
            ip_address = self._get_client_ip(request)
            
            # Extract content type from path
            path_parts = request.path.strip('/').split('/')
            content_type = path_parts[1] if len(path_parts) > 1 else 'unknown'
            
            # Log the action
            AuditLog.objects.create(
                user=request.user,
                action_type=action_type,
                content_type=content_type,
                object_id=path_parts[2] if len(path_parts) > 2 else '',
                description="",
                ip_address=ip_address,
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
            )
        except Exception as e:
            logger.error(f"Failed to log audit trail: {str(e)}")
        
        return response
    
    @staticmethod
    def _get_client_ip(request):
        """Extract client IP address from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

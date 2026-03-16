from django.apps import AppConfig


class InvitationsConfig(AppConfig):
    name = 'invitations'
    
    def ready(self):
        """Register signals when app is ready"""
        import requests.signals  # noqa


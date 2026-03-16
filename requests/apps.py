from django.apps import AppConfig


class RequestsConfig(AppConfig):
    name = 'requests'
    
    def ready(self):
        """Register signals when app is ready"""
        import requests.signals  # noqa


from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import RequestDocumentViewSet, RequestViewSet

router = DefaultRouter()
router.register(r'requests', RequestViewSet, basename='request')
router.register(r'documents', RequestDocumentViewSet, basename='document')

urlpatterns = [
    path('api/', include(router.urls)),
]

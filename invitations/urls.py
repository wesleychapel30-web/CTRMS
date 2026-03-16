from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InvitationAttachmentViewSet, InvitationViewSet

router = DefaultRouter()
router.register(r'invitations', InvitationViewSet, basename='invitation')
router.register(r'invitation-attachments', InvitationAttachmentViewSet, basename='invitation-attachment')

urlpatterns = [
    path('api/', include(router.urls)),
]

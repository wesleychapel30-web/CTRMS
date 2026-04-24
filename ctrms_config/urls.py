"""
URL configuration for ctrms_config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.urls import re_path

from core.spa_views import FrontendAppView, FrontendAssetView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('core.urls')),
    path('', include('requests.urls')),
    path('', include('invitations.urls')),
    path('', include('enterprise.urls')),
    path('assets/<path:path>', FrontendAssetView.as_view(), name='frontend_asset'),
    re_path(r'^(?!api/|admin/|media/|static/|assets/|export/).*$' , FrontendAppView.as_view(), name='frontend_app'),
]

# Serve uploaded media files when configured. Static assets are handled by WhiteNoise.
if settings.SERVE_MEDIA:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

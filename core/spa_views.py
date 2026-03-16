from pathlib import Path
import mimetypes

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse
from django.views import View


class FrontendAppView(View):
    """Serve the built React single-page application."""

    def get(self, request, *args, **kwargs):
        index_path = Path(settings.FRONTEND_DIST_ROOT) / 'index.html'
        if not index_path.exists():
            raise Http404('Frontend build not found. Run `npm run build` in frontend/.')

        return HttpResponse(index_path.read_text(encoding='utf-8'), content_type='text/html')


class FrontendAssetView(View):
    """Serve Vite-built assets from frontend/dist/assets with safe caching headers."""

    def get(self, request, path, *args, **kwargs):
        assets_root = Path(settings.FRONTEND_ASSETS_ROOT).resolve()
        file_path = (assets_root / path).resolve()

        if assets_root not in file_path.parents:
            raise Http404('Asset not found')

        if not file_path.exists() or not file_path.is_file():
            raise Http404('Asset not found')

        content_type, _encoding = mimetypes.guess_type(str(file_path))
        response = FileResponse(open(file_path, 'rb'), content_type=content_type or 'application/octet-stream')

        # Vite uses hashed filenames; cache safely in production.
        if not settings.DEBUG:
            response['Cache-Control'] = 'public, max-age=31536000, immutable'

        return response

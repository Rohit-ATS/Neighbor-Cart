"""Production entry point for the Neighbor Cart API and static React bundle."""

from __future__ import annotations

import mimetypes
import os
from http import HTTPStatus
from pathlib import Path
from urllib.parse import urlsplit

from api.app import BoundedThreadingHTTPServer, DEFAULT_DB_PATH, Database, make_handler

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"


def make_application():
    api_handler = make_handler(Database(os.environ.get("NEIGHBOR_CART_DB_PATH") or DEFAULT_DB_PATH))

    class Application(api_handler):
        def do_GET(self):
            if urlsplit(self.path).path.startswith("/api/") or urlsplit(self.path).path == "/healthz":
                return super().do_GET()
            requested = urlsplit(self.path).path.lstrip("/") or "index.html"
            candidate = (DIST / requested).resolve()
            if not candidate.is_relative_to(DIST.resolve()) or not candidate.is_file():
                candidate = DIST / "index.html"
            try:
                content = candidate.read_bytes()
            except OSError:
                return self.send_json(HTTPStatus.NOT_FOUND, {"error": "Frontend build not found"})
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", mimetypes.guess_type(candidate.name)[0] or "application/octet-stream")
            self.send_header("Content-Length", str(len(content)))
            # Vite fingerprints everything under /assets/, so those are safe to
            # cache forever. index.html must not be, or a deploy never reaches
            # anyone still holding the old one.
            if requested.startswith("assets/"):
                self.send_header("Cache-Control", "public, max-age=31536000, immutable")
            elif candidate.name == "index.html":
                self.send_header("Cache-Control", "no-cache")
            else:
                self.send_header("Cache-Control", "public, max-age=86400")
            self.end_headers()
            self.wfile.write(content)

    return Application


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    server = BoundedThreadingHTTPServer(("0.0.0.0", port), make_application())
    print(f"Neighbor Cart listening on http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

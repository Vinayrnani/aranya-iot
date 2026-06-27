"""
Gemini Live API - Ephemeral Token Server

Serves the frontend static files and provisions ephemeral tokens
for client-to-server WebSocket connections to Gemini Live API.

Uses direct REST API calls (no google-genai SDK dependency required).
"""

import os
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

from aiohttp import web, ClientSession
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).parent / "frontend"
API_KEY = os.environ.get("GEMINI_API_KEY", "")

if not API_KEY:
    logger.warning(
        "GEMINI_API_KEY not set. "
        "Copy .env.example to .env and add your key."
    )

# Gemini API endpoints
GEMINI_BASE = "https://generativelanguage.googleapis.com"
TOKEN_ENDPOINT = f"{GEMINI_BASE}/v1alpha/auth_tokens"

# Default model
DEFAULT_MODEL = "gemini-3.1-flash-live-preview"


async def handle_index(request: web.Request) -> web.Response:
    """Serve the main HTML page."""
    index_path = FRONTEND_DIR / "index.html"
    if not index_path.exists():
        return web.Response(text="Frontend not found", status=404)
    return web.FileResponse(index_path)


async def handle_static(request: web.Request) -> web.Response:
    """Serve static frontend files (JS, CSS, JSON)."""
    filename = request.match_info.get("filename", "")
    filepath = FRONTEND_DIR / filename

    if not filepath.exists() or not filepath.is_file():
        return web.Response(text="File not found", status=404)

    ext = filepath.suffix.lower()
    content_types = {
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".html": "text/html",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
    }
    content_type = content_types.get(ext, "application/octet-stream")
    return web.FileResponse(filepath, headers={"Content-Type": content_type})


async def handle_token(request: web.Request) -> web.Response:
    """
    Provision an ephemeral token for the Live API via direct REST call.

    POST /api/token
    Body: { "model": "..." } (optional)
    """
    try:
        body = await request.json() if request.can_read_body else {}
    except Exception:
        body = {}

    model = body.get("model", DEFAULT_MODEL)
    temperature = body.get("temperature", 0.7)

    if not API_KEY:
        return web.json_response(
            {"error": "GEMINI_API_KEY not configured on server"},
            status=500,
        )

    # Build the REST request to the Gemini API
    # The bidiGenerateContentSetup field mirrors the BidiGenerateContentSetup
    # proto fields directly (the SDK strips the 'setup' wrapper internally).
    payload = {
        "uses": 1,
        "bidiGenerateContentSetup": {
            "model": f"models/{model}",
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "temperature": temperature,
            },
            "sessionResumption": {},
        },
    }

    url = f"{TOKEN_ENDPOINT}?key={API_KEY}"

    try:
        async with ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    logger.error(f"Token API error ({resp.status}): {error_text}")
                    return web.json_response(
                        {"error": f"Token API returned {resp.status}"},
                        status=resp.status,
                    )

                data = await resp.json()

        token_name = data.get("name", "")
        expire_time = data.get("expireTime", "")

        if not token_name:
            return web.json_response(
                {"error": "No token in response"},
                status=500,
            )

        logger.info(f"Ephemeral token created: {token_name[:20]}...")

        return web.json_response({
            "token": token_name,
            "model": model,
            "expire_time": expire_time,
        })

    except Exception as e:
        logger.error(f"Failed to create ephemeral token: {e}")
        return web.json_response(
            {"error": f"Failed to create ephemeral token: {str(e)}"},
            status=500,
        )


async def handle_health(request: web.Request) -> web.Response:
    """Health check endpoint."""
    return web.json_response({
        "status": "ok",
        "api_key_configured": bool(API_KEY),
    })


def create_app() -> web.Application:
    app = web.Application()

    # API routes
    app.router.add_post("/api/token", handle_token)
    app.router.add_get("/api/health", handle_health)

    # Static frontend files
    app.router.add_get("/", handle_index)
    app.router.add_get("/{filename:.*}", handle_static)

    return app


def main():
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")

    app = create_app()
    logger.info(f"Viva Voice server starting at http://{host}:{port}")
    web.run_app(app, host=host, port=port)


if __name__ == "__main__":
    main()

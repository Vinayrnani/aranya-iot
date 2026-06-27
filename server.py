"""
Gemini Live API - Ephemeral Token Server

Serves the frontend static files and provisions ephemeral tokens
for client-to-server WebSocket connections to Gemini Live API.

Uses direct REST API calls (no google-genai SDK dependency required).
"""

import os
import json
import logging
import base64
from datetime import datetime, timedelta, timezone
from pathlib import Path

from aiohttp import web, ClientSession
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).parent / "frontend"
CONVERSATIONS_DIR = Path(__file__).parent / "conversations"
SYSTEM_PROMPT_PATH = Path(__file__).parent / "system-prompt.txt"
_DEFAULT_SYSTEM_PROMPT = (
    "You are a helpful multilingual voice assistant. "
    "Understand English, Hindi, and Telugu. "
    "Always respond in the language the user speaks."
)
CONVERSATIONS_DIR.mkdir(exist_ok=True)
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


def load_system_prompt() -> str:
    """Read the system prompt from system-prompt.txt, with live-reload on every read."""
    try:
        if SYSTEM_PROMPT_PATH.exists():
            text = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8").strip()
            if text:
                return text
    except Exception as exc:
        logger.warning(f"Failed to read system-prompt.txt: {exc}")
    return _DEFAULT_SYSTEM_PROMPT


async def handle_index(request: web.Request) -> web.Response:
    """Serve the main HTML page."""
    index_path = FRONTEND_DIR / "index.html"
    if not index_path.exists():
        return web.Response(text="Frontend not found", status=404)
    return web.FileResponse(index_path)


async def handle_static(request: web.Request) -> web.Response:
    """Serve static frontend files (JS, CSS, JSON, and index fallback)."""
    # Get filename from route match_info or derive from request path
    filename = request.match_info.get("filename", "")
    if not filename:
        # Extract filename from path (e.g., "/app.js" -> "app.js")
        path = request.path
        if path.startswith("/"):
            path = path[1:]
        filename = path

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
            "systemPrompt": load_system_prompt(),
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


# ─── Conversation History (for E2E replay tests) ────────────────────────────


async def handle_save_conversation(request: web.Request) -> web.Response:
    """
    Save a recorded conversation to disk for replay testing.

    POST /api/conversations/save
    Body: {
        "id": "conv_...",
        "timestamp": 1234567890,
        "language": "te",
        "voice": "Kore",
        "inputTranscript": "...",
        "outputTranscript": "...",
        "inputPCM_b64": "...",    # base64-encoded PCM 16kHz
        "outputPCM_b64": "...",   # base64-encoded PCM 24kHz
    }
    """
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)

    conv_id = body.get("id", f"conv_{int(datetime.now().timestamp() * 1000)}")
    conv_dir = CONVERSATIONS_DIR / conv_id
    conv_dir.mkdir(exist_ok=True)

    # Save manifest
    manifest = {
        "id": conv_id,
        "timestamp": body.get("timestamp", 0),
        "language": body.get("language", "en"),
        "voice": body.get("voice", "Kore"),
        "inputTranscript": body.get("inputTranscript", ""),
        "outputTranscript": body.get("outputTranscript", ""),
        "inputSampleRate": 16000,
        "outputSampleRate": 24000,
    }

    with open(conv_dir / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    # Save audio
    input_b64 = body.get("inputPCM_b64", "")
    if input_b64:
        try:
            pcm_data = base64.b64decode(input_b64)
            with open(conv_dir / "input.pcm", "wb") as f:
                f.write(pcm_data)
            manifest["inputAudioSize"] = len(pcm_data)
        except Exception as e:
            logger.warning(f"Failed to decode input audio: {e}")

    output_b64 = body.get("outputPCM_b64", "")
    if output_b64:
        try:
            pcm_data = base64.b64decode(output_b64)
            with open(conv_dir / "output.pcm", "wb") as f:
                f.write(pcm_data)
            manifest["outputAudioSize"] = len(pcm_data)
        except Exception as e:
            logger.warning(f"Failed to decode output audio: {e}")

    # Re-save manifest with size info
    with open(conv_dir / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    logger.info(f"Conversation saved: {conv_id}")
    return web.json_response({"id": conv_id, "status": "saved"})


async def handle_list_conversations(request: web.Request) -> web.Response:
    """
    List saved conversations, newest first.

    GET /api/conversations?limit=12
    Returns list of manifests (no audio data).
    """
    limit = int(request.query.get("limit", 12))

    entries = []
    for conv_dir in sorted(CONVERSATIONS_DIR.iterdir(), reverse=True):
        if not conv_dir.is_dir():
            continue
        manifest_path = conv_dir / "manifest.json"
        if not manifest_path.exists():
            continue
        try:
            with open(manifest_path) as f:
                manifest = json.load(f)
            entries.append(manifest)
        except Exception:
            continue

        if len(entries) >= limit:
            break

    return web.json_response(entries)


async def handle_get_conversation_audio(request: web.Request) -> web.Response:
    """
    Serve a conversation's audio file.

    GET /api/conversations/{id}/{file}   (file = input.pcm | output.pcm)
    """
    conv_id = request.match_info.get("id", "")
    filename = request.match_info.get("filename", "")

    if filename not in ("input.pcm", "output.pcm", "manifest.json"):
        return web.Response(text="Invalid file", status=400)

    filepath = CONVERSATIONS_DIR / conv_id / filename
    if not filepath.exists() or not filepath.is_file():
        return web.Response(text="File not found", status=404)

    content_types = {
        ".pcm": "application/octet-stream",
        ".json": "application/json",
    }
    ext = filepath.suffix.lower()
    content_type = content_types.get(ext, "application/octet-stream")

    return web.FileResponse(filepath, headers={"Content-Type": content_type})


async def handle_delete_conversation(request: web.Request) -> web.Response:
    """
    Delete a saved conversation.

    DELETE /api/conversations/{id}
    """
    conv_id = request.match_info.get("id", "")
    conv_dir = CONVERSATIONS_DIR / conv_id

    if not conv_dir.exists() or not conv_dir.is_dir():
        return web.json_response({"error": "Conversation not found"}, status=404)

    import shutil
    shutil.rmtree(conv_dir)
    logger.info(f"Conversation deleted: {conv_id}")
    return web.json_response({"id": conv_id, "status": "deleted"})


# ─── App Factory ─────────────────────────────────────────────────────────────


def create_app() -> web.Application:
    app = web.Application()

    # API routes
    app.router.add_post("/api/token", handle_token)
    app.router.add_get("/api/health", handle_health)

    # Conversation history routes (for E2E replay)
    app.router.add_post("/api/conversations/save", handle_save_conversation)
    app.router.add_get("/api/conversations", handle_list_conversations)
    app.router.add_get("/api/conversations/{id}/{filename}", handle_get_conversation_audio)
    app.router.add_delete("/api/conversations/{id}", handle_delete_conversation)

    # Static frontend files (individual routes to avoid catch-all conflicts)
    FRONTEND_FILES = [
        "app.js", "audio-handler.js", "audio-worklet-processor.js",
        "conversations.js", "geminilive.js",
        "index.html", "manifest.json", "style.css", "sw.js",
        "favicon.ico", "robots.txt",
    ]
    for f in FRONTEND_FILES:
        app.router.add_get(f"/{f}", handle_static)

    # Catch-all for root path and any unknown frontend routes
    app.router.add_get("/", handle_index)

    return app


def main():
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")

    app = create_app()
    logger.info(f"Viva Voice server starting at http://{host}:{port}")
    web.run_app(app, host=host, port=port)


if __name__ == "__main__":
    main()

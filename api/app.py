"""Small, dependency-free HTTP API for the Neighbor Cart demo.

The server deliberately uses Python's standard library so a local SQLite demo
does not depend on a native Node module.  It is a same-origin API in production
and is proxied by Vite during development.
"""

from __future__ import annotations

import json
import ipaddress
import os
import re
import secrets
import socket
import sqlite3
import threading
import time
import uuid
from collections import defaultdict, deque
from datetime import date, datetime, timedelta, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = ROOT / "data" / "neighbor-cart.db"
SEED_PATH = Path(__file__).resolve().parent / "demo_places.json"
MAX_BODY_BYTES = 64 * 1024
MAX_CONNECTIONS = 32
REQUEST_TIMEOUT_SECONDS = 10
SESSION_RE = re.compile(r"^[A-Za-z0-9_-]{32,128}$")
IDEMPOTENCY_RE = re.compile(r"^[A-Za-z0-9_-]{8,128}$")
HOUSEHOLD_SIZES = {"1 person", "2-3 people", "4-5 people", "6+ people"}
DEFAULT_SLOT_CAPACITY = 12
AI_MAX_MESSAGE = 2000
SESSION_TTL_DAYS = 30
BOOKING_HORIZON_DAYS = 30
MAX_RESERVATIONS_PER_SESSION_PER_DAY = 1
MAX_SESSIONS_PER_NETWORK_PER_DAY = 4
MAX_AI_REQUESTS_PER_NETWORK_PER_MINUTE = 5
MAX_AI_CONCURRENT_REQUESTS = 2
MAX_PLACE_ENRICH_REQUESTS_PER_NETWORK_PER_MINUTE = 20
MAX_ENRICH_PLACES_PER_REQUEST = 12
GOOGLE_TIMEOUT_SECONDS = 6
GOOGLE_CACHE_TTL_SECONDS = 60 * 60 * 6
GOOGLE_DISTANCE_CACHE_TTL_SECONDS = 60 * 30
TRUSTED_PROXY_ADDRESSES = frozenset(
    address.strip() for address in os.environ.get("NEIGHBOR_CART_TRUSTED_PROXY_ADDRESSES", "").split(",") if address.strip()
)


class ApiError(Exception):
    def __init__(self, status: HTTPStatus, message: str):
        self.status = status
        self.message = message
        super().__init__(message)


class SlidingWindowLimiter:
    """Process-local abuse control. Peer addresses are not taken from forwarded headers."""

    def __init__(self):
        self._requests: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, scope: str, subject: str, maximum: int, window_seconds: int) -> bool:
        now = time.monotonic()
        key = (scope, subject)
        with self._lock:
            entries = self._requests[key]
            while entries and entries[0] <= now - window_seconds:
                entries.popleft()
            if len(entries) >= maximum:
                return False
            entries.append(now)
            return True

    def clear(self) -> None:
        """Clear in-memory counters; used only by isolated integration tests."""
        with self._lock:
            self._requests.clear()


class BoundedThreadingHTTPServer(ThreadingHTTPServer):
    """Threaded HTTP server with finite request workers and socket read deadlines."""

    daemon_threads = True
    block_on_close = False

    def __init__(self, server_address, request_handler_class, max_workers=MAX_CONNECTIONS,
                 request_timeout=REQUEST_TIMEOUT_SECONDS):
        super().__init__(server_address, request_handler_class)
        self.request_queue_size = max_workers
        self._worker_slots = threading.BoundedSemaphore(max_workers)
        self.request_timeout = request_timeout

    def process_request(self, request, client_address):
        if not self._worker_slots.acquire(blocking=False):
            request.close()
            return
        try:
            request.settimeout(self.request_timeout)
            super().process_request(request, client_address)
        except Exception:
            self._worker_slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._worker_slots.release()


rate_limiter = SlidingWindowLimiter()
ai_request_slots = threading.BoundedSemaphore(MAX_AI_CONCURRENT_REQUESTS)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class Database:
    """SQLite repository. Connections are thread-local because requests are concurrent."""

    def __init__(self, path: str | Path):
        self.path = str(path)
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._local = threading.local()
        self._connections: list[sqlite3.Connection] = []
        self._conn_lock = threading.Lock()
        self._initialize()

    def connection(self) -> sqlite3.Connection:
        connection = getattr(self._local, "connection", None)
        if connection is None:
            connection = sqlite3.connect(self.path, timeout=5, isolation_level=None)
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA foreign_keys = ON")
            connection.execute("PRAGMA busy_timeout = 5000")
            self._local.connection = connection
            with self._conn_lock:
                self._connections.append(connection)
        return connection

    def close(self) -> None:
        with self._conn_lock:
            for conn in self._connections:
                try:
                    conn.close()
                except Exception:
                    pass
            self._connections.clear()

    def _initialize(self) -> None:
        connection = sqlite3.connect(self.path, timeout=5, isolation_level=None)
        try:
            connection.execute("PRAGMA journal_mode = WAL")
            connection.execute("PRAGMA foreign_keys = ON")
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS locations (
                  id TEXT PRIMARY KEY,
                  name TEXT NOT NULL,
                  category TEXT NOT NULL,
                  accepts_reservations INTEGER NOT NULL CHECK (accepts_reservations IN (0, 1)),
                  data_json TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS locations_category_idx ON locations(category);

                CREATE TABLE IF NOT EXISTS reservations (
                  id TEXT PRIMARY KEY,
                  confirmation_code TEXT NOT NULL UNIQUE,
                  session_id TEXT NOT NULL,
                  idempotency_key TEXT,
                  location_id TEXT NOT NULL REFERENCES locations(id),
                  pickup_date TEXT NOT NULL,
                  time_slot TEXT NOT NULL,
                  household_size TEXT NOT NULL,
                  dietary_json TEXT NOT NULL,
                  needs_curbside INTEGER NOT NULL CHECK (needs_curbside IN (0, 1)),
                  guest_name TEXT NOT NULL,
                  contact TEXT,
                  created_at TEXT NOT NULL,
                  UNIQUE(session_id, idempotency_key)
                );
                CREATE INDEX IF NOT EXISTS reservations_session_idx
                  ON reservations(session_id, created_at DESC);
                CREATE INDEX IF NOT EXISTS reservations_slot_idx
                  ON reservations(location_id, pickup_date, time_slot);

                CREATE TABLE IF NOT EXISTS anonymous_sessions (
                  id TEXT PRIMARY KEY,
                  created_at TEXT NOT NULL,
                  expires_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS anonymous_sessions_expiry_idx
                  ON anonymous_sessions(expires_at);
                """
            )
            self._seed_locations(connection)
        finally:
            connection.close()

    def _seed_locations(self, connection: sqlite3.Connection) -> None:
        if not SEED_PATH.exists():
            raise RuntimeError("Missing API seed data. Run: npm run seed:places")
        places = json.loads(SEED_PATH.read_text(encoding="utf-8"))
        now = utc_now()
        connection.executemany(
            """
            INSERT INTO locations (id, name, category, accepts_reservations, data_json, updated_at)
            VALUES (:id, :name, :type, :acceptsReservations, :data_json, :updated_at)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              category = excluded.category,
              accepts_reservations = excluded.accepts_reservations,
              data_json = excluded.data_json,
              updated_at = excluded.updated_at
            """,
            [
                {
                    "id": place["id"],
                    "name": place["name"],
                    "type": place["type"],
                    "acceptsReservations": int(bool(place.get("acceptsReservations"))),
                    "data_json": json.dumps(place, separators=(",", ":")),
                    "updated_at": now,
                }
                for place in places
            ],
        )

    def locations(self, query: str | None, category: str | None, reservable: bool) -> list[dict]:
        sql = "SELECT data_json FROM locations WHERE 1 = 1"
        values: list[object] = []
        if category and category != "all":
            sql += " AND category = ?"
            values.append(category)
        if reservable:
            sql += " AND accepts_reservations = 1"
        rows = self.connection().execute(sql + " ORDER BY name", values).fetchall()
        places = [json.loads(row["data_json"]) for row in rows]
        if not query:
            return places
        needle = query.casefold().strip()
        return [
            place
            for place in places
            if needle in " ".join(
                [
                    place["name"],
                    place.get("address", ""),
                    place.get("cityStateZip", ""),
                    place.get("neighborhood", ""),
                    *[item.get("item", "") for item in place.get("inventory", [])],
                ]
            ).casefold()
        ]

    def location(self, location_id: str) -> dict:
        row = self.connection().execute(
            "SELECT data_json FROM locations WHERE id = ?", (location_id,)
        ).fetchone()
        if row is None:
            raise ApiError(HTTPStatus.NOT_FOUND, "Location not found")
        return json.loads(row["data_json"])

    def issue_session(self) -> dict:
        session_id = secrets.token_urlsafe(32)
        created_at = utc_now()
        expires_at = (datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)).replace(microsecond=0).isoformat()
        self.connection().execute(
            "INSERT INTO anonymous_sessions (id, created_at, expires_at) VALUES (?, ?, ?)",
            (session_id, created_at, expires_at),
        )
        return {"id": session_id, "expiresAt": expires_at}

    def active_session(self, value: str) -> str:
        if not SESSION_RE.fullmatch(value):
            raise ApiError(HTTPStatus.UNAUTHORIZED, "A valid anonymous device session is required")
        row = self.connection().execute(
            "SELECT id FROM anonymous_sessions WHERE id = ? AND expires_at > ?",
            (value, utc_now()),
        ).fetchone()
        if row is None:
            raise ApiError(HTTPStatus.UNAUTHORIZED, "A valid anonymous device session is required")
        return row["id"]

    def availability(self, location_id: str, pickup_date: str) -> dict:
        location = self.location(location_id)
        if not location.get("acceptsReservations"):
            raise ApiError(HTTPStatus.CONFLICT, "This location does not accept reservations")

        slots = location.get("reservationWindows", [])
        capacity = slot_capacity(location)
        rows = self.connection().execute(
            """
            SELECT time_slot, COUNT(*) AS reserved
            FROM reservations
            WHERE location_id = ? AND pickup_date = ?
            GROUP BY time_slot
            """,
            (location_id, pickup_date),
        ).fetchall()
        reserved_by_slot = {row["time_slot"]: row["reserved"] for row in rows}
        return {
            "locationId": location_id,
            "date": pickup_date,
            "slots": [
                {
                    "timeSlot": time_slot,
                    "capacity": capacity,
                    "reserved": reserved_by_slot.get(time_slot, 0),
                    "available": max(capacity - reserved_by_slot.get(time_slot, 0), 0),
                    "isAvailable": reserved_by_slot.get(time_slot, 0) < capacity,
                }
                for time_slot in slots
            ],
        }

    def create_reservation(self, session_id: str, idempotency_key: str | None, payload: dict) -> dict:
        location_id = require_text(payload, "locationId", 96)
        location = self.location(location_id)
        if not location.get("acceptsReservations"):
            raise ApiError(HTTPStatus.CONFLICT, "This location does not accept reservations")

        pickup_date = require_booking_date(payload.get("pickupDate"))
        time_slot = require_text(payload, "timeSlot", 80)
        if time_slot not in location.get("reservationWindows", []):
            raise ApiError(HTTPStatus.BAD_REQUEST, "Pickup window is not available at this location")
        household_size = require_text(payload, "householdSize", 32)
        if household_size not in HOUSEHOLD_SIZES:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Household size is not valid")
        dietary = require_string_list(payload.get("dietary", []), "dietary", 8, 80)
        needs_curbside = payload.get("needsCurbside", False)
        if not isinstance(needs_curbside, bool):
            raise ApiError(HTTPStatus.BAD_REQUEST, "needsCurbside must be true or false")
        guest_name = optional_text(payload.get("guestName"), "Neighbor Guest", 64)
        contact = optional_text(payload.get("contact"), None, 200)

        # BEGIN IMMEDIATE serializes writes before counting reservations. This makes
        # the capacity check and insert one atomic operation even with concurrent users.
        connection = self.connection()
        connection.execute("BEGIN IMMEDIATE")
        try:
            if idempotency_key:
                existing = connection.execute(
                    "SELECT * FROM reservations WHERE session_id = ? AND idempotency_key = ?",
                    (session_id, idempotency_key),
                ).fetchone()
                if existing:
                    response = reservation_response(existing, self.location(existing["location_id"]))
                    connection.execute("COMMIT")
                    return response

            session_reservations = connection.execute(
                "SELECT COUNT(*) FROM reservations WHERE session_id = ? AND pickup_date = ?",
                (session_id, pickup_date),
            ).fetchone()[0]
            if session_reservations >= MAX_RESERVATIONS_PER_SESSION_PER_DAY:
                raise ApiError(HTTPStatus.TOO_MANY_REQUESTS, "This device already has a pickup reservation for that day")

            capacity = slot_capacity(location)
            reserved = connection.execute(
                """
                SELECT COUNT(*) FROM reservations
                WHERE location_id = ? AND pickup_date = ? AND time_slot = ?
                """,
                (location_id, pickup_date, time_slot),
            ).fetchone()[0]
            if reserved >= capacity:
                raise ApiError(HTTPStatus.CONFLICT, "This pickup window is full. Please choose another time.")

            row = None
            for _ in range(4):
                confirmation_code = "NC-" + "".join(
                    secrets.choice("23456789ABCDEFGHJKLMNPQRSTUVWXYZ") for _ in range(6)
                )
                try:
                    reservation_id = str(uuid.uuid4())
                    connection.execute(
                        """
                        INSERT INTO reservations (
                          id, confirmation_code, session_id, idempotency_key, location_id, pickup_date,
                          time_slot, household_size, dietary_json, needs_curbside, guest_name, contact, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            reservation_id,
                            confirmation_code,
                            session_id,
                            idempotency_key,
                            location_id,
                            pickup_date,
                            time_slot,
                            household_size,
                            json.dumps(dietary),
                            int(needs_curbside),
                            guest_name,
                            contact,
                            utc_now(),
                        ),
                    )
                    row = connection.execute("SELECT * FROM reservations WHERE id = ?", (reservation_id,)).fetchone()
                    break
                except sqlite3.IntegrityError:
                    # A random confirmation-code collision is retried. The idempotency
                    # constraint also protects a client retry with the same request key.
                    if idempotency_key:
                        existing = connection.execute(
                            "SELECT * FROM reservations WHERE session_id = ? AND idempotency_key = ?",
                            (session_id, idempotency_key),
                        ).fetchone()
                        if existing:
                            row = existing
                            break
            if row is None:
                raise ApiError(HTTPStatus.SERVICE_UNAVAILABLE, "Could not issue a pickup pass. Please try again.")
            response = reservation_response(row, location)
            connection.execute("COMMIT")
            return response
        except Exception:
            connection.execute("ROLLBACK")
            raise

    def reservations(self, session_id: str) -> list[dict]:
        rows = self.connection().execute(
            "SELECT * FROM reservations WHERE session_id = ? ORDER BY created_at DESC", (session_id,)
        ).fetchall()
        return [reservation_response(row, self.location(row["location_id"])) for row in rows]


def require_text(payload: dict, field: str, maximum: int) -> str:
    value = payload.get(field)
    if not isinstance(value, str) or not value.strip():
        raise ApiError(HTTPStatus.BAD_REQUEST, f"{field} is required")
    value = value.strip()
    if len(value) > maximum:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"{field} must be at most {maximum} characters")
    return value


def optional_text(value: object, default: str | None, maximum: int) -> str | None:
    if value is None or value == "":
        return default
    if not isinstance(value, str):
        raise ApiError(HTTPStatus.BAD_REQUEST, "Optional text fields must be strings")
    value = value.strip()
    if len(value) > maximum:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"Optional text fields must be at most {maximum} characters")
    return value or default


def require_string_list(value: object, field: str, maximum_items: int, maximum_length: int) -> list[str]:
    if not isinstance(value, list) or len(value) > maximum_items:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"{field} must contain at most {maximum_items} items")
    cleaned = []
    for item in value:
        if not isinstance(item, str) or not item.strip() or len(item.strip()) > maximum_length:
            raise ApiError(HTTPStatus.BAD_REQUEST, f"{field} contains an invalid item")
        cleaned.append(item.strip())
    return cleaned


def require_booking_date(value: object) -> str:
    if not isinstance(value, str):
        raise ApiError(HTTPStatus.BAD_REQUEST, "pickupDate is required")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as error:
        raise ApiError(HTTPStatus.BAD_REQUEST, "pickupDate must use YYYY-MM-DD") from error
    if parsed < date.today():
        raise ApiError(HTTPStatus.BAD_REQUEST, "pickupDate cannot be in the past")
    if parsed > date.today() + timedelta(days=BOOKING_HORIZON_DAYS):
        raise ApiError(HTTPStatus.BAD_REQUEST, f"pickupDate must be within {BOOKING_HORIZON_DAYS} days")
    return parsed.isoformat()


def slot_capacity(location: dict) -> int:
    capacity = location.get("slotCapacity", DEFAULT_SLOT_CAPACITY)
    if isinstance(capacity, int) and not isinstance(capacity, bool) and capacity > 0:
        return capacity
    return DEFAULT_SLOT_CAPACITY


def reservation_response(row: sqlite3.Row, location: dict) -> dict:
    return {
        "id": row["id"],
        "code": row["confirmation_code"],
        "placeId": row["location_id"],
        "placeName": location["name"],
        "address": f"{location['address']}, {location['cityStateZip']}",
        "date": row["pickup_date"],
        "timeSlot": row["time_slot"],
        "householdSize": row["household_size"],
        "dietary": json.loads(row["dietary_json"]),
        "needsCurbside": bool(row["needs_curbside"]),
        "name": row["guest_name"],
        "createdAt": row["created_at"],
    }


def session_id(headers, database: Database) -> str:
    value = headers.get("X-Neighbor-Session", "")
    return database.active_session(value)


def client_identity(handler: BaseHTTPRequestHandler) -> str:
    """Return a rate-limit key, trusting forwarding headers only from configured proxies."""
    peer = handler.client_address[0]
    if peer not in TRUSTED_PROXY_ADDRESSES:
        return peer
    forwarded = handler.headers.get("X-Forwarded-For", "").split(",", 1)[0].strip()
    try:
        return str(ipaddress.ip_address(forwarded))
    except ValueError:
        return peer


def read_json(handler: BaseHTTPRequestHandler) -> dict:
    content_type = handler.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
    if content_type != "application/json":
        raise ApiError(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, "Content-Type must be application/json")
    try:
        length = int(handler.headers.get("Content-Length", ""))
    except ValueError as error:
        raise ApiError(HTTPStatus.BAD_REQUEST, "Content-Length must be an integer") from error
    if length < 1 or length > MAX_BODY_BYTES:
        raise ApiError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "Request body must be between 1 and 65536 bytes")
    try:
        body = json.loads(handler.rfile.read(length))
    except socket.timeout as error:
        raise ApiError(HTTPStatus.REQUEST_TIMEOUT, "Request body timed out") from error
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ApiError(HTTPStatus.BAD_REQUEST, "Request body must be valid JSON") from error
    if not isinstance(body, dict):
        raise ApiError(HTTPStatus.BAD_REQUEST, "Request body must be a JSON object")
    return body


def ai_text(value: object, field: str, maximum: int) -> str:
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > maximum:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"{field} must be a non-empty string up to {maximum} characters")
    return value.strip()


def clean_ai_history(value: object) -> list[dict]:
    if not isinstance(value, list):
        return []
    cleaned = []
    for turn in value[-8:]:
        if not isinstance(turn, dict):
            continue
        role = turn.get("role")
        text = turn.get("text")
        if role in {"user", "assistant"} and isinstance(text, str) and text.strip():
            cleaned.append({"role": role, "content": [{"text": text.strip()[:AI_MAX_MESSAGE]}]})
    return cleaned


def clean_ai_catalog(value: object) -> list[dict]:
    if not isinstance(value, list):
        raise ApiError(HTTPStatus.BAD_REQUEST, "catalog must be a list")
    cleaned = []
    for place in value[:40]:
        if not isinstance(place, dict) or not isinstance(place.get("id"), str) or not isinstance(place.get("name"), str):
            continue
        cleaned.append({
            "id": place["id"][:96],
            "name": place["name"][:120],
            "address": str(place.get("address", ""))[:180],
            "city": str(place.get("city", ""))[:80],
            "services": [str(item)[:80] for item in place.get("services", [])[:8]],
            "dietary": [str(item)[:80] for item in place.get("dietary", [])[:8]],
            "hours": str(place.get("hours", ""))[:180],
        })
    return cleaned


def clean_ai_memory(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip()[:AI_MAX_MESSAGE] for item in value[-12:] if isinstance(item, str) and item.strip()]


def bedrock_chat(payload: dict) -> dict:
    """Call Converse server-side and accept only catalog IDs in the response."""
    message = ai_text(payload.get("message"), "message", AI_MAX_MESSAGE)
    catalog = clean_ai_catalog(payload.get("catalog"))
    memory = clean_ai_memory(payload.get("memory"))
    valid_ids = {place["id"] for place in catalog}
    if not catalog:
        raise ApiError(HTTPStatus.BAD_REQUEST, "catalog must contain at least one verified location")

    try:
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError
    except ImportError as error:
        raise ApiError(HTTPStatus.SERVICE_UNAVAILABLE, "AI service is not installed on this server") from error

    system = (
        "You are HarvestLink's compassionate food access navigator. Answer in plain language. "
        "Only recommend locations from the VERIFIED_CATALOG supplied below. Never invent an address, "
        "hours, inventory, eligibility rule, or availability. Do not make medical or eligibility decisions. "
        "For greetings or general small talk, return an empty placeIds list and warmly ask what food help is needed. "
        "When a customer only shares a requirement (for example a diet, budget, no-car need, language, children, or ID concern) without asking to find or suggest a place, acknowledge that you will remember it and return an empty placeIds list. Recommend locations only after an explicit request to find, show, suggest, or recommend food options. "
        "When the customer asks to find food but has not provided a city, neighborhood, or ZIP code, ask for that location first and return an empty placeIds list rather than guessing. "
        "Return ONLY JSON: {\"reply\":\"...\",\"placeIds\":[\"verified-id\"],\"warning\":\"optional\","
        "\"followUps\":[\"...\"]}. Include at most three place IDs.\n\nVERIFIED_CATALOG:\n"
        + json.dumps(catalog, separators=(",", ":"))
        + "\n\nCUSTOMER_REQUIREMENTS_MEMORY (use these conditions together with the newest message):\n"
        + json.dumps(memory, separators=(",", ":"))
    )
    try:
        client = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        response = client.converse(
            modelId=os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0"),
            system=[{"text": system}],
            messages=[*clean_ai_history(payload.get("history")), {"role": "user", "content": [{"text": message}]}],
            inferenceConfig={"maxTokens": 500, "temperature": 0.25, "topP": 0.9},
        )
        raw = "".join(part.get("text", "") for part in response["output"]["message"]["content"]).strip()
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.IGNORECASE).strip()
        parsed = json.loads(raw)
        if not isinstance(parsed.get("reply"), str) or not parsed["reply"].strip():
            raise ValueError("Bedrock returned no reply")
        return {
            "reply": parsed["reply"].strip()[:1800],
            "placeIds": [place_id for place_id in parsed.get("placeIds", []) if place_id in valid_ids][:3],
            "warning": parsed.get("warning", "")[:400] if isinstance(parsed.get("warning", ""), str) else "",
            "followUps": [item[:120] for item in parsed.get("followUps", [])[:3] if isinstance(item, str)],
        }
    except (BotoCoreError, ClientError, KeyError, ValueError, TypeError, json.JSONDecodeError) as error:
        print(f"Bedrock chat failed: {type(error).__name__}")
        raise ApiError(HTTPStatus.BAD_GATEWAY, "The AI service could not complete that request") from error


class TtlCache:
    """Tiny in-process cache so one person browsing does not re-bill every lookup."""

    def __init__(self, ttl_seconds: int, maximum: int = 512):
        self._ttl = ttl_seconds
        self._maximum = maximum
        self._entries: dict[str, tuple[float, object]] = {}
        self._lock = threading.Lock()

    def get(self, key: str):
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            stored_at, value = entry
            if time.monotonic() - stored_at > self._ttl:
                self._entries.pop(key, None)
                return None
            return value

    def put(self, key: str, value: object) -> None:
        with self._lock:
            if len(self._entries) >= self._maximum:
                oldest = min(self._entries, key=lambda name: self._entries[name][0])
                self._entries.pop(oldest, None)
            self._entries[key] = (time.monotonic(), value)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()


google_details_cache = TtlCache(GOOGLE_CACHE_TTL_SECONDS)
google_distance_cache = TtlCache(GOOGLE_DISTANCE_CACHE_TTL_SECONDS)


def google_key() -> str:
    return os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()


def google_get(path: str, params: dict) -> dict:
    """One Google Maps Platform call. The key never leaves the server."""
    url = f"https://maps.googleapis.com/maps/api/{path}?{urlencode({**params, 'key': google_key()})}"
    with urlopen(url, timeout=GOOGLE_TIMEOUT_SECONDS) as response:  # noqa: S310 - fixed Google host
        body = json.loads(response.read().decode("utf-8"))
    if body.get("status") not in {"OK", "ZERO_RESULTS"}:
        raise ValueError(f"Google replied {body.get('status')}")
    return body


def clean_enrich_places(value: object) -> list[dict]:
    if not isinstance(value, list) or not value:
        raise ApiError(HTTPStatus.BAD_REQUEST, "places must be a non-empty list")
    cleaned = []
    for place in value[:MAX_ENRICH_PLACES_PER_REQUEST]:
        if not isinstance(place, dict) or not isinstance(place.get("id"), str):
            continue
        try:
            latitude = float(place["lat"])
            longitude = float(place["lng"])
        except (KeyError, TypeError, ValueError):
            continue
        if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
            continue
        cleaned.append({
            "id": place["id"][:96],
            "name": str(place.get("name", ""))[:120],
            "address": str(place.get("address", ""))[:180],
            "lat": latitude,
            "lng": longitude,
        })
    if not cleaned:
        raise ApiError(HTTPStatus.BAD_REQUEST, "places must contain valid coordinates")
    return cleaned


def clean_origin(value: object) -> dict | None:
    if not isinstance(value, dict):
        return None
    try:
        latitude = float(value["lat"])
        longitude = float(value["lng"])
    except (KeyError, TypeError, ValueError):
        return None
    if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
        return None
    return {"lat": latitude, "lng": longitude}


def google_place_details(place: dict) -> dict:
    """Rating, review count, and a couple of recent reviews for one location."""
    cache_key = f"{place['id']}|{place['lat']:.5f},{place['lng']:.5f}"
    cached = google_details_cache.get(cache_key)
    if cached is not None:
        return cached

    details: dict = {}
    try:
        found = google_get("place/findplacefromtext/json", {
            "input": f"{place['name']} {place['address']}".strip(),
            "inputtype": "textquery",
            "fields": "place_id",
            "locationbias": f"point:{place['lat']},{place['lng']}",
        })
        candidates = found.get("candidates") or []
        if candidates:
            place_id = candidates[0].get("place_id")
            detail = google_get("place/details/json", {
                "place_id": place_id,
                "fields": "rating,user_ratings_total,reviews,url,opening_hours",
                "reviews_sort": "newest",
            }).get("result") or {}
            details = {
                "placeId": place_id,
                "rating": detail.get("rating"),
                "ratingCount": detail.get("user_ratings_total"),
                "mapsUrl": detail.get("url"),
                "openNow": (detail.get("opening_hours") or {}).get("open_now"),
                "reviews": [
                    {
                        "author": str(review.get("author_name", ""))[:80],
                        "rating": review.get("rating"),
                        "text": str(review.get("text", ""))[:280],
                        "when": str(review.get("relative_time_description", ""))[:60],
                    }
                    for review in (detail.get("reviews") or [])[:2]
                ],
            }
    except (HTTPError, URLError, socket.timeout, ValueError, KeyError, TypeError, json.JSONDecodeError):
        # A missing rating is a cosmetic loss; the verified record still stands.
        details = {}

    google_details_cache.put(cache_key, details)
    return details


def google_distances(origin: dict, places: list[dict], mode: str) -> dict[str, dict]:
    cache_key = f"{mode}|{origin['lat']:.4f},{origin['lng']:.4f}|" + ",".join(place["id"] for place in places)
    cached = google_distance_cache.get(cache_key)
    if cached is not None:
        return cached

    distances: dict[str, dict] = {}
    try:
        body = google_get("distancematrix/json", {
            "origins": f"{origin['lat']},{origin['lng']}",
            "destinations": "|".join(f"{place['lat']},{place['lng']}" for place in places),
            "mode": mode,
            "units": "imperial",
        })
        elements = (body.get("rows") or [{}])[0].get("elements") or []
        for place, element in zip(places, elements):
            if element.get("status") != "OK":
                continue
            distances[place["id"]] = {
                "distanceText": (element.get("distance") or {}).get("text"),
                "distanceMeters": (element.get("distance") or {}).get("value"),
                "durationText": (element.get("duration") or {}).get("text"),
                "durationSeconds": (element.get("duration") or {}).get("value"),
                "travelMode": mode,
            }
    except (HTTPError, URLError, socket.timeout, ValueError, KeyError, TypeError, json.JSONDecodeError):
        distances = {}

    google_distance_cache.put(cache_key, distances)
    return distances


def enrich_places(payload: dict) -> dict:
    """Google ratings, reviews, and travel time for the places the navigator picked.

    Without a key the endpoint still answers, with an empty enrichment map and
    `provider: "none"`, so the UI falls back to straight-line distance rather
    than breaking.
    """
    places = clean_enrich_places(payload.get("places"))
    origin = clean_origin(payload.get("origin"))
    mode = payload.get("mode") if payload.get("mode") in {"driving", "walking", "transit", "bicycling"} else "driving"

    if not google_key():
        return {"provider": "none", "enrichment": {}}

    enrichment = {place["id"]: dict(google_place_details(place)) for place in places}
    if origin:
        for place_id, travel in google_distances(origin, places, mode).items():
            enrichment.setdefault(place_id, {}).update(travel)
    return {"provider": "google", "enrichment": enrichment}


def make_handler(database: Database):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        server_version = "NeighborCartAPI/1.0"
        sys_version = ""

        def log_message(self, _format, *_args):
            return

        def send_json(self, status: HTTPStatus | int, body: dict):
            encoded = json.dumps(body, separators=(",", ":")).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(encoded)

        def do_GET(self):
            try:
                url = urlsplit(self.path)
                query = parse_qs(url.query)
                if url.path == "/healthz" or url.path == "/api/v1/healthz":
                    return self.send_json(HTTPStatus.OK, {"status": "ok", "storage": "sqlite"})
                if url.path == "/api/v1/locations":
                    category = query.get("category", [None])[0]
                    search = query.get("q", [None])[0]
                    reservable = query.get("reservable", ["false"])[0].lower() == "true"
                    return self.send_json(HTTPStatus.OK, {"locations": database.locations(search, category, reservable)})
                availability_match = re.fullmatch(r"/api/v1/locations/([^/]+)/availability", url.path)
                if availability_match:
                    pickup_date = require_booking_date(query.get("date", [None])[0])
                    return self.send_json(
                        HTTPStatus.OK,
                        {"availability": database.availability(availability_match.group(1), pickup_date)},
                    )
                if url.path.startswith("/api/v1/locations/"):
                    return self.send_json(HTTPStatus.OK, {"location": database.location(url.path.rsplit("/", 1)[1])})
                if url.path == "/api/v1/reservations":
                    return self.send_json(
                        HTTPStatus.OK, {"reservations": database.reservations(session_id(self.headers, database))}
                    )
                raise ApiError(HTTPStatus.NOT_FOUND, "Route not found")
            except ApiError as error:
                self.send_json(error.status, {"error": error.message})
            except Exception:
                self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Unexpected server error"})

        def do_POST(self):
            try:
                path = urlsplit(self.path).path
                peer = client_identity(self)
                if path == "/api/v1/sessions":
                    if not rate_limiter.allow("session", peer, MAX_SESSIONS_PER_NETWORK_PER_DAY, 24 * 60 * 60):
                        raise ApiError(HTTPStatus.TOO_MANY_REQUESTS, "Too many anonymous sessions from this network")
                    return self.send_json(HTTPStatus.CREATED, {"session": database.issue_session()})
                if path == "/api/v1/ai/chat":
                    session_id(self.headers, database)
                    payload = read_json(self)
                    if not rate_limiter.allow("ai", peer, MAX_AI_REQUESTS_PER_NETWORK_PER_MINUTE, 60):
                        raise ApiError(HTTPStatus.TOO_MANY_REQUESTS, "AI request limit reached. Please try again shortly.")
                    if not ai_request_slots.acquire(blocking=False):
                        raise ApiError(HTTPStatus.TOO_MANY_REQUESTS, "AI is busy. Please try again shortly.")
                    try:
                        return self.send_json(HTTPStatus.OK, bedrock_chat(payload))
                    finally:
                        ai_request_slots.release()
                if path == "/api/v1/places/enrich":
                    if not rate_limiter.allow("enrich", peer, MAX_PLACE_ENRICH_REQUESTS_PER_NETWORK_PER_MINUTE, 60):
                        raise ApiError(HTTPStatus.TOO_MANY_REQUESTS, "Too many lookups. Please try again shortly.")
                    return self.send_json(HTTPStatus.OK, enrich_places(read_json(self)))
                if path != "/api/v1/reservations":
                    raise ApiError(HTTPStatus.NOT_FOUND, "Route not found")
                key = self.headers.get("Idempotency-Key")
                if key is not None and not IDEMPOTENCY_RE.fullmatch(key):
                    raise ApiError(HTTPStatus.BAD_REQUEST, "Idempotency-Key must be 8-128 URL-safe characters")
                reservation = database.create_reservation(session_id(self.headers, database), key, read_json(self))
                self.send_json(HTTPStatus.CREATED, {"reservation": reservation})
            except ApiError as error:
                self.send_json(error.status, {"error": error.message})
            except Exception:
                self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Unexpected server error"})

        def do_OPTIONS(self):
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_header("Allow", "GET, POST, OPTIONS")
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_PUT(self):
            self.send_json(HTTPStatus.METHOD_NOT_ALLOWED, {"error": "Method not allowed"})

        do_PATCH = do_PUT
        do_DELETE = do_PUT

    return Handler


def create_server(host: str = "127.0.0.1", port: int = 8080, db_path: str | Path | None = None,
                  max_workers: int = MAX_CONNECTIONS, request_timeout: int | float = REQUEST_TIMEOUT_SECONDS):
    database = Database(db_path or os.environ.get("NEIGHBOR_CART_DB_PATH", DEFAULT_DB_PATH))
    server = BoundedThreadingHTTPServer(
        (host, port), make_handler(database), max_workers=max_workers, request_timeout=request_timeout
    )
    server.database = database
    return server


def main() -> None:
    port = int(os.environ.get("PORT", "8080"))
    server = create_server("0.0.0.0", port)
    print(f"Neighbor Cart API listening on http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

"""Small, dependency-free HTTP API for the Neighbor Cart demo.

The server deliberately uses Python's standard library so a local SQLite demo
does not depend on a native Node module.  It is a same-origin API in production
and is proxied by Vite during development.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import math
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
from urllib.parse import parse_qs, quote_plus, urlencode, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent


def load_dotenv(path: Path = ROOT / ".env") -> None:
    """Read KEY=VALUE lines from .env into the environment.

    .env.example tells people to put their keys in .env, but nothing was
    reading that file, so a key set there was silently ignored and Google
    features stayed off with no clue why. Written by hand rather than adding
    python-dotenv, since the API otherwise has no dependency but boto3.

    A value already present in the real environment always wins, so a
    container or CI secret is never overwritten by a stray local file.
    """
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return  # no .env is the normal case in production
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if key.startswith("export "):
            key = key[len("export "):].strip()
        value = value.strip()
        # Strip one matching pair of surrounding quotes, if present.
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        if key and key not in os.environ:
            os.environ[key] = value


load_dotenv()

DEFAULT_DB_PATH = ROOT / "data" / "neighbor-cart.db"
SEED_PATH = Path(__file__).resolve().parent / "demo_places.json"
OSM_SEED_PATH = Path(__file__).resolve().parent / "osm_places.json"
MAX_BODY_BYTES = 64 * 1024
MAX_CONNECTIONS = 32
REQUEST_TIMEOUT_SECONDS = 10
SESSION_RE = re.compile(r"^[A-Za-z0-9_-]{32,128}$")
IDEMPOTENCY_RE = re.compile(r"^[A-Za-z0-9_-]{8,128}$")
GOOGLE_PHOTO_REFERENCE_RE = re.compile(r"^places/[A-Za-z0-9._~-]{1,256}/photos/[A-Za-z0-9._~-]{1,512}$")
PHOTO_SIGNATURE_RE = re.compile(r"^[0-9a-f]{64}$")
HOUSEHOLD_SIZES = {"1 person", "2-3 people", "4-5 people", "6+ people"}
DEFAULT_SLOT_CAPACITY = 12
AI_MAX_MESSAGE = 2000
# A cropped screenshot of one part of the page, as PNG bytes after decoding.
# Generous enough for a legible crop of a card or a panel, small enough that a
# full-screen capture at retina density cannot be forwarded by accident.
AI_MAX_IMAGE_BYTES = 1_500_000
SESSION_TTL_DAYS = 30
BOOKING_HORIZON_DAYS = 30
MAX_RESERVATIONS_PER_SESSION_PER_DAY = 1
# One network may hold one online pickup at the same location on a day. This
# keeps the no-ID flow intact while making a single network unable to mint
# disposable sessions to consume every pickup window.
MAX_RESERVATIONS_PER_NETWORK_PER_LOCATION_PER_DAY = 1
MAX_SESSIONS_PER_NETWORK_PER_DAY = 4
MAX_AI_REQUESTS_PER_NETWORK_PER_MINUTE = 5
MAX_AI_CONCURRENT_REQUESTS = 2
MAX_PLACE_ENRICH_REQUESTS_PER_NETWORK_PER_MINUTE = 20
MAX_PLACE_ENRICH_REQUESTS_PER_SESSION_PER_MINUTE = 8
MAX_ENRICH_CONCURRENT_REQUESTS = 2
MAX_ENRICH_PLACES_PER_REQUEST = 12
MAX_DISCOVER_REQUESTS_PER_NETWORK_PER_MINUTE = 10
MAX_PHOTO_REQUESTS_PER_NETWORK_PER_MINUTE = 30
MAX_PHOTO_CONCURRENT_REQUESTS = 4
MAX_PHOTO_BYTES = 2 * 1024 * 1024
PHOTO_CACHE_TTL_SECONDS = 60 * 60
PHOTO_CAPABILITY_TTL_SECONDS = 24 * 60 * 60
# Each discover call fans out to one Nearby Search per keyword, so this is the
# per-call bill (~$0.032 each at Google's rate). Keep the list tight.
GOOGLE_DISCOVER_KEYWORDS = (
    "food bank",
    "food pantry",
    "soup kitchen",
    "community fridge",
    "free meals",
)
GOOGLE_DISCOVER_CACHE_TTL_SECONDS = 60 * 60 * 6
GOOGLE_DISCOVER_MAX_RADIUS_M = 50_000
GOOGLE_TIMEOUT_SECONDS = 6
GOOGLE_CACHE_TTL_SECONDS = 60 * 60 * 6
GOOGLE_DISTANCE_CACHE_TTL_SECONDS = 60 * 30
PHOTO_SIGNING_SECRET = (
    os.environ.get("NEIGHBOR_CART_PHOTO_SIGNING_SECRET", "").encode("utf-8")
    or secrets.token_bytes(32)
)
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
enrich_request_slots = threading.BoundedSemaphore(MAX_ENRICH_CONCURRENT_REQUESTS)
photo_request_slots = threading.BoundedSemaphore(MAX_PHOTO_CONCURRENT_REQUESTS)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()



def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in kilometres."""
    radius = 6371.0088
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(a))

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
                  updated_at TEXT NOT NULL,
                  lat REAL,
                  lng REAL
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
                  network_fingerprint TEXT NOT NULL DEFAULT 'legacy',
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
                CREATE TABLE IF NOT EXISTS internal_secrets (
                  name TEXT PRIMARY KEY,
                  value BLOB NOT NULL
                );

                CREATE TABLE IF NOT EXISTS anonymous_sessions (
                  id TEXT PRIMARY KEY,
                  created_at TEXT NOT NULL,
                  expires_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS anonymous_sessions_expiry_idx
                  ON anonymous_sessions(expires_at);
                """
            )
            self._migrate(connection)
            self._network_fingerprint_secret = self._persistent_secret(connection, "reservation-network-fingerprint")
            self._seed_locations(connection)
        finally:
            connection.close()

    def _migrate(self, connection: sqlite3.Connection) -> None:
        """Add columns introduced after a database was first created.

        CREATE TABLE IF NOT EXISTS skips an existing table, so a database made
        before lat/lng existed would keep the old shape and every geo query
        would quietly return nothing.
        """
        # Raw connection (no row_factory): PRAGMA rows are plain tuples.
        location_columns = {row[1] for row in connection.execute("PRAGMA table_info(locations)")}
        for column in ("lat", "lng"):
            if column not in location_columns:
                connection.execute(f"ALTER TABLE locations ADD COLUMN {column} REAL")
        connection.execute("CREATE INDEX IF NOT EXISTS locations_latlng_idx ON locations(lat, lng)")
        reservation_columns = {row[1] for row in connection.execute("PRAGMA table_info(reservations)")}
        if "network_fingerprint" not in reservation_columns:
            # Older rows have no trustworthy network identity. Mark them
            # explicitly so the new guard fails closed for that location/date
            # during the remaining booking horizon instead of treating them as
            # an unbounded new network.
            connection.execute("ALTER TABLE reservations ADD COLUMN network_fingerprint TEXT NOT NULL DEFAULT 'legacy'")
        connection.execute(
            "CREATE INDEX IF NOT EXISTS reservations_network_location_date_idx "
            "ON reservations(network_fingerprint, location_id, pickup_date)"
        )

    @staticmethod
    def _persistent_secret(connection: sqlite3.Connection, name: str) -> bytes:
        row = connection.execute("SELECT value FROM internal_secrets WHERE name = ?", (name,)).fetchone()
        if row is not None:
            return bytes(row[0])
        secret = secrets.token_bytes(32)
        connection.execute("INSERT INTO internal_secrets (name, value) VALUES (?, ?)", (name, secret))
        return secret

    def _seed_locations(self, connection: sqlite3.Connection) -> None:
        if not SEED_PATH.exists():
            raise RuntimeError("Missing API seed data. Run: npm run seed:places")
        places = json.loads(SEED_PATH.read_text(encoding="utf-8"))
        # Real OpenStreetMap records when the fetch script has been run. The
        # curated demo rows keep their hand-written detail; OSM rows upsert
        # alongside them under their own osm-* ids.
        if OSM_SEED_PATH.exists():
            places = places + json.loads(OSM_SEED_PATH.read_text(encoding="utf-8"))
        now = utc_now()
        connection.executemany(
            """
            INSERT INTO locations (id, name, category, accepts_reservations, data_json, updated_at, lat, lng)
            VALUES (:id, :name, :type, :acceptsReservations, :data_json, :updated_at, :lat, :lng)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              category = excluded.category,
              accepts_reservations = excluded.accepts_reservations,
              data_json = excluded.data_json,
              updated_at = excluded.updated_at,
              lat = excluded.lat,
              lng = excluded.lng
            """,
            [
                {
                    "id": place["id"],
                    "name": place["name"],
                    "type": place["type"],
                    "acceptsReservations": int(bool(place.get("acceptsReservations"))),
                    "data_json": json.dumps(place, separators=(",", ":")),
                    "updated_at": now,
                    "lat": place.get("lat"),
                    "lng": place.get("lng"),
                }
                for place in places
            ],
        )

    def locations(
        self,
        query: str | None,
        category: str | None,
        reservable: bool,
        near: tuple[float, float] | None = None,
        radius_km: float = 40.0,
        limit: int = 250,
    ) -> list[dict]:
        """Locations, optionally narrowed to a radius around a point.

        With thousands of real places nationwide, returning the whole table
        would be a multi-megabyte response no client wants. A bounding box
        runs in SQL against the lat/lng index, then exact great-circle
        distance trims the box corners.
        """
        sql = "SELECT data_json, lat, lng FROM locations WHERE 1 = 1"
        values: list[object] = []
        if category and category != "all":
            sql += " AND category = ?"
            values.append(category)
        if reservable:
            sql += " AND accepts_reservations = 1"

        if near is not None:
            centre_lat, centre_lng = near
            lat_span = radius_km / 111.0
            # Longitude degrees shrink toward the poles; guard the cosine so a
            # near-polar request cannot divide by ~0 and explode the box.
            lng_span = radius_km / max(111.0 * math.cos(math.radians(centre_lat)), 1e-6)
            sql += " AND lat IS NOT NULL AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?"
            values.extend([
                centre_lat - lat_span, centre_lat + lat_span,
                centre_lng - lng_span, centre_lng + lng_span,
            ])

        rows = self.connection().execute(sql + " ORDER BY name", values).fetchall()

        places = []
        for row in rows:
            place = json.loads(row["data_json"])
            if near is not None:
                distance = haversine_km(near[0], near[1], row["lat"], row["lng"])
                if distance > radius_km:
                    continue
                place["distanceKm"] = round(distance, 2)
                place["distanceMiles"] = round(distance * 0.621371, 1)
            places.append(place)

        if not query:
            if near is not None:
                places.sort(key=lambda item: item.get("distanceKm", 0))
            return places[:limit]
        needle = query.casefold().strip()
        matches = [
            place
            for place in places
            if needle in " ".join(
                [
                    place["name"],
                    place.get("address", ""),
                    place.get("cityStateZip", ""),
                    place.get("neighborhood", ""),
                    place.get("city", ""),
                    place.get("state", ""),
                    place.get("zip", ""),
                    *[item.get("item", "") for item in place.get("inventory", [])],
                ]
            ).casefold()
        ]
        if near is not None:
            matches.sort(key=lambda item: item.get("distanceKm", 0))
        return matches[:limit]

    def locations_count(self) -> int:
        return self.connection().execute("SELECT COUNT(*) AS n FROM locations").fetchone()["n"]

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

    def create_reservation(self, session_id: str, idempotency_key: str | None, payload: dict, peer: str) -> dict:
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
        network_fingerprint = hmac.new(
            self._network_fingerprint_secret, peer.encode("utf-8"), hashlib.sha256
        ).hexdigest()

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

            network_reservations = connection.execute(
                """
                SELECT COUNT(*) FROM reservations
                WHERE network_fingerprint IN (?, '', 'legacy') AND location_id = ? AND pickup_date = ?
                """,
                (network_fingerprint, location_id, pickup_date),
            ).fetchone()[0]
            if network_reservations >= MAX_RESERVATIONS_PER_NETWORK_PER_LOCATION_PER_DAY:
                raise ApiError(
                    HTTPStatus.TOO_MANY_REQUESTS,
                    "This network already has an online pickup reservation at this location for that day. "
                    "Please choose another location or contact the pantry for help.",
                )

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
                          time_slot, network_fingerprint, household_size, dietary_json, needs_curbside, guest_name, contact, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            reservation_id,
                            confirmation_code,
                            session_id,
                            idempotency_key,
                            location_id,
                            pickup_date,
                            time_slot,
                            network_fingerprint,
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
        entry = {
            "id": place["id"][:96],
            "name": place["name"][:120],
            "address": str(place.get("address", ""))[:180],
            "city": str(place.get("city", ""))[:80],
            "services": [str(item)[:80] for item in place.get("services", [])[:8]],
            "dietary": [str(item)[:80] for item in place.get("dietary", [])[:8]],
            "hours": str(place.get("hours", ""))[:180],
            "reservations": bool(place.get("reservations")),
        }
        # Distance is sent only when the customer has shared a location; their
        # own coordinates never are.
        miles = place.get("milesAway")
        if isinstance(miles, (int, float)) and 0 <= miles < 25000:
            entry["milesAway"] = round(float(miles), 1)
        cleaned.append(entry)
    return cleaned


def clean_ai_memory(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip()[:AI_MAX_MESSAGE] for item in value[-12:] if isinstance(item, str) and item.strip()]


def clean_ai_screenshot(value: object) -> bytes | None:
    """A crop of the page the customer is pointing at, as a base64 PNG.

    Absent is the normal case and never an error. Anything present has to be a
    PNG we can decode and that is small enough to be a crop rather than a whole
    screen: the bytes go straight to a model, so what is not recognisable here
    does not travel.
    """
    if value is None:
        return None
    if not isinstance(value, str):
        raise ApiError(HTTPStatus.BAD_REQUEST, "screenshot must be a base64 PNG string")

    encoded = value.split(",", 1)[-1].strip()
    # Base64 is 4 characters per 3 bytes; reject the obviously oversized before
    # spending memory decoding it.
    if len(encoded) > (AI_MAX_IMAGE_BYTES // 3 + 1) * 4 + 1024:
        raise ApiError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "screenshot is too large; crop a smaller area")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as error:
        raise ApiError(HTTPStatus.BAD_REQUEST, "screenshot must be valid base64") from error

    if len(raw) > AI_MAX_IMAGE_BYTES:
        raise ApiError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "screenshot is too large; crop a smaller area")
    # The PNG signature, so the declared format and the bytes agree.
    if not raw.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ApiError(HTTPStatus.BAD_REQUEST, "screenshot must be a PNG")
    return raw


def clean_ai_context(value: object) -> str:
    """The page section the question was asked from; absent or unusable is fine."""
    if not isinstance(value, str):
        return ""
    return value.strip()[:600]


def clean_ai_resident_profile(value: object) -> dict:
    """Allow a small, explicitly saved intake profile into the AI context.

    This is a one-turn personalization hint, not an account record. Each field
    is capped independently and unknown fields are discarded.
    """
    if not isinstance(value, dict):
        return {}
    cleaned = {}
    for key, limit in {
        "location": 160,
        "householdSize": 48,
        "urgency": 48,
        "transportation": 48,
        "otherNeed": 500,
    }.items():
        item = value.get(key)
        if isinstance(item, str) and item.strip():
            cleaned[key] = item.strip()[:limit]
    dietary = value.get("dietary")
    if isinstance(dietary, list):
        cleaned["dietary"] = [item.strip()[:96] for item in dietary[:12] if isinstance(item, str) and item.strip()]
    return cleaned


def bedrock_chat(payload: dict) -> dict:
    """Call Converse server-side and accept only catalog IDs in the response."""
    message = ai_text(payload.get("message"), "message", AI_MAX_MESSAGE)
    catalog = clean_ai_catalog(payload.get("catalog"))
    memory = clean_ai_memory(payload.get("memory"))
    page_context = clean_ai_context(payload.get("context"))
    screenshot = clean_ai_screenshot(payload.get("screenshot"))
    resident_profile = (
        clean_ai_resident_profile(payload.get("residentProfile"))
        if payload.get("bedrockProfileConsent") is True
        else {}
    )
    valid_ids = {place["id"] for place in catalog}
    if not catalog:
        raise ApiError(HTTPStatus.BAD_REQUEST, "catalog must contain at least one verified location")

    try:
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError
    except ImportError as error:
        raise ApiError(HTTPStatus.SERVICE_UNAVAILABLE, "AI service is not installed on this server") from error

    system = (
        "You are the Neighbor Cart Navigator, a compassionate food access guide. Answer in plain language. "
        "Only recommend locations from the VERIFIED_CATALOG supplied below. Never invent an address, "
        "hours, inventory, eligibility rule, or availability. Do not make medical or eligibility decisions. "
        "For greetings or general small talk, return an empty placeIds list and warmly ask what food help is needed. "
        "When a customer only shares a requirement (for example a diet, budget, no-car need, language, children, or ID concern) without asking to find or suggest a place, acknowledge that you will remember it and return an empty placeIds list. Recommend locations only after an explicit request to find, show, suggest, or recommend food options. "
        "If a message is unreadable, a stray keystroke, or carries no request or requirement, do not treat it as a requirement and do not claim to have noted it: say you could not read it, ask for it again in a few words, and return an empty placeIds list. "
        "CUSTOMER_REQUIREMENTS_MEMORY contains only requirements already recognised; treat it as established fact and never add to it from an unclear message. "
        "When the customer asks to find food but has not provided a city, neighborhood, or ZIP code, still return up to three catalog locations and ask for their area so you can narrow it — an empty list leaves a hungry person with nothing on screen. "
        "If catalog entries carry milesAway, the customer has already shared their location: never ask them where they are, prefer the closest entries, and say how far away they are. An entry with reservations true can hold a pickup slot ahead of time. "
        "When the customer asks to avoid something (no beans, nothing with peanuts, no pork), treat it as an exclusion: recommend locations that do not list it, and say so plainly. Never return the very thing they asked to avoid. "
        "Read a request for places however it is phrased — \"any places\", \"can you provide\", \"what is around\", \"I need somewhere\" are all requests to recommend locations. "
        "Return ONLY JSON: {\"reply\":\"...\",\"placeIds\":[\"verified-id\"],\"warning\":\"optional\","
        "\"followUps\":[\"...\"]}. Include at most three place IDs.\n\nVERIFIED_CATALOG:\n"
        + json.dumps(catalog, separators=(",", ":"))
        + "\n\nCUSTOMER_REQUIREMENTS_MEMORY (use these conditions together with the newest message):\n"
        + json.dumps(memory, separators=(",", ":"))
    )
    if resident_profile:
        system += (
            "\n\nCUSTOMER_INTAKE_PROFILE (the customer explicitly saved these details for personalized help). "
            "Use the location, household, timing, transportation, and dietary details to tailor your answer. "
            "Do not claim an exact travel distance; use the city, ZIP, or neighborhood to guide matching instead:\n"
            + json.dumps(resident_profile, separators=(",", ":"))
        )
    if screenshot:
        # The crop is evidence of what the customer is looking at, not a new
        # source of places: it may be read and explained, never mined for a
        # location that the catalog does not already carry.
        system += (
            "\n\nThe customer has attached a screenshot of the part of the page they are asking about. "
            "Read it to understand what they are pointing at and answer about that. "
            "Describe only what is actually legible in it, never guess at text you cannot read, and "
            "still recommend only VERIFIED_CATALOG locations — a name visible in the image is not a "
            "licence to recommend a place that is not in the catalog."
        )
    if page_context:
        # Where on the site the question came from. It answers "what is this?"
        # and nothing more: it never licenses a place that is not in the catalog.
        system += (
            "\n\nPAGE_CONTEXT (the part of the site the customer is looking at right now; "
            "use it to answer questions about what they are seeing, and still recommend only "
            "VERIFIED_CATALOG locations):\n"
            + page_context
        )
    try:
        client = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        response = client.converse(
            modelId=os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0"),
            system=[{"text": system}],
            messages=[
                *clean_ai_history(payload.get("history")),
                {
                    "role": "user",
                    "content": [
                        *([{"image": {"format": "png", "source": {"bytes": screenshot}}}] if screenshot else []),
                        {"text": message},
                    ],
                },
            ],
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
google_discover_cache = TtlCache(GOOGLE_DISCOVER_CACHE_TTL_SECONDS, maximum=256)
# At most 16 entries of 2 MiB each: 32 MiB is the hard upper bound for this
# in-process cache. Google photos are still served live rather than persisted.
google_photo_cache = TtlCache(PHOTO_CACHE_TTL_SECONDS, maximum=16)


def google_key() -> str:
    return os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()


PLACES_V1 = "https://places.googleapis.com/v1"


def signed_photo_url(reference: str, width: int = 640) -> str | None:
    """Return a capability URL for a Google photo resource produced by this API.

    Images are requested by an ``<img>`` element, which cannot attach the
    anonymous-session header. The signed, width-bound capability prevents the
    endpoint from becoming a general proxy for arbitrary Google photo names.
    """
    if not GOOGLE_PHOTO_REFERENCE_RE.fullmatch(reference):
        return None
    expires_at = int(time.time()) + PHOTO_CAPABILITY_TTL_SECONDS
    signature = photo_signature(reference, width, expires_at)
    return "/api/v1/places/photo?" + urlencode({
        "ref": reference,
        "w": width,
        "expires": expires_at,
        "signature": signature,
    })


def photo_signature(reference: str, width: int, expires_at: int) -> str:
    message = f"{reference}\n{width}\n{expires_at}".encode("utf-8")
    return hmac.new(PHOTO_SIGNING_SECRET, message, hashlib.sha256).hexdigest()


def authorized_photo_request(query: dict[str, list[str]]) -> tuple[str, int]:
    """Validate a short-lived, server-issued photo capability."""
    values = {name: query.get(name, []) for name in ("ref", "w", "expires", "signature")}
    if any(len(value) != 1 for value in values.values()):
        raise ApiError(HTTPStatus.FORBIDDEN, "A valid photo capability is required")
    reference, width_raw, expires_raw, signature = (
        values["ref"][0], values["w"][0], values["expires"][0], values["signature"][0],
    )
    if not GOOGLE_PHOTO_REFERENCE_RE.fullmatch(reference) or not PHOTO_SIGNATURE_RE.fullmatch(signature):
        raise ApiError(HTTPStatus.FORBIDDEN, "A valid photo capability is required")
    try:
        width = int(width_raw)
        expires_at = int(expires_raw)
    except ValueError as error:
        raise ApiError(HTTPStatus.FORBIDDEN, "A valid photo capability is required") from error
    if not 80 <= width <= 1600 or expires_at < int(time.time()):
        raise ApiError(HTTPStatus.FORBIDDEN, "A valid photo capability is required")
    if not hmac.compare_digest(signature, photo_signature(reference, width, expires_at)):
        raise ApiError(HTTPStatus.FORBIDDEN, "A valid photo capability is required")
    return reference, width

# Google bills Places API (New) by the fields requested, so this mask stays
# narrow — only what the directory actually renders.
SEARCH_FIELD_MASK = ",".join((
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.rating",
    "places.userRatingCount",
    "places.photos",
    "places.nationalPhoneNumber",
    "places.websiteUri",
    "places.currentOpeningHours.openNow",
    "places.businessStatus",
    "places.primaryTypeDisplayName",
    "places.types",
))


def places_post(path: str, body: dict, field_mask: str) -> dict:
    """One Places API (New) call. The key travels in a header, never a query string."""
    request = Request(
        f"{PLACES_V1}/{path}",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": google_key(),
            "X-Goog-FieldMask": field_mask,
        },
        method="POST",
    )
    with urlopen(request, timeout=GOOGLE_TIMEOUT_SECONDS) as response:  # noqa: S310 - fixed Google host
        return json.loads(response.read().decode("utf-8"))


def places_text_search(text_query: str, latitude: float, longitude: float, radius_m: int) -> list[dict]:
    body = {
        "textQuery": text_query,
        "pageSize": 20,
        "locationBias": {
            "circle": {
                "center": {"latitude": latitude, "longitude": longitude},
                "radius": float(radius_m),
            }
        },
    }
    return places_post("places:searchText", body, SEARCH_FIELD_MASK).get("places") or []

def catalog_enrich_places(value: object, database: Database) -> list[dict]:
    """Resolve client-selected IDs to the server's canonical location records."""
    if not isinstance(value, list) or not value:
        raise ApiError(HTTPStatus.BAD_REQUEST, "places must be a non-empty list")
    cleaned: list[dict] = []
    seen_ids: set[str] = set()
    for place in value[:MAX_ENRICH_PLACES_PER_REQUEST]:
        if not isinstance(place, dict) or not isinstance(place.get("id"), str):
            continue
        location_id = place["id"].strip()
        if not location_id or location_id in seen_ids:
            continue
        try:
            stored = database.location(location_id)
        except ApiError as error:
            if error.status == HTTPStatus.NOT_FOUND:
                raise ApiError(HTTPStatus.BAD_REQUEST, "places must contain known catalog IDs") from None
            raise
        try:
            latitude = float(stored["lat"])
            longitude = float(stored["lng"])
        except (KeyError, TypeError, ValueError) as error:
            raise ApiError(HTTPStatus.BAD_REQUEST, "A selected location is missing usable coordinates") from error
        if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
            raise ApiError(HTTPStatus.BAD_REQUEST, "A selected location is missing usable coordinates")
        cleaned.append({
            "id": stored["id"],
            "name": stored["name"],
            "address": ", ".join(filter(None, (stored.get("address", ""), stored.get("cityStateZip", "")))),
            "lat": latitude,
            "lng": longitude,
        })
        seen_ids.add(location_id)
    if not cleaned:
        raise ApiError(HTTPStatus.BAD_REQUEST, "places must contain known catalog IDs")
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
    """Rating, review count and a photo for one of our own records.

    Matches our stored place to Google's listing by name and location, which
    is how an OpenStreetMap record (which carries no photo at all) gets a real
    photograph attached at display time.
    """
    cache_key = f"{place['id']}|{place['lat']:.5f},{place['lng']:.5f}"
    cached = google_details_cache.get(cache_key)
    if cached is not None:
        return cached

    details: dict = {}
    try:
        query = f"{place['name']} {place['address']}".strip()
        results = places_text_search(query, place["lat"], place["lng"], 3_000)
        if results:
            match = results[0]
            photos = match.get("photos") or []
            photo_name = (photos[0] or {}).get("name") if photos else None
            photo_url = signed_photo_url(photo_name) if photo_name else None
            details = {
                "placeId": match.get("id"),
                "rating": match.get("rating"),
                "ratingCount": match.get("userRatingCount"),
                "mapsUrl": (
                    "https://www.google.com/maps/search/?api=1"
                    f"&query_place_id={match.get('id')}"
                ),
                "openNow": (match.get("currentOpeningHours") or {}).get("openNow"),
                "photoUrl": photo_url,
                "reviews": [],
            }
    except (HTTPError, URLError, socket.timeout, ValueError, KeyError, TypeError, json.JSONDecodeError):
        # A missing rating or photo is cosmetic; the stored record still stands.
        details = {}

    google_details_cache.put(cache_key, details)
    return details

# Searching "soup kitchen" or "free meals" also surfaces taco stands and
# burger counters, and Google types them identically to real soup kitchens
# (primaryType "food", types ['service','food','point_of_interest',
# 'establishment']) — there is no type signal that separates them.
#
# So trust is granted two ways. Places Google types as an organisation,
# charity, church or community centre are accepted outright. Anything with the
# ambiguous "food" type must also *read* like food assistance by name.
#
# This deliberately errs toward dropping a real pantry with an unusual name,
# because the opposite error sends a hungry person to a restaurant expecting a
# free meal. OpenStreetMap still covers what this rejects.

ASSISTANCE_TYPES = frozenset({
    "association_or_organization",
    "non_profit_organization",
    "charity",
    "church",
    "place_of_worship",
    "community_center",
    "social_services",
    "food_bank",
    "meal_delivery",
    "homeless_shelter",
    "welfare_office",
})

ASSISTANCE_NAME_WORDS = (
    "food bank", "foodbank", "food pantry", "pantry", "soup kitchen",
    "community kitchen", "free meal", "meals on wheels", "mission",
    "charity", "charities", "outreach", "ministries", "ministry",
    "salvation army", "community fridge", "fridge", "cupboard", "larder",
    "feeding", "hunger", "relief", "shelter", "harvest", "food distribution",
    "food closet", "nourish", "rescue mission", "benevolence", "giving",
    "helping", "care center", "care centre", "community center",
    "community centre", "resource center", "food share", "foodshare",
)

COMMERCIAL_TYPES = frozenset({
    "cafe", "coffee_shop", "bakery", "bar", "pub", "night_club",
    "meal_takeaway", "fast_food_restaurant", "ice_cream_shop", "sandwich_shop",
    "grocery_store", "supermarket", "convenience_store", "liquor_store",
    "department_store", "shopping_mall", "gas_station", "hotel", "lodging",
})


def looks_like_food_assistance(name: str, types: list[str]) -> bool:
    """Whether a Google listing is plausibly a food assistance site."""
    entries = set(types or [])

    for entry in entries:
        if entry.endswith("_restaurant") or entry == "restaurant":
            return False
        if entry in COMMERCIAL_TYPES:
            return False

    if entries & ASSISTANCE_TYPES:
        return True

    # Ambiguous "food"/"service" listing: the name has to carry the meaning.
    haystack = name.casefold()
    return any(word in haystack for word in ASSISTANCE_NAME_WORDS)


# Same split as the OpenStreetMap importer: Google gives one blob of food
# assistance, the UI offers five filters. Order matters — a "Mobile Food
# Pantry" is a mobile distribution first, since that is what a visitor has to
# plan around.
GOOGLE_TYPE_HINTS = (
    ("fridge", "community-fridge"),
    ("mobile", "mobile"),
    ("on wheels", "mobile"),
    ("drive-thru", "mobile"),
    ("pop-up", "mobile"),
    ("soup kitchen", "hot-meal"),
    ("community kitchen", "hot-meal"),
    ("hot meal", "hot-meal"),
    ("free meal", "hot-meal"),
    ("kitchen", "hot-meal"),
    ("pantry", "pantry"),
    ("cupboard", "pantry"),
    ("food closet", "pantry"),
    ("bank", "food-bank"),
)


def google_place_category(name: str, keyword: str) -> str:
    haystack = f"{name} {keyword}".casefold()
    for needle, category in GOOGLE_TYPE_HINTS:
        if needle in haystack:
            return category
    return "food-bank"


def google_discover(latitude: float, longitude: float, radius_m: int) -> list[dict]:
    """Every food assistance place Google lists around a point.

    One text search per phrase, deduplicated by place id. Cached on a coarse
    grid so a city block of visitors shares one set of billed calls.
    """
    cache_key = f"{latitude:.2f},{longitude:.2f}|{radius_m}"
    cached = google_discover_cache.get(cache_key)
    if cached is not None:
        return cached

    found: dict[str, dict] = {}
    for keyword in GOOGLE_DISCOVER_KEYWORDS:
        try:
            results = places_text_search(keyword, latitude, longitude, radius_m)
        except (HTTPError, URLError, socket.timeout, ValueError, json.JSONDecodeError):
            # One phrase failing should not lose the others.
            continue

        for result in results:
            place_id = result.get("id")
            location = result.get("location") or {}
            name = ((result.get("displayName") or {}).get("text") or "").strip()
            if not place_id or not name or "latitude" not in location:
                continue
            if result.get("businessStatus") == "CLOSED_PERMANENTLY":
                continue
            if not looks_like_food_assistance(name, result.get("types") or []):
                continue
            if place_id in found:
                continue

            photos = result.get("photos") or []
            photo_name = (photos[0] or {}).get("name") if photos else None
            photo_url = signed_photo_url(photo_name) if photo_name else None
            address = str(result.get("formattedAddress", ""))[:200]
            open_now = (result.get("currentOpeningHours") or {}).get("openNow")

            found[place_id] = {
                "id": f"google-{place_id}",
                "googlePlaceId": place_id,
                "name": name[:160],
                "type": google_place_category(name, keyword),
                "typeLabel": ((result.get("primaryTypeDisplayName") or {}).get("text")
                              or "Food Assistance (Google listing)"),
                "tagline": "",
                "neighborhood": "",
                "address": address,
                "city": "",
                "state": "",
                "zip": "",
                "cityStateZip": address,
                "lat": float(location["latitude"]),
                "lng": float(location["longitude"]),
                "phone": str(result.get("nationalPhoneNumber", ""))[:40],
                "email": "",
                "website": str(result.get("websiteUri", ""))[:300],
                "directionsUrl": (
                    "https://www.google.com/maps/search/?api=1"
                    f"&query={quote_plus(name)}&query_place_id={place_id}"
                ),
                "verifiedBadge": False,
                "verifiedDate": "",
                "callAheadWarning": open_now is None,
                "requirements": "",
                "languages": [],
                "dietary": [],
                "hasFreshProduce": False,
                "transitInfo": "",
                "accessibility": "",
                "eligibilityTags": [],
                # A reference, not a stored image: the client fetches it back
                # through our proxy so the API key stays server-side.
                "photoRef": photo_name,
                "images": [photo_url] if photo_url else [],
                "hoursSummary": "Hours from Google — call ahead" if open_now is None else (
                    "Open now (per Google)" if open_now else "Closed now (per Google)"
                ),
                "hoursKnown": False,
                "weeklyHours": [],
                "services": [],
                "inventory": [],
                "urgentNeeds": [],
                "acceptsReservations": False,
                "reservationWindows": [],
                "rating": result.get("rating"),
                "ratingCount": result.get("userRatingCount"),
                "openNow": open_now,
                "dataSource": "google",
                "attribution": "Listing data © Google",
            }

    places = sorted(found.values(), key=lambda place: place["name"])
    google_discover_cache.put(cache_key, places)
    return places

def google_photo(reference: str, width: int) -> tuple[bytes, str]:
    """Stream one Places photo through our server.

    `reference` is a Places API (New) photo resource name
    ("places/<id>/photos/<token>"). Google requires photos be served live from
    their endpoint rather than copied into our storage, and the key must not
    reach the browser, so the bytes are proxied per request.
    """
    url = f"{PLACES_V1}/{reference}/media?" + urlencode({"maxWidthPx": width, "key": google_key()})
    with urlopen(url, timeout=GOOGLE_TIMEOUT_SECONDS) as response:  # noqa: S310 - fixed Google host
        content_length = response.headers.get("Content-Length")
        try:
            declared_size = int(content_length) if content_length is not None else None
        except ValueError as error:
            raise ValueError("Google returned an invalid photo size") from error
        if declared_size is not None and declared_size > MAX_PHOTO_BYTES:
            raise ValueError("Google photo is too large")
        content_type = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        if not content_type.startswith("image/"):
            raise ValueError("Google returned a non-image response")
        payload = response.read(MAX_PHOTO_BYTES + 1)
        if len(payload) > MAX_PHOTO_BYTES:
            raise ValueError("Google photo is too large")
        return payload, content_type

ROUTES_TRAVEL_MODE = {
    "driving": "DRIVE",
    "walking": "WALK",
    "transit": "TRANSIT",
    "bicycling": "BICYCLE",
}


def google_distances(origin: dict, places: list[dict], mode: str) -> dict[str, dict]:
    """Real travel time from one origin to each place, via the Routes API.

    The legacy Distance Matrix endpoint is disabled for new Cloud projects, so
    this uses routes.googleapis.com computeRouteMatrix. If the Routes API is
    not enabled on the key the call fails and callers fall back to the
    straight-line distance the API already computes.
    """
    cache_key = f"{mode}|{origin['lat']:.4f},{origin['lng']:.4f}|" + ",".join(place["id"] for place in places)
    cached = google_distance_cache.get(cache_key)
    if cached is not None:
        return cached

    distances: dict[str, dict] = {}
    try:
        request = Request(
            "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
            data=json.dumps({
                "origins": [{
                    "waypoint": {"location": {"latLng": {
                        "latitude": origin["lat"], "longitude": origin["lng"],
                    }}},
                }],
                "destinations": [
                    {"waypoint": {"location": {"latLng": {
                        "latitude": place["lat"], "longitude": place["lng"],
                    }}}}
                    for place in places
                ],
                "travelMode": ROUTES_TRAVEL_MODE.get(mode, "DRIVE"),
            }).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": google_key(),
                "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,condition",
            },
            method="POST",
        )
        with urlopen(request, timeout=GOOGLE_TIMEOUT_SECONDS) as response:  # noqa: S310 - fixed Google host
            elements = json.loads(response.read().decode("utf-8"))

        for element in elements:
            index = element.get("destinationIndex")
            if index is None or not (0 <= index < len(places)):
                continue
            if element.get("condition") not in (None, "ROUTE_EXISTS"):
                continue
            metres = element.get("distanceMeters")
            # Routes returns duration as a string of seconds, e.g. "930s".
            seconds_raw = str(element.get("duration") or "").rstrip("s")
            seconds = int(seconds_raw) if seconds_raw.isdigit() else None
            distances[places[index]["id"]] = {
                "distanceText": f"{metres / 1609.344:.1f} mi" if metres is not None else None,
                "distanceMeters": metres,
                "durationText": f"{round(seconds / 60)} min" if seconds is not None else None,
                "durationSeconds": seconds,
                "travelMode": mode,
            }
    except (HTTPError, URLError, socket.timeout, ValueError, KeyError, TypeError, json.JSONDecodeError):
        distances = {}

    google_distance_cache.put(cache_key, distances)
    return distances

def enrich_places(payload: dict, database: Database) -> dict:
    """Google ratings, reviews, and travel time for the places the navigator picked.

    Without a key the endpoint still answers, with an empty enrichment map and
    `provider: "none"`, so the UI falls back to straight-line distance rather
    than breaking.
    """
    places = catalog_enrich_places(payload.get("places"), database)
    # Precise browser coordinates are sent to Google Routes only after the
    # client has collected the dedicated, feature-specific consent flag.
    origin = clean_origin(payload.get("origin")) if payload.get("googleRoutesConsent") is True else None
    mode = payload.get("mode") if payload.get("mode") in {"driving", "walking", "transit", "bicycling"} else "driving"

    if not google_key():
        return {"provider": "none", "enrichment": {}}

    enrichment = {place["id"]: dict(google_place_details(place)) for place in places}
    if origin:
        for place_id, travel in google_distances(origin, places, mode).items():
            enrichment.setdefault(place_id, {}).update(travel)
    return {"provider": "google", "enrichment": enrichment}



def bounded_float(raw: object, default: float, minimum: float, maximum: float, field: str) -> float:
    if raw is None or raw == "":
        return default
    try:
        value = float(raw)
    except (TypeError, ValueError):
        raise ApiError(HTTPStatus.BAD_REQUEST, f"{field} must be a number") from None
    if not math.isfinite(value) or not minimum <= value <= maximum:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"{field} must be between {minimum} and {maximum}")
    return value


def optional_point(raw_lat: object, raw_lng: object) -> tuple[float, float] | None:
    """A lat/lng pair, or None when neither is given. One without the other is a client bug."""
    if raw_lat in (None, "") and raw_lng in (None, ""):
        return None
    if raw_lat in (None, "") or raw_lng in (None, ""):
        raise ApiError(HTTPStatus.BAD_REQUEST, "lat and lng must be supplied together")
    return (
        bounded_float(raw_lat, 0.0, -90.0, 90.0, "lat"),
        bounded_float(raw_lng, 0.0, -180.0, 180.0, "lng"),
    )

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
                if url.path == "/api/v1/places/photo":
                    reference, width = authorized_photo_request(query)
                    if not google_key():
                        raise ApiError(HTTPStatus.SERVICE_UNAVAILABLE, "Photos need GOOGLE_MAPS_API_KEY")
                    peer = client_identity(self)
                    if not rate_limiter.allow(
                        "photo", peer, MAX_PHOTO_REQUESTS_PER_NETWORK_PER_MINUTE, 60,
                    ):
                        raise ApiError(HTTPStatus.TOO_MANY_REQUESTS, "Too many photo requests. Please try again shortly.")
                    cache_key = f"{reference}|{width}"
                    cached = google_photo_cache.get(cache_key)
                    if cached is not None:
                        payload, content_type = cached
                    elif not photo_request_slots.acquire(blocking=False):
                        raise ApiError(HTTPStatus.TOO_MANY_REQUESTS, "Photos are busy. Please try again shortly.")
                    else:
                        try:
                            payload, content_type = google_photo(reference, width)
                            google_photo_cache.put(cache_key, (payload, content_type))
                        except (HTTPError, URLError, socket.timeout, ValueError):
                            raise ApiError(HTTPStatus.BAD_GATEWAY, "Photo unavailable") from None
                        finally:
                            photo_request_slots.release()
                    self.send_response(HTTPStatus.OK)
                    self.send_header("Content-Type", content_type)
                    self.send_header("Content-Length", str(len(payload)))
                    # The URL is a signed 24-hour capability; keep browser
                    # caching shorter so stale images naturally refresh.
                    self.send_header("Cache-Control", f"public, max-age={PHOTO_CACHE_TTL_SECONDS}")
                    self.end_headers()
                    return self.wfile.write(payload)

                if url.path == "/api/v1/places/discover":
                    # Each call bills several Google searches, so it is limited
                    # per network the same way the POST routes are.
                    if not rate_limiter.allow(
                        "discover", client_identity(self),
                        MAX_DISCOVER_REQUESTS_PER_NETWORK_PER_MINUTE, 60,
                    ):
                        raise ApiError(HTTPStatus.TOO_MANY_REQUESTS, "Too many lookups. Please try again shortly.")
                    point = optional_point(query.get("lat", [None])[0], query.get("lng", [None])[0])
                    if point is None:
                        raise ApiError(HTTPStatus.BAD_REQUEST, "lat and lng are required")
                    if query.get("googlePlacesConsent", ["false"])[0].lower() != "true":
                        return self.send_json(HTTPStatus.OK, {"places": [], "provider": "none"})
                    radius_m = int(bounded_float(
                        query.get("radiusM", [None])[0], 16_000.0, 500.0,
                        float(GOOGLE_DISCOVER_MAX_RADIUS_M), "radiusM",
                    ))
                    if not google_key():
                        # Not an error: the stored OSM directory still works.
                        return self.send_json(HTTPStatus.OK, {"places": [], "provider": "none"})
                    return self.send_json(HTTPStatus.OK, {
                        "places": google_discover(point[0], point[1], radius_m),
                        "provider": "google",
                    })

                if url.path == "/api/v1/locations":
                    category = query.get("category", [None])[0]
                    search = query.get("q", [None])[0]
                    reservable = query.get("reservable", ["false"])[0].lower() == "true"
                    near = optional_point(query.get("lat", [None])[0], query.get("lng", [None])[0])
                    radius_km = bounded_float(query.get("radiusKm", [None])[0], 40.0, 1.0, 500.0, "radiusKm")
                    limit = int(bounded_float(query.get("limit", [None])[0], 250.0, 1.0, 1000.0, "limit"))
                    results = database.locations(search, category, reservable, near, radius_km, limit)
                    return self.send_json(HTTPStatus.OK, {
                        "locations": results,
                        "total": database.locations_count(),
                        "returned": len(results),
                    })
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
                    # A JSON body makes this a non-simple browser request. A
                    # cross-site form cannot consume this network's scarce
                    # anonymous-session quota, and rejected requests do not
                    # reach the limiter below.
                    read_json(self)
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
                    active_session = session_id(self.headers, database)
                    payload = read_json(self)
                    if not rate_limiter.allow("enrich", peer, MAX_PLACE_ENRICH_REQUESTS_PER_NETWORK_PER_MINUTE, 60):
                        raise ApiError(HTTPStatus.TOO_MANY_REQUESTS, "Too many lookups. Please try again shortly.")
                    if not rate_limiter.allow(
                        "enrich-session", active_session, MAX_PLACE_ENRICH_REQUESTS_PER_SESSION_PER_MINUTE, 60,
                    ):
                        raise ApiError(HTTPStatus.TOO_MANY_REQUESTS, "Too many lookups from this session. Please try again shortly.")
                    if not enrich_request_slots.acquire(blocking=False):
                        raise ApiError(HTTPStatus.TOO_MANY_REQUESTS, "Place enrichment is busy. Please try again shortly.")
                    try:
                        return self.send_json(HTTPStatus.OK, enrich_places(payload, database))
                    finally:
                        enrich_request_slots.release()
                if path != "/api/v1/reservations":
                    raise ApiError(HTTPStatus.NOT_FOUND, "Route not found")
                key = self.headers.get("Idempotency-Key")
                if key is not None and not IDEMPOTENCY_RE.fullmatch(key):
                    raise ApiError(HTTPStatus.BAD_REQUEST, "Idempotency-Key must be 8-128 URL-safe characters")
                reservation = database.create_reservation(session_id(self.headers, database), key, read_json(self), peer)
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

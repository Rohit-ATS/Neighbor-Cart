"""Small, dependency-free HTTP API for the Neighbor Cart demo.

The server deliberately uses Python's standard library so a local SQLite demo
does not depend on a native Node module.  It is a same-origin API in production
and is proxied by Vite during development.
"""

from __future__ import annotations

import json
import os
import re
import secrets
import sqlite3
import threading
import uuid
from datetime import date, datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = ROOT / "data" / "neighbor-cart.db"
SEED_PATH = Path(__file__).resolve().parent / "demo_places.json"
MAX_BODY_BYTES = 64 * 1024
MAX_CONNECTIONS = 32
SESSION_RE = re.compile(r"^[A-Za-z0-9_-]{16,128}$")
IDEMPOTENCY_RE = re.compile(r"^[A-Za-z0-9_-]{8,128}$")
HOUSEHOLD_SIZES = {"1 person", "2-3 people", "4-5 people", "6+ people"}


class ApiError(Exception):
    def __init__(self, status: HTTPStatus, message: str):
        self.status = status
        self.message = message
        super().__init__(message)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class Database:
    """SQLite repository. Connections are thread-local because requests are concurrent."""

    def __init__(self, path: str | Path):
        self.path = str(path)
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._local = threading.local()
        self._initialize()

    def connection(self) -> sqlite3.Connection:
        connection = getattr(self._local, "connection", None)
        if connection is None:
            connection = sqlite3.connect(self.path, timeout=5, isolation_level=None)
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA foreign_keys = ON")
            connection.execute("PRAGMA busy_timeout = 5000")
            self._local.connection = connection
        return connection

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

    def create_reservation(self, session_id: str, idempotency_key: str | None, payload: dict) -> dict:
        location_id = require_text(payload, "locationId", 96)
        location = self.location(location_id)
        if not location.get("acceptsReservations"):
            raise ApiError(HTTPStatus.CONFLICT, "This location does not accept reservations")

        pickup_date = require_future_date(payload.get("pickupDate"))
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

        connection = self.connection()
        if idempotency_key:
            existing = connection.execute(
                "SELECT * FROM reservations WHERE session_id = ? AND idempotency_key = ?",
                (session_id, idempotency_key),
            ).fetchone()
            if existing:
                return reservation_response(existing, self.location(existing["location_id"]))

        for _ in range(4):
            confirmation_code = "NC-" + "".join(secrets.choice("23456789ABCDEFGHJKLMNPQRSTUVWXYZ") for _ in range(6))
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
                return reservation_response(row, location)
            except sqlite3.IntegrityError:
                if idempotency_key:
                    existing = connection.execute(
                        "SELECT * FROM reservations WHERE session_id = ? AND idempotency_key = ?",
                        (session_id, idempotency_key),
                    ).fetchone()
                    if existing:
                        return reservation_response(existing, self.location(existing["location_id"]))
        raise ApiError(HTTPStatus.SERVICE_UNAVAILABLE, "Could not issue a pickup pass. Please try again.")

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


def require_future_date(value: object) -> str:
    if not isinstance(value, str):
        raise ApiError(HTTPStatus.BAD_REQUEST, "pickupDate is required")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as error:
        raise ApiError(HTTPStatus.BAD_REQUEST, "pickupDate must use YYYY-MM-DD") from error
    if parsed < date.today():
        raise ApiError(HTTPStatus.BAD_REQUEST, "pickupDate cannot be in the past")
    return parsed.isoformat()


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


def session_id(headers) -> str:
    value = headers.get("X-Neighbor-Session", "")
    if not SESSION_RE.fullmatch(value):
        raise ApiError(HTTPStatus.UNAUTHORIZED, "A valid anonymous device session is required")
    return value


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
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ApiError(HTTPStatus.BAD_REQUEST, "Request body must be valid JSON") from error
    if not isinstance(body, dict):
        raise ApiError(HTTPStatus.BAD_REQUEST, "Request body must be a JSON object")
    return body


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
                if url.path.startswith("/api/v1/locations/"):
                    return self.send_json(HTTPStatus.OK, {"location": database.location(url.path.rsplit("/", 1)[1])})
                if url.path == "/api/v1/reservations":
                    return self.send_json(HTTPStatus.OK, {"reservations": database.reservations(session_id(self.headers))})
                raise ApiError(HTTPStatus.NOT_FOUND, "Route not found")
            except ApiError as error:
                self.send_json(error.status, {"error": error.message})
            except Exception:
                self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Unexpected server error"})

        def do_POST(self):
            try:
                if urlsplit(self.path).path != "/api/v1/reservations":
                    raise ApiError(HTTPStatus.NOT_FOUND, "Route not found")
                key = self.headers.get("Idempotency-Key")
                if key is not None and not IDEMPOTENCY_RE.fullmatch(key):
                    raise ApiError(HTTPStatus.BAD_REQUEST, "Idempotency-Key must be 8-128 URL-safe characters")
                reservation = database.create_reservation(session_id(self.headers), key, read_json(self))
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


def create_server(host: str = "127.0.0.1", port: int = 8080, db_path: str | Path | None = None):
    database = Database(db_path or os.environ.get("NEIGHBOR_CART_DB_PATH", DEFAULT_DB_PATH))
    server = ThreadingHTTPServer((host, port), make_handler(database))
    server.request_queue_size = MAX_CONNECTIONS
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

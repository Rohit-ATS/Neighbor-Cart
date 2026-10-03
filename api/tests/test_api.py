import json
import socket
import sqlite3
import sys
import tempfile
import threading
import time
import types
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from http.client import HTTPConnection
from pathlib import Path
from unittest.mock import patch

from api import app
from api.app import create_server, rate_limiter


class ApiTests(unittest.TestCase):
    def setUp(self):
        rate_limiter.clear()
        app.google_details_cache.clear()
        app.google_distance_cache.clear()
        app.google_photo_cache.clear()
        self.temp_dir = tempfile.TemporaryDirectory()
        self.server = create_server("127.0.0.1", 0, Path(self.temp_dir.name) / "test.db")
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_port
        self.session = self.new_session()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        if hasattr(self.server, "database"):
            self.server.database.close()
        try:
            self.temp_dir.cleanup()
        except Exception:
            pass

    def request(self, method, path, payload=None, headers=None):
        connection = HTTPConnection("127.0.0.1", self.port, timeout=3)
        body = json.dumps(payload) if payload is not None else None
        request_headers = headers or {}
        if payload is not None:
            request_headers = {"Content-Type": "application/json", **request_headers}
        connection.request(method, path, body=body, headers=request_headers)
        response = connection.getresponse()
        decoded = json.loads(response.read())
        connection.close()
        return response.status, decoded

    def raw_request(self, method, path, headers=None):
        connection = HTTPConnection("127.0.0.1", self.port, timeout=3)
        connection.request(method, path, headers=headers or {})
        response = connection.getresponse()
        status = response.status
        body = response.read()
        response_headers = dict(response.getheaders())
        connection.close()
        return status, response_headers, body

    def reservation_payload(self):
        status, body = self.request("GET", "/api/v1/locations?reservable=true")
        self.assertEqual(status, 200)
        place = body["locations"][0]
        return {
            "locationId": place["id"],
            "pickupDate": (date.today() + timedelta(days=1)).isoformat(),
            "timeSlot": place["reservationWindows"][0],
            "householdSize": "2-3 people",
            "dietary": ["Vegetarian"],
            "needsCurbside": False,
            "guestName": "Alex",
        }

    def enrichment_payload(self, origin=None, google_routes_consent=False):
        place = self.server.database.locations(None, None, False, limit=1)[0]
        payload = {"places": [{"id": place["id"]}]}
        if origin is not None:
            payload["origin"] = origin
        if google_routes_consent:
            payload["googleRoutesConsent"] = True
        return payload

    def new_session(self):
        return self.server.database.issue_session()["id"]

    def headers(self, key="request-key-0001", session=None):
        return {"X-Neighbor-Session": session or self.session, "Idempotency-Key": key}

    def test_lists_seeded_locations(self):
        status, body = self.request("GET", "/api/v1/locations?q=food")
        self.assertEqual(status, 200)
        self.assertGreaterEqual(len(body["locations"]), 1)

    def test_location_filters_and_detail_route_are_consistent(self):
        status, body = self.request("GET", "/api/v1/locations?category=food-bank&reservable=true")
        self.assertEqual(status, 200)
        self.assertGreaterEqual(len(body["locations"]), 1)
        self.assertTrue(all(place["type"] == "food-bank" for place in body["locations"]))
        self.assertTrue(all(place["acceptsReservations"] for place in body["locations"]))

        location_id = body["locations"][0]["id"]
        status, body = self.request("GET", f"/api/v1/locations/{location_id}")
        self.assertEqual(status, 200)
        self.assertEqual(body["location"]["id"], location_id)
        self.assertIsInstance(body["location"]["inventory"], list)

        status, _ = self.request("GET", "/api/v1/locations/does-not-exist")
        self.assertEqual(status, 404)

        pickup_date = (date.today() + timedelta(days=1)).isoformat()
        status, body = self.request("GET", f"/api/v1/locations/{location_id}/availability?date={pickup_date}")
        self.assertEqual(status, 200)
        self.assertEqual(body["availability"]["locationId"], location_id)
        self.assertTrue(all(slot["available"] == slot["capacity"] for slot in body["availability"]["slots"]))

        status, _ = self.request("GET", f"/api/v1/locations/{location_id}/availability")
        self.assertEqual(status, 400)

    def test_creates_and_lists_an_anonymous_reservation(self):
        headers = self.headers()
        payload = self.reservation_payload()
        status, body = self.request("POST", "/api/v1/reservations", payload, headers)
        self.assertEqual(status, 201)
        self.assertTrue(body["reservation"]["code"].startswith("NC-"))
        self.assertEqual(body["reservation"]["placeId"], payload["locationId"])
        status, body = self.request("GET", "/api/v1/reservations", headers=headers)
        self.assertEqual(status, 200)
        self.assertEqual(len(body["reservations"]), 1)
        self.assertEqual(body["reservations"][0]["placeId"], payload["locationId"])
        self.assertNotIn("contact", body["reservations"][0])

    def test_idempotency_returns_the_original_pass(self):
        headers = self.headers("request-key-0002")
        payload = self.reservation_payload()
        _, first = self.request("POST", "/api/v1/reservations", payload, headers)
        _, second = self.request("POST", "/api/v1/reservations", payload, headers)
        self.assertEqual(first["reservation"]["id"], second["reservation"]["id"])

    def test_server_issues_sessions_and_rejects_client_forged_ones(self):
        status, body = self.request("POST", "/api/v1/sessions", {})
        self.assertEqual(status, 201)
        issued = body["session"]
        self.assertRegex(issued["id"], r"^[A-Za-z0-9_-]{32,128}$")
        self.assertIn("expiresAt", issued)

        forged = "x" * 32
        status, body = self.request("GET", "/api/v1/reservations", headers={"X-Neighbor-Session": forged})
        self.assertEqual(status, 401)
        self.assertIn("session", body["error"])

    def test_session_issuance_is_rate_limited_per_network(self):
        for _ in range(4):
            status, _ = self.request("POST", "/api/v1/sessions", {})
            self.assertEqual(status, 201)
        status, body = self.request("POST", "/api/v1/sessions", {})
        self.assertEqual(status, 429)
        self.assertIn("Too many", body["error"])

    def test_session_issuance_rejects_a_form_like_post_without_spending_quota(self):
        status, body = self.request("POST", "/api/v1/sessions")
        self.assertEqual(status, 415)
        self.assertIn("Content-Type", body["error"])

        for _ in range(4):
            status, _ = self.request("POST", "/api/v1/sessions", {})
            self.assertEqual(status, 201)

    def test_configured_trusted_proxy_uses_a_valid_forwarded_client_address(self):
        with patch("api.app.TRUSTED_PROXY_ADDRESSES", frozenset({"127.0.0.1"})):
            for _ in range(4):
                status, _ = self.request("POST", "/api/v1/sessions", {}, {"X-Forwarded-For": "198.51.100.10"})
                self.assertEqual(status, 201)
            status, _ = self.request("POST", "/api/v1/sessions", {}, {"X-Forwarded-For": "198.51.100.10"})
            self.assertEqual(status, 429)
            status, _ = self.request("POST", "/api/v1/sessions", {}, {"X-Forwarded-For": "198.51.100.11"})
            self.assertEqual(status, 201)

    def test_rejects_a_reservation_without_a_device_session(self):
        status, body = self.request("POST", "/api/v1/reservations", self.reservation_payload())
        self.assertEqual(status, 401)
        self.assertIn("session", body["error"])

    def test_reservations_are_isolated_between_anonymous_devices(self):
        self.request("POST", "/api/v1/reservations", self.reservation_payload(), self.headers("request-key-0003"))
        other_session = {"X-Neighbor-Session": self.new_session()}
        status, body = self.request("GET", "/api/v1/reservations", headers=other_session)
        self.assertEqual(status, 200)
        self.assertEqual(body["reservations"], [])

    def test_rejects_nonreservable_locations_past_dates_and_invalid_slots(self):
        headers = self.headers("request-key-0004")
        status, body = self.request("GET", "/api/v1/locations")
        self.assertEqual(status, 200)
        nonreservable = next(place for place in body["locations"] if not place["acceptsReservations"])

        payload = self.reservation_payload()
        payload["locationId"] = nonreservable["id"]
        status, _ = self.request("POST", "/api/v1/reservations", payload, headers)
        self.assertEqual(status, 409)

        payload = self.reservation_payload()
        payload["pickupDate"] = (date.today() - timedelta(days=1)).isoformat()
        status, _ = self.request("POST", "/api/v1/reservations", payload, self.headers("request-key-0005"))
        self.assertEqual(status, 400)

        payload = self.reservation_payload()
        payload["pickupDate"] = (date.today() + timedelta(days=31)).isoformat()
        status, _ = self.request("POST", "/api/v1/reservations", payload, self.headers("request-key-horizon"))
        self.assertEqual(status, 400)

        status, _ = self.request(
            "GET",
            f"/api/v1/locations/{self.reservation_payload()['locationId']}/availability?date={(date.today() + timedelta(days=31)).isoformat()}",
        )
        self.assertEqual(status, 400)

        payload = self.reservation_payload()
        payload["timeSlot"] = "Not a real pickup window"
        status, _ = self.request("POST", "/api/v1/reservations", payload, self.headers("request-key-0006"))
        self.assertEqual(status, 400)

    def test_rejects_bad_request_shape_and_invalid_idempotency_key(self):
        status, _ = self.request(
            "POST",
            "/api/v1/reservations",
            ["not", "an", "object"],
            {"X-Neighbor-Session": self.session, "Idempotency-Key": "request-key-0007"},
        )
        self.assertEqual(status, 400)

        status, _ = self.request(
            "POST",
            "/api/v1/reservations",
            self.reservation_payload(),
            {"X-Neighbor-Session": self.session, "Idempotency-Key": "not valid"},
        )
        self.assertEqual(status, 400)

    def test_slot_capacity_is_enforced_for_concurrent_reservations(self):
        payload = self.reservation_payload()
        pickup_date = payload["pickupDate"]
        path = f"/api/v1/locations/{payload['locationId']}/availability?date={pickup_date}"
        status, body = self.request("GET", path)
        self.assertEqual(status, 200)
        slot = next(slot for slot in body["availability"]["slots"] if slot["timeSlot"] == payload["timeSlot"])
        capacity = slot["capacity"]

        def reserve(index):
            try:
                self.server.database.create_reservation(
                    self.new_session(), f"capacity-request-{index:016d}", payload, f"198.51.100.{index + 1}"
                )
                return 201
            except app.ApiError as error:
                return error.status

        with ThreadPoolExecutor(max_workers=capacity + 2) as executor:
            statuses = list(executor.map(reserve, range(capacity + 2)))

        self.assertEqual(statuses.count(201), capacity)
        self.assertEqual(statuses.count(409), 2)
        status, body = self.request("GET", path)
        self.assertEqual(status, 200)
        slot = next(slot for slot in body["availability"]["slots"] if slot["timeSlot"] == payload["timeSlot"])
        self.assertEqual(slot["reserved"], capacity)
        self.assertEqual(slot["available"], 0)
        self.assertFalse(slot["isAvailable"])

    def test_network_reservation_limit_blocks_disposable_sessions_but_allows_another_location(self):
        payload = self.reservation_payload()
        first_headers = self.headers("network-limit-0001", self.new_session())
        status, _ = self.request("POST", "/api/v1/reservations", payload, first_headers)
        self.assertEqual(status, 201)

        status, body = self.request(
            "POST", "/api/v1/reservations", payload, self.headers("network-limit-0002", self.new_session())
        )
        self.assertEqual(status, 429)
        self.assertIn("network", body["error"])

        reservable = self.server.database.locations(None, None, True, limit=10)
        alternative = next(place for place in reservable if place["id"] != payload["locationId"])
        alternative_payload = {**payload, "locationId": alternative["id"], "timeSlot": alternative["reservationWindows"][0]}
        status, _ = self.request(
            "POST", "/api/v1/reservations", alternative_payload, self.headers("network-limit-0003", self.new_session())
        )
        self.assertEqual(status, 201)

    def test_network_reservation_limit_survives_a_database_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            database_path = Path(directory) / "persistent-limit.db"
            first_database = app.Database(database_path)
            payload = first_database.locations(None, None, True, limit=1)[0]
            reservation = {
                "locationId": payload["id"],
                "pickupDate": (date.today() + timedelta(days=1)).isoformat(),
                "timeSlot": payload["reservationWindows"][0],
                "householdSize": "2-3 people",
                "dietary": [],
                "needsCurbside": False,
            }
            first_database.create_reservation(first_database.issue_session()["id"], "restart-limit-0001", reservation, "198.51.100.80")
            first_database.close()

            restarted_database = app.Database(database_path)
            with self.assertRaises(app.ApiError) as error:
                restarted_database.create_reservation(
                    restarted_database.issue_session()["id"], "restart-limit-0002", reservation, "198.51.100.80"
                )
            restarted_database.close()

        self.assertEqual(error.exception.status, 429)

    def test_legacy_reservations_fail_closed_for_their_remaining_pickup_date(self):
        with tempfile.TemporaryDirectory() as directory:
            database_path = Path(directory) / "legacy-limit.db"
            place = json.loads(app.SEED_PATH.read_text(encoding="utf-8"))[0]
            pickup_date = (date.today() + timedelta(days=1)).isoformat()
            with sqlite3.connect(database_path) as connection:
                connection.executescript(
                    """
                    CREATE TABLE locations (
                      id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
                      accepts_reservations INTEGER NOT NULL, data_json TEXT NOT NULL, updated_at TEXT NOT NULL
                    );
                    CREATE TABLE reservations (
                      id TEXT PRIMARY KEY, confirmation_code TEXT NOT NULL UNIQUE, session_id TEXT NOT NULL,
                      idempotency_key TEXT, location_id TEXT NOT NULL, pickup_date TEXT NOT NULL,
                      time_slot TEXT NOT NULL, household_size TEXT NOT NULL, dietary_json TEXT NOT NULL,
                      needs_curbside INTEGER NOT NULL, guest_name TEXT NOT NULL, contact TEXT, created_at TEXT NOT NULL,
                      UNIQUE(session_id, idempotency_key)
                    );
                    CREATE TABLE anonymous_sessions (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
                    """
                )
                connection.execute(
                    "INSERT INTO locations VALUES (?, ?, ?, ?, ?, ?)",
                    (place["id"], place["name"], place["type"], int(place["acceptsReservations"]), json.dumps(place), "2026-01-01T00:00:00+00:00"),
                )
                connection.execute(
                    "INSERT INTO reservations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    ("legacy-reservation", "NC-LEGACY", "legacy-session", "legacy-key", place["id"], pickup_date,
                     place["reservationWindows"][0], "2-3 people", "[]", 0, "Neighbor Guest", None, "2026-01-01T00:00:00+00:00"),
                )

            first_database = app.Database(database_path)
            reservation = {
                "locationId": place["id"],
                "pickupDate": pickup_date,
                "timeSlot": place["reservationWindows"][0],
                "householdSize": "2-3 people",
                "dietary": [],
                "needsCurbside": False,
            }
            with self.assertRaises(app.ApiError) as error:
                first_database.create_reservation(
                    first_database.issue_session()["id"], "legacy-limit-0002", reservation, "198.51.100.82"
                )
            first_database.close()

        self.assertEqual(error.exception.status, 429)

    def test_one_pickup_per_session_per_day_preserves_idempotent_retry(self):
        payload = self.reservation_payload()
        first_headers = self.headers("quota-request-0001")
        status, first = self.request("POST", "/api/v1/reservations", payload, first_headers)
        self.assertEqual(status, 201)

        status, replay = self.request("POST", "/api/v1/reservations", payload, first_headers)
        self.assertEqual(status, 201)
        self.assertEqual(replay["reservation"]["id"], first["reservation"]["id"])

        payload["timeSlot"] = self.reservation_payload()["timeSlot"]
        status, body = self.request("POST", "/api/v1/reservations", payload, self.headers("quota-request-0002"))
        self.assertEqual(status, 429)
        self.assertIn("already", body["error"])

    def test_ai_requires_a_valid_session_and_enforces_a_peer_limit(self):
        payload = {"message": "Where can I find food?", "catalog": [{"id": "place-1", "name": "Place"}]}
        status, _ = self.request("POST", "/api/v1/ai/chat", payload)
        self.assertEqual(status, 401)

        with patch("api.app.bedrock_chat", return_value={"reply": "Try Place", "placeIds": ["place-1"]}) as chat:
            for _ in range(5):
                status, body = self.request("POST", "/api/v1/ai/chat", payload, {"X-Neighbor-Session": self.session})
                self.assertEqual(status, 200)
                self.assertEqual(body["reply"], "Try Place")
            status, body = self.request("POST", "/api/v1/ai/chat", payload, {"X-Neighbor-Session": self.session})
        self.assertEqual(status, 429)
        self.assertIn("limit", body["error"])
        self.assertEqual(chat.call_count, 5)

    def test_place_enrichment_degrades_without_a_google_key(self):
        payload = self.enrichment_payload()
        with patch.dict("os.environ", {"GOOGLE_MAPS_API_KEY": ""}, clear=False):
            status, body = self.request("POST", "/api/v1/places/enrich", payload, {"X-Neighbor-Session": self.session})
        self.assertEqual(status, 200)
        self.assertEqual(body, {"provider": "none", "enrichment": {}})

    def test_place_enrichment_requires_a_session_and_known_catalog_ids(self):
        payload = self.enrichment_payload()
        status, body = self.request("POST", "/api/v1/places/enrich", payload)
        self.assertEqual(status, 401)
        self.assertIn("session", body["error"])

        with patch.dict("os.environ", {"GOOGLE_MAPS_API_KEY": "test-key"}, clear=False):
            with patch("api.app.places_text_search") as search:
                status, body = self.request(
                    "POST", "/api/v1/places/enrich",
                    {"places": [{"id": "forged-place", "name": "Attacker query", "lat": 41.6, "lng": -93.6}]},
                    {"X-Neighbor-Session": self.session},
                )
        self.assertEqual(status, 400)
        self.assertIn("known catalog", body["error"])
        search.assert_not_called()

    def test_place_enrichment_uses_server_catalog_coordinates(self):
        with patch.dict("os.environ", {"GOOGLE_MAPS_API_KEY": "test-key"}, clear=False):
            with patch("api.app.places_text_search", return_value=[] ) as search:
                payload = self.enrichment_payload()
                payload["places"][0].update({"name": "Attacker query", "lat": 0, "lng": 0})
                status, body = self.request("POST", "/api/v1/places/enrich", payload, {"X-Neighbor-Session": self.session})
        self.assertEqual(status, 200)
        self.assertEqual(body["provider"], "google")
        args = search.call_args.args
        stored = self.server.database.location(payload["places"][0]["id"])
        self.assertIn(stored["name"], args[0])
        self.assertEqual((args[1], args[2]), (float(stored["lat"]), float(stored["lng"])))

    def test_place_enrichment_merges_ratings_with_travel_time(self):
        payload = self.enrichment_payload({"lat": 41.59, "lng": -93.62}, google_routes_consent=True)
        details = [{
            "id": "g-1", "rating": 4.6, "userRatingCount": 212,
            "photos": [{"name": "places/g-1/photos/photo-token"}],
        }]
        travel = {payload["places"][0]["id"]: {
            "distanceText": "1.4 mi", "distanceMeters": 2253,
            "durationText": "6 min", "durationSeconds": 360, "travelMode": "driving",
        }}

        with patch.dict("os.environ", {"GOOGLE_MAPS_API_KEY": "test-key"}, clear=False):
            with patch("api.app.places_text_search", return_value=details), patch(
                "api.app.google_distances", return_value=travel,
            ):
                status, body = self.request("POST", "/api/v1/places/enrich", payload, {"X-Neighbor-Session": self.session})

        self.assertEqual(status, 200)
        self.assertEqual(body["provider"], "google")
        place = body["enrichment"][payload["places"][0]["id"]]
        self.assertEqual(place["rating"], 4.6)
        self.assertEqual(place["ratingCount"], 212)
        self.assertEqual(place["distanceText"], "1.4 mi")
        self.assertEqual(place["durationText"], "6 min")
        self.assertIn("signature=", place["photoUrl"])

    def test_place_enrichment_does_not_send_an_origin_without_google_consent(self):
        payload = self.enrichment_payload({"lat": 41.59, "lng": -93.62})
        with patch.dict("os.environ", {"GOOGLE_MAPS_API_KEY": "test-key"}, clear=False):
            with patch("api.app.places_text_search", return_value=[]), patch("api.app.google_distances") as distances:
                status, body = self.request("POST", "/api/v1/places/enrich", payload, {"X-Neighbor-Session": self.session})
        self.assertEqual(status, 200)
        self.assertEqual(body["provider"], "google")
        distances.assert_not_called()

    def test_place_discovery_does_not_call_google_without_explicit_consent(self):
        path = "/api/v1/places/discover?lat=41.59&lng=-93.62&radiusM=25000"
        with patch.dict("os.environ", {"GOOGLE_MAPS_API_KEY": "test-key"}, clear=False):
            with patch("api.app.google_discover", return_value=[{"id": "google-1"}]) as discover:
                status, body = self.request("GET", path)
                self.assertEqual(status, 200)
                self.assertEqual(body, {"places": [], "provider": "none"})
                discover.assert_not_called()

                status, body = self.request("GET", path + "&googlePlacesConsent=true")
        self.assertEqual(status, 200)
        self.assertEqual(body["provider"], "google")
        discover.assert_called_once_with(41.59, -93.62, 25000)

    def test_bedrock_profile_requires_consent_and_never_includes_an_address(self):
        class FakeBotoCoreError(Exception):
            pass

        class FakeClientError(Exception):
            pass

        response = {"output": {"message": {"content": [{"text": '{"reply":"Try Place","placeIds":["place-1"]}'}]}}}
        converse = unittest.mock.Mock(return_value=response)
        boto3_module = types.ModuleType("boto3")
        boto3_module.client = unittest.mock.Mock(return_value=types.SimpleNamespace(converse=converse))
        botocore_module = types.ModuleType("botocore")
        exceptions_module = types.ModuleType("botocore.exceptions")
        exceptions_module.BotoCoreError = FakeBotoCoreError
        exceptions_module.ClientError = FakeClientError
        payload = {
            "message": "Where can I find food?",
            "catalog": [{"id": "place-1", "name": "Place"}],
            "residentProfile": {"address": "123 Private Street", "location": "50309", "householdSize": "2-3 people"},
        }
        with patch.dict(sys.modules, {"boto3": boto3_module, "botocore": botocore_module, "botocore.exceptions": exceptions_module}):
            app.bedrock_chat(payload)
            system_without_consent = converse.call_args.kwargs["system"][0]["text"]
            self.assertNotIn("CUSTOMER_INTAKE_PROFILE", system_without_consent)

            payload["bedrockProfileConsent"] = True
            app.bedrock_chat(payload)
            system_with_consent = converse.call_args.kwargs["system"][0]["text"]

        self.assertIn("50309", system_with_consent)
        self.assertNotIn("123 Private Street", system_with_consent)

    def test_place_enrichment_survives_a_google_outage(self):
        payload = self.enrichment_payload()
        with patch.dict("os.environ", {"GOOGLE_MAPS_API_KEY": "test-key"}, clear=False):
            with patch("api.app.places_text_search", side_effect=app.URLError("google is down")):
                status, body = self.request("POST", "/api/v1/places/enrich", payload, {"X-Neighbor-Session": self.session})
        self.assertEqual(status, 200)
        self.assertEqual(body["enrichment"], {payload["places"][0]["id"]: {}})

    def test_photo_proxy_requires_a_signed_capability_and_caches_valid_images(self):
        reference = "places/google-place/photos/photo-token"
        url = app.signed_photo_url(reference)
        self.assertIsNotNone(url)

        with patch.dict("os.environ", {"GOOGLE_MAPS_API_KEY": "test-key"}, clear=False):
            with patch("api.app.google_photo", return_value=(b"jpeg-bytes", "image/jpeg")) as photo:
                status, _, _ = self.raw_request("GET", "/api/v1/places/photo?ref=" + reference + "&w=640")
                self.assertEqual(status, 403)
                photo.assert_not_called()

                status, headers, body = self.raw_request("GET", url)
                self.assertEqual(status, 200)
                self.assertEqual(headers["Content-Type"], "image/jpeg")
                self.assertEqual(body, b"jpeg-bytes")
                status, _, body = self.raw_request("GET", url)

        self.assertEqual(status, 200)
        self.assertEqual(body, b"jpeg-bytes")
        self.assertEqual(photo.call_count, 1)

    def test_ai_concurrency_is_bounded_before_calling_bedrock(self):
        payload = {"message": "Where can I find food?", "catalog": [{"id": "place-1", "name": "Place"}]}
        entered = threading.Event()
        release = threading.Event()
        calls = 0
        calls_lock = threading.Lock()

        def blocked_chat(_payload):
            nonlocal calls
            with calls_lock:
                calls += 1
                if calls == 2:
                    entered.set()
            release.wait(timeout=2)
            return {"reply": "Try Place", "placeIds": ["place-1"]}

        with patch("api.app.bedrock_chat", side_effect=blocked_chat):
            with ThreadPoolExecutor(max_workers=3) as executor:
                first = executor.submit(self.request, "POST", "/api/v1/ai/chat", payload, {"X-Neighbor-Session": self.session})
                second = executor.submit(self.request, "POST", "/api/v1/ai/chat", payload, {"X-Neighbor-Session": self.session})
                self.assertTrue(entered.wait(timeout=1), "two Bedrock calls did not begin")
                third_status, third_body = self.request(
                    "POST", "/api/v1/ai/chat", payload, {"X-Neighbor-Session": self.session}
                )
                self.assertEqual(third_status, 429)
                self.assertIn("busy", third_body["error"])
                release.set()
                self.assertEqual(first.result(timeout=2)[0], 200)
                self.assertEqual(second.result(timeout=2)[0], 200)
        self.assertEqual(calls, 2)

    def test_slow_ai_bodies_do_not_consume_bedrock_concurrency(self):
        partial_clients = []
        try:
            for _ in range(2):
                client = socket.create_connection(("127.0.0.1", self.port), timeout=1)
                client.sendall(
                    b"POST /api/v1/ai/chat HTTP/1.1\r\nHost: localhost\r\n"
                    + f"X-Neighbor-Session: {self.session}\r\n".encode()
                    + b"Content-Type: application/json\r\nContent-Length: 100\r\n\r\n{"
                )
                partial_clients.append(client)
            time.sleep(0.1)
            with patch("api.app.bedrock_chat", return_value={"reply": "Try Place", "placeIds": ["place-1"]}) as chat:
                status, body = self.request(
                    "POST",
                    "/api/v1/ai/chat",
                    {"message": "Where can I find food?", "catalog": [{"id": "place-1", "name": "Place"}]},
                    {"X-Neighbor-Session": self.session},
                )
            self.assertEqual(status, 200)
            self.assertEqual(body["reply"], "Try Place")
            self.assertEqual(chat.call_count, 1)
        finally:
            for client in partial_clients:
                try:
                    client.shutdown(socket.SHUT_WR)
                    client.settimeout(1)
                    client.recv(4096)
                except OSError:
                    pass
                finally:
                    client.close()

    def test_slow_body_times_out_without_permanently_consuming_the_only_worker(self):
        constrained = create_server(
            "127.0.0.1", 0, Path(self.temp_dir.name) / "constrained.db", max_workers=1, request_timeout=0.2
        )
        thread = threading.Thread(target=constrained.serve_forever, daemon=True)
        thread.start()
        session = constrained.database.issue_session()["id"]
        client = socket.create_connection(("127.0.0.1", constrained.server_port), timeout=1)
        try:
            client.sendall(
                b"POST /api/v1/reservations HTTP/1.1\r\nHost: localhost\r\n"
                + f"X-Neighbor-Session: {session}\r\n".encode()
                + b"Idempotency-Key: slow-body-request-0001\r\nConnection: close\r\n"
                b"Content-Type: application/json\r\nContent-Length: 20\r\n\r\n{"
            )
            client.settimeout(1)
            response = client.recv(4096)
            self.assertIn(b"408", response)
        finally:
            client.close()

        status, body = self.request_to_port("GET", "/healthz", constrained.server_port)
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "ok")
        constrained.shutdown()
        constrained.server_close()
        thread.join(timeout=2)
        if hasattr(constrained, "database"):
            constrained.database.close()

    @staticmethod
    def request_to_port(method, path, port):
        connection = HTTPConnection("127.0.0.1", port, timeout=3)
        connection.request(method, path)
        response = connection.getresponse()
        decoded = json.loads(response.read())
        connection.close()
        return response.status, decoded

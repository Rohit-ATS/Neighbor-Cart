import json
import socket
import tempfile
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from http.client import HTTPConnection
from pathlib import Path
from unittest.mock import patch

from urllib.error import URLError

from api import app
from api.app import create_server, rate_limiter


class ApiTests(unittest.TestCase):
    def setUp(self):
        rate_limiter.clear()
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
        status, body = self.request("POST", "/api/v1/sessions")
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
            status, _ = self.request("POST", "/api/v1/sessions")
            self.assertEqual(status, 201)
        status, body = self.request("POST", "/api/v1/sessions")
        self.assertEqual(status, 429)
        self.assertIn("Too many", body["error"])

    def test_configured_trusted_proxy_uses_a_valid_forwarded_client_address(self):
        with patch("api.app.TRUSTED_PROXY_ADDRESSES", frozenset({"127.0.0.1"})):
            for _ in range(4):
                status, _ = self.request("POST", "/api/v1/sessions", headers={"X-Forwarded-For": "198.51.100.10"})
                self.assertEqual(status, 201)
            status, _ = self.request("POST", "/api/v1/sessions", headers={"X-Forwarded-For": "198.51.100.10"})
            self.assertEqual(status, 429)
            status, _ = self.request("POST", "/api/v1/sessions", headers={"X-Forwarded-For": "198.51.100.11"})
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
            headers = self.headers(f"capacity-request-{index:016d}", self.new_session())
            return self.request("POST", "/api/v1/reservations", payload, headers)[0]

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
        payload = {"places": [{"id": "place-1", "name": "Place", "lat": 41.6, "lng": -93.6}]}
        with patch.dict("os.environ", {"GOOGLE_MAPS_API_KEY": ""}, clear=False):
            status, body = self.request("POST", "/api/v1/places/enrich", payload)
        self.assertEqual(status, 200)
        self.assertEqual(body, {"provider": "none", "enrichment": {}})

    def test_place_enrichment_rejects_places_without_usable_coordinates(self):
        with patch.dict("os.environ", {"GOOGLE_MAPS_API_KEY": "test-key"}, clear=False):
            status, body = self.request("POST", "/api/v1/places/enrich", {"places": [{"id": "a", "lat": 999, "lng": 0}]})
        self.assertEqual(status, 400)
        self.assertIn("coordinates", body["error"])

    def test_place_enrichment_merges_ratings_with_travel_time(self):
        app.google_details_cache.clear()
        app.google_distance_cache.clear()
        payload = {
            "places": [{"id": "place-1", "name": "Place", "address": "1 Main St", "lat": 41.6, "lng": -93.6}],
            "origin": {"lat": 41.59, "lng": -93.62},
        }

        def fake_google(path, params):
            if path.startswith("place/findplacefromtext"):
                return {"status": "OK", "candidates": [{"place_id": "g-1"}]}
            if path.startswith("place/details"):
                return {"status": "OK", "result": {
                    "rating": 4.6,
                    "user_ratings_total": 212,
                    "reviews": [{"author_name": "Sam", "rating": 5, "text": "Kind staff.", "relative_time_description": "a week ago"}],
                }}
            return {"status": "OK", "rows": [{"elements": [
                {"status": "OK", "distance": {"text": "1.4 mi", "value": 2253}, "duration": {"text": "6 mins", "value": 360}},
            ]}]}

        with patch.dict("os.environ", {"GOOGLE_MAPS_API_KEY": "test-key"}, clear=False):
            with patch("api.app.google_get", side_effect=fake_google):
                status, body = self.request("POST", "/api/v1/places/enrich", payload)

        self.assertEqual(status, 200)
        self.assertEqual(body["provider"], "google")
        place = body["enrichment"]["place-1"]
        self.assertEqual(place["rating"], 4.6)
        self.assertEqual(place["ratingCount"], 212)
        self.assertEqual(place["distanceText"], "1.4 mi")
        self.assertEqual(place["durationText"], "6 mins")
        self.assertEqual(place["reviews"][0]["author"], "Sam")

    def test_place_enrichment_survives_a_google_outage(self):
        app.google_details_cache.clear()
        app.google_distance_cache.clear()
        payload = {"places": [{"id": "place-1", "name": "Place", "lat": 41.6, "lng": -93.6}]}
        with patch.dict("os.environ", {"GOOGLE_MAPS_API_KEY": "test-key"}, clear=False):
            with patch("api.app.google_get", side_effect=URLError("google is down")):
                status, body = self.request("POST", "/api/v1/places/enrich", payload)
        self.assertEqual(status, 200)
        self.assertEqual(body["enrichment"], {"place-1": {}})

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

import json
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from http.client import HTTPConnection
from pathlib import Path

from api.app import create_server


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.server = create_server("127.0.0.1", 0, Path(self.temp_dir.name) / "test.db")
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_port
        self.session = "test-device-session-0123456789"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.temp_dir.cleanup()

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

    def headers(self, key="request-key-0001"):
        return {"X-Neighbor-Session": self.session, "Idempotency-Key": key}

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

    def test_rejects_a_reservation_without_a_device_session(self):
        status, body = self.request("POST", "/api/v1/reservations", self.reservation_payload())
        self.assertEqual(status, 401)
        self.assertIn("session", body["error"])

    def test_reservations_are_isolated_between_anonymous_devices(self):
        self.request("POST", "/api/v1/reservations", self.reservation_payload(), self.headers("request-key-0003"))
        other_session = {"X-Neighbor-Session": "other-device-session-0123456789"}
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
            headers = {
                "X-Neighbor-Session": f"capacity-test-device-{index:016d}",
                "Idempotency-Key": f"capacity-request-{index:016d}",
            }
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

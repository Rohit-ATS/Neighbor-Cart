import json
import tempfile
import threading
import unittest
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

    def test_lists_seeded_locations(self):
        status, body = self.request("GET", "/api/v1/locations?q=food")
        self.assertEqual(status, 200)
        self.assertGreaterEqual(len(body["locations"]), 1)

    def test_creates_and_lists_an_anonymous_reservation(self):
        headers = {"X-Neighbor-Session": self.session, "Idempotency-Key": "request-key-0001"}
        status, body = self.request("POST", "/api/v1/reservations", self.reservation_payload(), headers)
        self.assertEqual(status, 201)
        self.assertTrue(body["reservation"]["code"].startswith("NC-"))
        status, body = self.request("GET", "/api/v1/reservations", headers=headers)
        self.assertEqual(status, 200)
        self.assertEqual(len(body["reservations"]), 1)
        self.assertNotIn("contact", body["reservations"][0])

    def test_idempotency_returns_the_original_pass(self):
        headers = {"X-Neighbor-Session": self.session, "Idempotency-Key": "request-key-0002"}
        payload = self.reservation_payload()
        _, first = self.request("POST", "/api/v1/reservations", payload, headers)
        _, second = self.request("POST", "/api/v1/reservations", payload, headers)
        self.assertEqual(first["reservation"]["id"], second["reservation"]["id"])

    def test_rejects_a_reservation_without_a_device_session(self):
        status, body = self.request("POST", "/api/v1/reservations", self.reservation_payload())
        self.assertEqual(status, 401)
        self.assertIn("session", body["error"])

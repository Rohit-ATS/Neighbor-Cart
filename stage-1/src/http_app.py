"""HTTP plumbing: routing, JSON request and response handling.

One connection per thread (A13), HTTP/1.1 with an explicit ``Content-Length`` on
every response. Handlers receive a :class:`Request` and return
``(status, payload)``; every error they raise that is an :class:`ApiError`
becomes the JSON body the interface contract names.
"""

import json
import re
import socket
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

from .errors import ApiError, InvalidRequest, MethodNotAllowed, MissingIdempotencyKey, NotFound, RequestTimeout
from .money import parse_json_object, require_integer

JSON_CONTENT_TYPE = "application/json"
#: A body larger than this is refused before it is read into memory.
MAX_BODY_BYTES = 64 * 1024
#: Slow clients may hold a connection for at most this many idle seconds.
REQUEST_TIMEOUT_SECONDS = 5
#: A peer cannot retain a worker indefinitely by sending a byte before each
#: idle timeout; this bounds the total duration of one HTTP request.
REQUEST_DEADLINE_SECONDS = 10
#: Keep enough capacity for the stated 50 concurrent requests while bounding threads.
MAX_CONCURRENT_CONNECTIONS = 64

_SEGMENT = re.compile(r"\{([a-z_]+)\}")


class Request:
    """One decoded request: path parameters, query string and JSON body."""

    def __init__(self, method, path, params, query, headers, raw_body):
        self.method = method
        self.path = path
        self.params = params
        self.query = query
        self.headers = headers
        self.raw_body = raw_body

    def json(self):
        """The body as a JSON object, or :class:`InvalidRequest`."""
        content_type = self.headers.get("Content-Type", "")
        media_type = content_type.split(";", 1)[0].strip().lower()
        if media_type != JSON_CONTENT_TYPE:
            raise InvalidRequest(
                "Content-Type must be %s, got %r" % (JSON_CONTENT_TYPE, content_type)
            )
        return parse_json_object(self.raw_body)


def _compile(pattern):
    regex = "^" + _SEGMENT.sub(r"(?P<\1>[^/]+)", pattern) + "$"
    return re.compile(regex)


class Router:
    """Exact and ``{param}`` path routes, grouped by path so 405 can list Allow."""

    def __init__(self):
        self._routes = []

    def add(self, method, pattern, handler):
        for entry in self._routes:
            if entry["pattern"] == pattern:
                entry["handlers"][method.upper()] = handler
                return
        self._routes.append(
            {
                "pattern": pattern,
                "regex": _compile(pattern),
                "handlers": {method.upper(): handler},
            }
        )

    def resolve(self, method, path):
        """Return ``(handler, params)``, or raise ``NotFound`` / ``MethodNotAllowed``."""
        for entry in self._routes:
            match = entry["regex"].match(path)
            if match is None:
                continue
            handlers = entry["handlers"]
            handler = handlers.get(method.upper())
            if handler is None:
                raise MethodNotAllowed(
                    sorted(handlers),
                    "%s is not supported on %s" % (method.upper(), path),
                )
            return handler, match.groupdict()
        raise NotFound("no route for %s" % (path,))


def health(request):
    return 200, {"status": "ok"}


class HtmlResponse:
    def __init__(self, body):
        self.body = body.encode("utf-8")


INDEX_HTML = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pocketful accounts</title><style>
:root{font:16px system-ui,sans-serif;color:#172033;background:#f5f7fb}body{margin:0}main{max-width: sixtyrem;max-width:60rem;margin:auto;padding:2rem 1rem}section{background:#fff;border:1px solid #dce2ee;border-radius:12px;padding:1rem;margin:1rem 0;box-shadow:0 2px 8px #17203312}h1{margin-top:0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem}label{display:grid;gap:.35rem;font-weight:600}input,button{font:inherit;padding:.65rem;border:1px solid #aeb8cc;border-radius:7px}button{background:#2457d6;color:white;border:0;cursor:pointer}button:focus,input:focus{outline:3px solid #9bb7ff;outline-offset:2px}.muted{color:#5f6b82}.error{color:#a3122d}.status{min-height:1.5rem}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:.5rem;border-bottom:1px solid #e5e9f1}
</style></head><body><main><h1>Pocketful</h1><p class="muted">Accounts and transfers in minor units.</p>
<section><h2>Accounts</h2><p id="account-status" class="status" aria-live="polite">Loading accounts…</p><div id="accounts" class="grid"></div>
<form id="account-form" class="grid"><label>Name<input name="name" required maxlength="64"></label><label>Opening balance<input name="opening_balance" type="number" min="0" step="1" required></label><button>Create account</button></form></section>
<section><h2>Transfer</h2><form id="transfer-form" class="grid"><label>From<select name="source_id" required></select></label><label>To<select name="destination_id" required></select></label><label>Amount<input name="amount" type="number" min="1" step="1" required></label><button>Send transfer</button></form><p id="transfer-status" class="status" aria-live="polite"></p></section>
<section><h2>History</h2><p id="history-status" class="status muted">Choose an account to view transfers.</p><table><thead><tr><th>Transfer</th><th>Amount</th><th>Status</th></tr></thead><tbody id="history"></tbody></table></section>
</main><script>
const $=s=>document.querySelector(s), accounts=$('#accounts'), status=$('#account-status'), source=$('[name=source_id]'), destination=$('[name=destination_id]');
async function api(url,options){const r=await fetch(url,options);const data=await r.json();if(!r.ok)throw Error(data.detail||data.error||'Request failed');return data}
function render(list){accounts.innerHTML=list.length?list.map(a=>`<article><strong>${a.name}</strong><div>${a.balance} minor units</div></article>`).join(''):'<p class="muted">No accounts yet.</p>';[source,destination].forEach(s=>s.innerHTML=list.map(a=>`<option value="${a.id}">${a.name}</option>`).join(''))}
async function load(){status.textContent='Loading accounts…';try{const data=await api('/accounts');render(data.accounts);status.textContent=data.accounts.length?'':'No accounts yet.'}catch(e){status.textContent=e.message;status.className='status error'}}
$('#account-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);status.textContent='Creating…';try{await api('/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:f.get('name'),opening_balance:Number(f.get('opening_balance'))})});e.target.reset();await load()}catch(x){status.textContent=x.message;status.className='status error'}};
$('#transfer-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);$('#transfer-status').textContent='Sending…';try{await api('/transfers',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({source_id:f.get('source_id'),destination_id:f.get('destination_id'),amount:Number(f.get('amount'))})});$('#transfer-status').textContent='Transfer complete';await load()}catch(x){$('#transfer-status').textContent=x.message;$('#transfer-status').className='status error'}};load();
</script></body></html>"""


def build_router(ledger=None):
    """The product router. Tests add their own probe routes on top of it."""
    router = Router()
    router.add("GET", "/healthz", health)
    if ledger is None:
        return router

    router.add("GET", "/", lambda _request: (200, HtmlResponse(INDEX_HTML)))

    def account_create(request):
        body = request.json()
        if "name" not in body:
            raise InvalidRequest("'name' is required")
        return 201, ledger.create_account(body["name"], require_integer(body, "opening_balance"))

    def accounts(_request):
        return 200, {"accounts": ledger.accounts()}

    def account_get(request):
        return 200, ledger.account(request.params["id"])

    def transfer_create(request):
        key = request.headers.get("Idempotency-Key", "")
        if not key:
            raise MissingIdempotencyKey("Idempotency-Key is required")
        if len(key) > 128:
            raise InvalidRequest("Idempotency-Key must be 1-128 characters")
        body = request.json()
        source_id = body.get("source_id")
        destination_id = body.get("destination_id")
        if not isinstance(source_id, str) or not isinstance(destination_id, str):
            raise InvalidRequest("source_id and destination_id are required strings")
        if source_id == destination_id:
            raise InvalidRequest("source_id and destination_id must differ")
        amount = require_integer(body, "amount")
        if amount < 1:
            raise InvalidRequest("'amount' must be positive")
        return 201, ledger.transfer(source_id, destination_id, amount, key)

    def transfer_get(request):
        return 200, ledger.get_transfer(request.params["id"])

    def transfer_history(request):
        values = request.query.get("account_id", [])
        if len(values) != 1 or not values[0]:
            raise InvalidRequest("account_id is required")
        try:
            uuid.UUID(values[0])
        except (ValueError, AttributeError):
            raise InvalidRequest("account_id must be a UUID") from None
        return 200, {"transfers": ledger.history(values[0])}

    router.add("POST", "/accounts", account_create)
    router.add("GET", "/accounts", accounts)
    router.add("GET", "/accounts/{id}", account_get)
    router.add("POST", "/transfers", transfer_create)
    router.add("GET", "/transfers/{id}", transfer_get)
    router.add("GET", "/transfers", transfer_history)
    return router


class JsonHandler(BaseHTTPRequestHandler):
    """Turns raw HTTP into :class:`Request` objects and JSON responses."""

    protocol_version = "HTTP/1.1"
server_version = "neighbor-cart-stage1"
    sys_version = ""

    def log_message(self, fmt, *args):  # pragma: no cover - quiet by design
        pass

    def handle_one_request(self):
        """Apply an absolute deadline in addition to the socket idle timeout."""
        finished = threading.Event()
        expired = threading.Event()

        def close_expired_request():
            if finished.is_set():
                return
            expired.set()
            self.close_connection = True
            try:
                self.connection.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass

        timer = threading.Timer(
            self.server.request_deadline, close_expired_request
        )
        timer.daemon = True
        timer.start()
        try:
            super().handle_one_request()
        except (OSError, ValueError):
            if not expired.is_set():
                raise
            self.close_connection = True
        finally:
            finished.set()
            timer.cancel()

    def _read_body(self):
        raw_length = self.headers.get("Content-Length")
        if raw_length is None:
            return b""
        try:
            length = int(raw_length)
        except ValueError:
            raise InvalidRequest("Content-Length is not an integer") from None
        if length < 0:
            raise InvalidRequest("Content-Length is negative")
        if length > MAX_BODY_BYTES:
            raise InvalidRequest("request body is too large")
        try:
            return self.rfile.read(length)
        except TimeoutError:
            # A buffered socket must not be reused after a read timeout.
            self.close_connection = True
            raise RequestTimeout("request body timed out") from None

    def _respond(self, status, payload, extra_headers=()):
        if isinstance(payload, HtmlResponse):
            body = payload.body
            content_type = "text/html; charset=utf-8"
        else:
            body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
            content_type = JSON_CONTENT_TYPE
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        for name, value in extra_headers:
            self.send_header(name, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _respond_error(self, status, payload, extra_headers=()):
        """An error may arrive before the body was read, so the connection ends."""
        headers = list(extra_headers) + [("Connection", "close")]
        self._respond(status, payload, headers)

    def _dispatch(self, method):
        parts = urlsplit(self.path)
        try:
            handler, params = self.server.router.resolve(method, parts.path)
            request = Request(
                method=method,
                path=parts.path,
                params=params,
                query=parse_qs(parts.query, keep_blank_values=True),
                headers=self.headers,
                raw_body=self._read_body(),
            )
            status, payload = handler(request)
        except MethodNotAllowed as exc:
            self._respond_error(
                exc.status, exc.body(), [("Allow", ", ".join(exc.allowed))]
            )
        except ApiError as exc:
            self._respond_error(exc.status, exc.body())
        except Exception:  # pragma: no cover - last resort, never a silent 200
            self.log_error("unhandled error on %s %s", method, self.path)
            self._respond_error(500, {"error": "internal_error"})
        else:
            self._respond(status, payload)

    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")

    def do_PUT(self):
        self._dispatch("PUT")

    def do_PATCH(self):
        self._dispatch("PATCH")

    def do_DELETE(self):
        self._dispatch("DELETE")

    def do_HEAD(self):
        self._dispatch("GET")


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(
        self,
        address,
        router,
        request_timeout=REQUEST_TIMEOUT_SECONDS,
        request_deadline=REQUEST_DEADLINE_SECONDS,
        max_concurrent_connections=MAX_CONCURRENT_CONNECTIONS,
    ):
        if request_timeout <= 0:
            raise ValueError("request_timeout must be positive")
        if request_deadline <= 0:
            raise ValueError("request_deadline must be positive")
        if max_concurrent_connections < 1:
            raise ValueError("max_concurrent_connections must be positive")
        self.router = router
        self.request_timeout = request_timeout
        self.request_deadline = request_deadline
        self._connection_slots = threading.BoundedSemaphore(max_concurrent_connections)
        super().__init__(address, JsonHandler)

    def get_request(self):
        request, client_address = super().get_request()
        # This happens before BaseHTTPRequestHandler reads a request line or
        # headers, so it protects every stage of HTTP request parsing.
        request.settimeout(self.request_timeout)
        return request, client_address

    def process_request(self, request, client_address):
        if not self._connection_slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self._connection_slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._connection_slots.release()


def make_server(
    host="0.0.0.0",
    port=8080,
    router=None,
    ledger=None,
    *,
    request_timeout=REQUEST_TIMEOUT_SECONDS,
    request_deadline=REQUEST_DEADLINE_SECONDS,
    max_concurrent_connections=MAX_CONCURRENT_CONNECTIONS,
):
    return Server(
        (host, port),
        router if router is not None else build_router(ledger),
        request_timeout=request_timeout,
        request_deadline=request_deadline,
        max_concurrent_connections=max_concurrent_connections,
    )

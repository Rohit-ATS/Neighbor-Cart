# Neighbor Cart

Food support that stays with you. Neighbor Cart connects individuals and families to verified local food banks, community pantries, free hot meal kitchens, and 24/7 community fridges—complete with interactive maps, live inventory tracking, operating hours, directions, and dignified pickup reservations.

## Features

- **Official Landing Page**: David Le's signature design featuring the interactive 3D perspective Cart with groceries launching out of the basket, dignity-first trust messaging, and clear community calls-to-action.
- **Places & Interactive Map (`/places`)**:
  - **Live Map**: Real Leaflet map powered by OpenStreetMap tiles with custom emoji pins for each category (🥫 Food Banks, 🧺 Pantries, 🍲 Hot Meals, 🧊 Community Fridges).
  - **Verified Community Locations**: Real street addresses, GPS coordinates, phone numbers, websites, directions, and high-resolution photo galleries.
  - **Live Operating Status**: Real-time status indicators (e.g. *Open now · Closes at 4:30 PM* / *Open 24/7* / *Closed today*) plus full 7-day weekly schedule tables.
  - **Real-Time Inventory Tracker**: Categorized view of available fresh produce, protein & dairy, shelf-stable canned goods, baby supplies, and dietary-specific items with stock levels (High, Moderate, Limited).
  - **Dignified Pickup Reservations**: Privacy-first booking flow (select pickup date, time window, household size, dietary requirements, and curbside loading) generating an instant, printable/downloadable digital Pickup Pass with confirmation code and barcode preview. Zero ID or paperwork required.
  - **Smart Filtering & Search**: Instant search by place name, street address, neighborhood, ZIP code, or food item, with toggles for "Open Right Now" and "Accepts Free Reservations".
- **AI Navigator Chat (sidebar → "Ask HarvestLink AI")**: A full chat section of the workspace rather than a modal, so a conversation survives opening a place beside it. The composer rests as a single line and springs open on focus, carrying suggested prompts; it settles back only while still empty, so a half-written question is never thrown away. Every answer that names places draws its own mini map, ranks the matches nearest-first, and lets the person choose one — the choice becomes a turn in the conversation instead of ending it. Requirements shared across several messages are remembered for the session and shown in a strip the person can clear.

## Getting Started

### Development
```bash
npm install
npm run seed:places
npm run dev:api # terminal 1: local SQLite API on :8080
npm run dev     # terminal 2: Vite frontend on :5173
```

The Vite development server proxies `/api` requests to the local API. The
SQLite file is created at `data/neighbor-cart.db` and is intentionally ignored
by Git. Reset the local demo by stopping the API and deleting that file.

### Local API

The API is dependency-free Python 3.12 + SQLite and is designed around an
anonymous, device-scoped pickup pass instead of an account or ID requirement.

- `GET /api/v1/locations` — search/filter the seeded demo locations
- `GET /api/v1/locations/:id` — location details and inventory snapshot
- `GET /api/v1/locations/:id/availability?date=YYYY-MM-DD` — remaining capacity for each pickup window
- `POST /api/v1/sessions` — issue a private, anonymous device session (the web client does this automatically)
- `POST /api/v1/reservations` — create an idempotent pickup pass
- `GET /api/v1/reservations` — passes for the current anonymous device
- `POST /api/v1/ai/chat` — the navigator's grounded answer, restricted to verified catalog IDs
- `POST /api/v1/places/enrich` — Google ratings, reviews, and travel time for a set of places

#### Google Maps Platform (optional)

Set `GOOGLE_MAPS_API_KEY` in the API's environment to switch on Google ratings,
recent reviews, and real driving/transit times in the navigator's mini map. The
key is read only by the Python API and never reaches the browser; enable the
**Places API** and **Distance Matrix API** on it. Responses are cached in
process (6h for place details, 30m for distances) to keep billing down.

Without the key, `/api/v1/places/enrich` still answers with `provider: "none"`
and the UI falls back to straight-line distance and no reviews, so nothing
breaks before the key is issued.

Each reservable window has a default capacity of 12 passes per day. A future
data source can override it with a positive integer `slotCapacity` on a place.
The reservation write uses a SQLite transaction, so concurrent requests cannot
overbook a window. Sessions are server-issued, expire after 30 days, and may
create one pass per device per pickup day; pickup dates are limited to the next
30 days. The API also bounds HTTP workers and request-body reads, and the AI
route is session-gated, rate-limited, and capped at two simultaneous Bedrock
calls. Run its integration suite with `npm run test:api`.

For a direct deployment, rate limits use the TCP peer address. Behind a reverse
proxy, set `NEIGHBOR_CART_TRUSTED_PROXY_ADDRESSES` to a comma-separated allowlist
of proxy addresses only after confirming that proxy replaces `X-Forwarded-For`.
Untrusted forwarding headers are ignored by default.

### Production Build
```bash
npm run build
npm run preview
```

### GitHub Pages

Pushing to `main` publishes the static React build through GitHub Actions at
`https://Rohit-ATS.github.io/Neighbor-Cart/`. GitHub Pages cannot run the
Python/SQLite API, so locations retain their checked-in demo snapshot there,
while live reservations, AI navigation, and place enrichment require a
separately deployed API.

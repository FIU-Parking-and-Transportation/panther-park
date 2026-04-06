# Panther Park

Panther Park is Florida International University's parking analytics platform.
The system provides real-time parking occupancy tracking, license plate
recognition (LPR) integration, and digital signage for campus parking management.

## Quick Start

```bash
# Install dependencies
bun install


# Start dev server
bun run dev

# Type-check (no test suite — this is the only automated validation)
bun run check
```

## Project Structure

```
src/
  app.d.ts                    # SvelteKit App namespace
  app.html                    # HTML shell
  hooks.server.ts             # Request timing middleware
  lib/
    assets/                   # SVG icons / favicon
    components/
      occupancy-radial.svelte # Radial occupancy chart widget
      signage/                # Digital signage components
      ui/                     # shadcn-svelte primitives (card, chart, …)
    s3.ts                     # Bun S3Client wrapper + image upload helper
    utils.ts                  # cn() utility, type helpers
  routes/
    +layout.svelte            # Root layout
    +page.svelte              # Dashboard home page
    layout.css                # Global Tailwind theme + CSS custom properties
    api/
      [...slugs]/+server.ts   # All API routes (single Elysia app)
    signage/
      large/+page.svelte      # Large-format digital sign display
      small/[slug]/+page.svelte
```

## API

All REST endpoints are served under `/api/v1` by an Elysia app mounted in
`src/routes/api/[...slugs]/+server.ts`. Interactive OpenAPI docs are available
at `/api/v1/swagger`.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/v1/facilities` | Public | List parking facilities |
| GET | `/api/v1/facilities/locations` | Public | Facility GeoJSON locations |
| GET | `/api/v1/facilities/occupancy` | Public | Current occupancy counts |
| POST | `/api/v1/facilities/occupancy` | Bearer | Ingest legacy occupancy export |
| POST | `/api/v1/lpr/read` | Bearer | Record a fixed-camera LPR plate read |
| POST | `/api/v1/db/operations` | Bearer | Seed database (dev/admin) |

Protected routes require a `Authorization: Bearer <DB_OPERATIONS_TOKEN>` header.

## Technologies

| Layer | Technology |
|---|---|
| Framework | SvelteKit 2 + Svelte 5 (runes) |
| Runtime | Bun + `svelte-adapter-bun` |
| API | Elysia 1.x + TypeBox + `@elysiajs/openapi` |
| Database | PostgreSQL + PostGIS (Bun native `sql`) |
| Styling | Tailwind CSS v4 (Vite plugin) |
| UI | shadcn-svelte + layerchart |
| Language | TypeScript 5 strict mode |

## Database Schema

- **`parking_facility`** — garages and lots with geospatial coordinates
- **`parking_occupancy_history`** — historical occupancy snapshots
- **`lpr_read`** — fixed-camera license plate reads with S3 image URLs
- **`patroller_read`** — mobile patroller LPR captures
- **`digital_sign`** — digital signage units with location and config
- **`v_parking_facility_occupancy`** — materialized view for current occupancy

PostGIS is required. Run `POST /api/v1/db/operations` with `{"action": "seedDatabase"}`,
then `{"action": "seedFacilities"}` to populate initial FIU facilities.

## Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DB_OPERATIONS_TOKEN` | Yes | Bearer token for protected API routes |
| `LOG_LEVEL` | No | `"verbose"` or `"debug"` |
| `S3_ACCESS_KEY_ID` | Yes (LPR) | AWS / S3-compatible key |
| `S3_SECRET_ACCESS_KEY` | Yes (LPR) | AWS / S3-compatible secret |
| `S3_BUCKET` | Yes (LPR) | S3 bucket for LPR images |
| `S3_REGION` | No | Default: `us-east-1` |
| `S3_ENDPOINT` | No | Custom endpoint (MinIO, etc.) |

# Panther Park

Panther Park is Florida International University's parking analytics platform.
The system provides real-time parking occupancy tracking, license plate
recognition (LPR) integration, and data-driven insights for campus parking
management.

## Project Structure

```
src/
├── routes/
│   ├── db/operations/
│   │   ├── data.remote.ts      # Database operations and queries
│   │   └── +page.svelte        # Database management UI
│   ├── signage/
│   │   └── +page.svelte        # Digital signage templates
│   ├── +layout.svelte          # Root layout
│   └── +page.svelte            # Home page
├── hooks.server.ts             # Server-side middleware
└── routes/layout.css           # Global styles
```

## Technologies Used

### Framework & Build

- SvelteKit 2 with Svelte 5: Full-stack web framework
- Vite 7.3.1: Build tool and dev server
- Bun: Runtime and package manager (via `svelte-adapter-bun`)
- valibot: Schema validation
- TypeScript

### UI

- shadcn-svelte
- Tailwind CSS, tw-animate-css

### Database

- PostgreSQL with PostGIS: Geospatial database
- Bun SQL: Native SQL queries with TypeScript support

### Data Visualization

- layerchart 2.0.0: Charting library for analytics

## Database Schema

### Tables

- parking_facility: Parking garage and lot information with geospatial data
- parking_occupancy_history: Historical occupancy records
- lpr_read: License plate recognition captures from fixed cameras
- patroller_read: Mobile patroller LPR captures

### Key Features

- Geospatial queries using PostGIS for nearest facility lookups
- JSONB columns for flexible occupancy tracking (student/employee splits)
- Automatic entry/exit counting via camera name pattern matching
- Automated digital signage for real-time alerts and parking information

## TODO

- [ ] Migrate signage templates
- [ ] Implement S3 for LPR captures
- [ ] Build admin dashboard
- [ ] Add authentication with OIDC

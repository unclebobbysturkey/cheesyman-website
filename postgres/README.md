# postgres

PostgreSQL 16 database for cheesyman.com. Stores motor racing schedule data.

## Schema

| Table | Description |
|---|---|
| `series` | Racing series (name, slug, accent color, logo URL) |
| `tracks` | Track details (name, city, state, country, surface, type, size) |
| `events` | Individual race events linked to a series and track |

The `slug` column on `series` is the URL identifier used by the API (e.g. `usac-sprint`).

## Init

`init.sql` runs automatically on first container startup (empty volume only). It creates the schema and seeds the initial season data. It will not re-run if the `postgres_data` volume already exists.

## Connection

The database binds to `127.0.0.1:5432` on the host — accessible locally but not exposed externally. Credentials are set via environment variables in the root `.env` file.

# cbb_main_app

Node.js/Express service that returns college basketball team data for cheesyman.com. Runs on **port 3003**.

## Endpoint

### `GET /cbb_api/:schoolName`

Returns team info, current season record, logo, and full schedule for a given school.

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `:schoolName` | path | Yes | — | Full school name (e.g. `Duke`) |
| `year` | query | No | `2026` | Season year |

**Example:** `GET /cbb_api/Duke?year=2026`

**Response shape:**
```json
{
  "team": { ... },
  "currentRecord": "18-5",
  "logo": "https://...",
  "games": [ ... ]
}
```

## Data Sources

- [api.collegebasketballdata.com](https://api.collegebasketballdata.com) — team info and schedule data
- [api.collegefootballdata.com](https://api.collegefootballdata.com) — team logos (the CBB API does not provide them; the same bearer token works for both)

Requires the `TOKEN` environment variable set in a `.env` file.

## Running

```bash
# Docker (via compose.yaml in parent directory)
docker compose up -d --build cbb_main_app

# Local
npm install
node collegebasketballapi.js
```

# cfb_main_app (prod)

Node.js/Express service that returns college football team data for cheesyman.com. Runs on **port 3001**.

## Endpoint

### `GET /cfb_api/:schoolName`

Returns team info, current season record, AP/Coaches Poll rankings, and full schedule for a given FBS school.

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `:schoolName` | path | Yes | — | Full school name (e.g. `Michigan`) |
| `year` | query | No | `2025` | Season year |

**Example:** `GET /cfb_api/Michigan?year=2025`

**Response shape:**
```json
{
  "team": { ... },
  "currentRecord": "8-4",
  "currentRank": { "CoachesRank": 12, "APTop25Rank": null },
  "games": [ ... ]
}
```

## Data Source

[api.collegefootballdata.com](https://api.collegefootballdata.com) — requires a bearer token set via the `TOKEN` environment variable in a `.env` file (see `.env.example`).

## Running

```bash
# Docker (via compose.yaml in parent directory)
docker compose up -d --build cfb_main_app

# Local
npm install
node collegefootballapi.js
```

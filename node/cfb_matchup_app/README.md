# cfb_matchup_app (prod)

Node.js/Express service that returns college football game details and historical head-to-head matchup data for cheesyman.com. Runs on **port 3002**.

## Endpoint

### `GET /matchup_api/:gameId`

Returns box score stats, line scores, venue, team logos, and all-time series record between two teams for a specific game.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `:gameId` | path | Yes | CFB Data API game ID |
| `team1` | query | Yes | Home or away team name (e.g. `Ohio State`) |
| `team2` | query | Yes | Opposing team name |
| `year` | query | Yes | Season year |

**Example:** `GET /matchup_api/401628335?team1=Ohio%20State&team2=Michigan&year=2024`

**Response shape:**
```json
{
  "matchupHistory": { "gamesPlayed": 120, "team1wins": 60, "team2wins": 58, "ties": 2, "firstgame": 1897 },
  "currentSeason": 2024,
  "gameCompleted": true,
  "homeTeam": "Ohio State",
  "homeTeamLogo": "https://...",
  "homeLineScores": [ ... ],
  "homeTeamStats": [ ... ],
  "awayTeam": "Michigan",
  "awayTeamLogo": "https://...",
  "awayLineScores": [ ... ],
  "awayTeamStats": [ ... ],
  "venue": "Ohio Stadium"
}
```

## Data Source

[api.collegefootballdata.com](https://api.collegefootballdata.com) — requires a bearer token set via the `TOKEN` environment variable in a `.env` file (see `.env.example`).

## Running

```bash
# Docker (via compose.yaml in parent directory)
docker compose up -d --build cfb_matchup_app

# Local
npm install
node collegefootballmatchup.js
```

# cheesyman.com

Source code for [cheesyman.com](https://cheesyman.com) — a personal site with college sports stats, racing schedules, and cheese.

## Stack

- **Nginx** — reverse proxy, SSL termination, and static file server
- **Node.js/Express** — four microservices providing sports data APIs
- **PostgreSQL** — stores racing schedule data
- **Docker Compose** — orchestrates all services

## Services

| Service | Route Prefix | Description |
|---|---|---|
| `cfb_main_app` | `/cfb_api/` | College football team info, schedules, and rankings |
| `cfb_matchup_app` | `/matchup_api/` | CFB head-to-head matchup history and box scores |
| `cbb_main_app` | `/cbb_api/` | College basketball team info and schedules |
| `race_schedule_app` | `/raceschedule/` | Motor racing schedules from a Postgres database |

## Running

```bash
docker compose up -d
```

Each service requires a `.env` file with API credentials and configuration. See the README in each service directory for details.

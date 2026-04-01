# race_schedule_app

Node.js/Express service that returns motor racing schedules from the PostgreSQL database. Runs on **port 3004**.

## Endpoint

### `GET /raceschedule/:slug`

Returns all events for a racing series, plus series metadata (name, accent color, logo).

| Parameter | Type | Required | Description |
|---|---|---|---|
| `:slug` | path | Yes | Series identifier (e.g. `usac-sprint`, `nascar-cup`) |

**Example:** `GET /raceschedule/usac-sprint`

**Response shape:**
```json
{
  "series": {
    "name": "USAC Sprint Car",
    "slug": "usac-sprint",
    "color_accent": "#ff5722",
    "logo_url": "https://..."
  },
  "events": [
    {
      "event_date": "2026-04-05",
      "event_name": "Some Race",
      "event_time": "7:30 PM",
      "track_name": "Eldora Speedway",
      "city": "New Weston",
      "state": "OH",
      "surface": "D",
      "size": "0.5"
    }
  ]
}
```

Returns `404` if the slug does not exist.

## Additional Scripts

These run via cron on the server — they are not part of the Express server process.

| Script | Schedule | Description |
|---|---|---|
| `daily_preview_email.js` | Daily | Emails today's race events plus a random cheese image |
| `weekly_preview_email.js` | Every Monday | Emails the full week's race events across all series |

Both scripts use `mail.js` (nodemailer transporter) and connect directly to Postgres using the same environment variables as the main server.

## Running

```bash
# Docker (via compose.yaml in parent directory)
docker compose up -d --build race_schedule_app

# Local
npm install
node raceschedule.js
```

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (3004) |
| `DB_HOST` | Postgres host |
| `DB_PORT` | Postgres port |
| `DB_NAME` | Database name |
| `DB_USER` | Database user |
| `DB_PASSWORD` | Database password |
| `GMAIL_USER` | Gmail address for outbound email |
| `GMAIL_APP_PWD` | Gmail App Password (16-character) |
| `EMAIL_TO` | Primary recipient for scheduled emails |
| `EMAIL_BCC` | BCC recipients (comma-separated) |

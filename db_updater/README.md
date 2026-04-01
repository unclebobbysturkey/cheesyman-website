# db_updater

PowerShell script that syncs motor racing schedule data from [thesportsdb.com](https://www.thesportsdb.com) into the `racing_schedule_db` Postgres database. Runs on the host machine (not inside Docker).

## What It Does

For each configured racing series, the script:
1. Fetches the current season's schedule from the TheSportsDB API
2. Queries the local Postgres database for the same series
3. Compares event times and dates between the two
4. Updates any rows in the DB where the time or date has changed

It does **not** insert new events — only updates existing ones matched by `external_event_id`.

## Series Covered

| Series | TheSportsDB ID |
|---|---|
| Formula 1 | 4370 |
| IndyCar | 4373 |
| NASCAR Cup | 4393 |
| IMSA | 4488 |

F1 results are filtered to Grand Prix and Sprint events only (practice and qualifying are excluded).

## Requirements

- PowerShell
- [SimplySql](https://www.powershellgallery.com/packages/SimplySql) module

```powershell
Install-Module -Name SimplySql
```

- A `.race-secrets` file in the `db_updater/` directory (excluded from source control). This file is dot-sourced by `Read-Secrets.ps1` and must set the following environment variables:

| Variable | Description |
|---|---|
| `POSTGRES_DB` | Database name |
| `DB_PORT` | Postgres port (default `5432`) |
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |
| `X_API_KEY` | TheSportsDB API key |

## Running

```powershell
.\Update-RaceDB.ps1
```

The script connects to Postgres on `localhost` using the port defined in `.race-secrets`. The database must be running (via Docker Compose) before the script is executed.

## Logging

All activity is appended to `db_updater.log` in the same directory. The log is excluded from source control.

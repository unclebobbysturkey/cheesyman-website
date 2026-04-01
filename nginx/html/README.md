# nginx/html

Static HTML files served directly by Nginx. All pages are self-contained (HTML + inline CSS + inline JS with no build step).

## Site Structure

```
cheesyhome.html          Home page
├── surprisecheese.html  Random cheese image from the Azure photo library
├── gallery.html         Paginated cheese photo gallery
└── sports.html          Sports hub
    ├── collegefootball.html     CFB team search + featured teams
    │   ├── team.html            CFB team detail — schedule, record, rankings
    │   │   └── footballmatchup.html  Game detail — box score, line scores, series history
    │   └── potfb.html           Special page for a specific rival
    ├── collegebasketball.html   CBB team search + featured teams
    │   └── cbbteam.html         CBB team detail — schedule and record
    └── racing.html              Racing hub — links to series schedules
        └── raceschedule.html    Full season schedule for a given racing series
```

## Pages

| File | Description |
|---|---|
| `cheesyhome.html` | Home page — entry point for the site |
| `sports.html` | Sports hub — links to CFB, CBB, and Racing sections |
| `collegefootball.html` | CFB team search; links to featured teams; navigates to `team.html` |
| `team.html` | CFB team detail page; reads `?team=` and `?year=` from URL; calls `/cfb_api/` |
| `footballmatchup.html` | CFB game detail; reads `?gameId=`, `?team1=`, `?team2=`, `?year=` from URL; calls `/matchup_api/` |
| `potfb.html` | Dedicated page for a specific CFB rival |
| `collegebasketball.html` | CBB team search; links to featured teams; navigates to `cbbteam.html` |
| `cbbteam.html` | CBB team detail page; reads `?team=` and `?year=` from URL; calls `/cbb_api/` |
| `racing.html` | Racing hub — links to each series schedule by slug |
| `raceschedule.html` | Season schedule for a racing series; reads `?series=` from URL; calls `/raceschedule/` |
| `gallery.html` | Paginated cheese photo gallery; reads from `cheese-images.js` |
| `surprisecheese.html` | Displays a random cheese photo; reads from `cheese-images.js` |
| `dailycheese.html` | Today's cheese display page |
| `underconstruction.html` | Placeholder for sections not yet live |
| `index_maintenance.html` | Maintenance mode page |

## API Calls by Page

| Page | API Route |
|---|---|
| `team.html` | `GET /cfb_api/:schoolName?year=` |
| `footballmatchup.html` | `GET /matchup_api/:gameId?team1=&team2=&year=` |
| `cbbteam.html` | `GET /cbb_api/:schoolName?year=` |
| `raceschedule.html` | `GET /raceschedule/:slug` |

## Static Assets

`cheese-images.js` — exports an `images` array of photo URLs used by `gallery.html`, `surprisecheese.html`, and the daily email script. It is also volume-mounted into the `race_schedule_app` container for use by `daily_preview_email.js`.

// Calcio (soccer) backend API for cheesyman.com
// Serves league list, teams by league, and team details from thesportsdb.com v2 API.
// Page flow: sports.html → leagues.html → league_teams.html → league_team.html
// Routes: GET /calcio_api/leagues, /calcio_api/teams/:leagueId, /calcio_api/team/:teamId,
//         /calcio_api/schedule/next/:teamId, /calcio_api/schedule/last/:teamId
// Port: 3009

require('dotenv').config();

const express = require('express');
const app = express();
const port = process.env.PORT || 3009;

const apiKey = process.env.X_API_KEY;
const baseAPI = 'https://www.thesportsdb.com/api/v2/json';

// Curated list of soccer leagues with their thesportsdb IDs.
const LEAGUES = [
    { idLeague: '4328', strLeague: 'English Premier League', flag: '\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F' },
    { idLeague: '4335', strLeague: 'Spanish La Liga', flag: '\uD83C\uDDEA\uD83C\uDDF8' },
    { idLeague: '4332', strLeague: 'Italian Serie A', flag: '\uD83C\uDDEE\uD83C\uDDF9' },
    { idLeague: '4331', strLeague: 'German Bundesliga', flag: '\uD83C\uDDE9\uD83C\uDDEA' },
    { idLeague: '4334', strLeague: 'French Ligue 1', flag: '\uD83C\uDDEB\uD83C\uDDF7' },
    { idLeague: '4346', strLeague: 'Major League Soccer', flag: '\uD83C\uDDFA\uD83C\uDDF8' },
    { idLeague: '4350', strLeague: 'Mexican Primera League', flag: '\uD83C\uDDF2\uD83C\uDDFD' },
    { idLeague: '4344', strLeague: 'Portuguese Primeira Liga', flag: '\uD83C\uDDF5\uD83C\uDDF9' },
    { idLeague: '4337', strLeague: 'Dutch Eredivisie', flag: '\uD83C\uDDF3\uD83C\uDDF1' },
    { idLeague: '4480', strLeague: 'UEFA Champions League', flag: '\uD83C\uDDEA\uD83C\uDDFA' }
];

// Returns the curated leagues list.
app.get('/calcio_api/leagues', (req, res) => {
    res.json(LEAGUES);
});

// Fetches all teams in a league from thesportsdb, sorted alphabetically by team name.
app.get('/calcio_api/teams/:leagueId', async (req, res) => {
    const { leagueId } = req.params;

    try {
        const response = await fetch(`${baseAPI}/list/teams/${leagueId}`, {
            method: 'GET',
            headers: { 'X-API-KEY': apiKey }
        });

        if (!response.ok) {
            throw new Error(`thesportsdb API error: ${response.status}`);
        }

        const data = await response.json();
        const teams = data.list || [];

        teams.sort((a, b) => a.strTeam.localeCompare(b.strTeam));

        res.json(teams);
    } catch (error) {
        console.error(`Error fetching teams for league ${leagueId}:`, error);
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
});

// Fetches detailed info for a single team from thesportsdb.
app.get('/calcio_api/team/:teamId', async (req, res) => {
    const { teamId } = req.params;

    try {
        const response = await fetch(`${baseAPI}/lookup/team/${teamId}`, {
            method: 'GET',
            headers: { 'X-API-KEY': apiKey }
        });

        if (!response.ok) {
            throw new Error(`thesportsdb API error: ${response.status}`);
        }

        const data = await response.json();
        const team = data.lookup ? data.lookup[0] : null;

        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }

        res.json(team);
    } catch (error) {
        console.error(`Error fetching team ${teamId}:`, error);
        res.status(500).json({ error: 'Failed to fetch team details' });
    }
});

// Fetches the next upcoming events for a team from thesportsdb.
app.get('/calcio_api/schedule/next/:teamId', async (req, res) => {
    const { teamId } = req.params;

    try {
        const response = await fetch(`${baseAPI}/schedule/next/team/${teamId}`, {
            method: 'GET',
            headers: { 'X-API-KEY': apiKey }
        });

        if (!response.ok) {
            throw new Error(`thesportsdb API error: ${response.status}`);
        }

        const data = await response.json();
        res.json(data.schedule || []);
    } catch (error) {
        console.error(`Error fetching next events for team ${teamId}:`, error);
        res.status(500).json({ error: 'Failed to fetch upcoming schedule' });
    }
});

// Fetches the last completed events for a team from thesportsdb.
app.get('/calcio_api/schedule/last/:teamId', async (req, res) => {
    const { teamId } = req.params;

    try {
        const response = await fetch(`${baseAPI}/schedule/previous/team/${teamId}`, {
            method: 'GET',
            headers: { 'X-API-KEY': apiKey }
        });

        if (!response.ok) {
            throw new Error(`thesportsdb API error: ${response.status}`);
        }

        const data = await response.json();
        res.json(data.schedule || []);
    } catch (error) {
        console.error(`Error fetching last events for team ${teamId}:`, error);
        res.status(500).json({ error: 'Failed to fetch recent results' });
    }
});

app.listen(port, () => {
    console.log(`Calcio API server is running on port ${port}`);
});

// CBB backend for cheesyman.com
// Serves team info, schedule, record, and logo for a given school.
// Route: GET /cbb_api/:schoolName?year=
// Port: 3003

// alllow use of .env file
require('dotenv').config();

const express = require('express');
const app = express();
const port = 3003;

// Bearer token for api.collegefootballdata.com. Replace if expired.
const token = process.env.TOKEN;
const baseAPI = process.env.URL;

// Fetches team info for the given school from the CBB API.
async function getTeamData(schoolName) {

    try {
        const response = await fetch(`${baseAPI}/teams`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`FAILED to call API: ${response.status}`)
        }

        const teams = await response.json();
        // Case-insensitive match on school name
        const team = teams.find(team =>
            team.school.toLowerCase() === schoolName.toLowerCase());
            // team.alternateNames?.some(alternateName =>
                // alternateName.toLowerCase() === schoolName.toLowerCase()
            // ) --> Possible addition to help check against alt names too. Need to test more.

        if (!team) {
            console.error(`Unable to find data on ${schoolName}.`); // send to JSON as well
            return null;
        }

        return team;

    } catch(error) {
        console.error(`Error encounted running getTeamData function`, error); // send to JSON as well
    }
}

// Fetches the game schedule for the given school and season year.
// Returns the games array (with formatted dates attached) and the current W-L record.
async function getScheduleData(schoolName, year) {

    const school = schoolName.toLowerCase();

    try {
        // Note: CBB API uses 'season' as the year param, unlike CFB which uses 'year'
        const response = await fetch(`${baseAPI}/games?team=${school}&season=${year}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`API call FAILED: ${response.status}`);
        }

        const games = await response.json();

        if (!games || games.length === 0) {
            console.error(`No games found for ${school}` );
            return null;
        }

        // Attach formatted date/time fields to each game object for easier front-end rendering
        games.forEach(game => {
            const dateTime = getGameDateTime(game);
            game.formatedDate = dateTime.date;
            game.formatedTime = dateTime.time;
            game.formatedDateTime = dateTime.fullDateTime;
        });
        return {
            games: games,
            record: getRecord(games, schoolName)
        };

    } catch (error) {
        console.error('There was an problem with API. See: ', error); // add to JSON
    }

}

// The CBB API doesn't provide team logos, so we cross-call the CFB API to fetch them.
// The same bearer token is valid for both APIs.
async function getTeamLogo(schoolName) {
    let teamLogo;
    const response = await fetch(`https://api.collegefootballdata.com/teams/fbs`, {
        method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
    });
    if (!response) {
        teamLogo = null;
        return teamLogo;
    }
    const teams = await response.json();
    const team = teams.find(team =>
        team.school.toLowerCase() === schoolName.toLowerCase()
    );
    if(!team) {
        teamLogo = null;
        return teamLogo;
    }
    teamLogo = team.logos[0];
    console.log(teamLogo);
    return teamLogo;

}

// Calculates wins and losses from the games array.
// CBB API uses a homeWinner boolean (true = home team won, false = away team won),
// unlike CFB which determines the winner by comparing homePoints vs awayPoints.
// Only counts games where homeWinner is not null — skips unplayed games.
function getRecord(games, schoolName) {

    let wins = 0;
    let losses = 0;

    games.forEach(game => {
        if (game.homeWinner != null) {
        const winner = game.homeWinner ? game.homeTeam : game.awayTeam;
        if (winner.toLowerCase() === schoolName.toLowerCase()) {
            wins = wins + 1;
        } else {
            losses = losses +1;
        }
    }});

    return `${wins}-${losses}`;
}

// Converts the game's UTC startDate to a local EST date and time string.
// The -14400000 ms offset is -4 hours, shifting UTC to EST.
// CBB API can return either 12:00 AM or 01:00 AM when no tip-off time is set —
// both are treated as TBD. When TBD, we also subtract one full day (86400000 ms)
// to correct the date: the UTC→EST shift can push a timeless game into the wrong calendar day.
function getGameDateTime(game) {

    const utcDate = new Date(game.startDate);
    const localDate = new Date(utcDate.getTime() - (14400000)); // -4 hours → EST

    let gameDate = localDate.toLocaleDateString();
    let gameTime = localDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    if (['12:00 AM', '01:00 AM'].includes(gameTime)) {
        gameTime = 'TBD';
        // Shift the date back one day to undo the UTC offset pushing it forward
        const correctedDate = new Date(localDate.getTime() - 86400000);
        gameDate = correctedDate.toLocaleDateString();
    }

    return {
        date: gameDate,
        time: gameTime,
        fullDateTime: `${gameDate} @ ${gameTime}`
    };
}

// Main route — assembles team info, schedule, record, and logo into a single JSON response.
app.get('/cbb_api/:schoolName', async (req, res) => {
    const schoolName = req.params.schoolName;
    const year = req.query.year || 2026;

    const team = await getTeamData(schoolName);
    const scheduleData = await getScheduleData(schoolName, year);  // ← This returns {games, record}
    const teamLogo = await getTeamLogo(schoolName);
    res.json({ // building the JSON
        team: team,
        currentRecord: scheduleData.record,     // ← Get record from scheduleData
        logo: teamLogo,
        games: scheduleData.games      // ← Get games from scheduleData

    });
});
app.listen(port, () => {
    console.log(`API server is running on port ${port}`);
});

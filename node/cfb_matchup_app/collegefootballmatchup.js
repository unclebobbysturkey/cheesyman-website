// CFB matchup backend for cheesyman.com
// Takes a gameId (from the schedule) plus team1/team2 names and returns:
//   - historical head-to-head matchup record
//   - box score stats (if the game has been played)
//   - per-quarter line scores and venue
//   - team logos
// Route: GET /matchup_api/:gameId?team1=&team2=&year=
// Port: 3002

// all for use of .env file
require('dotenv').config();
// express setup
const express = require('express');
const app = express();
const port = 3002;

// Bearer token for api.collegefootballdata.com. Replace if expired.
const token = process.env.TOKEN;
const baseAPI = process.env.URL;

// Fetches all-time head-to-head history between two teams.
// Calculates total gamesPlayed as wins + losses + ties — the API doesn't return this directly.
// Also pulls the season year of the first ever recorded matchup.
async function getMatchupHistory(team1, team2) {
    let matchupHistory;
    const response = await fetch(`${baseAPI}/teams/matchup?team1=${team1}&team2=${team2}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if(!response.ok) {
        console.error(`CRITICAL ERROR!!!! Issue fetching MatchupHistory`)
    }

    const rawMatchupHistory = await response.json();

    if (!rawMatchupHistory) {
        matchupHistory= null;
        return matchupHistory
    }

    matchupHistory = {
        team1: team1,
        team2: team2,
        gamesPlayed: rawMatchupHistory.team1Wins + rawMatchupHistory.team2Wins + rawMatchupHistory.ties, // derived — not provided directly by API
        team1wins: rawMatchupHistory.team1Wins,
        team2wins: rawMatchupHistory.team2Wins,
        ties: rawMatchupHistory.ties,
        firstgame: rawMatchupHistory.games[0].season // year of the first recorded matchup
    }

    return matchupHistory;

}

// Fetches team-level box score stats for a specific game.
// Returns null stats if the game hasn't been played yet (API returns an empty array).
// The API returns home and away as entries in an array; we split them out by the homeAway field.
async function getBoxScore(gameId) {

    const response = await fetch(`${baseAPI}/games/teams?id=${gameId}`, {
        method: 'GET',
        headers: {
            'Authorization' : `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if(!response.ok) {
        console.error(`CRITICAL ERROR!!!! Issue fetchin BoxScore`);
    }

    let gameData = await response.json();

    // Empty array means the game hasn't been played or stats aren't available yet
    if (gameData.length === 0) {

        return gameData = {
        homeTeamStats: null,
        awayTeamStats: null
    };
    }

    const awayTeamStats = gameData[0].teams.find(team =>
            team.homeAway === 'away'
        );
    const homeTeamStats = gameData[0].teams.find(team =>
        team.homeAway === 'home'
    );

    gameData = {
        homeTeamStats: homeTeamStats.stats,
        awayTeamStats: awayTeamStats.stats
    }
    return gameData;
}

// Fetches team logos from the /teams endpoint using a case-insensitive school name match.
async function getLogos(team1, team2) {
    try {
        const response = await fetch(`${baseAPI}/teams`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
            }
        });

        if(!response.ok) {
            throw new Error(`API ERROR --> ${response.status}`);
        }

        const teams = await response.json();
        const team1Data = teams.find(team =>
            team.school.toLowerCase() === team1.toLowerCase()
        );
        const team2Data = teams.find(team =>
            team.school.toLowerCase() === team2.toLowerCase()
        );

        if (!team1 || !team2) {
            throw new Error(`Issue finding one of the teams. Verify team spelled correctly`);
        }

        const teamLogos = {
            team1: team1Data.school,
            team1URL: team1Data.logos[0],
            team2: team2Data.school,
            team2URL: team2Data.logos[0]
        }

        return teamLogos;

    } catch (error) {
        console.error(`CRITIAL ERROR! SEE DETAILS: ${error}`);
    }
}

// Fetches team1's full schedule for the year, then finds the specific game by gameId.
// We use this endpoint (rather than the box score endpoint) because it includes
// per-quarter line scores and the venue, which aren't available in the box score response.
async function getLineScores(team1, gameId, year) {

    try {
        const response = await fetch(`${baseAPI}/games?year=${year}&team=${team1}`, {
            method: 'GET',
            headers: {
                'Authorization' : `Bearer ${token}`,
                'Content-Type' : 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API Call Error --> ${response.status}`);
        }

        const games = await response.json();

        if (!games) {
            throw new Error(`No games found!!!`)
        }

        // Find the specific game within the full schedule by matching the gameId
        const game = games.find(game =>
            game.id == gameId
        );

        if (!game) {
            throw new Error(`No game found for supplied gameId: ${gameId}`);
        }

        const lineScores = {
            season: game.season,
            gameCompleted: game.completed,
            homeTeam: game.homeTeam,
            homeLineScores: game.homeLineScores,
            awayTeam: game.awayTeam,
            awayLineScores: game.awayLineScores,
            venue: game.venue
        };

        return lineScores;

    } catch (error) {
        console.error(error);
    }
}

// Main route — assembles matchup history, box score, line scores, and logos into one response.
app.get('/matchup_api/:gameId', async (req, res) => {
    const gameId = req.params.gameId;
    const team1 = req.query.team1;
    const team2 = req.query.team2;
    const year = req.query.year;

    if (!team1 || !team2) {
        return res.status(400).json({ error: 'team1 and team2 query parameters are required' });
    }

    const matchupHistory = await getMatchupHistory(team1, team2);
    const gameStats = await getBoxScore(gameId);
    const teamLogos = await getLogos(team1, team2);
    const lineScores = await getLineScores(team1, gameId, year);

    res.json({
        matchupHistory: matchupHistory,
        currentSeason: lineScores.season,
        gameCompleted: lineScores.gameCompleted,
        homeTeam: lineScores.homeTeam,
        // Logo assignment: team1/team2 from the query may not match the home/away order in the game data.
        // Compare school names to determine which logo URL belongs to which side.
        homeTeamLogo: teamLogos.team1.toLowerCase() === lineScores.homeTeam.toLowerCase() ? teamLogos.team1URL : teamLogos.team2URL,
        homeLineScores: lineScores.homeLineScores,
        homeTeamStats: gameStats.homeTeamStats,
        awayTeam: lineScores.awayTeam,
        awayTeamLogo: teamLogos.team1.toLowerCase() === lineScores.awayTeam.toLowerCase() ? teamLogos.team1URL : teamLogos.team2URL,
        awayLineScores: lineScores.awayLineScores,
        awayTeamStats: gameStats.awayTeamStats,
        venue: lineScores.venue
    })
});

app.listen(port, () => {
    console.log(`API server is running on port ${port}`);
});

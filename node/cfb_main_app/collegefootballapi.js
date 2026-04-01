// CFB backend API for cheesyman.com
// Serves team info, schedule, record, and rankings for a given school.
// Page flow: sports.html → collegefootball.html → team.html
// Route: GET /cfb_api/:schoolName?year=
// Port: 3001

// alllow use of .env file
require('dotenv').config();

const express = require('express');
const app = express();
const port = 3001;

// Bearer token for api.collegefootballdata.com. Replace if expired.
const token = process.env.TOKEN;
const baseAPI = process.env.URL;

// Fetches team info for the given school. Augments the team object with
// current head coach and playing surface before returning it.
async function getTeamData(schoolName) {

    try {
        // /teams returns all FBS teams — no filter params, so we search client-side
        const response = await fetch(`${baseAPI}/teams`, {
            method: 'GET',
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
            console.error(`Unable to find data on ${schoolName}.`);
            return null;
        }

        // Looks up the current head coach by checking if they have a season entry
        // matching the current year. If not found, decrements to the previous year
        // and tries once more — handles the off-season gap before new coaches are listed.
        async function getCoach(team) {
            let year = new Date().getFullYear();
            const response = await fetch(`${baseAPI}/coaches?team=${team.school}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const coachData = await response.json();
            let currentCoach = 'N/A'
            if(coachData.length === 0) return currentCoach;

            // Outer loop runs up to twice: first for current year, then last year (x=1).
            // Needed because the API may not list a new coach yet early in the off-season.
            for (let x = 0; x < 2; x ++) {
                for (const coach of coachData) {
                    for (const season of coach.seasons) {
                        if (season.year === year) {
                            currentCoach = coach;
                            return currentCoach
                        }
                    }
                }
                year = year - 1; // fall back to previous year and retry
            }

            // No match after two attempts — return N/A
            return currentCoach
        }

        // Converts the API's boolean `grass` field into a readable string.
        // grass: true → 'Grass', false → 'Turf', null → 'N/A'
        function getPlayingSurface(team) {
            let surface;
            if (team.location.grass != null){
                surface = team.location.grass ? 'Grass' : 'Turf';
            } else {
                surface = 'N/A';
            };
            return surface;
        }

        currentCoach = await getCoach(team);
        if (currentCoach === 'N/A') {
            team.coachFirstName = 'N/A';
            team.coachLastName = 'N/A';
        } else {
            team.coachFirstName = currentCoach.firstName;
            team.coachLastName = currentCoach.lastName;
        }
        team.playingSurface = getPlayingSurface(team); // calling the function, adding to team object
        return team;

    } catch(error) {
        console.error(`Error encounted running getTeamData function`, error);
    }
}

// Fetches the game schedule for the given school and year.
// Returns the games array (with formatted dates attached) and the current W-L record.
async function getScheduleData(schoolName, year) {

    const school = schoolName.toLowerCase();

    try {
        const response = await fetch(`${baseAPI}/games?year=${year}&team=${school}`, {
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
        return { // this returns object
            games: games,
            record: getRecord(games, schoolName)
        };

    } catch (error) {
        console.error('There was an problem with API. See: ', error);
    }

}

// Fetches the most recent AP Top 25 and Coaches Poll rankings for the given year,
// then checks whether the team appears in each poll.
async function getRanking (team, year) {
    const teamId = team.id; // use team id to identify the team in rankings

    try {
        const response = await fetch(`${baseAPI}/rankings?year=${year}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
        });

        if (!response.ok){
            throw new Error(`ERROR with getRanking: ${response.status}`);
        }

        const allRankings = await response.json();

        // The API returns one entry per poll week — grab the last element for the most recent week
        const rankings = allRankings[allRankings.length - 1];

        // Searches a specific poll (e.g. 'AP Top 25') for the team's rank.
        // Returns the rank number, or null if the team isn't ranked in that poll.
        function getPollRank (desiredPoll) {

            const pollRankings = rankings.polls.find (poll =>
                poll.poll.toLowerCase() === desiredPoll.toLowerCase()
            );

            let rankData = pollRankings.ranks.find(rank =>
                rank.teamId === teamId
            );

            if (!rankData) {
                rankData = null;
                return rankData;
            }

            return rankData.rank;
        }
        const coachesRank = getPollRank('Coaches Poll');
        const aptop25Rank = getPollRank('AP Top 25');

        return {
            CoachesRank: coachesRank,
            APTop25Rank: aptop25Rank
        };

    } catch (error) {
        console.error('ERORR!!!--> ', error);
    }

}

// Calculates wins and losses from the games array.
// Only counts games where homePoints is not null — skips games that haven't been played yet.
function getRecord(games, schoolName) {

    let wins = 0;
    let losses = 0;

    games.forEach(game => {
        if (game.homePoints != null) {
        const winner = (game.homePoints > game.awayPoints) ? game.homeTeam : game.awayTeam;
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
// If the time comes back as 12:00 AM, the API had no kickoff time set — display TBD instead.
function getGameDateTime(game) {

    const utcDate = new Date(game.startDate);
    const localDate = new Date(utcDate.getTime() - (14400000)); // -4 hours → EST

    let gameDate = localDate.toLocaleDateString();
    let gameTime = localDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    if (gameTime === '12:00 AM') {
        gameTime = 'TBD';
    }

    return {
        date: gameDate,
        time: gameTime,
        fullDateTime: `${gameDate} @ ${gameTime}`
    };
}

// Main route — assembles team info, schedule, record, and rankings into a single JSON response.
app.get('/cfb_api/:schoolName', async (req, res) => {
    const schoolName = req.params.schoolName;
    const year = req.query.year || 2025;

    const team = await getTeamData(schoolName);
    const scheduleData = await getScheduleData(schoolName, year);  // ← This returns {games, record}
    const currentRank = await getRanking(team, year);

    res.json({
        team: team,
        currentRecord: scheduleData.record,
        currentRank: currentRank,
        games: scheduleData.games

    });
});

app.listen(port, () => {
    console.log(`API server is running on port ${port}`);
});

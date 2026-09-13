// Rankings backend for cheesyman.com
// Serves poll rankings for CFB and CBB.
// Route: GET /rankings_api/rankings?sport=cfb&year=2026&week=3
// Port: 3008

require('dotenv').config();

const express = require('express');
const app = express();
const port = 3008;

const token = process.env.TOKEN;

const SPORT_CONFIG = {
    cfb: { baseURL: 'https://api.collegefootballdata.com' },
    cbb: { baseURL: 'https://api.collegebasketballdata.com' }
};

app.get('/rankings_api/rankings', async (req, res) => {
    const sport = req.query.sport || 'cfb';
    const year = req.query.year || new Date().getFullYear();
    const week = req.query.week;

    const config = SPORT_CONFIG[sport];
    if (!config) {
        return res.status(400).json({ error: `Unknown sport: ${sport}` });
    }

    let url = `${config.baseURL}/rankings?year=${year}`;
    if (week) url += `&week=${week}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Rankings API error:', error);
        res.status(500).json({ error: 'Failed to fetch rankings' });
    }
});

app.listen(port, () => {
    console.log(`Rankings API server running on port ${port}`);
});

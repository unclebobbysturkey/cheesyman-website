// raceschedule.js
//├── express setup
//├── pg pool connection
//└── route(s) i.e what is fetched from frontend HTML
//    ├── listen for fetch from HTML page
//    ├── extract slug from request
//    ├── query db with slug
//    └── return JSON

// all for use of .env file
require('dotenv').config();

// setup express
const express = require('express');
const app = express();
const port = process.env.PORT;

// setup db connection...

const { Pool } = require('pg');

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

// test the connection on startup. Check docker logs for details if there are failures
pool.connect((err, _, release) => { // passes variables in order, _ is there as a placeholder for client which is not needed. 
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Successfully connected to Postgres');
        release();
    }
});

//main route. comes from the raceschedule.html
app.get('/raceschedule/:slug', async (req, res) => {
    try { // build the query below. $1 will be translated as the slug value. 
        const eventsquery = `
            SELECT
                e.event_date,
                e.event_date_end,
                e.event_name,
                e.event_time,
                e.external_event_id,
                t.surface,
                t.type,
                t.name AS track_name,
                t.city,
                t.state,
                t.country,  
                t.size
            FROM events e
            JOIN series s ON e.series_id = s.id
            LEFT JOIN tracks t ON e.track_id = t.id
            WHERE s.slug = $1
            ORDER BY e.event_date ASC
        `;
        // adding this query to grab the logo URL and color_accent
        const seriesquery = ` 
            SELECT
                name,
                slug,
                color_accent,
                logo_url
            FROM series
            WHERE slug=$1
            `;

        // this will run both queries in parallel (Promise)
        const [eventsResult, seriesResult] = await Promise.all([
            pool.query(eventsquery, [req.params.slug]),
            pool.query(seriesquery, [req.params.slug])]);

        // return 404 if the slug doesn't exist in the DB
        if (!seriesResult.rows[0]) {
            return res.status(404).json({ error: 'Series not found' });
        }

        // return series and events results together
        res.json({
            series: seriesResult.rows[0],
            events: eventsResult.rows
        });

    } catch (err) { // catch any errors with our query. return 500 error with 'Database error'
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.listen(port, () => {
    console.log(`API server is running on port ${port}`);
});
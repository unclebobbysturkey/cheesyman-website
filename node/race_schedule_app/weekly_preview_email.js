// this script will run every monday via cron. 
// it will grab all events for the week from each series from the DB.
// then will email it to the list of users in the .env file

require('dotenv').config(); // dotenv file
const transporter = require('./mail'); // import mail.js
const { Pool } = require('pg'); // import postgres module, place as an object Pool

const pool = new Pool({ // setup the connection variables for the db
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

pool.connect((err, _, release) => { // test the DB connection
    if (err) {
        console.error(`Unable to connect to DB ${process.env.DB_NAME}: ${err.message}`);
    } else {
        console.log(`Succesfully connected to DB ${process.env.DB_NAME}`);
        release();
    }
});

async function getSeries() { // get series will grab all the series slugs and names.
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT slug, name FROM series');
        return result.rows;  // fix #3: return inside try, where result is in scope
    } catch (err) {
        console.error(`Error querying database ${process.env.DB_NAME}:`, err.message);
        throw err; // terminates script. Would be logged in the Docker logs. 
    } finally {
        client.release();
        console.log(`Released connection to ${process.env.DB_NAME}`);
    }
}

// grabs the schedule date (start to end dates) for the specic series slug
async function getWeeklySchedule (slug, start_date, end_date) { 
    const client = await pool.connect();
    // SQL query. Grabs all events for series s that start on or after start_date but not after end_date
    const query = `
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
            AND e.event_date >= $2
            AND e.event_date <= $3
        ORDER BY e.event_date ASC`
    try {
        const result = await client.query(query, [slug, start_date, end_date]); 
        return result.rows
    } catch (err) {
        console.error(`Error connecting/querying database ${process.env.DB_NAME}:`, err.message);
    } finally {
        client.release();
        console.log(`Released connection to ${process.env.DB_NAME}`);
    }
}

async function sendWeeklyPreview() {
    // Date range: today (Monday) through Sunday
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sunday = new Date(today);
    sunday.setDate(today.getDate() + 6); // back to 6 for prod

    const start_date = today.toISOString().split('T')[0];   // YYYY-MM-DD
    const end_date = sunday.toISOString().split('T')[0];

    const seriesList = await getSeries();

    let htmlBody = `
        <h2 style="font-family:sans-serif;">Racing Schedule Preview</h2>
        <p style="font-family:sans-serif;">${start_date} &ndash; ${end_date}</p>
        <hr>
    `;

    for (const { slug, name } of seriesList) {
        const events = await getWeeklySchedule(slug, start_date, end_date);

        htmlBody += `<h3 style="font-family:sans-serif;">${name}</h3>`;

        if (!events || events.length === 0) {
            htmlBody += `<p style="font-family:sans-serif;"><em>No events this week.</em></p>`;
        } else {
            htmlBody += `
            <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; font-family:sans-serif; font-size:14px;">
                <thead style="background-color:#f2f2f2;">
                    <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Event</th>
                        <th>Track</th>
                        <th>Location</th>
                        <th>Type</th>
                    </tr>
                </thead>
                <tbody>`;

            for (const e of events) {
                const date = e.event_date
                    ? new Date(e.event_date).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
                    : '&mdash;';
                const time = e.event_time || '&mdash;';
                const eventName = e.event_name || '&mdash;';
                const track = e.track_name || '&mdash;';
                const location = [e.city, e.state, e.country].filter(Boolean).join(', ') || '&mdash;';
                const type = e.type || '&mdash;';

                htmlBody += `
                    <tr>
                        <td>${date}</td>
                        <td>${time}</td>
                        <td>${eventName}</td>
                        <td>${track}</td>
                        <td>${location}</td>
                        <td>${type}</td>
                    </tr>`;
            }

            htmlBody += `</tbody></table>`;
        }

        htmlBody += `<br>`;
    }

    const mailOptions = {
        from: 'cheesyman.mail@gmail.com',
        to: process.env.EMAIL_TO,
        bcc: process.env.EMAIL_BCC,     // comma-separated string in .env
        subject: `Weekly Racing Preview: ${start_date} – ${end_date}`,
        html: htmlBody
    };

    await transporter.sendMail(mailOptions);
    console.log(`Weekly preview email sent for ${start_date} – ${end_date}`);
}

sendDailyPreview()
                .then(() => pool.end())
                .catch(err => {
                    console.error('Error sending weekly schedule email:', err.message);
                    pool.end();
                    process.exit(1);
                });
